/* =========================================================
   INSET 2026 ATTENDANCE SYSTEM
   FRONTEND JAVASCRIPT
   ========================================================= */

const API_URL =
  "https://script.google.com/macros/s/AKfycbxtBRiR3XOLpidV5aaL0Im9emBZvJ_wsEi1CqABGV5-g0jIcZ0Ji7TqNOccygIlIflF3w/exec";

const STORAGE_LICENSE = "inset_license";
const STORAGE_REGISTERED_USERS = "inset_registered_users";

let currentUser = null;
let scanner = null;
let scannerRunning = false;

let selectedQRDate = "";
let selectedQRMode = "";

let generatedQRData = null;


/* =========================================================
   PAGE CONTROL
   ========================================================= */

function showPage(pageId) {
  const pages = document.querySelectorAll(".page");

  pages.forEach(page => {
    page.classList.remove("active");
  });

  const page = document.getElementById(pageId);

  if (page) {
    page.classList.add("active");
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


/* =========================================================
   HOME
   ========================================================= */

function goHome() {
  stopScanner();
  currentUser = null;
  showPage("homePage");
}


/* =========================================================
   LOADING
   ========================================================= */

function showLoading(message = "Please wait...") {
  const overlay = document.getElementById("loadingOverlay");

  if (!overlay) return;

  const text =
    overlay.querySelector(".loading-text") ||
    overlay.querySelector("#loadingText");

  if (text) {
    text.textContent = message;
  }

  overlay.style.display = "flex";
}


function hideLoading() {
  const overlay = document.getElementById("loadingOverlay");

  if (!overlay) return;

  overlay.style.display = "none";
}


/* =========================================================
   API
   ========================================================= */

async function apiCall(action, data = {}) {
  try {
    const url =
      API_URL +
      "?action=" +
      encodeURIComponent(action) +
      "&data=" +
      encodeURIComponent(JSON.stringify(data));

    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store"
    });

    const text = await response.text();

    let result;

    try {
      result = JSON.parse(text);
    } catch (parseError) {
      console.error("Invalid API response:", text);
      throw new Error("Invalid response from attendance server.");
    }

    return result;

  } catch (error) {
    console.error("API Error:", error);

    return {
      success: false,
      message:
        error.message ||
        "Unable to connect to the attendance server."
    };
  }
}


/* =========================================================
   ATTENDANCE START
   ========================================================= */

function startAttendance() {
  const users = getRegisteredUsers();

  /*
   * If there are locally saved registered users,
   * allow the user to choose one.
   *
   * However, the license number will still be manually
   * entered and verified before the camera is opened.
   */

  if (users.length === 0) {
    showPage("identifyPage");

    const input = document.getElementById("licenseInput");

    if (input) {
      input.value = "";
      setTimeout(() => input.focus(), 300);
    }

    return;
  }

  showPage("identifyPage");

  const input = document.getElementById("licenseInput");

  if (input) {
    input.value = "";
    setTimeout(() => input.focus(), 300);
  }
}


/* =========================================================
   LICENSE VERIFICATION
   ========================================================= */

async function identifyUser(event) {
  if (event) {
    event.preventDefault();
  }

  const input = document.getElementById("licenseInput");

  if (!input) {
    showError("License number input was not found.");
    return;
  }

  const licenseNo = String(input.value || "").trim();

  if (!licenseNo) {
    showError("Please enter your License No.");
    input.focus();
    return;
  }

  showLoading("Checking License No...");

  try {
    const result = await apiCall("verifyParticipant", {
      licenseNo: licenseNo
    });

    hideLoading();

    if (!result || !result.success) {
      showError(
        result?.message ||
        "License No. not registered. Please register first."
      );
      return;
    }

    /*
     * Save the verified participant.
     */
    currentUser = {
      firstName: result.firstName || "",
      middleName: result.middleName || "",
      lastName: result.lastName || "",
      licenseNo: result.licenseNo || licenseNo
    };

    saveCurrentLicense(currentUser.licenseNo);

    saveRegisteredUser(currentUser);

    showSelectedUserConfirmation();

  } catch (error) {
    hideLoading();

    console.error(error);

    showError(
      "Unable to connect to the attendance server."
    );
  }
}


/* =========================================================
   SELECTED USER CONFIRMATION
   ========================================================= */

