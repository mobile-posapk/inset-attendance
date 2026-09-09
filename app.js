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

const EVENT_DATES = [
  "2026-09-09",
  "2026-09-10",
  "2026-09-11"
];

const LICENSE_STORAGE_KEY =
  "inset_license";

const PENDING_QR_TOKEN_KEY =
  "inset_pending_qr_token";


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

  document
    .querySelectorAll(".page")
    .forEach(page => {

      page.classList.remove(
        "active"
      );

    });


  const page =
    document.getElementById(
      pageId
    );


  if (page) {

    page.classList.add(
      "active"
    );

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
   ========================================================= */

async function startAttendance() {

  scannerProcessing = false;

  /*
   * New scan session.
   */
  localStorage.removeItem(
    PENDING_QR_TOKEN_KEY
  );


  const savedLicense =
    localStorage.getItem(
      LICENSE_STORAGE_KEY
    );


  if (savedLicense) {

    currentParticipant = {
      licenseNo:
        savedLicense
    };

  } else {

    currentParticipant = null;

  }


  showPage("scannerPage");


  const status =
    document.getElementById(
      "scannerStatus"
    );


  if (status) {

    status.innerHTML =
      "📷 <strong>Ready to scan</strong><br>" +
      "Point your camera at the INSET 2026 QR code.";

  }


  await startScanner();
}


/* =========================================================
   OPEN REGISTRATION
   ========================================================= */

function openRegistration() {

  /*
   * Direct registration should not
   * retain an abandoned QR.
   */
  localStorage.removeItem(
    PENDING_QR_TOKEN_KEY
  );


  openRegistrationPage();
}


/* =========================================================
   INTERNAL REGISTRATION PAGE
   ========================================================= */

function openRegistrationPage() {

  stopScanner();


  const note =
    document.getElementById(
      "registrationNote"
    );


  if (note) {

    note.innerHTML =
      "Please enter your information to continue.";

  }


  showPage(
    "registrationPage"
  );
}


/* =========================================================
   COMPATIBILITY
   ========================================================= */

function identifyUser() {

  openRegistration();
}


/* =========================================================
   REGISTER PARTICIPANT
   ========================================================= */

async function registerUser() {

  const firstName =
    document
      .getElementById("firstName")
      ?.value
      .trim() || "";


  const middleName =
    document
      .getElementById("middleName")
      ?.value
      .trim() || "";


  const lastName =
    document
      .getElementById("lastName")
      ?.value
      .trim() || "";


  const licenseNo =
    document
      .getElementById(
        "registrationLicense"
      )
      ?.value
      .trim() || "";


  if (!firstName) {

    showRegistrationMessage(
      "Please enter your First Name."
    );

    return;
  }


  if (!lastName) {

    showRegistrationMessage(
      "Please enter your Last Name."
    );

    return;
  }


  if (!licenseNo) {

    showRegistrationMessage(
      "Please enter your License No."
    );

    return;
  }


  showLoading(
    true,
    "Registering participant..."
  );


  try {

    const result =
      await apiCall(
        "registerParticipant",
        {
          firstName:
            firstName,

          middleName:
            middleName,

          lastName:
            lastName,

          licenseNo:
            licenseNo
        }
      );


    if (!result.success) {

      showLoading(false);

      showRegistrationMessage(
        result.message ||
        "Registration failed."
      );

      return;
    }


    /*
     * Save license locally.
     */
    localStorage.setItem(
      LICENSE_STORAGE_KEY,
      licenseNo
    );


    currentParticipant = {

      firstName:
        firstName,

      middleName:
        middleName,

      lastName:
        lastName,

      licenseNo:
        licenseNo
    };


    /*
     * Check if this registration
     * came from a scanned QR.
     */
    const pendingToken =
      localStorage.getItem(
        PENDING_QR_TOKEN_KEY
      );


    if (pendingToken) {

      await recordAttendanceWithToken(
        pendingToken,
        licenseNo
      );

      return;
    }


    showLoading(false);


    showSuccess({

      success: true,

      registrationOnly:
        true,

      message:
        "Registration successful. You may now scan the attendance QR code."
    });


  } catch (error) {

    console.error(error);

    showLoading(false);

    showRegistrationMessage(
      error.message ||
      "Unable to complete registration."
    );
  }
}


/* =========================================================
   REGISTRATION MESSAGE
   ========================================================= */

function showRegistrationMessage(
  message
) {

  const note =
    document.getElementById(
      "registrationNote"
    );


  if (note) {

    note.innerHTML =
      "⚠️ " +
      escapeHTML(
        message
      );
  }
}


/* =========================================================
   START SCANNER
   ========================================================= */

async function startScanner() {

  if (scannerRunning) {
    return;
  }


  await stopScanner();


  const reader =
    document.getElementById(
      "reader"
    );


  if (!reader) {
    return;
  }


  reader.innerHTML = "";


  const status =
    document.getElementById(
      "scannerStatus"
    );


  if (status) {

    status.innerHTML =
      "📷 <strong>Starting camera...</strong>";
  }


  try {

    if (
      typeof Html5Qrcode ===
      "undefined"
    ) {

      throw new Error(
        "QR scanner library failed to load."
      );
    }


    scanner =
      new Html5Qrcode(
        "reader"
      );


    const cameras =
      await Html5Qrcode
        .getCameras();


    if (
      !cameras ||
      cameras.length === 0
    ) {

      throw new Error(
        "No camera was found on this device."
      );
    }


    let cameraId =
      cameras[0].id;


    const rearCamera =
      cameras.find(
        camera =>
          /back|rear|environment/i
            .test(
              camera.label || ""
            )
      );


    if (rearCamera) {

      cameraId =
        rearCamera.id;
    }


    await scanner.start(

      cameraId,

      {
        fps: 10,

        qrbox: {
          width: 250,
          height: 250
        },

        aspectRatio: 1
      },

      decodedText => {

        processQRCode(
          decodedText
        );

      },

      () => {}

    );


    scannerRunning =
      true;


    if (status) {

      status.innerHTML =
        "📷 <strong>Camera ready</strong><br>" +
        "Scan the INSET 2026 attendance QR code.";
    }


  } catch (error) {

    console.error(error);

    scannerRunning =
      false;

    scanner =
      null;


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

  const activeScanner =
    scanner;


  if (!activeScanner) {

    scannerRunning =
      false;

    return;
  }


  scanner =
    null;

  scannerRunning =
    false;


  try {

    await activeScanner.stop();

  } catch (error) {

    console.warn(
      error
    );
  }


  try {

    await activeScanner.clear();

  } catch (error) {

    console.warn(
      error
    );
  }
}


/* =========================================================
   PROCESS QR
   ========================================================= */

async function processQRCode(
  qrText
) {

  if (scannerProcessing) {
    return;
  }


  scannerProcessing =
    true;


  try {

    const token =
      extractQRToken(
        qrText
      );


    if (!token) {

      scannerProcessing =
        false;

      showError(
        "Invalid QR code. Please scan the INSET 2026 attendance QR code."
      );

      return;
    }


    await stopScanner();


    const license =
      localStorage.getItem(
        LICENSE_STORAGE_KEY
      );


    /*
     * NOT REGISTERED
     */
    if (!license) {

      localStorage.setItem(
        PENDING_QR_TOKEN_KEY,
        token
      );


      const input =
        document.getElementById(
          "registrationLicense"
        );


      if (input) {
        input.value = "";
      }


      scannerProcessing =
        false;


      openRegistrationPage();

      return;
    }


    /*
     * ALREADY REGISTERED
     */
    await recordAttendanceWithToken(
      token,
      license
    );


  } catch (error) {

    console.error(error);

    scannerProcessing =
      false;

    showError(
      error.message ||
      "Unable to process QR code."
    );
  }
}


/* =========================================================
   EXTRACT QR TOKEN
   ========================================================= */

function extractQRToken(
  qrText
) {

  if (!qrText) {
    return null;
  }


  const text =
    String(qrText)
      .trim();


  try {

    const url =
      new URL(text);


    const token =
      url.searchParams.get(
        "token"
      );


    if (token) {
      return token;
    }

  } catch (error) {}


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
          token:
            token,

          licenseNo:
            licenseNo
        }
      );


    const registrationRequired =
      result &&
      (
        result.registrationRequired ===
          true ||

        /participant not found|register first/i
          .test(
            result.message ||
            ""
          )
      );


    /*
     * Participant no longer exists.
     */
    if (registrationRequired) {

      showLoading(false);


      localStorage.removeItem(
        LICENSE_STORAGE_KEY
      );


      currentParticipant =
        null;


      /*
       * Preserve the QR.
       */
      localStorage.setItem(
        PENDING_QR_TOKEN_KEY,
        token
      );


      const input =
        document.getElementById(
          "registrationLicense"
        );


      if (input) {
        input.value = "";
      }


      scannerProcessing =
        false;


      openRegistrationPage();

      return;
    }


    /*
     * SUCCESS
     */
    if (result.success) {

      localStorage.removeItem(
        PENDING_QR_TOKEN_KEY
      );


      showLoading(false);

      scannerProcessing =
        false;


      showSuccess(
        result
      );


      return;
    }


    /*
     * Invalid/expired/wrong QR.
     */
    localStorage.removeItem(
      PENDING_QR_TOKEN_KEY
    );


    showLoading(false);

    scannerProcessing =
      false;


    showError(
      result.message ||
      "Attendance could not be recorded."
    );


  } catch (error) {

    console.error(error);

    showLoading(false);

    scannerProcessing =
      false;


    showError(
      error.message ||
      "Unable to connect to the attendance server."
    );
  }
}


