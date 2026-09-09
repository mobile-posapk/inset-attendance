/* =========================================================
   INSET 2026 ATTENDANCE SYSTEM
   FINAL app.js
   ========================================================= */

"use strict";

/* =========================================================
   CONFIGURATION
   ========================================================= */

const API_URL =
  "https://script.google.com/macros/s/AKfycbxtBRiR3XOLpidV5aaL0Im9emBZvJ_wsEi1CqABGV5-g0jIcZ0Ji7TqNOccygIlIflF3w/exec";

const EVENT_START = "2026-09-09";
const EVENT_END   = "2026-09-11";

const LICENSE_STORAGE_KEY = "inset_license";
const REGISTERED_USERS_STORAGE_KEY = "inset_registered_users";

const ADMIN_PASSWORD = "INSET2026ADMIN";

/* =========================================================
   GLOBAL VARIABLES
   ========================================================= */

let scanner = null;
let scannerRunning = false;
let scannerProcessing = false;

let qrCountdownTimer = null;

let currentParticipant = null;
let selectedUserIndex = null;

let currentQRData = null;
let currentQRMode = "";
let currentQRDate = "";

let apiRequestInProgress = false;


/* =========================================================
   BASIC HELPERS
   ========================================================= */

function $(id) {
  return document.getElementById(id);
}