function showSelectedUserConfirmation() {
  showPage("scannerPage");

  const status = document.getElementById("scannerStatus");

  if (status) {
    status.textContent =
      "License No. verified. Allow camera access, then scan the attendance QR code.";
  }

  const reader = document.getElementById("reader");

  if (reader) {
    reader.innerHTML = "";
  }

  /*
   * Do NOT automatically record attendance.
   * User must explicitly start the scanner.
   */

  setTimeout(() => {
    startScanner();
  }, 350);
}


/* =========================================================
   SCANNER
   ========================================================= */

async function startScanner() {
  stopScanner();

  const reader = document.getElementById("reader");

  if (!reader) {
    showError("Scanner area was not found.");
    return;
  }

  if (typeof Html5Qrcode === "undefined") {
    showError(
      "QR scanner library failed to load. Please refresh the page and try again."
    );
    return;
  }

  scanner = new Html5Qrcode("reader");

  scannerRunning = true;

  if (document.getElementById("scannerStatus")) {
    document.getElementById("scannerStatus").textContent =
      "Allow camera access, then point the camera at the attendance QR code.";
  }

  try {
    await scanner.start(
      {
        facingMode: "environment"
      },
      {
        fps: 10,
        qrbox: {
          width: 250,
          height: 250
        },
        aspectRatio: 1.0
      },
      qrCodeMessage => {
        if (!scannerRunning) return;

        processQRCode(qrCodeMessage);
      },
      errorMessage => {
        /*
         * Ignore normal QR scanning errors.
         * html5-qrcode reports these continuously while
         * it is looking for a QR code.
         */
      }
    );

  } catch (error) {
    console.error("Camera error:", error);

    scannerRunning = false;

    if (document.getElementById("scannerStatus")) {
      document.getElementById("scannerStatus").textContent =
        "Camera access could not be started.";
    }

    showError(
      "Unable to open the camera. Please allow camera permission and try again."
    );
  }
}


function stopScanner() {
  scannerRunning = false;

  if (!scanner) return;

  try {
    const scannerInstance = scanner;
    scanner = null;

    scannerInstance
      .stop()
      .then(() => {
        try {
          scannerInstance.clear();
        } catch (e) {}
      })
      .catch(() => {
        try {
          scannerInstance.clear();
        } catch (e) {}
      });

  } catch (error) {
    scanner = null;
  }
}


/* =========================================================
   QR PROCESSING
   ========================================================= */

let qrProcessing = false;

async function processQRCode(qrMessage) {
  if (qrProcessing) return;

  qrProcessing = true;

  stopScanner();

  const token = extractAttendanceToken(qrMessage);

  if (!token) {
    qrProcessing = false;

    showError(
      "Invalid attendance QR code."
    );

    return;
  }

  if (!currentUser || !currentUser.licenseNo) {
    qrProcessing = false;

    showError(
      "License No. is missing. Please enter and verify your License No. first."
    );

    return;
  }

  showLoading("Recording attendance...");

  try {
    const result = await apiCall("recordAttendance", {
      token: token,
      licenseNo: currentUser.licenseNo
    });

    hideLoading();

    if (result && result.success) {
      showSuccess(result);
    } else {
      showError(
        result?.message ||
        "Unable to record attendance."
      );
    }

  } catch (error) {
    hideLoading();

    console.error(error);

    showError(
      "Unable to connect to the attendance server."
    );

  } finally {
    setTimeout(() => {
      qrProcessing = false;
    }, 1000);
  }
}


/* =========================================================
   EXTRACT QR TOKEN
   ========================================================= */

function extractAttendanceToken(value) {
  if (!value) return null;

  const text = String(value).trim();

  /*
   * The QR may contain the raw token.
   */
  if (
    text &&
    !text.includes("http://") &&
    !text.includes("https://")
  ) {
    return text;
  }

  /*
   * If the QR contains a URL, attempt to extract
   * ?token=...
   */
  try {
    const url = new URL(text);

    const token =
      url.searchParams.get("token") ||
      url.searchParams.get("qr") ||
      url.searchParams.get("attendanceToken");

    if (token) {
      return token;
    }

  } catch (error) {
    /*
     * Not a URL.
     */
  }

  return text || null;
}