/* =========================================================
   SUCCESS
   ========================================================= */

function showSuccess(
  result
) {

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
          result.mode
        ) +
        "</strong><br>";
    }


    if (result.date) {

      html +=
        "Date: " +
        escapeHTML(
          formatDisplayDate(
            result.date
          )
        ) +
        "<br>";
    }


    if (result.time) {

      html +=
        "Time: " +
        escapeHTML(
          formatDisplayTime(
            result.time
          )
        ) +
        "<br>";
    }


    details.innerHTML =
      html;
  }


  showPage(
    "successPage"
  );
}


/* =========================================================
   ERROR
   ========================================================= */

function showError(
  message
) {

  const errorMessage =
    document.getElementById(
      "errorMessage"
    );


  if (errorMessage) {

    errorMessage.innerHTML =
      escapeHTML(
        message
      );
  }


  showPage(
    "errorPage"
  );
}


/* =========================================================
   API
   ========================================================= */

async function apiCall(
  action,
  data = {}
) {

  const url =
    API_URL +
    "?action=" +
    encodeURIComponent(
      action
    ) +
    "&data=" +
    encodeURIComponent(
      JSON.stringify(
        data
      )
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
      JSON.parse(
        text
      );

  } catch (error) {

    throw new Error(
      "Invalid response from attendance server."
    );
  }


  return result;
}