function showPage(pageId) {
  const pages = [
    "homePage",
    "identifyPage",
    "registrationPage",
    "scannerPage",
    "successPage",
    "errorPage",
    "adminLoginPage",
    "adminPage"
  ];

  pages.forEach(function (id) {
    const el = $(id);

    if (el) {
      el.style.display = id === pageId ? "block" : "none";
    }
  });

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function setText(id, text) {
  const el = $(id);

  if (el) {
    el.textContent = text == null ? "" : String(text);
  }
}

function escapeHtml(text) {
  return String(text == null ? "" : text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


/* =========================================================
   LOADING OVERLAY
   ========================================================= */

function showLoading(message) {
  const overlay = $("loadingOverlay");

  if (!overlay) {
    return;
  }

  const messageElement =
    overlay.querySelector(".loading-message") ||
    overlay.querySelector("#loadingMessage");

  if (messageElement) {
    messageElement.textContent = message || "Please wait...";
  }

  overlay.style.display = "flex";
}

function hideLoading() {
  const overlay = $("loadingOverlay");

  if (overlay) {
    overlay.style.display = "none";
  }
}


/* =========================================================
   API CONNECTION
   ========================================================= */

/*
 * Primary method:
 *   fetch()
 *
 * Fallback:
 *   JSONP
 *
 * The JSONP fallback is important for browsers / in-app browsers
 * that have problems following Google Apps Script redirects
 * through fetch().
 */

async function apiCall(action, data) {
  data = data || {};

  const url =
    API_URL +
    "?action=" +
    encodeURIComponent(action) +
    "&data=" +
    encodeURIComponent(JSON.stringify(data));

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }

    const text = await response.text();

    let result;

    try {
      result = JSON.parse(text);
    } catch (parseError) {
      throw new Error("Invalid server response.");
    }

    return result;

  } catch (fetchError) {
    console.warn(
      "Fetch API failed. Trying JSONP fallback...",
      fetchError
    );

    try {
      return await apiCallJSONP(action, data);
    } catch (jsonpError) {
      console.error("JSONP fallback failed:", jsonpError);

      throw new Error(
        fetchError && fetchError.message
          ? fetchError.message
          : "Unable to connect to the attendance server."
      );
    }
  }
}


/* =========================================================
   JSONP FALLBACK
   ========================================================= */

function apiCallJSONP(action, data) {
  data = data || {};

  return new Promise(function (resolve, reject) {

    const callbackName =
      "insetAttendanceCallback_" +
      Date.now() +
      "_" +
      Math.floor(Math.random() * 100000);

    const script = document.createElement("script");

    let finished = false;

    const timeout = setTimeout(function () {

      if (finished) {
        return;
      }

      finished = true;

      cleanup();

      reject(
        new Error("The attendance server did not respond.")
      );

    }, 20000);


    function cleanup() {
      clearTimeout(timeout);

      try {
        delete window[callbackName];
      } catch (e) {
        window[callbackName] = undefined;
      }

      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    }


    window[callbackName] = function (result) {

      if (finished) {
        return;
      }

      finished = true;

      cleanup();

      resolve(result);
    };


    script.onerror = function () {

      if (finished) {
        return;
      }

      finished = true;

      cleanup();

      reject(
        new Error("Unable to connect to the attendance server.")
      );
    };


    script.src =
      API_URL +
      "?action=" +
      encodeURIComponent(action) +
      "&data=" +
      encodeURIComponent(JSON.stringify(data)) +
      "&callback=" +
      encodeURIComponent(callbackName) +
      "&_=" +
      Date.now();

    document.head.appendChild(script);
  });
}


/* =========================================================
   CONNECTION TEST
   ========================================================= */

async function testServerConnection() {
  try {
    const result = await apiCall("ping", {});

    return !!(
      result &&
      (
        result.success === true ||
        result.status === "ok"
      )
    );

  } catch (error) {
    console.error("Connection test failed:", error);
    return false;
  }
}


/* =========================================================
   LOCAL STORAGE
   ========================================================= */

function getRegisteredUsers() {
  try {
    const raw =
      localStorage.getItem(REGISTERED_USERS_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const users = JSON.parse(raw);

    if (!Array.isArray(users)) {
      return [];
    }

    return users.filter(function (user) {
      return user &&
        String(user.firstName || "").trim() &&
        String(user.lastName || "").trim() &&
        String(user.licenseNo || "").trim();
    });

  } catch (error) {
    console.error("Unable to read registered users:", error);
    return [];
  }
}

function saveRegisteredUsers(users) {
  localStorage.setItem(
    REGISTERED_USERS_STORAGE_KEY,
    JSON.stringify(users || [])
  );
}

function saveSelectedLicense(licenseNo) {
  if (licenseNo) {
    localStorage.setItem(
      LICENSE_STORAGE_KEY,
      String(licenseNo).trim()
    );
  }
}

function getSavedLicense() {
  return (
    localStorage.getItem(LICENSE_STORAGE_KEY) || ""
  ).trim();
}


/* =========================================================
   DATE HELPERS
   ========================================================= */

function parseLocalDate(dateString) {
  const parts = String(dateString).split("-");

  if (parts.length !== 3) {
    return new Date(dateString);
  }

  return new Date(
    Number(parts[0]),
    Number(parts[1]) - 1,
    Number(parts[2])
  );
}

function formatLongDate(dateString) {
  const date = parseLocalDate(dateString);

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function formatShortDate(dateString) {
  const date = parseLocalDate(dateString);

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function getDayNumber(dateString) {
  const date = parseLocalDate(dateString);
  const eventStart = parseLocalDate(EVENT_START);

  return Math.round(
    (
      date.getTime() -
      eventStart.getTime()
    ) /
    (24 * 60 * 60 * 1000)
  ) + 1;
}

function isValidEventDate(dateString) {
  return (
    String(dateString) >= EVENT_START &&
    String(dateString) <= EVENT_END
  );
}


/* =========================================================
   HOME
   ========================================================= */

function startAttendance() {

  const users = getRegisteredUsers();

  if (!users.length) {
    openRegistration(
      "PRC ACCREDITATION"
    );
    return;
  }

  if (users.length === 1) {
    selectedUserIndex = 0;

    currentParticipant = users[0];

    saveSelectedLicense(
      users[0].licenseNo
    );

    confirmSelectedUser();
    return;
  }

  showUserSelection(users);
}


/* =========================================================
   REGISTER
   ========================================================= */

function openRegistration(message) {

  showPage("registrationPage");

  const note = $("registrationNote");

  if (note) {
    note.textContent =
      message ||
      "Register your details on this device.";
  }

  const firstName = $("firstName");

  if (firstName) {
    setTimeout(function () {
      firstName.focus();
    }, 200);
  }
}


async function submitRegistration() {

  const firstName =
    ($("firstName")?.value || "").trim();

  const middleName =
    ($("middleName")?.value || "").trim();

  const lastName =
    ($("lastName")?.value || "").trim();

  const licenseNo =
    ($("registrationLicense")?.value || "").trim();


  if (!firstName) {
    alert("Please enter your first name.");
    $("firstName")?.focus();
    return;
  }

  if (!lastName) {
    alert("Please enter your last name.");
    $("lastName")?.focus();
    return;
  }

  if (!licenseNo) {
    alert("Please enter your PRC License No.");
    $("registrationLicense")?.focus();
    return;
  }


  const participant = {
    firstName: firstName,
    middleName: middleName,
    lastName: lastName,
    licenseNo: licenseNo
  };


  showLoading("Registering participant...");


  try {

    const result = await apiCall(
      "registerParticipant",
      participant
    );


    if (!result || result.success !== true) {

      alert(
        result?.message ||
        "Registration failed."
      );

      return;
    }


    const users = getRegisteredUsers();

    const duplicateIndex = users.findIndex(
      function (user) {
        return normalizeLicense(
          user.licenseNo
        ) === normalizeLicense(
          licenseNo
        );
      }
    );


    if (duplicateIndex >= 0) {
      users[duplicateIndex] = participant;
    } else {
      users.push(participant);
    }


    saveRegisteredUsers(users);

    saveSelectedLicense(licenseNo);


    currentParticipant = participant;

    selectedUserIndex =
      users.findIndex(function (user) {
        return normalizeLicense(
          user.licenseNo
        ) === normalizeLicense(
          licenseNo
        );
      });


    clearRegistrationForm();

    hideLoading();

    confirmSelectedUser();


  } catch (error) {

    console.error(
      "Registration error:",
      error
    );

    alert(
      "Unable to connect to the attendance server.\n\n" +
      "Please check your internet connection and try again."
    );

  } finally {

    hideLoading();
  }
}


function clearRegistrationForm() {

  [
    "firstName",
    "middleName",
    "lastName",
    "registrationLicense"
  ].forEach(function (id) {

    const el = $(id);

    if (el) {
      el.value = "";
    }

  });
}


/* =========================================================
   USER SELECTION
   ========================================================= */

function showUserSelection(users) {

  const page = $("identifyPage");

  if (!page) {
    return;
  }


  let container =
    $("registeredUsersList");


  if (!container) {

    container = document.createElement("div");

    container.id = "registeredUsersList";

    container.className =
      "registered-users-list";

    const existing =
      page.querySelector(".page-content") ||
      page.querySelector(".card") ||
      page;

    existing.appendChild(container);
  }


  let html = "";

  html +=
    '<div class="user-selection-heading">' +
      "<h2>Select Participant</h2>" +
      "<p>Who is attending?</p>" +
    "</div>";


  users.forEach(function (user, index) {

    const fullName =
      buildFullName(user);


    html +=
      '<button type="button" ' +
      'class="registered-user-button" ' +
      'onclick="chooseRegisteredUser(' +
      index +
      ')">' +

        '<span class="registered-user-name">' +
          escapeHtml(fullName) +
        "</span>" +

        '<span class="registered-user-license">' +
          "PRC License No.: " +
          escapeHtml(user.licenseNo) +
        "</span>" +

      "</button>";

  });


  html +=
    '<button type="button" ' +
    'class="secondary-button" ' +
    'onclick="openRegistration()">' +
      "➕ Register Another User" +
    "</button>";


  container.innerHTML = html;

  showPage("identifyPage");
}


function chooseRegisteredUser(index) {

  const users = getRegisteredUsers();

  if (
    index < 0 ||
    index >= users.length
  ) {
    return;
  }


  selectedUserIndex = index;

  currentParticipant = users[index];

  saveSelectedLicense(
    users[index].licenseNo
  );


  confirmSelectedUser();
}


/* =========================================================
   CONFIRM SELECTED USER
   ========================================================= */

function confirmSelectedUser() {

  if (!currentParticipant) {
    startAttendance();
    return;
  }


  const participant =
    currentParticipant;


  const fullName =
    buildFullName(participant);


  let message =
    "You are attending as:\n\n" +
    fullName +
    "\n\nPRC License No.: " +
    participant.licenseNo +
    "\n\nContinue to QR scanner?";


  const confirmed =
    window.confirm(message);


  if (!confirmed) {
    showPage("homePage");
    return;
  }


  startScanner();
}


/* =========================================================
   BUILD NAME
   ========================================================= */

function buildFullName(user) {

  if (!user) {
    return "";
  }

  return [
    user.firstName,
    user.middleName,
    user.lastName
  ]
    .map(function (value) {
      return String(value || "").trim();
    })
    .filter(Boolean)
    .join(" ");
}


/* =========================================================
   LICENSE NORMALIZATION
   ========================================================= */

function normalizeLicense(value) {

  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}


/* =========================================================
   SCANNER
   ========================================================= */

async function startScanner() {

  showPage("scannerPage");

  scannerProcessing = false;

  setText(
    "scannerStatus",
    "Starting camera..."
  );


  if (
    typeof Html5Qrcode === "undefined"
  ) {

    setText(
      "scannerStatus",
      "Scanner library is loading..."
    );


    await waitForScannerLibrary();


    if (
      typeof Html5Qrcode === "undefined"
    ) {

      setText(
        "scannerStatus",
        "Unable to load the QR scanner."
      );

      return;
    }
  }


  try {

    if (scanner) {
      await stopScanner();
    }


    scanner =
      new Html5Qrcode("reader");


    const config = {
      fps: 10,
      qrbox: {
        width: 280,
        height: 280
      },
      aspectRatio: 1
    };


    await scanner.start(
      {
        facingMode: "environment"
      },
      config,
      function (decodedText) {

        handleQRCode(decodedText);

      },
      function (errorMessage) {
        // Ignore normal scanner decode failures.
      }
    );


    scannerRunning = true;


    setText(
      "scannerStatus",
      "Point the camera at the attendance QR code."
    );


  } catch (error) {

    console.error(
      "Scanner start error:",
      error
    );


    setText(
      "scannerStatus",
      "Unable to start the camera."
    );


    alert(
      "Unable to start the camera.\n\n" +
      "Please allow camera permission and try again."
    );
  }
}


function waitForScannerLibrary() {

  return new Promise(function (resolve) {

    let attempts = 0;

    const timer =
      setInterval(function () {

        attempts++;


        if (
          typeof Html5Qrcode !== "undefined"
        ) {

          clearInterval(timer);
          resolve();
          return;
        }


        if (attempts >= 50) {

          clearInterval(timer);
          resolve();
        }

      }, 200);

  });
}


async function stopScanner() {

  if (!scanner) {
    return;
  }


  try {

    if (scannerRunning) {
      await scanner.stop();
    }

  } catch (error) {

    console.warn(
      "Scanner stop warning:",
      error
    );

  } finally {

    scannerRunning = false;

    try {
      scanner.clear();
    } catch (e) {
      // Ignore.
    }

    scanner = null;
  }
}


/* =========================================================
   QR CODE HANDLER
   ========================================================= */

async function handleQRCode(decodedText) {

  if (scannerProcessing) {
    return;
  }


  const token =
    String(
      decodedText || ""
    ).trim();


  if (!token) {
    return;
  }


  await stopScanner();


  if (!currentParticipant) {

    const savedLicense =
      getSavedLicense();


    if (!savedLicense) {

      showError(
        "No participant has been selected."
      );

      return;
    }


    currentParticipant = {
      licenseNo:
        savedLicense
    };
  }


  await processDecodedAttendanceToken(
    token
  );
}

/* =========================================================
   SUCCESS PAGE
   ========================================================= */

function showAttendanceSuccess(result) {

  const participant =
    currentParticipant || {};


  const fullName =
    buildFullName(participant);


  let details = "";


  if (fullName) {

    details +=
      "<strong>" +
      escapeHtml(fullName) +
      "</strong><br>";
  }


  if (participant.licenseNo) {

    details +=
      "PRC License No.: " +
      escapeHtml(
        participant.licenseNo
      ) +
      "<br>";
  }


  if (result.attendanceDate) {

    details +=
      "Date: " +
      escapeHtml(
        result.attendanceDate
      ) +
      "<br>";
  }


  if (result.mode) {

    details +=
      "Attendance: " +
      escapeHtml(
        formatMode(result.mode)
      ) +
      "<br>";
  }


  if (result.time) {

    details +=
      "Time: " +
      escapeHtml(
        result.time
      );
  }


  const detailsElement =
    $("successDetails");


  if (detailsElement) {
    detailsElement.innerHTML = details;
  }


  setText(
    "successMessage",
    result.message ||
    "Attendance recorded successfully."
  );


  showPage("successPage");
}


/* =========================================================
   ERROR PAGE
   ========================================================= */

function showError(message) {

  setText(
    "errorMessage",
    message ||
    "Something went wrong."
  );


  showPage("errorPage");
}


/* =========================================================
   MODE FORMATTER
   ========================================================= */

function formatMode(mode) {

  const value =
    String(mode || "")
      .toUpperCase()
      .replace(/[_-]+/g, " ");


  if (
    value === "TIME IN" ||
    value === "TIME-IN"
  ) {
    return "TIME IN";
  }


  if (
    value === "TIME OUT" ||
    value === "TIME-OUT"
  ) {
    return "TIME OUT";
  }


  return value;
}


/* =========================================================
   HOME RESET
   ========================================================= */

function returnHome() {

  stopScanner();

  scannerProcessing = false;

  currentParticipant = null;

  selectedUserIndex = null;

  showPage("homePage");
}


/* =========================================================
   ADMIN LOGIN
   ========================================================= */

function openAdminLogin() {

  showPage("adminLoginPage");

  const password =
    $("adminPassword");


  if (password) {

    password.value = "";

    setTimeout(function () {
      password.focus();
    }, 200);
  }
}


async function adminLogin() {

  const password =
    ($("adminPassword")?.value || "").trim();


  if (!password) {

    alert(
      "Please enter the administrator password."
    );

    $("adminPassword")?.focus();

    return;
  }


  showLoading(
    "Checking administrator password..."
  );


  try {

    const result =
      await apiCall(
        "checkAdminPassword",
        {
          password: password
        }
      );


    if (
      result &&
      result.success === true
    ) {

      if ($("adminPassword")) {
        $("adminPassword").value = "";
      }


      hideLoading();

      showPage("adminPage");

      loadAttendanceSummary();

      return;
    }


    alert(
      result?.message ||
      "Incorrect administrator password."
    );


  } catch (error) {

    console.error(
      "Admin login error:",
      error
    );


    alert(
      "Unable to connect to the attendance server."
    );

  } finally {

    hideLoading();
  }
}


/* =========================================================
   ADMIN PAGE
   ========================================================= */

function openAdminPage() {

  showPage("adminPage");

  loadAttendanceSummary();
}


function logoutAdmin() {

  clearQR();

  showPage("homePage");
}


/* =========================================================
   QR SELECTION
   ========================================================= */

function selectQRDay(dateString) {

  if (!isValidEventDate(dateString)) {

    alert(
      "Invalid attendance date."
    );

    return;
  }


  const input =
    $("attendanceDate");


  if (input) {
    input.value = dateString;
  }


  currentQRDate = dateString;
}


/* =========================================================
   QR GENERATION
   ========================================================= */

async function generateQR(mode) {

  const dateInput =
    $("attendanceDate");


  const attendanceDate =
    dateInput?.value ||
    currentQRDate ||
    EVENT_START;


  if (!isValidEventDate(attendanceDate)) {

    alert(
      "Please select a valid attendance date."
    );

    return;
  }


  mode =
    String(mode || "")
      .toUpperCase();


  if (
    mode !== "TIME-IN" &&
    mode !== "TIME-OUT"
  ) {

    alert(
      "Invalid QR attendance mode."
    );

    return;
  }


  currentQRDate =
    attendanceDate;

  currentQRMode =
    mode;


  const status =
    $("qrStatus");


  if (status) {

    status.textContent =
      "Generating " +
      mode +
      " QR code for " +
      formatLongDate(
        attendanceDate
      ) +
      "...";
  }


  const container =
    $("qrContainer");


  if (container) {
    container.innerHTML = "";
  }


  const downloadButton =
    $("downloadQrButton");


  if (downloadButton) {
    downloadButton.disabled = true;
  }


  showLoading(
    "Generating attendance QR code..."
  );


  try {

    const result =
      await apiCall(
        "generateQR",
        {
          mode: mode,
          attendanceDate:
            attendanceDate
        }
      );


    if (
      !result ||
      result.success !== true
    ) {

      throw new Error(
        result?.message ||
        "Unable to generate QR code."
      );
    }


    currentQRData = result;


    await displayGeneratedQR(result);


    hideLoading();


    if (status) {

      status.innerHTML =
        "<strong>" +
        escapeHtml(
          mode
        ) +
        "</strong><br>" +
        "DAY " +
        getDayNumber(
          attendanceDate
        ) +
        " — " +
        escapeHtml(
          formatLongDate(
            attendanceDate
          )
        ) +
        "<br>" +
        "QR code generated successfully.";
    }


    if (downloadButton) {
      downloadButton.disabled = false;
    }


  } catch (error) {

    hideLoading();


    console.error(
      "QR generation error:",
      error
    );


    if (status) {

      status.textContent =
        error.message ||
        "Unable to generate QR code.";
    }


    alert(
      error.message ||
      "Unable to generate QR code."
    );
  }
}


/* =========================================================
   QR CODE LIBRARY
   ========================================================= */

function loadQRCodeLibrary() {

  if (
    typeof QRCode !== "undefined"
  ) {
    return Promise.resolve();
  }


  return new Promise(function (
    resolve,
    reject
  ) {

    const existing =
      document.querySelector(
        'script[data-inset-qrcode="true"]'
      );


    if (existing) {

      existing.addEventListener(
        "load",
        function () {
          resolve();
        }
      );

      existing.addEventListener(
        "error",
        function () {
          reject(
            new Error(
              "Unable to load QR code library."
            )
          );
        }
      );

      return;
    }


    const script =
      document.createElement("script");


    script.src =
      "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";

    script.async = true;

    script.dataset.insetQrcode = "true";


    script.onload = function () {

      if (
        typeof QRCode !== "undefined"
      ) {
        resolve();
      } else {
        reject(
          new Error(
            "QR code library loaded incorrectly."
          )
        );
      }
    };


    script.onerror = function () {

      reject(
        new Error(
          "Unable to load QR code library."
        )
      );
    };


    document.head.appendChild(script);
  });
}


/* =========================================================
   DISPLAY QR
   ========================================================= */

async function displayGeneratedQR(result) {

  const container =
    $("qrContainer");


  if (!container) {
    return;
  }


  container.innerHTML = "";


  /*
   * The backend returns the secure attendance token.
   * The QR itself contains ONLY the secure token.
   */

  const qrValue =
    result.token ||
    result.qrData ||
    result.value ||
    result.url;


  if (!qrValue) {

    throw new Error(
      "The server did not return a QR value."
    );
  }


  await loadQRCodeLibrary();


  new QRCode(
    container,
    {
      text: String(qrValue),
      width: 320,
      height: 320,
      correctLevel:
        QRCode.CorrectLevel.H
    }
  );


  /*
   * Save the exact generated value so that
   * the PDF generator uses the same token.
   */

  currentQRData = Object.assign(
    {},
    result,
    {
      token:
        result.token ||
        result.qrData ||
        result.value ||
        result.url
    }
  );
}


/* =========================================================
   DOWNLOAD CURRENT QR
   ========================================================= */

async function downloadCurrentQR() {

  if (!currentQRData) {

    alert(
      "Please generate a QR code first."
    );

    return;
  }


  const qrValue =
    currentQRData.token ||
    currentQRData.qrData ||
    currentQRData.value ||
    currentQRData.url;


  if (!qrValue) {

    alert(
      "QR code data is unavailable."
    );

    return;
  }


  try {

    await loadQRCodeLibrary();


    const temporary =
      document.createElement("div");


    temporary.style.position =
      "fixed";

    temporary.style.left =
      "-10000px";

    temporary.style.top =
      "-10000px";

    temporary.style.width =
      "1000px";

    temporary.style.height =
      "1000px";

    temporary.style.background =
      "#ffffff";

    document.body.appendChild(
      temporary
    );


    new QRCode(
      temporary,
      {
        text: String(qrValue),
        width: 1000,
        height: 1000,
        correctLevel:
          QRCode.CorrectLevel.H
      }
    );


    await wait(500);


    const canvas =
      temporary.querySelector("canvas");


    if (!canvas) {

      temporary.remove();

      throw new Error(
        "Unable to create QR image."
      );
    }


    const link =
      document.createElement("a");


    const safeDate =
      currentQRDate ||
      EVENT_START;


    const safeMode =
      currentQRMode ||
      "QR";


    link.download =
      "INSET2026_" +
      "DAY" +
      getDayNumber(
        safeDate
      ) +
      "_" +
      safeMode +
      "_" +
      safeDate +
      ".png";


    link.href =
      canvas.toDataURL(
        "image/png"
      );


    document.body.appendChild(link);

    link.click();

    link.remove();

    temporary.remove();


  } catch (error) {

    console.error(
      "QR download error:",
      error
    );


    alert(
      "Unable to download the QR code."
    );
  }
}


/* =========================================================
   JAVASCRIPT-PDF LIBRARY
   ========================================================= */

function loadJsPDF() {

  if (
    window.jspdf &&
    window.jspdf.jsPDF
  ) {
    return Promise.resolve();
  }


  return new Promise(function (
    resolve,
    reject
  ) {

    const existing =
      document.querySelector(
        'script[data-inset-jspdf="true"]'
      );


    if (existing) {

      existing.addEventListener(
        "load",
        function () {
          resolve();
        }
      );

      existing.addEventListener(
        "error",
        function () {
          reject(
            new Error(
              "Unable to load PDF library."
            )
          );
        }
      );

      return;
    }


    const script =
      document.createElement("script");


    script.src =
      "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";

    script.async = true;

    script.dataset.insetJspdf =
      "true";


    script.onload = function () {

      if (
        window.jspdf &&
        window.jspdf.jsPDF
      ) {
        resolve();
      } else {
        reject(
          new Error(
            "PDF library loaded incorrectly."
          )
        );
      }
    };


    script.onerror = function () {

      reject(
        new Error(
          "Unable to load PDF library."
        )
      );
    };


    document.head.appendChild(script);
  });
}


/* =========================================================
   WAIT HELPER
   ========================================================= */

function wait(milliseconds) {

  return new Promise(function (resolve) {

    setTimeout(
      resolve,
      milliseconds
    );

  });
}


/* =========================================================
   CREATE HIGH-RESOLUTION QR CANVAS
   ========================================================= */

async function createQRCanvas(value) {

  await loadQRCodeLibrary();


  const wrapper =
    document.createElement("div");


  wrapper.style.position =
    "fixed";

  wrapper.style.left =
    "-20000px";

  wrapper.style.top =
    "-20000px";

  wrapper.style.width =
    "1000px";

  wrapper.style.height =
    "1000px";

  wrapper.style.background =
    "#ffffff";


  document.body.appendChild(
    wrapper
  );


  new QRCode(
    wrapper,
    {
      text: String(value),
      width: 1000,
      height: 1000,
      correctLevel:
        QRCode.CorrectLevel.H
    }
  );


  await wait(400);


  const canvas =
    wrapper.querySelector(
      "canvas"
    );


  if (!canvas) {

    wrapper.remove();

    throw new Error(
      "Unable to create QR canvas."
    );
  }


  const dataUrl =
    canvas.toDataURL(
      "image/png"
    );


  wrapper.remove();


  return dataUrl;
}


/* =========================================================
   DOWNLOAD ALL SIX QR CODES — A4 PDF
   ========================================================= */

async function downloadAllQRCodesPDF() {

  const confirmed =
    window.confirm(
      "Generate the complete 6-page A4 PDF?\n\n" +
      "Each page will contain one QR code:\n\n" +
      "DAY 1 — TIME IN\n" +
      "DAY 1 — TIME OUT\n" +
      "DAY 2 — TIME IN\n" +
      "DAY 2 — TIME OUT\n" +
      "DAY 3 — TIME IN\n" +
      "DAY 3 — TIME OUT"
    );


  if (!confirmed) {
    return;
  }


  showLoading(
    "Generating all 6 QR codes and A4 PDF..."
  );


  try {

    await loadQRCodeLibrary();

    await loadJsPDF();


    const jsPDF =
      window.jspdf.jsPDF;


    const pdf =
      new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });


    const qrList = [
      {
        date: "2026-09-09",
        mode: "TIME-IN"
      },
      {
        date: "2026-09-09",
        mode: "TIME-OUT"
      },
      {
        date: "2026-09-10",
        mode: "TIME-IN"
      },
      {
        date: "2026-09-10",
        mode: "TIME-OUT"
      },
      {
        date: "2026-09-11",
        mode: "TIME-IN"
      },
      {
        date: "2026-09-11",
        mode: "TIME-OUT"
      }
    ];


    for (
      let i = 0;
      i < qrList.length;
      i++
    ) {

      const item =
        qrList[i];


      setLoadingMessage(
        "Generating page " +
        (i + 1) +
        " of 6..."
      );


      const result =
        await apiCall(
          "generateQR",
          {
            mode:
              item.mode,

            attendanceDate:
              item.date
          }
        );


      if (
        !result ||
        result.success !== true
      ) {

        throw new Error(
          result?.message ||
          "Unable to generate QR for " +
          item.date +
          " " +
          item.mode
        );
      }


      const qrValue =
        result.token ||
        result.qrData ||
        result.value ||
        result.url;


      if (!qrValue) {

        throw new Error(
          "QR token missing for " +
          item.date +
          " " +
          item.mode
        );
      }


      const qrImage =
        await createQRCanvas(
          qrValue
        );


      if (i > 0) {
        pdf.addPage();
      }


      drawQRPDFPage(
        pdf,
        item.date,
        item.mode,
        qrImage
      );
    }


    pdf.save(
      "INSET2026_ATTENDANCE_QR_CODES_A4.pdf"
    );


  } catch (error) {

    console.error(
      "PDF generation error:",
      error
    );


    alert(
      error.message ||
      "Unable to generate the A4 PDF."
    );


  } finally {

    hideLoading();
  }
}


/* =========================================================
   LOADING MESSAGE
   ========================================================= */

function setLoadingMessage(message) {

  const overlay =
    $("loadingOverlay");


  if (!overlay) {
    return;
  }


  const messageElement =
    overlay.querySelector(
      ".loading-message"
    ) ||
    overlay.querySelector(
      "#loadingMessage"
    );


  if (messageElement) {

    messageElement.textContent =
      message;
  }
}


/* =========================================================
   DRAW A4 PDF PAGE
   ========================================================= */

function drawQRPDFPage(
  pdf,
  dateString,
  mode,
  qrImage
) {

  const pageWidth = 210;
  const pageHeight = 297;


  const dayNumber =
    getDayNumber(
      dateString
    );


  /*
   * Header
   */

  pdf.setFont(
    "helvetica",
    "bold"
  );

  pdf.setFontSize(26);

  pdf.text(
    "INSET 2026",
    pageWidth / 2,
    27,
    {
      align: "center"
    }
  );


  /*
   * Attendance mode
   */

  pdf.setFontSize(24);

  pdf.text(
    "DAY " +
      dayNumber +
      ": " +
      formatMode(mode),
    pageWidth / 2,
    47,
    {
      align: "center"
    }
  );


  /*
   * Date
   */

  pdf.setFont(
    "helvetica",
    "normal"
  );

  pdf.setFontSize(15);

  pdf.text(
    formatLongDate(
      dateString
    ),
    pageWidth / 2,
    59,
    {
      align: "center"
    }
  );


  /*
   * Instruction
   */

  pdf.setFont(
    "helvetica",
    "bold"
  );

  pdf.setFontSize(14);

  pdf.text(
    "SCAN THIS QR CODE FOR " +
      formatMode(mode),
    pageWidth / 2,
    75,
    {
      align: "center"
    }
  );


  /*
   * QR code
   */

  const qrSize = 150;

  const qrX =
    (pageWidth - qrSize) / 2;

  const qrY = 82;


  pdf.addImage(
    qrImage,
    "PNG",
    qrX,
    qrY,
    qrSize,
    qrSize
  );


  /*
   * Footer
   */

  pdf.setFont(
    "helvetica",
    "bold"
  );

  pdf.setFontSize(13);

  pdf.text(
    "INSET 2026 ATTENDANCE",
    pageWidth / 2,
    249,
    {
      align: "center"
    }
  );


  pdf.setFont(
    "helvetica",
    "normal"
  );

  pdf.setFontSize(11);

  pdf.text(
    "Scan the QR code using the INSET 2026 Attendance System.",
    pageWidth / 2,
    259,
    {
      align: "center"
    }
  );


  pdf.setFontSize(9);

  pdf.text(
    "The attendance time is recorded by the attendance server.",
    pageWidth / 2,
    270,
    {
      align: "center"
    }
  );
}


/* =========================================================
   CLEAR QR
   ========================================================= */

function clearQR() {

  currentQRData = null;

  currentQRMode = "";

  currentQRDate = "";


  const container =
    $("qrContainer");


  if (container) {
    container.innerHTML = "";
  }


  const status =
    $("qrStatus");


  if (status) {
    status.textContent =
      "Select a day and attendance mode to generate a QR code.";
  }


  const button =
    $("downloadQrButton");


  if (button) {
    button.disabled = true;
  }
}


/* =========================================================
   ATTENDANCE SUMMARY
   ========================================================= */

async function loadAttendanceSummary() {

  const container =
    $("attendanceSummary");


  if (!container) {
    return;
  }


  container.innerHTML =
    "<p>Loading attendance summary...</p>";


  try {

    const result =
      await apiCall(
        "getAttendanceSummary",
        {}
      );


    if (
      !result ||
      result.success !== true
    ) {

      throw new Error(
        result?.message ||
        "Unable to load attendance summary."
      );
    }


    renderAttendanceSummary(
      result
    );


  } catch (error) {

    console.error(
      "Summary error:",
      error
    );


    container.innerHTML =
      "<p>" +
      escapeHtml(
        error.message ||
        "Unable to load attendance summary."
      ) +
      "</p>";
  }
}


/* =========================================================
   RENDER ATTENDANCE SUMMARY
   ========================================================= */

function renderAttendanceSummary(result) {

  const container =
    $("attendanceSummary");


  if (!container) {
    return;
  }


  const records =
    Array.isArray(result.records)
      ? result.records
      : Array.isArray(result.data)
        ? result.data
        : [];


  if (!records.length) {

    container.innerHTML =
      "<p>No attendance records yet.</p>";

    return;
  }


  let html = "";


  html +=
    '<div class="attendance-summary-table-wrapper">';


  html +=
    "<table class=\"attendance-summary-table\">";


  html += "<thead>";

  html += "<tr>";

  html +=
    "<th>NAME</th>";

  html +=
    "<th>DATE</th>";

  html +=
    "<th>PRC LICENSE NO.</th>";

  html +=
    "<th>TIME IN</th>";

  html +=
    "<th>TIME OUT</th>";

  html += "</tr>";

  html += "</thead>";


  html += "<tbody>";


  records.forEach(function (record) {

    const name =
      record.name ||
      buildFullName(record);


    html += "<tr>";


    html +=
      "<td>" +
      escapeHtml(name) +
      "</td>";


    html +=
      "<td>" +
      escapeHtml(
        record.date ||
        record.attendanceDate ||
        ""
      ) +
      "</td>";


    html +=
      "<td>" +
      escapeHtml(
        record.licenseNo ||
        record.license ||
        ""
      ) +
      "</td>";


    html +=
      "<td>" +
      escapeHtml(
        record.timeIn ||
        ""
      ) +
      "</td>";


    html +=
      "<td>" +
      escapeHtml(
        record.timeOut ||
        ""
      ) +
      "</td>";


    html += "</tr>";
  });


  html += "</tbody>";

  html += "</table>";

  html += "</div>";


  container.innerHTML =
    html;
}


/* =========================================================
   KEYBOARD SUPPORT
   ========================================================= */

document.addEventListener(
  "keydown",
  function (event) {

    /*
     * Admin login with Enter.
     */

    if (
      event.key === "Enter" &&
      $("adminLoginPage") &&
      $("adminLoginPage").style.display !== "none"
    ) {

      const active =
        document.activeElement;


      if (
        active &&
        active.id === "adminPassword"
      ) {

        event.preventDefault();

        adminLogin();
      }
    }

  }
);


/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  function () {

    /*
     * Make sure the home page is visible
     * when the application starts.
     */

    showPage("homePage");


    /*
     * Hide loading overlay.
     */

    hideLoading();


    /*
     * Disable QR download button
     * until a QR is generated.
     */

    const downloadButton =
      $("downloadQrButton");


    if (downloadButton) {
      downloadButton.disabled = true;
    }


    /*
     * Set default attendance date.
     */

    const dateInput =
      $("attendanceDate");


    if (dateInput) {

      dateInput.value =
        EVENT_START;

      currentQRDate =
        EVENT_START;
    }


    /*
     * Prevent browser from restoring
     * an old form state.
     */

    document.querySelectorAll(
      "input"
    ).forEach(function (input) {

      input.setAttribute(
        "autocomplete",
        "off"
      );

    });

  }
);

/* =========================================================
   OPEN QR IMAGE PICKER
   ========================================================= */

function openQRImagePicker() {
  const input = document.getElementById("qrImageUpload");

  if (!input) {
    console.error(
      "QR image upload input was not found."
    );
    return;
  }

  /*
   * Reset the input first so the same image can
   * be selected again if needed.
   */
  input.value = "";

  /*
   * Open the device's native file/image picker.
   */
  input.click();
}
/* =========================================================
   EXPOSE FUNCTIONS TO HTML
   ========================================================= */

window.startAttendance =
  startAttendance;

window.openRegistration =
  openRegistration;

window.submitRegistration =
  submitRegistration;

window.chooseRegisteredUser =
  chooseRegisteredUser;

window.confirmSelectedUser =
  confirmSelectedUser;

window.startScanner =
  startScanner;

window.stopScanner =
  stopScanner;

window.handleQRCode =
  handleQRCode;

window.returnHome =
  returnHome;

window.openAdminLogin =
  openAdminLogin;

window.adminLogin =
  adminLogin;

window.openAdminPage =
  openAdminPage;

window.logoutAdmin =
  logoutAdmin;

window.selectQRDay =
  selectQRDay;

window.generateQR =
  generateQR;

window.downloadCurrentQR =
  downloadCurrentQR;

window.downloadAllQRCodesPDF =
  downloadAllQRCodesPDF;

window.clearQR =
  clearQR;

window.loadAttendanceSummary =
  loadAttendanceSummary;


/* =========================================================
   END OF FINAL app.js
   ========================================================= */
/* =========================================================
   UPLOAD QR CODE — IMAGE SCANNING
   ========================================================= */

async function handleQRImageUpload(event) {

  const input = event.target;

  if (
    !input ||
    !input.files ||
    !input.files.length
  ) {
    return;
  }


  const file = input.files[0];


  if (!file.type.startsWith("image/")) {

    setUploadQRStatus(
      "Please select an image file containing a QR code."
    );

    input.value = "";

    return;
  }


  if (!currentParticipant) {

    setUploadQRStatus(
      "Please select a participant first."
    );

    input.value = "";

    return;
  }


  setUploadQRStatus(
    "Reading QR code from image..."
  );


  showLoading(
    "Reading QR code..."
  );


  let imageScanner = null;


  try {

    /*
     * Make sure Html5Qrcode is available.
     */

    if (
      typeof Html5Qrcode === "undefined"
    ) {

      await waitForScannerLibrary();

    }


    if (
      typeof Html5Qrcode === "undefined"
    ) {

      throw new Error(
        "QR scanner library is unavailable."
      );
    }


    /*
     * Create a temporary scanner element.
     */

    const tempId =
      "qr-upload-reader-" +
      Date.now();


    const tempReader =
      document.createElement("div");


    tempReader.id =
      tempId;


    tempReader.style.position =
      "fixed";

    tempReader.style.left =
      "-20000px";

    tempReader.style.top =
      "-20000px";

    tempReader.style.width =
      "100px";

    tempReader.style.height =
      "100px";


    document.body.appendChild(
      tempReader
    );


    /*
     * Create QR decoder.
     */

    imageScanner =
      new Html5Qrcode(
        tempId
      );


    /*
     * Decode the uploaded image.
     */

    const decodedText =
      await imageScanner.scanFile(
        file,
        true
      );


    /*
     * Remove temporary scanner.
     */

    try {

      imageScanner.clear();

    } catch (clearError) {

      console.warn(
        "Temporary scanner cleanup warning:",
        clearError
      );

    }


    if (
      tempReader.parentNode
    ) {

      tempReader.parentNode.removeChild(
        tempReader
      );
    }


    hideLoading();


    /*
     * Make sure something was decoded.
     */

    const token =
      String(
        decodedText || ""
      ).trim();


    if (!token) {

      throw new Error(
        "No QR code was found in the selected image."
      );
    }


    setUploadQRStatus(
      "QR code detected. Verifying attendance..."
    );


    /*
     * IMPORTANT:
     *
     * Use the EXACT SAME attendance
     * processing as the camera scanner.
     */

    await processDecodedAttendanceToken(
      token
    );


  } catch (error) {

    console.error(
      "Uploaded QR decoding error:",
      error
    );


    hideLoading();


    if (
      error &&
      error.message &&
      error.message.toLowerCase().includes("qr")
    ) {

      setUploadQRStatus(
        error.message
      );

    } else {

      setUploadQRStatus(
        "No valid QR code was found in that image."
      );
    }


    alert(
      "Unable to read the QR code from the selected image.\n\n" +
      "Please choose a clear photo or screenshot of the official attendance QR code."
    );


  } finally {

    /*
     * Reset file input so the same image
     * can be selected again if necessary.
     */

    input.value = "";


    /*
     * Make sure temporary scanner is cleaned up.
     */

    if (imageScanner) {

      try {
        imageScanner.clear();
      } catch (e) {
        // Ignore cleanup error.
      }
    }


    const tempElement =
      document.querySelector(
        '[id^="qr-upload-reader-"]'
      );


    if (
      tempElement &&
      tempElement.parentNode
    ) {

      tempElement.parentNode.removeChild(
        tempElement
      );
    }
  }
}


/* =========================================================
   PROCESS DECODED TOKEN
   ========================================================= */

async function processDecodedAttendanceToken(
  token
) {

  if (scannerProcessing) {
    return;
  }


  scannerProcessing = true;


  if (!currentParticipant) {

    scannerProcessing = false;

    showError(
      "No participant has been selected."
    );

    return;
  }


  showLoading(
    "Checking attendance QR code..."
  );


  try {

    const result =
      await apiCall(
        "recordAttendance",
        {
          token: token,

          licenseNo:
            currentParticipant.licenseNo
        }
      );


    hideLoading();


    if (
      result &&
      result.success === true
    ) {

      setUploadQRStatus(
        "Attendance recorded successfully."
      );


      showAttendanceSuccess(
        result
      );


    } else {

      scannerProcessing = false;


      const message =
        result?.message ||
        "Attendance could not be recorded.";


      setUploadQRStatus(
        message
      );


      showError(
        message
      );
    }


  } catch (error) {

    hideLoading();


    scannerProcessing = false;


    console.error(
      "Uploaded QR attendance error:",
      error
    );


    setUploadQRStatus(
      "Unable to connect to the attendance server."
    );


    showError(
      "Unable to connect to the attendance server."
    );
  }
}


/* =========================================================
   UPLOAD STATUS
   ========================================================= */

function setUploadQRStatus(message) {

  const status =
    document.getElementById(
      "uploadQRStatus"
    );


  if (status) {

    status.textContent =
      message || "";

  }
}


/* =========================================================
   MAKE UPLOAD FUNCTION AVAILABLE TO HTML
   ========================================================= */
window.handleQRImageUpload =
  handleQRImageUpload;

window.openQRImagePicker =
  openQRImagePicker;