/* =========================================================
   SUCCESS
   ========================================================= */

function showSuccess(result) {
  stopScanner();

  const details =
    document.getElementById("successDetails");

  const message =
    document.getElementById("successMessage");

  if (message) {
    message.textContent =
      result.message ||
      "Attendance recorded successfully.";
  }

  if (details) {
    const mode =
      String(result.mode || "").toUpperCase();

    const attendanceDate =
      result.attendanceDate ||
      "";

    const actualTime =
      result.scanTime ||
      result.time ||
      "";

    details.innerHTML = `
      <div class="success-detail-row">
        <strong>NAME</strong>
        <span>${escapeHtml(getFullName(currentUser))}</span>
      </div>

      <div class="success-detail-row">
        <strong>LICENSE NO.</strong>
        <span>${escapeHtml(currentUser.licenseNo)}</span>
      </div>

      ${
        mode
          ? `
            <div class="success-detail-row">
              <strong>ACTION</strong>
              <span>${escapeHtml(mode)}</span>
            </div>
          `
          : ""
      }

      ${
        attendanceDate
          ? `
            <div class="success-detail-row">
              <strong>DATE</strong>
              <span>${escapeHtml(formatDateDisplay(attendanceDate))}</span>
            </div>
          `
          : ""
      }

      ${
        actualTime
          ? `
            <div class="success-detail-row">
              <strong>TIME</strong>
              <span>${escapeHtml(actualTime)}</span>
            </div>
          `
          : ""
      }
    `;
  }

  showPage("successPage");
}


/* =========================================================
   ERROR
   ========================================================= */

function showError(message) {
  stopScanner();

  const errorMessage =
    document.getElementById("errorMessage");

  if (errorMessage) {
    errorMessage.textContent =
      message ||
      "Something went wrong.";
  }

  showPage("errorPage");
}


/* =========================================================
   REGISTER
   ========================================================= */

function openRegistration() {
  showPage("registrationPage");

  const fields = [
    "firstName",
    "middleName",
    "lastName",
    "registrationLicense"
  ];

  fields.forEach(id => {
    const element = document.getElementById(id);

    if (element) {
      element.value = "";
    }
  });

  const note = document.getElementById("registrationNote");

  if (note) {
    note.textContent = "";
  }
}


async function registerParticipant(event) {
  if (event) {
    event.preventDefault();
  }

  const firstName =
    getInputValue("firstName");

  const middleName =
    getInputValue("middleName");

  const lastName =
    getInputValue("lastName");

  const licenseNo =
    getInputValue("registrationLicense");

  if (!firstName) {
    showRegistrationMessage("Please enter the First Name.");
    return;
  }

  if (!lastName) {
    showRegistrationMessage("Please enter the Last Name.");
    return;
  }

  if (!licenseNo) {
    showRegistrationMessage("Please enter the License No.");
    return;
  }

  showLoading("Registering participant...");

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

    hideLoading();

    if (!result || !result.success) {
      showRegistrationMessage(
        result?.message ||
        "Unable to register participant."
      );

      return;
    }

    const user = {
      firstName: firstName,
      middleName: middleName,
      lastName: lastName,
      licenseNo:
        result.licenseNo ||
        licenseNo
    };

    currentUser = user;

    saveRegisteredUser(user);

    saveCurrentLicense(user.licenseNo);

    showRegistrationMessage(
      result.message ||
      "Registration successful."
    );

    /*
     * Clear registration fields after successful
     * registration.
     */
    setTimeout(() => {
      showPage("homePage");
    }, 1300);

  } catch (error) {
    hideLoading();

    console.error(error);

    showRegistrationMessage(
      "Unable to connect to the attendance server."
    );
  }
}


function showRegistrationMessage(message) {
  const note =
    document.getElementById("registrationNote");

  if (note) {
    note.textContent = message;
  }
}


/* =========================================================
   LOCAL REGISTERED USERS
   ========================================================= */

function getRegisteredUsers() {
  try {
    const raw =
      localStorage.getItem(
        STORAGE_REGISTERED_USERS
      );

    if (!raw) {
      return [];
    }

    const users = JSON.parse(raw);

    return Array.isArray(users)
      ? users
      : [];

  } catch (error) {
    console.error(error);
    return [];
  }
}