/* =========================================================
   ADMIN LOGIN
   ========================================================= */

function openAdminLogin() {

  showPage(
    "adminLoginPage"
  );

  setAdminDefaults();
}


function showAdminLogin() {

  openAdminLogin();
}


/* =========================================================
   ADMIN LOGIN
   ========================================================= */

async function checkAdminPassword() {

  const input =
    document.getElementById(
      "adminPassword"
    );


  if (!input) {
    return;
  }


  const password =
    input.value.trim();


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
          password:
            password
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


    showPage(
      "adminPage"
    );


    setAdminDefaults();

    clearQR();

    loadAttendanceSummary();


    /*
     * Add A4 PDF button.
     */
    addPDFButton();

  } catch (error) {

    showLoading(false);

    showAdminMessage(
      error.message ||
      "Unable to connect to server."
    );
  }
}


/* =========================================================
   ADMIN COMPATIBILITY
   ========================================================= */

async function adminLogin(
  event
) {

  if (event) {
    event.preventDefault();
  }


  await checkAdminPassword();
}


/* =========================================================
   ADMIN MESSAGE
   ========================================================= */

function showAdminMessage(
  message
) {

  const input =
    document.getElementById(
      "adminPassword"
    );


  let element =
    document.getElementById(
      "adminLoginMessage"
    );


  if (
    !element &&
    input
  ) {

    element =
      document.createElement(
        "div"
      );


    element.id =
      "adminLoginMessage";


    element.style.marginTop =
      "10px";


    element.style.textAlign =
      "center";


    input.parentElement
      .appendChild(
        element
      );
  }


  if (element) {

    element.textContent =
      "⚠️ " +
      message;
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


  if (!dateInput.value) {

    dateInput.value =
      EVENT_START;
  }


  updateQRStatus();
}


/* =========================================================
   SELECT DAY
   ========================================================= */

function selectQRDay(
  date
) {

  const dateInput =
    document.getElementById(
      "attendanceDate"
    );


  if (!dateInput) {
    return;
  }


  if (
    !EVENT_DATES.includes(
      date
    )
  ) {

    showQRStatus(
      "Invalid INSET 2026 date."
    );

    return;
  }


  dateInput.value =
    date;


  generatedQR =
    null;


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

    downloadButton.disabled =
      true;
  }


  updateQRStatus();
}


