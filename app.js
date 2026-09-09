/* =========================================================
   INSET 2026 ATTENDANCE SYSTEM
   app.js
   ========================================================= */


/* =========================================================
   CONFIGURATION
   ========================================================= */

const API_URL =
  "https://script.google.com/macros/s/AKfycbxtBRiR3XOLpidV5aaL0Im9emBZvJ_wsEi1CqABGV5-g0jIcZ0Ji7TqNOccygIlIflF3w/exec";

const EVENT_START = "2026-09-09";
const EVENT_END = "2026-09-11";

const LICENSE_STORAGE_KEY = "inset_license";
const PENDING_QR_TOKEN_KEY = "inset_pending_qr_token";


/* =========================================================
   GLOBAL VARIABLES
   ========================================================= */

let scanner = null;
let scannerRunning = false;
let scannerProcessing = false;

let currentParticipant = null;
let generatedQR = null;


/* =========================================================
   PAGE NAVIGATION
   ========================================================= */

function showPage(pageId) {

  const pages = document.querySelectorAll(".page");

  pages.forEach(page => {
    page.classList.remove("active");
  });

  const target = document.getElementById(pageId);

  if (target) {
    target.classList.add("active");
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


/* =========================================================
   HOME
   ========================================================= */

function showHome() {

  stopScanner();

  scannerProcessing = false;

  showPage("homePage");
}


/* =========================================================
   START ATTENDANCE
   =========================================================
   IMPORTANT:
   The scanner opens immediately.

   If a saved license exists:
      scan -> attendance

   If no saved license exists:
      scan -> registration
   ========================================================= */

async function startAttendance() {

  scannerProcessing = false;

  /*
   * A new attendance session starts here.
   * Remove any abandoned pending token from a previous session.
   */
  localStorage.removeItem(PENDING_QR_TOKEN_KEY);

  const savedLicense =
    localStorage.getItem(LICENSE_STORAGE_KEY);

  if (savedLicense) {

    currentParticipant = {
      licenseNo: savedLicense
    };

  } else {

    currentParticipant = null;
  }

  showPage("scannerPage");

  const status =
    document.getElementById("scannerStatus");

  if (status) {
    status.innerHTML =
      "📷 <strong>Ready to scan</strong><br>" +
      "Point your camera at the INSET 2026 QR code.";
  }

  await startScanner();
}


/* =========================================================
   REGISTRATION
   =========================================================
   Direct REGISTER button.

   Since this is a direct registration,
   remove an old pending QR token.
   ========================================================= */

function openRegistration() {

  localStorage.removeItem(PENDING_QR_TOKEN_KEY);

  openRegistrationPage(false);
}


/* =========================================================
   INTERNAL REGISTRATION PAGE
   ========================================================= */

function openRegistrationPage(clearPending = false) {

  if (clearPending) {
    localStorage.removeItem(PENDING_QR_TOKEN_KEY);
  }

  stopScanner();

  const note =
    document.getElementById("registrationNote");

  if (note) {
    note.innerHTML =
      "Please enter your information to continue.";
  }

  const license =
    localStorage.getItem(LICENSE_STORAGE_KEY);

  const licenseInput =
    document.getElementById("registrationLicense");

  /*
   * If we already know the license, show it.
   */
  if (license && licenseInput && !licenseInput.value) {
    licenseInput.value = license;
  }

  showPage("registrationPage");
}


/* =========================================================
   COMPATIBILITY ALIAS
   =========================================================
   Some older versions of index.html used identifyUser().
   Keep it available so nothing breaks.
   ========================================================= */

function identifyUser() {

  openRegistration();
}


/* =========================================================
   REGISTRATION SUBMISSION
   ========================================================= */

async function registerUser() {

  const firstName =
    document.getElementById("firstName")?.value.trim() || "";

  const middleName =
    document.getElementById("middleName")?.value.trim() || "";

  const lastName =
    document.getElementById("lastName")?.value.trim() || "";

  const licenseNo =
    document.getElementById("registrationLicense")?.value.trim() || "";


  /* -------------------------------------------------------
     VALIDATION
     ------------------------------------------------------- */

  if (!firstName) {
    showRegistrationMessage("Please enter your First Name.");
    return;
  }

  if (!lastName) {
    showRegistrationMessage("Please enter your Last Name.");
    return;
  }

  if (!licenseNo) {
    showRegistrationMessage("Please enter your License No.");
    return;
  }


  showLoading(
    true,
    "Registering participant..."
  );


  try {

    const result = await apiCall(
      "registerParticipant",
      {
        firstName: firstName,
        middleName: middleName,
        lastName: lastName,
        licenseNo: licenseNo
      }
    );


    if (!result.success) {

      showLoading(false);

      showRegistrationMessage(
        result.message || "Registration failed."
      );

      return;
    }


    /*
     * Registration successful.
     */
    localStorage.setItem(
      LICENSE_STORAGE_KEY,
      licenseNo
    );

    currentParticipant = {
      firstName: firstName,
      middleName: middleName,
      lastName: lastName,
      licenseNo: licenseNo
    };


    /*
     * Check whether registration was triggered
     * by scanning a QR code.
     */
    const pendingToken =
      localStorage.getItem(PENDING_QR_TOKEN_KEY);


    if (pendingToken) {

      /*
       * DO NOT ASK THE USER TO SCAN AGAIN.
       *
       * Use the QR token that was already scanned.
       */
      await recordAttendanceWithToken(
        pendingToken,
        licenseNo
      );

      return;
    }


    /*
     * Normal direct registration.
     *
     * After registration, open scanner.
     */
    showLoading(false);

    showSuccess({
      success: true,
      registrationOnly: true,
      message:
        "Registration successful. You may now scan the attendance QR code."
    });

  } catch (error) {

    console.error(error);

    showLoading(false);

    showRegistrationMessage(
      error.message || "Unable to complete registration."
    );
  }
}


/* =========================================================
   REGISTRATION MESSAGE
   ========================================================= */

function showRegistrationMessage(message) {

  const note =
    document.getElementById("registrationNote");

  if (note) {
    note.innerHTML =
      "⚠️ " + escapeHTML(message);
  }
}


/* =========================================================
   START SCANNER
   ========================================================= */

async function startScanner() {

  if (scannerRunning) {
    return;
  }

  /*
   * Stop an old scanner instance first.
   */
  await stopScanner();


  const reader =
    document.getElementById("reader");

  if (!reader) {
    console.error("QR reader element not found.");
    return;
  }

  reader.innerHTML = "";


  const status =
    document.getElementById("scannerStatus");


  if (status) {
    status.innerHTML =
      "📷 <strong>Starting camera...</strong>";
  }


  try {

    if (
      typeof Html5Qrcode === "undefined"
    ) {

      throw new Error(
        "QR scanner library failed to load."
      );
    }


    scanner =
      new Html5Qrcode("reader");


    const cameras =
      await Html5Qrcode.getCameras();


    if (!cameras || cameras.length === 0) {

      throw new Error(
        "No camera was found on this device."
      );
    }


    /*
     * Prefer rear/environment camera.
     */
    let cameraId =
      cameras[0].id;

    const rearCamera =
      cameras.find(camera =>
        /back|rear|environment/i.test(
          camera.label || ""
        )
      );

    if (rearCamera) {
      cameraId = rearCamera.id;
    }


    await scanner.start(
      cameraId,

      {
        fps: 10,

        qrbox: {
          width: 250,
          height: 250
        },

        aspectRatio: 1.0
      },

      decodedText => {

        processQRCode(decodedText);

      },

      () => {
        /*
         * Ignore normal QR scan failures.
         */
      }
    );


    scannerRunning = true;


    if (status) {

      status.innerHTML =
        "📷 <strong>Camera ready</strong><br>" +
        "Scan the INSET 2026 attendance QR code.";
    }

  } catch (error) {

    console.error(
      "Scanner error:",
      error
    );

    scannerRunning = false;

    scanner = null;

    if (status) {

      status.innerHTML =
        "❌ " +
        escapeHTML(
          error.message ||
          "Unable to access the camera."
        );
    }

  }
}


/* =========================================================
   STOP SCANNER
   ========================================================= */

async function stopScanner() {

  const activeScanner = scanner;

  if (!activeScanner) {

    scannerRunning = false;

    return;
  }


  scanner = null;

  scannerRunning = false;


  try {

    await activeScanner.stop();

  } catch (error) {

    console.warn(
      "Scanner stop warning:",
      error
    );
  }


  try {

    await activeScanner.clear();

  } catch (error) {

    console.warn(
      "Scanner clear warning:",
      error
    );
  }
}


/* =========================================================
   PROCESS QR CODE
   ========================================================= */

async function processQRCode(qrText) {

  /*
   * Prevent multiple reads of the same QR
   * while the server request is processing.
   */
  if (scannerProcessing) {
    return;
  }

  scannerProcessing = true;


  try {

    const token =
      extractQRToken(qrText);


    if (!token) {

      scannerProcessing = false;

      showError(
        "Invalid QR code. Please scan the INSET 2026 attendance QR code."
      );

      return;
    }


    /*
     * Stop camera immediately after successful detection.
     */
    await stopScanner();


    /*
     * Check saved license.
     */
    const savedLicense =
      localStorage.getItem(
        LICENSE_STORAGE_KEY
      );


    if (!savedLicense) {

      /*
       * USER IS NOT REGISTERED.
       *
       * Save the QR token so registration
       * can automatically record this scan.
       */
      localStorage.setItem(
        PENDING_QR_TOKEN_KEY,
        token
      );


      const licenseInput =
        document.getElementById(
          "registrationLicense"
        );

      if (licenseInput) {
        licenseInput.value = "";
      }


      scannerProcessing = false;

      openRegistrationPage(false);

      return;
    }


    /*
     * User is already registered.
     *
     * Record attendance immediately.
     */
    await recordAttendanceWithToken(
      token,
      savedLicense
    );

  } catch (error) {

    console.error(error);

    scannerProcessing = false;

    showError(
      error.message ||
      "Unable to process the QR code."
    );
  }
}


/* =========================================================
   EXTRACT TOKEN FROM QR
   ========================================================= */

function extractQRToken(qrText) {

  if (!qrText) {
    return null;
  }

  const text =
    String(qrText).trim();


  /*
   * QR contains:
   *
   * https://script.google.com/.../exec?token=XXXX
   */
  try {

    const url =
      new URL(text);

    const token =
      url.searchParams.get("token");

    if (token) {
      return token;
    }

  } catch (error) {

    /*
     * Not a URL.
     * Treat it as a raw token below.
     */
  }


  /*
   * Also support raw token QR.
   */
  if (
    text &&
    !text.includes(" ") &&
    text.length >= 10
  ) {
    return text;
  }


  return null;
}


/* =========================================================
   RECORD ATTENDANCE
   ========================================================= */

async function recordAttendanceWithToken(
  token,
  licenseNo
) {

  showLoading(
    true,
    "Recording attendance..."
  );


  try {

    const result =
      await apiCall(
        "recordAttendance",
        {
          token: token,
          licenseNo: licenseNo
        }
      );


    /*
     * Registration is required.
     *
     * The backend may return either
     * registrationRequired:true
     * OR a "register first" message.
     */
    const registrationRequired =
      result &&
      (
        result.registrationRequired === true ||
        /participant not found|register first/i.test(
          result.message || ""
        )
      );


    if (registrationRequired) {

      showLoading(false);


      /*
       * The saved license is no longer valid.
       */
      localStorage.removeItem(
        LICENSE_STORAGE_KEY
      );

      currentParticipant = null;


      /*
       * Preserve the QR token.
       *
       * The user will register and this exact
       * QR scan will be processed automatically.
       */
      localStorage.setItem(
        PENDING_QR_TOKEN_KEY,
        token
      );


      const licenseInput =
        document.getElementById(
          "registrationLicense"
        );

      if (licenseInput) {
        licenseInput.value = "";
      }


      scannerProcessing = false;

      openRegistrationPage(false);

      return;
    }


    /*
     * Attendance successfully recorded.
     */
    if (result.success) {

      localStorage.removeItem(
        PENDING_QR_TOKEN_KEY
      );

      showLoading(false);

      scannerProcessing = false;

      showSuccess(result);

      return;
    }


    /*
     * QR was invalid, expired, already used,
     * wrong date, etc.
     */
    localStorage.removeItem(
      PENDING_QR_TOKEN_KEY
    );

    showLoading(false);

    scannerProcessing = false;

    showError(
      result.message ||
      "Attendance could not be recorded."
    );

  } catch (error) {

    console.error(error);

    showLoading(false);

    scannerProcessing = false;

    showError(
      error.message ||
      "Unable to connect to the attendance server."
    );
  }
}


/* =========================================================
   SUCCESS SCREEN
   ========================================================= */

function showSuccess(result) {

  const details =
    document.getElementById(
      "successDetails"
    );

  const message =
    document.getElementById(
      "successMessage"
    );


  if (message) {

    message.innerHTML =
      escapeHTML(
        result.message ||
        "Attendance recorded successfully."
      );
  }


  if (details) {

    let html = "";


    if (result.mode) {

      html +=
        "<strong>" +
        escapeHTML(
          String(result.mode)
        ) +
        "</strong><br>";
    }


    if (result.date) {

      html +=
        "Date: " +
        escapeHTML(
          formatDisplayDate(result.date)
        ) +
        "<br>";
    }


    if (result.time) {

      html +=
        "Time: " +
        escapeHTML(
          formatDisplayTime(result.time)
        ) +
        "<br>";
    }


    if (
      result.firstName ||
      result.lastName
    ) {

      html +=
        "Participant: " +
        escapeHTML(
          [
            result.firstName,
            result.middleName,
            result.lastName
          ]
          .filter(Boolean)
          .join(" ")
        );
    }


    details.innerHTML = html;
  }


  showPage("successPage");
}


/* =========================================================
   ERROR SCREEN
   ========================================================= */

function showError(message) {

  const errorMessage =
    document.getElementById(
      "errorMessage"
    );


  if (errorMessage) {

    errorMessage.innerHTML =
      escapeHTML(
        message ||
        "Something went wrong."
      );
  }


  showPage("errorPage");
}


/* =========================================================
   API CALL
   ========================================================= */

async function apiCall(
  action,
  data = {}
) {

  const url =
    API_URL +
    "?action=" +
    encodeURIComponent(action) +
    "&data=" +
    encodeURIComponent(
      JSON.stringify(data)
    );


  const response =
    await fetch(
      url,
      {
        method: "GET",
        cache: "no-store"
      }
    );


  if (!response.ok) {

    throw new Error(
      "Server returned HTTP " +
      response.status
    );
  }


  const text =
    await response.text();


  let result;


  try {

    result =
      JSON.parse(text);

  } catch (error) {

    console.error(
      "Invalid server response:",
      text
    );

    throw new Error(
      "Invalid response from the attendance server."
    );
  }


  return result;
}


/* =========================================================
   ADMIN LOGIN
   ========================================================= */

function openAdminLogin() {

  showPage("adminLoginPage");

  setAdminDefaults();
}


/* Compatibility alias */
function showAdminLogin() {

  openAdminLogin();
}


/* =========================================================
   ADMIN LOGIN CHECK
   ========================================================= */

async function checkAdminPassword() {

  const passwordInput =
    document.getElementById(
      "adminPassword"
    );


  if (!passwordInput) {
    return;
  }


  const password =
    passwordInput.value.trim();


  if (!password) {

    showAdminMessage(
      "Please enter the admin password."
    );

    return;
  }


  showLoading(
    true,
    "Checking admin access..."
  );


  try {

    const result =
      await apiCall(
        "adminLogin",
        {
          password: password
        }
      );


    showLoading(false);


    if (!result.success) {

      showAdminMessage(
        result.message ||
        "Invalid admin password."
      );

      return;
    }


    /*
     * Login successful.
     */
    showPage("adminPage");

    setAdminDefaults();

    clearQR();

    loadAttendanceSummary();

  } catch (error) {

    console.error(error);

    showLoading(false);

    showAdminMessage(
      error.message ||
      "Unable to connect to server."
    );
  }
}


/* Compatibility alias */
async function adminLogin(event) {

  if (event) {
    event.preventDefault();
  }

  await checkAdminPassword();
}


/* =========================================================
   ADMIN MESSAGE
   ========================================================= */

function showAdminMessage(message) {

  const passwordInput =
    document.getElementById(
      "adminPassword"
    );


  /*
   * Look for an existing message element.
   */
  let messageElement =
    document.getElementById(
      "adminLoginMessage"
    );


  /*
   * If it does not exist, create one.
   */
  if (!messageElement && passwordInput) {

    messageElement =
      document.createElement("div");

    messageElement.id =
      "adminLoginMessage";

    messageElement.style.marginTop =
      "10px";

    messageElement.style.textAlign =
      "center";

    passwordInput.parentElement.appendChild(
      messageElement
    );
  }


  if (messageElement) {

    messageElement.textContent =
      "⚠️ " + message;
  }
}


/* =========================================================
   ADMIN DEFAULTS
   ========================================================= */

function setAdminDefaults() {

  const dateInput =
    document.getElementById(
      "attendanceDate"
    );


  if (!dateInput) {
    return;
  }


  /*
   * Default to Day 1.
   */
  if (!dateInput.value) {

    dateInput.value =
      EVENT_START;
  }


  updateQRStatus();
}


/* =========================================================
   SELECT QR DAY
   ========================================================= */

function selectQRDay(date) {

  const dateInput =
    document.getElementById(
      "attendanceDate"
    );


  if (!dateInput) {
    return;
  }


  if (
    date < EVENT_START ||
    date > EVENT_END
  ) {

    showQRStatus(
      "Invalid INSET 2026 date."
    );

    return;
  }


  dateInput.value = date;


  /*
   * Clear previous generated QR.
   */
  generatedQR = null;


  const container =
    document.getElementById(
      "qrContainer"
    );

  if (container) {
    container.innerHTML = "";
  }


  const downloadButton =
    document.getElementById(
      "downloadQrButton"
    );

  if (downloadButton) {
    downloadButton.disabled = true;
  }


  updateQRStatus();
}


/* =========================================================
   GENERATE QR
   ========================================================= */

async function generateQR(mode) {

  const dateInput =
    document.getElementById(
      "attendanceDate"
    );


  const attendanceDate =
    dateInput?.value || EVENT_START;


  if (
    attendanceDate < EVENT_START ||
    attendanceDate > EVENT_END
  ) {

    showQRStatus(
      "Please select a valid INSET 2026 date."
    );

    return;
  }


  if (
    mode !== "TIME-IN" &&
    mode !== "TIME-OUT"
  ) {

    showQRStatus(
      "Invalid attendance mode."
    );

    return;
  }


  showLoading(
    true,
    "Generating " + mode + " QR code..."
  );


  showQRStatus(
    "Generating " +
    mode +
    " QR code for " +
    formatDisplayDate(attendanceDate) +
    "..."
  );


  try {

    const result =
      await apiCall(
        "generateQR",
        {
          mode: mode,
          attendanceDate: attendanceDate
        }
      );


    showLoading(false);


    if (!result.success) {

      showQRStatus(
        result.message ||
        "Unable to generate QR code."
      );

      return;
    }


    generatedQR = result;


    await displayQRCode(result);

  } catch (error) {

    console.error(error);

    showLoading(false);

    showQRStatus(
      error.message ||
      "Unable to generate QR code."
    );
  }
}


/* =========================================================
   QR CODE LIBRARY LOADER
   =========================================================
   We dynamically load QRCode.js so the existing
   index.html does not need another manual edit.
   ========================================================= */

function ensureQRCodeLibrary() {

  return new Promise(
    (resolve, reject) => {

      if (
        typeof QRCode !== "undefined"
      ) {

        resolve();

        return;
      }


      const existing =
        document.querySelector(
          'script[data-inset-qrcode="true"]'
        );


      if (existing) {

        existing.addEventListener(
          "load",
          resolve
        );

        existing.addEventListener(
          "error",
          () => reject(
            new Error(
              "QR generator library failed to load."
            )
          )
        );

        return;
      }


      const script =
        document.createElement("script");


      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";


      script.async = true;

      script.dataset.insetQrcode =
        "true";


      script.onload = () => resolve();

      script.onerror = () => {

        reject(
          new Error(
            "Unable to load QR generator library."
          )
        );
      };


      document.head.appendChild(
        script
      );
    }
  );
}


/* =========================================================
   DISPLAY GENERATED QR
   ========================================================= */

async function displayQRCode(result) {

  const container =
    document.getElementById(
      "qrContainer"
    );


  if (!container) {

    throw new Error(
      "QR container was not found."
    );
  }


  const qrUrl =
    result.qrUrl ||
    result.url;


  if (!qrUrl) {

    throw new Error(
      "QR URL was not returned by the server."
    );
  }


  try {

    await ensureQRCodeLibrary();

  } catch (error) {

    showQRStatus(
      error.message
    );

    return;
  }


  container.innerHTML = "";


  /*
   * Create QR image.
   */
  new QRCode(
    container,
    {
      text: qrUrl,

      width: 280,
      height: 280,

      colorDark: "#000000",
      colorLight: "#ffffff",

      correctLevel:
        QRCode.CorrectLevel.H
    }
  );


  /*
   * Give QRCode.js a moment to render.
   */
  await new Promise(
    resolve =>
      setTimeout(resolve, 200)
  );


  const day =
    result.day ||
    getInsetDayNumber(
      result.attendanceDate
    );


  const mode =
    result.mode ||
    "TIME-IN";


  const date =
    result.attendanceDate ||
    result.date;


  const filename =
    "INSET2026_DAY" +
    day +
    "_" +
    mode.replace(
      /[^A-Z0-9-]/gi,
      "-"
    ) +
    "_" +
    date +
    ".png";


  generatedQR = {
    ...result,
    qrUrl: qrUrl,
    filename: filename
  };


  const downloadButton =
    document.getElementById(
      "downloadQrButton"
    );


  if (downloadButton) {

    downloadButton.disabled =
      false;

    downloadButton.textContent =
      "⬇️ DOWNLOAD QR CODE";
  }


  const validityText =
    getQRValidityText(
      result
    );


  showQRStatus(
    "DAY " +
    day +
    " — " +
    mode +
    "<br>" +
    "<strong>" +
    escapeHTML(
      formatDisplayDate(date)
    ) +
    "</strong><br>" +
    validityText
  );
}


/* =========================================================
   DOWNLOAD GENERATED QR
   ========================================================= */

async function downloadGeneratedQR() {

  if (!generatedQR) {

    showQRStatus(
      "Please generate a QR code first."
    );

    return;
  }


  const container =
    document.getElementById(
      "qrContainer"
    );


  if (!container) {
    return;
  }


  let dataUrl = null;


  /*
   * QRCode.js normally creates a canvas
   * and an image.
   */
  const canvas =
    container.querySelector(
      "canvas"
    );


  if (
    canvas &&
    typeof canvas.toDataURL === "function"
  ) {

    dataUrl =
      canvas.toDataURL(
        "image/png"
      );
  }


  /*
   * Fallback to generated image.
   */
  if (!dataUrl) {

    const image =
      container.querySelector(
        "img"
      );


    if (
      image &&
      image.src
    ) {

      dataUrl =
        image.src;
    }
  }


  if (!dataUrl) {

    showQRStatus(
      "QR image is not ready yet. Please try again."
    );

    return;
  }


  const link =
    document.createElement("a");


  link.href =
    dataUrl;


  link.download =
    generatedQR.filename ||
    "INSET2026_QR_CODE.png";


  document.body.appendChild(
    link
  );


  link.click();


  document.body.removeChild(
    link
  );
}


/* =========================================================
   QR STATUS
   ========================================================= */

function showQRStatus(message) {

  const status =
    document.getElementById(
      "qrStatus"
    );


  if (status) {

    status.innerHTML =
      message;
  }
}


/* =========================================================
   UPDATE QR STATUS
   ========================================================= */

function updateQRStatus() {

  const date =
    document.getElementById(
      "attendanceDate"
    )?.value;


  if (!date) {
    return;
  }


  const day =
    getInsetDayNumber(date);


  if (!day) {

    showQRStatus(
      "Select a valid INSET 2026 date."
    );

    return;
  }


  showQRStatus(
    "DAY " +
    day +
    " — " +
    escapeHTML(
      formatDisplayDate(date)
    ) +
    "<br>" +
    "Select TIME-IN or TIME-OUT to generate the QR code.<br>" +
    "<strong>Validity: 24 hours</strong>"
  );
}


/* =========================================================
   QR VALIDITY TEXT
   ========================================================= */

function getQRValidityText(result) {

  /*
   * The backend controls actual validity.
   *
   * We display the configured 24-hour validity
   * here as requested.
   */
  if (
    result.validityHours
  ) {

    return (
      "Valid for " +
      result.validityHours +
      " hours"
    );
  }


  return "Valid for 24 hours";
}


/* =========================================================
   CLEAR QR
   ========================================================= */

function clearQR() {

  generatedQR = null;


  const container =
    document.getElementById(
      "qrContainer"
    );


  if (container) {
    container.innerHTML = "";
  }


  const button =
    document.getElementById(
      "downloadQrButton"
    );


  if (button) {

    button.disabled =
      true;

    button.textContent =
      "⬇️ DOWNLOAD QR CODE";
  }


  updateQRStatus();
}


/* =========================================================
   ATTENDANCE SUMMARY
   ========================================================= */

async function loadAttendanceSummary() {

  const summary =
    document.getElementById(
      "attendanceSummary"
    );


  if (!summary) {
    return;
  }


  summary.innerHTML =
    "Loading attendance summary...";


  try {

    const selectedDate =
      document.getElementById(
        "attendanceDate"
      )?.value || EVENT_START;


    const result =
      await apiCall(
        "getAttendanceSummary",
        {
          selectedDate:
            selectedDate
        }
      );


    if (!result.success) {

      summary.innerHTML =
        escapeHTML(
          result.message ||
          "Unable to load attendance summary."
        );

      return;
    }


    renderAttendanceSummary(
      result,
      summary
    );

  } catch (error) {

    console.error(error);

    summary.innerHTML =
      escapeHTML(
        error.message ||
        "Unable to load attendance summary."
      );
  }
}


/* Compatibility alias */
async function loadAdminSummary() {

  await loadAttendanceSummary();
}


/* =========================================================
   RENDER ATTENDANCE SUMMARY
   ========================================================= */

function renderAttendanceSummary(
  result,
  container
) {

  /*
   * Support several possible backend
   * summary structures.
   */

  if (
    Array.isArray(result.summary)
  ) {

    if (
      result.summary.length === 0
    ) {

      container.innerHTML =
        "<p>No attendance records yet.</p>";

      return;
    }


    let html =
      '<div class="summary-table-wrapper">' +
      "<table>" +
      "<thead>" +
      "<tr>" +
      "<th>NAME</th>" +
      "<th>LICENSE</th>" +
      "<th>TIME IN</th>" +
      "<th>TIME OUT</th>" +
      "</tr>" +
      "</thead>" +
      "<tbody>";


    result.summary.forEach(row => {

      const name =
        [
          row.firstName,
          row.middleName,
          row.lastName
        ]
        .filter(Boolean)
        .join(" ");


      html +=
        "<tr>" +
        "<td>" +
        escapeHTML(name) +
        "</td>" +
        "<td>" +
        escapeHTML(
          row.licenseNo ||
          row.license ||
          ""
        ) +
        "</td>" +
        "<td>" +
        escapeHTML(
          row.timeIn ||
          row.time ||
          ""
        ) +
        "</td>" +
        "<td>" +
        escapeHTML(
          row.timeOut ||
          ""
        ) +
        "</td>" +
        "</tr>";
    });


    html +=
      "</tbody></table></div>";


    container.innerHTML =
      html;

    return;
  }


  /*
   * If backend provides counts.
   */
  const total =
    result.total ??
    result.totalParticipants ??
    0;


  const timeIn =
    result.timeIn ??
    result.timeInCount ??
    0;


  const timeOut =
    result.timeOut ??
    result.timeOutCount ??
    0;


  container.innerHTML =
    "<div>" +
      "<strong>Total:</strong> " +
      escapeHTML(String(total)) +
    "</div>" +

    "<div>" +
      "<strong>TIME-IN:</strong> " +
      escapeHTML(String(timeIn)) +
    "</div>" +

    "<div>" +
      "<strong>TIME-OUT:</strong> " +
      escapeHTML(String(timeOut)) +
    "</div>";
}


/* =========================================================
   DAY NUMBER
   ========================================================= */

function getInsetDayNumber(dateString) {

  const dates = [
    EVENT_START,
    "2026-09-10",
    EVENT_END
  ];


  const index =
    dates.indexOf(dateString);


  if (index === -1) {
    return null;
  }


  return index + 1;
}


/* =========================================================
   DATE FORMATTING
   ========================================================= */

function formatDisplayDate(
  dateString
) {

  if (!dateString) {
    return "";
  }


  /*
   * Handle YYYY-MM-DD without
   * browser timezone shifting.
   */
  const parts =
    String(dateString)
      .split("-");


  if (parts.length === 3) {

    const year =
      Number(parts[0]);

    const month =
      Number(parts[1]);

    const day =
      Number(parts[2]);


    if (
      year &&
      month &&
      day
    ) {

      const date =
        new Date(
          year,
          month - 1,
          day
        );


      return date.toLocaleDateString(
        "en-PH",
        {
          month: "long",
          day: "numeric",
          year: "numeric"
        }
      );
    }
  }


  /*
   * Fallback.
   */
  try {

    return new Date(
      dateString
    ).toLocaleDateString(
      "en-PH",
      {
        month: "long",
        day: "numeric",
        year: "numeric"
      }
    );

  } catch (error) {

    return String(dateString);
  }
}


/* =========================================================
   TIME FORMATTING
   ========================================================= */

function formatDisplayTime(
  timeValue
) {

  if (!timeValue) {
    return "";
  }


  /*
   * If backend already sends a formatted
   * time such as 7:58:34 AM, preserve it.
   */
  if (
    typeof timeValue === "string" &&
    /AM|PM/i.test(timeValue)
  ) {

    return timeValue;
  }


  try {

    const date =
      new Date(timeValue);


    if (!isNaN(date.getTime())) {

      return date.toLocaleTimeString(
        "en-PH",
        {
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
          timeZone: "Asia/Manila"
        }
      );
    }

  } catch (error) {
    // Use original value below.
  }


  return String(timeValue);
}


/* =========================================================
   LOADING OVERLAY
   ========================================================= */

function showLoading(
  show,
  message = "Please wait..."
) {

  const overlay =
    document.getElementById(
      "loadingOverlay"
    );


  if (!overlay) {
    return;
  }


  if (show) {

    overlay.classList.add(
      "active"
    );


    const text =
      overlay.querySelector(
        ".loading-text"
      );


    if (text) {

      text.textContent =
        message;
    }


  } else {

    overlay.classList.remove(
      "active"
    );
  }
}


/* =========================================================
   HTML ESCAPE
   ========================================================= */

function escapeHTML(value) {

  if (
    value === null ||
    value === undefined
  ) {

    return "";
  }


  return String(value)
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}


/* =========================================================
   PAGE LOAD
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    console.log(
      "INSET 2026 Attendance System loaded."
    );


    /*
     * Make sure HOME is displayed.
     */
    const pages =
      document.querySelectorAll(
        ".page"
      );


    let activeFound = false;


    pages.forEach(page => {

      if (
        page.classList.contains(
          "active"
        )
      ) {

        activeFound = true;
      }
    });


    if (!activeFound) {

      const home =
        document.getElementById(
          "homePage"
        );

      if (home) {
        home.classList.add(
          "active"
        );
      }
    }


    /*
     * Set admin defaults if the
     * admin date field already exists.
     */
    setAdminDefaults();
  }
);