function saveRegisteredUser(user) {
  if (!user || !user.licenseNo) {
    return;
  }

  const users =
    getRegisteredUsers();

  const normalizedLicense =
    normalizeLicense(user.licenseNo);

  const existingIndex =
    users.findIndex(
      item =>
        normalizeLicense(item.licenseNo) ===
        normalizedLicense
    );

  if (existingIndex >= 0) {
    users[existingIndex] = {
      ...users[existingIndex],
      ...user
    };
  } else {
    users.push(user);
  }

  try {
    localStorage.setItem(
      STORAGE_REGISTERED_USERS,
      JSON.stringify(users)
    );
  } catch (error) {
    console.error(error);
  }
}


function saveCurrentLicense(licenseNo) {
  if (!licenseNo) return;

  try {
    localStorage.setItem(
      STORAGE_LICENSE,
      String(licenseNo).trim()
    );
  } catch (error) {
    console.error(error);
  }
}


function getCurrentLicense() {
  try {
    return (
      localStorage.getItem(
        STORAGE_LICENSE
      ) || ""
    ).trim();

  } catch (error) {
    return "";
  }
}


/* =========================================================
   ADMIN LOGIN
   ========================================================= */

function openAdminLogin() {
  showPage("adminLoginPage");

  const password =
    document.getElementById("adminPassword");

  if (password) {
    password.value = "";

    setTimeout(() => {
      password.focus();
    }, 300);
  }

  const message =
    document.getElementById("adminLoginMessage");

  if (message) {
    message.textContent = "";
  }
}


async function adminLogin(event) {
  if (event) {
    event.preventDefault();
  }

  const passwordElement =
    document.getElementById("adminPassword");

  if (!passwordElement) {
    showError("Administrator password field was not found.");
    return;
  }

  const password =
    passwordElement.value || "";

  if (!password) {
    showAdminLoginMessage(
      "Please enter the administrator password."
    );

    passwordElement.focus();

    return;
  }

  showLoading("Checking administrator access...");

  try {
    const result = await apiCall(
      "checkAdminPassword",
      {
        password: password
      }
    );

    hideLoading();

    if (!result || !result.success) {
      showAdminLoginMessage(
        result?.message ||
        "Incorrect administrator password."
      );

      passwordElement.select();

      return;
    }

    showPage("adminPage");

    initializeAdminPage();

  } catch (error) {
    hideLoading();

    console.error(error);

    showAdminLoginMessage(
      "Unable to connect to the attendance server."
    );
  }
}


function showAdminLoginMessage(message) {
  const element =
    document.getElementById(
      "adminLoginMessage"
    );

  if (element) {
    element.textContent = message;
  }
}


/* =========================================================
   ADMIN PAGE
   ========================================================= */

function initializeAdminPage() {
  clearQR();

  loadAttendanceSummary();
}


/* =========================================================
   QR SELECTION
   ========================================================= */

function selectQRDay(date) {
  selectedQRDate = date;

  const hiddenDate =
    document.getElementById("attendanceDate");

  if (hiddenDate) {
    hiddenDate.value = date;
  }

  /*
   * Remove active state from all QR buttons if
   * the current HTML uses button classes.
   */
  document
    .querySelectorAll("[data-qr-date]")
    .forEach(button => {
      button.classList.toggle(
        "active",
        button.getAttribute("data-qr-date") === date
      );
    });
}


/* =========================================================
   GENERATE QR
   ========================================================= */

async function generateQR(mode) {
  const attendanceDate =
    selectedQRDate ||
    getInputValue("attendanceDate");

  if (!attendanceDate) {
    updateQRStatus(
      "Please select an attendance date first."
    );

    return;
  }

  if (!mode) {
    updateQRStatus(
      "Please select TIME-IN or TIME-OUT."
    );

    return;
  }

  selectedQRDate = attendanceDate;
  selectedQRMode = String(mode).toUpperCase();

  updateQRStatus(
    "Generating secure QR code..."
  );

  const container =
    document.getElementById("qrContainer");

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

  try {
    const result = await apiCall(
      "generateQR",
      {
        mode: selectedQRMode,
        attendanceDate: attendanceDate
      }
    );

    if (!result || !result.success) {
      updateQRStatus(
        result?.message ||
        "Unable to generate QR code."
      );

      return;
    }

    generatedQRData = result;

    displayQRCode(result);

  } catch (error) {
    console.error(error);

    updateQRStatus(
      "Unable to connect to the attendance server."
    );
  }
}