/* =========================================================
   GENERATE SINGLE QR
   ========================================================= */

async function generateQR(
  mode
) {

  const date =
    document.getElementById(
      "attendanceDate"
    )?.value ||
    EVENT_START;


  if (
    !EVENT_DATES.includes(
      date
    )
  ) {

    showQRStatus(
      "Please select a valid date."
    );

    return;
  }


  if (
    mode !== "TIME-IN" &&
    mode !== "TIME-OUT"
  ) {

    showQRStatus(
      "Invalid QR mode."
    );

    return;
  }


  showLoading(
    true,
    "Generating " +
    mode +
    " QR code..."
  );


  try {

    const result =
      await apiCall(
        "generateQR",
        {
          mode:
            mode,

          attendanceDate:
            date
        }
      );


    showLoading(false);


    if (!result.success) {

      showQRStatus(
        result.message
      );

      return;
    }


    generatedQR =
      result;


    await displayQRCode(
      result
    );


  } catch (error) {

    showLoading(false);

    showQRStatus(
      error.message ||
      "Unable to generate QR."
    );
  }
}


/* =========================================================
   LOAD QR LIBRARY
   ========================================================= */

function ensureQRCodeLibrary() {

  return new Promise(
    (resolve, reject) => {

      if (
        typeof QRCode !==
        "undefined"
      ) {

        resolve();

        return;
      }


      const script =
        document.createElement(
          "script"
        );


      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";


      script.onload =
        resolve;


      script.onerror =
        () => reject(
          new Error(
            "QR generator library failed to load."
          )
        );


      document.head.appendChild(
        script
      );
    }
  );
}


/* =========================================================
   DISPLAY QR
   ========================================================= */

