/* =========================================================
   INSET 2026 ATTENDANCE SYSTEM
   COMPLETE FRONTEND
   ========================================================= */


/* =========================================================
   CONFIG
   ========================================================= */

const API_URL =
  "https://script.google.com/macros/s/AKfycbxtBRiR3XOLpidV5aaL0Im9emBZvJ_wsEi1CqABGV5-g0jIcZ0Ji7TqNOccygIlIflF3w/exec";


const EVENT_DATES = [
  "2026-09-09",
  "2026-09-10",
  "2026-09-11"
];


const EVENT_START =
  "2026-09-09";


const EVENT_END =
  "2026-09-11";


const LICENSE_STORAGE_KEY =
  "inset_license";


const PENDING_QR_TOKEN_KEY =
  "inset_pending_qr_token";


/* =========================================================
   GLOBALS
   ========================================================= */

let scanner = null;

let scannerRunning = false;

let scannerProcessing = false;

let currentParticipant = null;

let generatedQR = null;


/* =========================================================
   PAGE NAVIGATION
   ========================================================= */

function showPage(
  pageId
) {

  document
    .querySelectorAll(
      ".page"
    )
    .forEach(
      page => {

        page.classList.remove(
          "active"
        );

      }
    );


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

  scannerProcessing =
    false;

  showPage(
    "homePage"
  );
}


/* =========================================================
   START ATTENDANCE
   ========================================================= */

async function startAttendance() {

  scannerProcessing =
    false;


  /*
   * New scanning session.
   */
  localStorage.removeItem(
    PENDING_QR_TOKEN_KEY
  );


  const license =
    localStorage.getItem(
      LICENSE_STORAGE_KEY
    );


  if (license) {

    currentParticipant = {
      licenseNo:
        license
    };

  } else {

    currentParticipant =
      null;
  }


  showPage(
    "scannerPage"
  );


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
   * Direct registration.
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
   OLD COMPATIBILITY
   ========================================================= */

function identifyUser() {

  openRegistration();
}


/* =========================================================
   REGISTER USER
   ========================================================= */

async function registerUser() {

  const firstName =
    document.getElementById(
      "firstName"
    )?.value
    .trim() || "";


  const middleName =
    document.getElementById(
      "middleName"
    )?.value
    .trim() || "";


  const lastName =
    document.getElementById(
      "lastName"
    )?.value
    .trim() || "";


  const licenseNo =
    document.getElementById(
      "registrationLicense"
    )?.value
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
     * Save license.
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
     * Was registration triggered
     * by an earlier QR scan?
     */
    const pendingToken =
      localStorage.getItem(
        PENDING_QR_TOKEN_KEY
      );


    if (pendingToken) {

      /*
       * Automatically process
       * the original QR.
       */
      await recordAttendanceWithToken(
        pendingToken,
        licenseNo
      );

      return;
    }


    /*
     * Normal registration.
     */
    showLoading(false);


    scannerProcessing =
      false;


    showSuccess({

      success:
        true,

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

    console.error(
      "Reader element not found."
    );

    return;
  }


  reader.innerHTML =
    "";


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


    /*
     * Prefer rear camera.
     */
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
        fps:
          10,

        qrbox: {
          width:
            250,

          height:
            250
        },

        aspectRatio:
          1
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

    console.error(
      "Scanner error:",
      error
    );


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
      "Scanner stop:",
      error
    );
  }


  try {

    await activeScanner.clear();

  } catch (error) {

    console.warn(
      "Scanner clear:",
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


    /*
     * Stop camera immediately.
     */
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


      const licenseInput =
        document.getElementById(
          "registrationLicense"
        );


      if (licenseInput) {

        licenseInput.value =
          "";
      }


      scannerProcessing =
        false;


      openRegistrationPage();

      return;
    }


    /*
     * REGISTERED
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
    String(
      qrText
    ).trim();


  /*
   * QR is a URL.
   */
  try {

    const url =
      new URL(
        text
      );


    const token =
      url.searchParams.get(
        "token"
      );


    if (token) {
      return token;
    }

  } catch (error) {}


  /*
   * Raw token support.
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
          token:
            token,

          licenseNo:
            licenseNo
        }
      );


    /*
     * Participant not found.
     */
    const needsRegistration =
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


    if (needsRegistration) {

      showLoading(false);


      localStorage.removeItem(
        LICENSE_STORAGE_KEY
      );


      currentParticipant =
        null;


      /*
       * Keep the scanned QR.
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

        licenseInput.value =
          "";
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
     * Invalid / expired / duplicate.
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
      "Unable to connect to attendance server."
    );
  }
}


/* =========================================================
   SUCCESS PAGE
   ========================================================= */

function showSuccess(
  result
) {

  const message =
    document.getElementById(
      "successMessage"
    );


  const details =
    document.getElementById(
      "successDetails"
    );


  if (message) {

    message.innerHTML =
      escapeHTML(
        result.message ||
        "Attendance recorded successfully."
      );
  }


  if (details) {

    let html =
      "";


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
          result.time
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


    details.innerHTML =
      html;
  }


  showPage(
    "successPage"
  );
}


/* =========================================================
   ERROR PAGE
   ========================================================= */

function showError(
  message
) {

  const element =
    document.getElementById(
      "errorMessage"
    );


  if (element) {

    element.innerHTML =
      escapeHTML(
        message
      );
  }


  showPage(
    "errorPage"
  );
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
        method:
          "GET",

        cache:
          "no-store"
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


  try {

    return JSON.parse(
      text
    );

  } catch (error) {

    console.error(
      "Server response:",
      text
    );


    throw new Error(
      "Invalid response from attendance server."
    );
  }
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


/* Compatibility */
function showAdminLogin() {

  openAdminLogin();
}


/* =========================================================
   ADMIN PASSWORD
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
      "Please enter the administrator password."
    );

    return;
  }


  showLoading(
    true,
    "Checking administrator access..."
  );


  try {

    /*
     * IMPORTANT:
     *
     * This EXACT action exists
     * in Code.gs.
     */
    const result =
      await apiCall(
        "checkAdminPassword",
        {
          password:
            password
        }
      );


    showLoading(false);


    if (!result.success) {

      showAdminMessage(
        result.message ||
        "Incorrect administrator password."
      );

      return;
    }


    /*
     * SUCCESS
     */
    showPage(
      "adminPage"
    );


    setAdminDefaults();

    clearQR();

    loadAttendanceSummary();

    addPDFButton();


  } catch (error) {

    console.error(
      "ADMIN LOGIN ERROR:",
      error
    );


    showLoading(false);


    showAdminMessage(
      error.message ||
      "Unable to connect to the attendance server."
    );
  }
}


/* Compatibility */
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


    element.style.color =
      "#b42318";


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
   SELECT QR DATE
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

    container.innerHTML =
      "";
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
      "Please select a valid INSET 2026 date."
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
      "Unable to generate QR code."
    );
  }
}