/* =========================================================
   DISPLAY QR
   ========================================================= */

function displayQRCode(result) {
  const container =
    document.getElementById("qrContainer");

  if (!container) {
    return;
  }

  container.innerHTML = "";

  if (
    typeof QRCode === "undefined"
  ) {
    updateQRStatus(
      "QR code library failed to load. Please refresh the page."
    );

    return;
  }

  const qrWrapper =
    document.createElement("div");

  qrWrapper.style.display = "flex";
  qrWrapper.style.justifyContent = "center";
  qrWrapper.style.alignItems = "center";
  qrWrapper.style.padding = "15px";

  container.appendChild(qrWrapper);

  try {
    new QRCode(qrWrapper, {
      text: result.url || result.token,
      width: 320,
      height: 320,
      correctLevel:
        QRCode.CorrectLevel.H
    });

    updateQRStatus(
      result.message ||
      `${selectedQRMode} QR generated successfully.`
    );

    const downloadButton =
      document.getElementById(
        "downloadQrButton"
      );

    if (downloadButton) {
      downloadButton.disabled = false;
    }

  } catch (error) {
    console.error("QR generation error:", error);

    updateQRStatus(
      "Unable to display QR code."
    );
  }
}


/* =========================================================
   DOWNLOAD SINGLE QR
   ========================================================= */

function downloadGeneratedQR() {
  if (!generatedQRData) {
    return;
  }

  const container =
    document.getElementById("qrContainer");

  if (!container) {
    return;
  }

  const canvas =
    container.querySelector("canvas");

  const image =
    container.querySelector("img");

  let dataURL = "";

  if (canvas) {
    dataURL = canvas.toDataURL("image/png");
  } else if (image) {
    dataURL = image.src;
  }

  if (!dataURL) {
    updateQRStatus(
      "QR image is not ready yet."
    );

    return;
  }

  const filename =
    buildQRFilename(
      selectedQRDate,
      selectedQRMode
    );

  const link =
    document.createElement("a");

  link.href = dataURL;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();
}


/* =========================================================
   QR STATUS
   ========================================================= */

function updateQRStatus(message) {
  const status =
    document.getElementById("qrStatus");

  if (status) {
    status.textContent = message || "";
  }
}


/* =========================================================
   CLEAR QR
   ========================================================= */

function clearQR() {
  selectedQRDate = "";
  selectedQRMode = "";
  generatedQRData = null;

  const container =
    document.getElementById("qrContainer");

  if (container) {
    container.innerHTML = "";
  }

  const status =
    document.getElementById("qrStatus");

  if (status) {
    status.textContent =
      "Select a day and attendance action to generate a QR code.";
  }

  const downloadButton =
    document.getElementById(
      "downloadQrButton"
    );

  if (downloadButton) {
    downloadButton.disabled = true;
  }

  const dateInput =
    document.getElementById("attendanceDate");

  if (dateInput) {
    dateInput.value = "";
  }
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
    const result =
      await apiCall(
        "getAttendanceSummary",
        {}
      );

    if (!result || !result.success) {
      container.innerHTML =
        escapeHtml(
          result?.message ||
          "Unable to load attendance summary."
        );

      return;
    }

    renderAttendanceSummary(
      result
    );

  } catch (error) {
    console.error(error);

    container.innerHTML =
      "Unable to connect to the attendance server.";
  }
}