async function displayQRCode(
  result
) {

  const container =
    document.getElementById(
      "qrContainer"
    );


  if (!container) {
    return;
  }


  await ensureQRCodeLibrary();


  container.innerHTML =
    "";


  const qrUrl =
    result.qrUrl ||
    result.url;


  new QRCode(
    container,
    {

      text:
        qrUrl,

      width:
        280,

      height:
        280,

      colorDark:
        "#000000",

      colorLight:
        "#ffffff",

      correctLevel:
        QRCode.CorrectLevel.H
    }
  );


  await wait(250);


  const day =
    result.day ||
    getInsetDayNumber(
      result.attendanceDate
    );


  const filename =
    "INSET2026_DAY" +
    day +
    "_" +
    result.mode +
    "_" +
    result.attendanceDate +
    ".png";


  generatedQR = {

    ...result,

    qrUrl:
      qrUrl,

    filename:
      filename
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


  showQRStatus(

    "<strong>DAY " +
    day +
    " — " +
    result.mode +
    "</strong><br>" +

    escapeHTML(
      formatDisplayDate(
        result.attendanceDate
      )
    ) +

    "<br>" +

    "QR code generated successfully."

  );
}


/* =========================================================
   DOWNLOAD SINGLE QR
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


  let dataURL =
    null;


  const canvas =
    container.querySelector(
      "canvas"
    );


  if (canvas) {

    dataURL =
      canvas.toDataURL(
        "image/png"
      );
  }


  if (!dataURL) {

    const image =
      container.querySelector(
        "img"
      );


    if (image) {

      dataURL =
        image.src;
    }
  }


  if (!dataURL) {

    showQRStatus(
      "QR image is not ready."
    );

    return;
  }


  const link =
    document.createElement(
      "a"
    );


  link.href =
    dataURL;


  link.download =
    generatedQR.filename ||
    "INSET2026_QR.png";


  document.body.appendChild(
    link
  );


  link.click();


  link.remove();
}


/* =========================================================
   ADD A4 PDF BUTTON
   ========================================================= */

function addPDFButton() {

  if (
    document.getElementById(
      "downloadA4PdfButton"
    )
  ) {

    return;
  }


  const downloadQRButton =
    document.getElementById(
      "downloadQrButton"
    );


  if (!downloadQRButton) {
    return;
  }


  const button =
    document.createElement(
      "button"
    );


  button.id =
    "downloadA4PdfButton";


  button.type =
    "button";


  button.className =
    "main-button primary-button qr-download-button";


  button.style.marginTop =
    "10px";


  button.innerHTML =
    "📄 DOWNLOAD ALL 6 QR CODES — A4 PDF";


  button.onclick =
    generateA4PDF;


  downloadQRButton
    .parentElement
    .appendChild(
      button
    );
}


/* =========================================================
   LOAD jsPDF
   ========================================================= */

function ensureJsPDF() {

  return new Promise(
    (resolve, reject) => {

      if (
        window.jspdf &&
        window.jspdf.jsPDF
      ) {

        resolve();

        return;
      }


      const existing =
        document.querySelector(
          'script[data-inset-jspdf="true"]'
        );


      if (existing) {

        existing.addEventListener(
          "load",
          resolve
        );


        existing.addEventListener(
          "error",
          () =>
            reject(
              new Error(
                "PDF library failed to load."
              )
            )
        );


        return;
      }


      const script =
        document.createElement(
          "script"
        );


      script.dataset.insetJspdf =
        "true";


      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";


      script.onload =
        resolve;


      script.onerror =
        () =>
          reject(
            new Error(
              "Unable to load PDF library."
            )
          );


      document.head.appendChild(
        script
      );
    }
  );
}


/* =========================================================
   GENERATE ALL 6 QR CODES + A4 PDF
   ========================================================= */

async function generateA4PDF() {

  showLoading(
    true,
    "Preparing all 6 QR codes..."
  );


  try {

    await ensureQRCodeLibrary();

    await ensureJsPDF();


    const qrItems = [];


    /*
     * Generate all six real QR sessions.
     */
    for (
      let dayIndex = 0;
      dayIndex < EVENT_DATES.length;
      dayIndex++
    ) {

      const date =
        EVENT_DATES[
          dayIndex
        ];


      for (
        const mode of [
          "TIME-IN",
          "TIME-OUT"
        ]
      ) {

        showLoading(

          true,

          "Generating DAY " +
          (dayIndex + 1) +
          " " +
          mode +
          "..."
        );


        const result =
          await apiCall(
            "generateQR",
            {

              mode:
                mode,

              attendanceDate:
                date

            }
          );


        if (!result.success) {

          throw new Error(
            result.message ||
            "Failed to generate " +
            mode
          );
        }


        const qrDataURL =
          await createQRDataURL(
            result.qrUrl ||
            result.url
          );


        qrItems.push({

          day:
            dayIndex + 1,

          mode:
            mode,

          date:
            date,

          qrDataURL:
            qrDataURL,

          token:
            result.token

        });
      }
    }


    showLoading(
      true,
      "Creating A4 PDF..."
    );


    await createA4PDF(
      qrItems
    );


    showLoading(false);


    showQRStatus(
      "✅ All 6 QR codes were generated and the A4 PDF is ready."
    );


  } catch (error) {

    console.error(error);

    showLoading(false);


    showQRStatus(
      "❌ " +
      escapeHTML(
        error.message ||
        "Unable to create PDF."
      )
    );
  }
}


/* =========================================================
   CREATE QR DATA URL
   ========================================================= */

async function createQRDataURL(
  text
) {

  const temporary =
    document.createElement(
      "div"
    );


  temporary.style.position =
    "fixed";


  temporary.style.left =
    "-10000px";


  temporary.style.top =
    "-10000px";


  temporary.style.width =
    "500px";


  temporary.style.height =
    "500px";


  temporary.style.background =
    "#ffffff";


  document.body.appendChild(
    temporary
  );


  new QRCode(
    temporary,
    {

      text:
        text,

      width:
        800,

      height:
        800,

      colorDark:
        "#000000",

      colorLight:
        "#ffffff",

      correctLevel:
        QRCode.CorrectLevel.H
    }
  );


  await wait(300);


  const canvas =
    temporary.querySelector(
      "canvas"
    );


  let dataURL =
    null;


  if (canvas) {

    dataURL =
      canvas.toDataURL(
        "image/png"
      );

  } else {

    const image =
      temporary.querySelector(
        "img"
      );


    if (image) {

      dataURL =
        image.src;
    }
  }


  temporary.remove();


  if (!dataURL) {

    throw new Error(
      "Unable to create QR image."
    );
  }


  return dataURL;
}


/* =========================================================
   CREATE A4 PDF
   ========================================================= */

async function createA4PDF(
  qrItems
) {

  const {
    jsPDF
  } =
    window.jspdf;


  /*
   * A4 portrait.
   *
   * Units: millimeters
   */
  const pdf =
    new jsPDF({

      orientation:
        "portrait",

      unit:
        "mm",

      format:
        "a4",

      compress:
        true
    });


  const pageWidth =
    210;


  const pageHeight =
    297;


  const margin =
    12;


  const navy =
    "#073B70";


  const gold =
    "#E6AA18";


  const lightBlue =
    "#EEF5FA";


  for (
    let i = 0;
    i < qrItems.length;
    i++
  ) {

    if (i > 0) {

      pdf.addPage(
        "a4",
        "portrait"
      );
    }


    const item =
      qrItems[i];


    const day =
      item.day;


    const mode =
      item.mode;


    const date =
      item.date;


    /*
     * Background
     */
    pdf.setFillColor(
      255,
      255,
      255
    );


    pdf.rect(
      0,
      0,
      pageWidth,
      pageHeight,
      "F"
    );


    /*
     * Outer border
     */
    pdf.setDrawColor(
      7,
      59,
      112
    );


    pdf.setLineWidth(
      0.7
    );


    pdf.rect(
      7,
      7,
      196,
      283
    );


    /*
     * Top accent
     */
    pdf.setFillColor(
      7,
      59,
      112
    );


    pdf.rect(
      7,
      7,
      196,
      10,
      "F"
    );


    pdf.setFillColor(
      230,
      170,
      24
    );


    pdf.rect(
      7,
      17,
      196,
      2.5,
      "F"
    );


    /*
     * Header
     */
    pdf.setTextColor(
      7,
      59,
      112
    );


    pdf.setFont(
      "helvetica",
      "bold"
    );


    pdf.setFontSize(
      28
    );


    pdf.text(
      "INSET 2026",
      pageWidth / 2,
      36,
      {
        align:
          "center"
      }
    );


    pdf.setFontSize(
      11
    );


    pdf.setFont(
      "helvetica",
      "normal"
    );


    pdf.setTextColor(
      70,
      70,
      70
    );


    pdf.text(
      "IN-SERVICE TRAINING",
      pageWidth / 2,
      44,
      {
        align:
          "center"
      }
    );


    pdf.setFontSize(
      10
    );


    pdf.text(
      "September 9–11, 2026",
      pageWidth / 2,
      50,
      {
        align:
          "center"
      }
    );


    /*
     * Main title panel
     */
    pdf.setFillColor(
      7,
      59,
      112
    );


    pdf.roundedRect(
      20,
      59,
      170,
      40,
      5,
      5,
      "F"
    );


    /*
     * Gold lower accent
     */
    pdf.setFillColor(
      230,
      170,
      24
    );


    pdf.roundedRect(
      20,
      91,
      170,
      8,
      0,
      0,
      "F"
    );


    /*
     * DAY X
     */
    pdf.setTextColor(
      255,
      255,
      255
    );


    pdf.setFont(
      "helvetica",
      "bold"
    );


    pdf.setFontSize(
      28
    );


    pdf.text(
      "DAY " +
      day +
      ":",
      28,
      82
    );


    /*
     * TIME IN / TIME OUT
     */
    pdf.setTextColor(
      255,
      255,
      255
    );


    pdf.setFontSize(
      28
    );


    pdf.text(
      mode,
      72,
      82
    );


    /*
     * Date
     */
    pdf.setTextColor(
      7,
      59,
      112
    );


    pdf.setFontSize(
      17
    );


    pdf.text(
      formatDisplayDate(
        date
      ).toUpperCase(),
      pageWidth / 2,
      110,
      {
        align:
          "center"
      }
    );


    /*
     * Instruction
     */
    pdf.setFontSize(
      12
    );


    pdf.setFont(
      "helvetica",
      "bold"
    );


    pdf.setTextColor(
      50,
      50,
      50
    );


    pdf.text(
      mode === "TIME-IN"
        ? "SCAN HERE FOR TIME IN"
        : "SCAN HERE FOR TIME OUT",
      pageWidth / 2,
      119,
      {
        align:
          "center"
      }
    );


    /*
     * QR area
     */
    const qrSize =
      125;


    const qrX =
      (pageWidth -
        qrSize) /
      2;


    const qrY =
      130;


    /*
     * QR white card
     */
    pdf.setFillColor(
      255,
      255,
      255
    );


    pdf.setDrawColor(
      7,
      59,
      112
    );


    pdf.setLineWidth(
      1.2
    );


    pdf.roundedRect(
      qrX - 5,
      qrY - 5,
      qrSize + 10,
      qrSize + 10,
      4,
      4,
      "FD"
    );


    /*
     * Real QR code
     */
    pdf.addImage(
      item.qrDataURL,
      "PNG",
      qrX,
      qrY,
      qrSize,
      qrSize,
      undefined,
      "FAST"
    );


    /*
     * Bottom instruction panel
     */
    pdf.setFillColor(
      7,
      59,
      112
    );


    pdf.roundedRect(
      25,
      263,
      160,
      13,
      6,
      6,
      "F"
    );


    pdf.setTextColor(
      255,
      255,
      255
    );


    pdf.setFontSize(
      11
    );


    pdf.text(
      mode === "TIME-IN"
        ? "SCAN THIS QR CODE FOR TIME IN"
        : "SCAN THIS QR CODE FOR TIME OUT",
      pageWidth / 2,
      271.5,
      {
        align:
          "center"
      }
    );


    /*
     * Footer
     */
    pdf.setTextColor(
      90,
      90,
      90
    );


    pdf.setFont(
      "helvetica",
      "italic"
    );


    pdf.setFontSize(
      9
    );


    pdf.text(
      "Please scan only the QR code matching the day and activity.",
      pageWidth / 2,
      282,
      {
        align:
          "center"
      }
    );


    /*
     * Small page number
     */
    pdf.setFont(
      "helvetica",
      "normal"
    );


    pdf.setFontSize(
      7
    );


    pdf.setTextColor(
      130,
      130,
      130
    );


    pdf.text(
      "Page " +
      (i + 1) +
      " of 6",
      pageWidth - 12,
      290,
      {
        align:
          "right"
      }
    );
  }


  /*
   * Download.
   */
  pdf.save(
    "INSET2026_ATTENDANCE_QR_CODES_A4.pdf"
  );
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
      )?.value ||
      EVENT_START;


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
          "Unable to load summary."
        );

      return;
    }


    renderAttendanceSummary(
      result,
      summary
    );


  } catch (error) {

    summary.innerHTML =
      escapeHTML(
        error.message ||
        "Unable to load summary."
      );
  }
}