/* =========================================================
   LOAD QR GENERATOR
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
          () =>
            reject(
              new Error(
                "QR generator failed to load."
              )
            )
        );


        return;
      }


      const script =
        document.createElement(
          "script"
        );


      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";


      script.dataset.insetQrcode =
        "true";


      script.onload =
        resolve;


      script.onerror =
        () =>
          reject(
            new Error(
              "Unable to load QR generator."
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


  await wait(
    300
  );


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


  const button =
    document.getElementById(
      "downloadQrButton"
    );


  if (button) {

    button.disabled =
      false;
  }


  showQRStatus(

    "<strong>DAY " +
    day +
    " — " +
    escapeHTML(
      result.mode
    ) +
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
   ADD PDF BUTTON
   ========================================================= */

function addPDFButton() {

  if (
    document.getElementById(
      "downloadA4PdfButton"
    )
  ) {

    return;
  }


  const qrButton =
    document.getElementById(
      "downloadQrButton"
    );


  if (!qrButton) {
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


  button.innerHTML =
    "📄 DOWNLOAD ALL 6 QR CODES — A4 PDF";


  button.style.marginTop =
    "10px";


  button.onclick =
    generateA4PDF;


  qrButton.parentElement
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


      const script =
        document.createElement(
          "script"
        );


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
   GENERATE ALL 6 QR CODES
   ========================================================= */

async function generateA4PDF() {

  showLoading(
    true,
    "Preparing all 6 QR codes..."
  );


  try {

    await ensureQRCodeLibrary();

    await ensureJsPDF();


    const items =
      [];


    /*
     * DAY 1
     * DAY 2
     * DAY 3
     *
     * TIME-IN
     * TIME-OUT
     */
    for (
      let i = 0;
      i < EVENT_DATES.length;
      i++
    ) {

      const date =
        EVENT_DATES[i];


      const day =
        i + 1;


      for (
        const mode of [
          "TIME-IN",
          "TIME-OUT"
        ]
      ) {

        showLoading(
          true,
          "Generating DAY " +
          day +
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
            "Unable to generate " +
            mode
          );
        }


        const qrImage =
          await createQRImage(
            result.qrUrl
          );


        items.push({

          day:
            day,

          mode:
            mode,

          date:
            date,

          qrImage:
            qrImage

        });
      }
    }


    showLoading(
      true,
      "Creating A4 PDF..."
    );


    await createA4PDF(
      items
    );


    showLoading(false);


    showQRStatus(
      "✅ The 6 QR codes were generated and the A4 PDF was downloaded."
    );


  } catch (error) {

    console.error(
      error
    );


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
   CREATE QR IMAGE
   ========================================================= */

async function createQRImage(
  text
) {

  const holder =
    document.createElement(
      "div"
    );


  holder.style.position =
    "fixed";


  holder.style.left =
    "-10000px";


  holder.style.top =
    "-10000px";


  holder.style.width =
    "800px";


  holder.style.height =
    "800px";


  holder.style.background =
    "#ffffff";


  document.body.appendChild(
    holder
  );


  new QRCode(
    holder,
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


  await wait(
    400
  );


  const canvas =
    holder.querySelector(
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
      holder.querySelector(
        "img"
      );


    if (image) {

      dataURL =
        image.src;
    }
  }


  holder.remove();


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
  items
) {

  const {
    jsPDF
  } =
    window.jspdf;


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


  const W =
    210;


  const H =
    297;


  for (
    let i = 0;
    i < items.length;
    i++
  ) {

    if (i > 0) {

      pdf.addPage(
        "a4",
        "portrait"
      );
    }


    const item =
      items[i];


    const day =
      item.day;


    const mode =
      item.mode;


    const date =
      item.date;


    /*
     * WHITE BACKGROUND
     */
    pdf.setFillColor(
      255,
      255,
      255
    );


    pdf.rect(
      0,
      0,
      W,
      H,
      "F"
    );


    /*
     * OUTER BORDER
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
     * TOP NAVY STRIPE
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
      9,
      "F"
    );


    /*
     * GOLD STRIPE
     */
    pdf.setFillColor(
      230,
      170,
      24
    );


    pdf.rect(
      7,
      16,
      196,
      2.5,
      "F"
    );


    /*
     * INSET 2026
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
      30
    );


    pdf.text(
      "INSET 2026",
      W / 2,
      38,
      {
        align:
          "center"
      }
    );


    /*
     * SUBTITLE
     */
    pdf.setFont(
      "helvetica",
      "normal"
    );


    pdf.setFontSize(
      11
    );


    pdf.text(
      "IN-SERVICE TRAINING",
      W / 2,
      46,
      {
        align:
          "center"
      }
    );


    /*
     * MAIN DAY PANEL
     */
    pdf.setFillColor(
      7,
      59,
      112
    );


    pdf.roundedRect(
      20,
      58,
      170,
      42,
      5,
      5,
      "F"
    );


    /*
     * DAY
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
      30,
      84
    );


    /*
     * TIME IN / TIME OUT
     */
    pdf.setTextColor(
      230,
      180,
      35
    );


    pdf.setFontSize(
      28
    );


    pdf.text(
      mode,
      72,
      84
    );


    /*
     * DATE
     */
    pdf.setTextColor(
      7,
      59,
      112
    );


    pdf.setFontSize(
      18
    );


    pdf.text(
      formatDisplayDate(
        date
      ).toUpperCase(),
      W / 2,
      112,
      {
        align:
          "center"
      }
    );


    /*
     * SCAN INSTRUCTION
     */
    pdf.setFontSize(
      12
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
      W / 2,
      122,
      {
        align:
          "center"
      }
    );


    /*
     * QR SIZE
     */
    const qrSize =
      135;


    const qrX =
      (W - qrSize) / 2;


    const qrY =
      130;


    /*
     * QR WHITE CARD
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
      1.3
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
     * REAL QR IMAGE
     */
    pdf.addImage(
      item.qrImage,
      "PNG",
      qrX,
      qrY,
      qrSize,
      qrSize,
      undefined,
      "FAST"
    );


    /*
     * BOTTOM CALL TO ACTION
     */
    pdf.setFillColor(
      7,
      59,
      112
    );


    pdf.roundedRect(
      25,
      273,
      160,
      11,
      5,
      5,
      "F"
    );


    pdf.setTextColor(
      255,
      255,
      255
    );


    pdf.setFontSize(
      10
    );


    pdf.text(
      mode === "TIME-IN"
        ? "SCAN THIS QR CODE FOR TIME IN"
        : "SCAN THIS QR CODE FOR TIME OUT",
      W / 2,
      280,
      {
        align:
          "center"
      }
    );
  }


  /*
   * DOWNLOAD PDF
   */
  pdf.save(
    "INSET2026_ATTENDANCE_QR_CODES_A4.pdf"
  );
}


/* =========================================================
   ATTENDANCE SUMMARY
   ========================================================= */

async function loadAttendanceSummary() {

  const container =
    document.getElementById(
      "attendanceSummary"
    );


  if (!container) {
    return;
  }


  container.innerHTML =
    "Loading attendance summary...";


  try {

    const date =
      document.getElementById(
        "attendanceDate"
      )?.value ||
      EVENT_START;


    const result =
      await apiCall(
        "getAttendanceSummary",
        {
          selectedDate:
            date
        }
      );


    if (!result.success) {

      container.innerHTML =
        escapeHTML(
          result.message
        );

      return;
    }


    renderAttendanceSummary(
      result,
      container
    );


  } catch (error) {

    container.innerHTML =
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
    !Array.isArray(
      result.summary
    )
  ) {

    container.innerHTML =
      "<strong>Total:</strong> " +
      escapeHTML(
        String(
          result.total || 0
        )
      );

    return;
  }


  if (
    result.summary.length === 0
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
  value
) {

  if (!value) {
    return "";
  }


  const parts =
    String(
      value
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
    value
  );
}


/* =========================================================
   LOADING
   ========================================================= */

function showLoading(
  show,
  message
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
        message ||
        "Please wait...";
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


  return String(
    value
  )

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
   INITIALIZE
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    console.log(
      "INSET 2026 Attendance System loaded."
    );


    /*
     * Make sure HOME is active.
     */
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