function renderAttendanceSummary(result) {
  const container =
    document.getElementById(
      "attendanceSummary"
    );

  if (!container) {
    return;
  }

  const rows =
    Array.isArray(result.rows)
      ? result.rows
      : [];

  if (rows.length === 0) {
    container.innerHTML =
      "<p>No attendance records yet.</p>";

    return;
  }

  let html = `
    <div class="attendance-summary-table-wrapper">
      <table class="attendance-summary-table">
        <thead>
          <tr>
            <th>NAME</th>
            <th>LICENSE NO.</th>
            <th>DATE</th>
            <th>TIME IN</th>
            <th>TIME OUT</th>
          </tr>
        </thead>
        <tbody>
  `;

  rows.forEach(row => {
    html += `
      <tr>
        <td>
          ${escapeHtml(
            row.name ||
            getNameFromRow(row)
          )}
        </td>

        <td>
          ${escapeHtml(
            row.licenseNo || ""
          )}
        </td>

        <td>
          ${escapeHtml(
            formatDateDisplay(
              row.date || ""
            )
          )}
        </td>

        <td>
          ${escapeHtml(
            row.timeIn || ""
          )}
        </td>

        <td>
          ${escapeHtml(
            row.timeOut || ""
          )}
        </td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </div>
  `;

  container.innerHTML = html;
}


/* =========================================================
   UTILITY
   ========================================================= */

function getInputValue(id) {
  const element =
    document.getElementById(id);

  if (!element) {
    return "";
  }

  return String(
    element.value || ""
  ).trim();
}


function normalizeLicense(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}


function getFullName(user) {
  if (!user) {
    return "";
  }

  return [
    user.firstName,
    user.middleName,
    user.lastName
  ]
    .filter(Boolean)
    .join(" ");
}


function getNameFromRow(row) {
  if (!row) {
    return "";
  }

  return [
    row.firstName,
    row.middleName,
    row.lastName
  ]
    .filter(Boolean)
    .join(" ");
}


function formatDateDisplay(value) {
  if (!value) {
    return "";
  }

  const text =
    String(value).trim();

  /*
   * Keep already formatted dates.
   */
  if (
    text.match(
      /^\d{1,2}\/\d{1,2}\/\d{4}$/
    )
  ) {
    return text;
  }

  if (
    text.match(
      /^\d{4}-\d{2}-\d{2}$/
    )
  ) {
    const parts =
      text.split("-");

    return (
      parts[1] +
      "/" +
      parts[2] +
      "/" +
      parts[0]
    );
  }

  return text;
}


function buildQRFilename(
  date,
  mode
) {
  const dayMap = {
    "2026-09-09": "DAY1",
    "2026-09-10": "DAY2",
    "2026-09-11": "DAY3"
  };

  const day =
    dayMap[date] ||
    "ATTENDANCE";

  return (
    "INSET2026_" +
    day +
    "_" +
    String(mode || "")
      .toUpperCase()
      .replace(/\s+/g, "-") +
    "_" +
    date +
    ".png"
  );
}


function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


/* =========================================================
   OPTIONAL BACKWARD-COMPATIBILITY FUNCTIONS
   ========================================================= */

function chooseRegisteredUser(index) {
  const users =
    getRegisteredUsers();

  if (
    index < 0 ||
    index >= users.length
  ) {
    return;
  }

  currentUser =
    users[index];

  saveCurrentLicense(
    currentUser.licenseNo
  );

  showSelectedUserConfirmation();
}


function showUserSelection() {
  showPage("identifyPage");

  const input =
    document.getElementById(
      "licenseInput"
    );

  if (input) {
    input.value =
      getCurrentLicense();
  }
}


/* =========================================================
   DOM INITIALIZATION
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    /*
     * Registration form
     */
    const registrationForm =
      document.getElementById(
        "registrationForm"
      );

    if (registrationForm) {
      registrationForm.addEventListener(
        "submit",
        registerParticipant
      );
    }


    /*
     * License verification form
     */
    const identifyForm =
      document.getElementById(
        "identifyForm"
      );

    if (identifyForm) {
      identifyForm.addEventListener(
        "submit",
        identifyUser
      );
    }


    /*
     * Admin login form
     */
    const adminForm =
      document.getElementById(
        "adminLoginForm"
      );

    if (adminForm) {
      adminForm.addEventListener(
        "submit",
        adminLogin
      );
    }


    /*
     * Download QR button
     */
    const downloadButton =
      document.getElementById(
        "downloadQrButton"
      );

    if (downloadButton) {
      downloadButton.addEventListener(
        "click",
        downloadGeneratedQR
      );
    }


    /*
     * Hide loading overlay on initial load.
     */
    hideLoading();
  }
);


/* =========================================================
   PREVENT ACCIDENTAL BACK BUTTON SCANNER ISSUES
   ========================================================= */

window.addEventListener(
  "beforeunload",
  () => {
    stopScanner();
  }
);