/* =========================================================
   SUMMARY RENDER
   ========================================================= */

function renderAttendanceSummary(
  result,
  container
) {

  if (
    Array.isArray(
      result.summary
    )
  ) {

    if (
      result.summary.length ===
      0
    ) {

      container.innerHTML =
        "<p>No attendance records yet.</p>";

      return;
    }


    let html =
      "<div class='summary-table-wrapper'>" +
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


    result.summary.forEach(
      row => {

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
          escapeHTML(
            name
          ) +
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
      }
    );


    html +=
      "</tbody></table></div>";


    container.innerHTML =
      html;


    return;
  }


  container.innerHTML =
    "<strong>Total:</strong> " +
    escapeHTML(
      String(
        result.total ||
        0
      )
    );
}


/* =========================================================
   CLEAR QR
   ========================================================= */

function clearQR() {

  generatedQR =
    null;


  const container =
    document.getElementById(
      "qrContainer"
    );


  if (container) {

    container.innerHTML =
      "";
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
   QR STATUS
   ========================================================= */

function showQRStatus(
  message
) {

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
   QR STATUS UPDATE
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
    getInsetDayNumber(
      date
    );


  if (!day) {

    showQRStatus(
      "Select a valid INSET 2026 date."
    );

    return;
  }


  showQRStatus(

    "<strong>DAY " +
    day +
    "</strong><br>" +

    escapeHTML(
      formatDisplayDate(
        date
      )
    ) +

    "<br>" +

    "Select TIME-IN or TIME-OUT to generate a QR code."

  );
}


/* =========================================================
   DAY NUMBER
   ========================================================= */

function getInsetDayNumber(
  date
) {

  const index =
    EVENT_DATES.indexOf(
      date
    );


  if (index === -1) {
    return null;
  }


  return index + 1;
}


/* =========================================================
   DATE FORMAT
   ========================================================= */

function formatDisplayDate(
  dateString
) {

  if (!dateString) {
    return "";
  }


  const parts =
    String(
      dateString
    ).split("-");


  if (
    parts.length === 3
  ) {

    const date =
      new Date(
        Number(parts[0]),
        Number(parts[1]) - 1,
        Number(parts[2])
      );


    return date.toLocaleDateString(
      "en-PH",
      {
        month:
          "long",

        day:
          "numeric",

        year:
          "numeric"
      }
    );
  }


  return String(
    dateString
  );
}


/* =========================================================
   TIME FORMAT
   ========================================================= */

function formatDisplayTime(
  value
) {

  if (!value) {
    return "";
  }


  if (
    typeof value ===
      "string" &&
    /AM|PM/i.test(
      value
    )
  ) {

    return value;
  }


  try {

    const date =
      new Date(
        value
      );


    if (
      !isNaN(
        date.getTime()
      )
    ) {

      return date.toLocaleTimeString(
        "en-PH",
        {
          hour:
            "numeric",

          minute:
            "2-digit",

          second:
            "2-digit",

          hour12:
            true,

          timeZone:
            "Asia/Manila"
        }
      );
    }

  } catch (error) {}


  return String(
    value
  );
}


/* =========================================================
   LOADING
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

function escapeHTML(
  value
) {

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
   WAIT
   ========================================================= */

function wait(
  milliseconds
) {

  return new Promise(
    resolve =>
      setTimeout(
        resolve,
        milliseconds
      )
  );
}


/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    console.log(
      "INSET 2026 Attendance System loaded."
    );


    const pages =
      document.querySelectorAll(
        ".page"
      );


    let active =
      false;


    pages.forEach(
      page => {

        if (
          page.classList.contains(
            "active"
          )
        ) {

          active =
            true;
        }
      }
    );


    if (!active) {

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


    setAdminDefaults();

  }
);
