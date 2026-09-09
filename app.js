/* =========================================================
   INSET 2026 ATTENDANCE SYSTEM
   APP.JS
   ========================================================= */


/* =========================================================
   GOOGLE APPS SCRIPT API
   ========================================================= */

const API_URL =
  "https://script.google.com/macros/s/AKfycbxtBRiR3XOLpidV5aaL0Im9emBZvJ_wsEi1CqABGV5-g0jIcZ0Ji7TqNOccygIlIflF3w/exec";


/* =========================================================
   GLOBAL VARIABLES
   ========================================================= */

let scanner = null;

let scannerRunning = false;

let scannerProcessing = false;

let qrCountdownTimer = null;

let currentParticipant = null;


/* =========================================================
   EVENT DATES
   ========================================================= */

const EVENT_START =
  "2026-09-09";

const EVENT_END =
  "2026-09-11";


/* =========================================================
   LOCAL STORAGE
   ========================================================= */

const LICENSE_STORAGE_KEY =
  "inset_license";

const PENDING_QR_TOKEN_KEY =
  "inset_pending_qr_token";


/* =========================================================
   PAGE MANAGEMENT
   ========================================================= */

function showPage(pageId) {

  const pages =
    document.querySelectorAll(".page");

  pages.forEach(function(page) {

    page.classList.remove("active");

  });


  const target =
    document.getElementById(pageId);

  if (target) {

    target.classList.add("active");

  }

}


/* =========================================================
   HOME
   ========================================================= */

function showHome() {

  stopScanner();

  currentParticipant = null;

  /*
   * A pending QR should not remain when the user
   * intentionally returns to the Home page.
   */
  localStorage.removeItem(
    PENDING_QR_TOKEN_KEY
  );

  showPage("homePage");

}


/* =========================================================
   START ATTENDANCE
   ========================================================= */

/*
 * NEW FLOW:
 *
 * HOME
 *   ↓
 * SCAN QR
 *   ↓
 * If registered:
 *      record attendance
 *
 * If not registered:
 *      save QR token
 *      open registration
 *      after registration automatically
 *      record the saved QR token
 */

function startAttendance() {

  stopScanner();

  currentParticipant = null;

  /*
   * Starting a completely new scan should not use
   * an abandoned QR token from an old registration.
   */
  localStorage.removeItem(
    PENDING_QR_TOKEN_KEY
  );

  startScanner();

}


/* =========================================================
   OPEN REGISTRATION
   ========================================================= */

function openRegistration() {

  stopScanner();

  currentParticipant = null;

  /*
   * Direct registration is a new registration process.
   *
   * If registration was triggered by a QR scan,
   * processQRCode() will NOT call this function.
   * It will directly show registrationPage while
   * preserving the pending QR token.
   */
  localStorage.removeItem(
    PENDING_QR_TOKEN_KEY
  );


  const firstName =
    document.getElementById("firstName");

  const middleName =
    document.getElementById("middleName");

  const lastName =
    document.getElementById("lastName");

  const license =
    document.getElementById("registrationLicense");

  const note =
    document.getElementById("registrationNote");


  if (firstName) {
    firstName.value = "";
  }

  if (middleName) {
    middleName.value = "";
  }

  if (lastName) {
    lastName.value = "";
  }

  if (license) {
    license.value = "";
  }

  if (note) {

    note.textContent =
      "Please enter your information to register.";

  }


  showPage("registrationPage");

}


/* =========================================================
   IDENTIFY PARTICIPANT
   LEGACY COMPATIBILITY
   ========================================================= */

/*
 * This function is kept so older HTML does not break.
 *
 * The new Home flow does NOT use this function.
 */

function identifyUser(event) {

  event.preventDefault();

  const field =
    document.getElementById("identifyLicense");

  if (!field) {

    showError(
      "Identification form is not available."
    );

    return;

  }


  const license =
    field.value
      .trim()
      .toUpperCase();


  if (!license) {

    showError(
      "Please enter your License No."
    );

    return;

  }


  showLoading(true);


  apiCall(
    "verifyParticipant",
    {
      licenseNo: license
    }
  )

  .then(function(result) {

    showLoading(false);


    if (
      result &&
      result.success &&
      result.participant
    ) {

      currentParticipant =
        result.participant;


      localStorage.setItem(
        LICENSE_STORAGE_KEY,
        result.participant.licenseNo
      );


      startScanner();

      return;

    }


    /*
     * Participant not found.
     */
    const registrationLicense =
      document.getElementById(
        "registrationLicense"
      );

    if (registrationLicense) {

      registrationLicense.value =
        license;

    }


    showPage("registrationPage");

  })

  .catch(function(error) {

    showLoading(false);

    showError(
      error.message ||
      "Unable to connect to the attendance server."
    );

  });

}


/* =========================================================
   REGISTER PARTICIPANT
   ========================================================= */

function registerUser(event) {

  event.preventDefault();


  const firstName =
    document.getElementById(
      "firstName"
    ).value
      .trim()
      .toUpperCase();


  const middleName =
    document.getElementById(
      "middleName"
    ).value
      .trim()
      .toUpperCase();


  const lastName =
    document.getElementById(
      "lastName"
    ).value
      .trim()
      .toUpperCase();


  const licenseNo =
    document.getElementById(
      "registrationLicense"
    ).value
      .trim()
      .toUpperCase();


  if (
    !firstName ||
    !lastName ||
    !licenseNo
  ) {

    showError(
      "Please complete all required fields."
    );

    return;

  }


  showLoading(true);


  apiCall(
    "registerParticipant",
    {
      firstName: firstName,
      middleName: middleName,
      lastName: lastName,
      licenseNo: licenseNo
    }
  )

  .then(function(result) {

    showLoading(false);


    if (
      !result ||
      !result.success
    ) {

      /*
       * If the license is already registered,
       * use the existing participant.
       */
      if (
        result &&
        result.alreadyRegistered &&
        result.participant
      ) {

        currentParticipant =
          result.participant;

        localStorage.setItem(
          LICENSE_STORAGE_KEY,
          result.participant.licenseNo
        );

        /*
         * If a pending QR exists, record it.
         */
        const pendingToken =
          localStorage.getItem(
            PENDING_QR_TOKEN_KEY
          );

        if (pendingToken) {

          localStorage.removeItem(
            PENDING_QR_TOKEN_KEY
          );

          recordAttendanceWithToken(
            pendingToken,
            result.participant.licenseNo
          );

          return;

        }

        startScanner();

        return;

      }


      throw new Error(
        result && result.message
          ? result.message
          : "Registration failed."
      );

    }


    /*
     * Registration successful.
     */
    currentParticipant =
      result.participant;


    localStorage.setItem(
      LICENSE_STORAGE_KEY,
      result.participant.licenseNo
    );


    /*
     * Check if registration was triggered
     * by a QR scan.
     */
    const pendingToken =
      localStorage.getItem(
        PENDING_QR_TOKEN_KEY
      );


    if (pendingToken) {

      /*
       * Remove it BEFORE recording so that
       * accidental repeated submissions do
       * not reuse the same pending token.
       */
      localStorage.removeItem(
        PENDING_QR_TOKEN_KEY
      );


      /*
       * Automatically record the QR that was
       * scanned before registration.
       */
      recordAttendanceWithToken(
        pendingToken,
        result.participant.licenseNo
      );

      return;

    }


    /*
     * Direct registration:
     * registration is complete, so now open scanner.
     */
    startScanner();

  })

  .catch(function(error) {

    showLoading(false);

    showError(
      error.message ||
      "Unable to register participant."
    );

  });

}


/* =========================================================
   START QR SCANNER
   ========================================================= */

function startScanner() {

  /*
   * Stop any previous scanner first.
   */
  stopScanner();


  showPage("scannerPage");


  scannerProcessing = false;


  const reader =
    document.getElementById(
      "reader"
    );


  const status =
    document.getElementById(
      "scannerStatus"
    );


  if (!reader || !status) {

    showError(
      "Scanner interface is missing."
    );

    return;

  }


  reader.innerHTML = "";


  status.textContent =
    "Requesting camera access...";


  /*
   * Make sure Html5Qrcode library exists.
   */
  if (
    typeof Html5Qrcode ===
    "undefined"
  ) {

    status.textContent =
      "QR scanner library is not loaded. Please refresh the page.";

    return;

  }


  scanner =
    new Html5Qrcode(
      "reader"
    );


  /*
   * Detect cameras.
   */
  Html5Qrcode
    .getCameras()

    .then(function(cameras) {

      if (
        !cameras ||
        cameras.length === 0
      ) {

        throw new Error(
          "No camera was detected on this device."
        );

      }


      /*
       * Prefer rear camera.
       */
      let cameraId =
        cameras[0].id;


      for (
        let i = 0;
        i < cameras.length;
        i++
      ) {

        const label =
          String(
            cameras[i].label || ""
          ).toLowerCase();


        if (
          label.includes("back") ||
          label.includes("rear") ||
          label.includes("environment")
        ) {

          cameraId =
            cameras[i].id;

          break;

        }

      }


      status.textContent =
        "Starting camera...";


      return scanner.start(

        cameraId,

        {
          fps: 10,

          qrbox:
            function(
              viewfinderWidth,
              viewfinderHeight
            ) {

              const minSize =
                Math.min(
                  viewfinderWidth,
                  viewfinderHeight
                );


              const size =
                Math.floor(
                  minSize * 0.70
                );


              return {
                width: size,
                height: size
              };

            },

          aspectRatio: 1.0

        },


        function(decodedText) {

          if (scannerProcessing) {

            return;

          }


          scannerProcessing = true;


          status.textContent =
            "QR code detected. Processing...";


          processQRCode(
            decodedText
          );

        },


        function(errorMessage) {

          /*
           * Normal QR scanning errors
           * are intentionally ignored.
           */

        }

      );

    })

    .then(function() {

      scannerRunning =
        true;


      status.textContent =
        "Camera ready — point it at the QR code.";

    })

    .catch(function(error) {

      console.error(
        "CAMERA ERROR:",
        error
      );


      scannerRunning =
        false;


      let message =
        "Unable to start the camera.";


      if (
        error &&
        error.message
      ) {

        message =
          error.message;

      }


      status.innerHTML =
        "<strong>Camera could not be started.</strong>" +
        "<br><br>" +
        escapeHTML(message) +
        "<br><br>" +
        "Please make sure camera permission is allowed, " +
        "then refresh the page and try again.";


      try {

        scanner.clear();

      }

      catch (e) {}


      scanner =
        null;

    });

}


/* =========================================================
   STOP QR SCANNER
   ========================================================= */

function stopScanner() {

  if (!scanner) {

    scannerRunning =
      false;

    scannerProcessing =
      false;

    return;

  }


  const currentScanner =
    scanner;


  scanner =
    null;


  scannerRunning =
    false;


  scannerProcessing =
    false;


  try {

    currentScanner
      .stop()

      .then(function() {

        try {

          currentScanner.clear();

        }

        catch (e) {}

      })

      .catch(function() {

        try {

          currentScanner.clear();

        }

        catch (e) {}

      });

  }

  catch (error) {

    console.log(
      "Scanner cleanup:",
      error
    );

  }

}


/* =========================================================
   PROCESS QR CODE
   ========================================================= */

/*
 * NEW LOGIC:
 *
 * The QR is scanned FIRST.
 *
 * If the participant already has a saved license:
 *      → record attendance
 *
 * If there is NO saved license:
 *      → save QR token
 *      → open registration
 *
 * The user does NOT scan the QR again after registering.
 */

function processQRCode(qrText) {

  /*
   * Extract token.
   */
  let token =
    String(qrText || "").trim();


  /*
   * QR may contain:
   *
   * https://.../?token=ABC
   *
   * OR:
   *
   * ABC
   */
  try {

    const scannedURL =
      new URL(qrText);


    const urlToken =
      scannedURL.searchParams.get(
        "token"
      );


    if (urlToken) {

      token =
        urlToken;

    }

  }

  catch (error) {

    /*
     * Not a URL.
     * Use QR text as token.
     */

  }


  /*
   * Validate token.
   */
  if (!token) {

    scannerProcessing =
      false;

    showError(
      "Invalid QR code. No attendance token was found."
    );

    return;

  }


  console.log(
    "QR TEXT:",
    qrText
  );


  console.log(
    "EXTRACTED TOKEN:",
    token
  );


  /*
   * Check whether this device already has
   * a registered License No.
   */
  const savedLicense =
    localStorage.getItem(
      LICENSE_STORAGE_KEY
    );


  /* =====================================================
     NOT REGISTERED
     ===================================================== */

  if (!savedLicense) {

    /*
     * IMPORTANT:
     * Save the QR token before opening registration.
     */
    localStorage.setItem(
      PENDING_QR_TOKEN_KEY,
      token
    );


    currentParticipant =
      null;


    stopScanner();


    /*
     * Clear old license field.
     */
    const registrationLicense =
      document.getElementById(
        "registrationLicense"
      );


    if (registrationLicense) {

      registrationLicense.value =
        "";

    }


    /*
     * Tell participant what is happening.
     */
    const note =
      document.getElementById(
        "registrationNote"
      );


    if (note) {

      note.textContent =
        "QR code scanned. Complete registration and your attendance will be recorded automatically.";

    }


    showPage(
      "registrationPage"
    );


    return;

  }


  /* =====================================================
     REGISTERED PARTICIPANT
     ===================================================== */

  currentParticipant = {
    licenseNo:
      savedLicense
  };


  recordAttendanceWithToken(
    token,
    savedLicense
  );

}


/* =========================================================
   RECORD ATTENDANCE WITH TOKEN
   ========================================================= */

function recordAttendanceWithToken(
  token,
  licenseNo
) {

  showLoading(true);


  apiCall(
    "recordAttendance",
    {
      token: token,
      licenseNo: licenseNo
    }
  )

  .then(function(result) {

    showLoading(false);


    /*
     * Participant no longer exists in database.
     */
    if (
      result &&
      result.registrationRequired
    ) {

      /*
       * Clear invalid saved license.
       */
      localStorage.removeItem(
        LICENSE_STORAGE_KEY
      );


      /*
       * IMPORTANT:
       * Keep the QR token because it was
       * already scanned.
       */
      localStorage.setItem(
        PENDING_QR_TOKEN_KEY,
        token
      );


      currentParticipant =
        null;


      stopScanner();


      /*
       * Pre-fill the old license so the user
       * can see what was previously stored.
       */
      const registrationLicense =
        document.getElementById(
          "registrationLicense"
        );


      if (registrationLicense) {

        registrationLicense.value =
          licenseNo || "";

      }


      const note =
        document.getElementById(
          "registrationNote"
        );


      if (note) {

        note.textContent =
          "Your previous registration was not found. Please register again. Your scanned QR code will be recorded automatically after registration.";

      }


      showPage(
        "registrationPage"
      );


      return;

    }


    /*
     * Normal attendance success.
     */
    if (
      !result ||
      !result.success
    ) {

      throw new Error(
        result &&
        result.message
          ? result.message
          : "Attendance could not be recorded."
      );

    }


    stopScanner();


    showSuccess(
      result
    );

  })

  .catch(function(error) {

    showLoading(false);

    scannerProcessing =
      false;


    showError(
      error.message ||
      "Unable to record attendance."
    );

  });

}


/* =========================================================
   SUCCESS PAGE
   ========================================================= */

function showSuccess(
  result
) {

  const details =
    document.getElementById(
      "successDetails"
    );


  const participant =
    result.participant || {};


  const fullName =
    [
      participant.firstName || "",
      participant.middleName || "",
      participant.lastName || ""
    ]
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();


  if (details) {

    details.innerHTML =

      "<strong>NAME</strong><br>" +

      escapeHTML(
        fullName
      ) +

      "<br><br>" +

      "<strong>LICENSE NO.</strong><br>" +

      escapeHTML(
        participant.licenseNo || ""
      ) +

      "<br><br>" +

      "<strong>DATE</strong><br>" +

      escapeHTML(
        result.attendanceDate ||
        result.date ||
        ""
      ) +

      "<br><br>" +

      "<strong>" +

      escapeHTML(
        result.mode ||
        "ATTENDANCE"
      ) +

      "</strong><br>" +

      escapeHTML(
        result.time || ""
      );

  }


  const successMessage =
    document.getElementById(
      "successMessage"
    );


  if (successMessage) {

    successMessage.textContent =
      result.message ||
      "Attendance recorded successfully.";

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

  stopScanner();


  const errorMessage =
    document.getElementById(
      "errorMessage"
    );


  if (errorMessage) {

    errorMessage.textContent =
      message ||
      "An unexpected error occurred.";

  }


  showPage(
    "errorPage"
  );

}


/* =========================================================
   ADMIN LOGIN
   ========================================================= */

function openAdminLogin() {

  const password =
    document.getElementById(
      "adminPassword"
    );


  if (password) {

    password.value = "";

  }


  showPage(
    "adminLoginPage"
  );

}


/*
 * Keep the old function name working too.
 */
function showAdminLogin() {

  openAdminLogin();

}


/* =========================================================
   ADMIN LOGIN SUBMIT
   ========================================================= */

function adminLogin(event) {

  event.preventDefault();


  const password =
    document.getElementById(
      "adminPassword"
    ).value;


  if (!password) {

    return;

  }


  showLoading(true);


  apiCall(
    "checkAdminPassword",
    {
      password: password
    }
  )

  .then(function(result) {

    showLoading(false);


    if (
      !result ||
      !result.success
    ) {

      throw new Error(
        result &&
        result.message
          ? result.message
          : "Incorrect administrator password."
      );

    }


    setAdminDefaults();


    showPage(
      "adminPage"
    );


    loadAdminSummary();

  })

  .catch(function(error) {

    showLoading(false);


    showError(
      error.message ||
      "Administrator login failed."
    );

  });

}


/* =========================================================
   ADMIN DEFAULT VALUES
   ========================================================= */

function setAdminDefaults() {

  const dateInput =
    document.getElementById(
      "attendanceDate"
    );


  if (
    dateInput &&
    !dateInput.value
  ) {

    dateInput.value =
      EVENT_START;

  }

}


/* =========================================================
   GENERATE QR
   ========================================================= */

function generateQR(
  mode
) {

  const attendanceDate =
    document.getElementById(
      "attendanceDate"
    ).value;


  if (!attendanceDate) {

    alert(
      "Please select the attendance date."
    );

    return;

  }


  showLoading(true);


  apiCall(
    "generateQR",
    {
      mode: mode,
      attendanceDate:
        attendanceDate
    }
  )

  .then(function(result) {

    showLoading(false);


    if (
      !result ||
      !result.success
    ) {

      throw new Error(
        result &&
        result.message
          ? result.message
          : "Unable to generate QR code."
      );

    }


    displayQRCode(
      result
    );

  })

  .catch(function(error) {

    showLoading(false);


    alert(
      error.message ||
      "Unable to generate QR code."
    );

  });

}


/* =========================================================
   DISPLAY QR CODE
   ========================================================= */

function displayQRCode(
  result
) {

  const container =
    document.getElementById(
      "qrContainer"
    );


  const status =
    document.getElementById(
      "qrStatus"
    );


  if (!container || !status) {

    return;

  }


  container.innerHTML =
    "";

  status.innerHTML =
    "";


  /*
   * The backend returns qrUrl.
   *
   * For compatibility, also support url.
   */
  const qrURL =
    result.qrUrl ||
    result.url;


  if (!qrURL) {

    status.textContent =
      "QR URL was not returned by the server.";

    return;

  }


  loadQRCodeLibrary(
    function() {

      new QRCode(
        container,
        {
          text: qrURL,

          width: 250,

          height: 250,

          correctLevel:
            QRCode.CorrectLevel.H
        }
      );


      status.innerHTML =

        "<strong>" +

        escapeHTML(
          result.mode ||
          ""
        ) +

        "</strong><br>" +

        "Attendance Date: " +

        escapeHTML(
          result.attendanceDate ||
          result.date ||
          ""
        ) +

        "<br><br>" +

        "QR expires in " +

        "<span id=\"qrCountdown\">" +

        "60:00" +

        "</span>";


      startQRCountdown(
        result.expiresAt
      );

    }
  );

}


/* =========================================================
   QR CODE LIBRARY
   ========================================================= */

function loadQRCodeLibrary(
  callback
) {

  if (
    typeof QRCode !==
    "undefined"
  ) {

    callback();

    return;

  }


  const script =
    document.createElement(
      "script"
    );


  script.src =
    "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";


  script.onload =
    callback;


  script.onerror =
    function() {

      alert(
        "Unable to load QR code generator."
      );

    };


  document.head.appendChild(
    script
  );

}


/* =========================================================
   QR COUNTDOWN
   ========================================================= */

function startQRCountdown(
  expiresAt
) {

  if (qrCountdownTimer) {

    clearInterval(
      qrCountdownTimer
    );

  }


  const countdown =
    document.getElementById(
      "qrCountdown"
    );


  if (!countdown) {

    return;

  }


  function updateCountdown() {

    const remaining =
      new Date(
        expiresAt
      ).getTime() -
      Date.now();


    if (
      remaining <= 0
    ) {

      countdown.textContent =
        "EXPIRED";


      clearInterval(
        qrCountdownTimer
      );


      qrCountdownTimer =
        null;


      return;

    }


    const totalSeconds =
      Math.floor(
        remaining / 1000
      );


    const minutes =
      Math.floor(
        totalSeconds / 60
      );


    const seconds =
      totalSeconds % 60;


    countdown.textContent =

      String(minutes)
        .padStart(2, "0") +

      ":" +

      String(seconds)
        .padStart(2, "0");

  }


  updateCountdown();


  qrCountdownTimer =
    setInterval(
      updateCountdown,
      1000
    );

}


/* =========================================================
   CLEAR QR
   ========================================================= */

function clearQR() {

  if (qrCountdownTimer) {

    clearInterval(
      qrCountdownTimer
    );


    qrCountdownTimer =
      null;

  }


  const container =
    document.getElementById(
      "qrContainer"
    );


  const status =
    document.getElementById(
      "qrStatus"
    );


  if (container) {

    container.innerHTML =
      '<div class="qr-placeholder">QR CODE WILL APPEAR HERE</div>';

  }


  if (status) {

    status.innerHTML =
      "";

  }

}


/* =========================================================
   ADMIN SUMMARY
   ========================================================= */

function loadAdminSummary() {

  /*
   * Summary can be connected to the backend later.
   */

}


/* =========================================================
   API CALL
   ========================================================= */

function apiCall(
  action,
  data
) {

  return new Promise(
    function(resolve, reject) {

      if (!API_URL) {

        reject(
          new Error(
            "Google Apps Script API URL has not been configured yet."
          )
        );

        return;

      }


      const url =
        API_URL +
        "?action=" +
        encodeURIComponent(
          action
        ) +
        "&data=" +
        encodeURIComponent(
          JSON.stringify(
            data || {}
          )
        );


      fetch(
        url,
        {
          method: "GET",
          redirect: "follow"
        }
      )

      .then(function(response) {

        if (!response.ok) {

          throw new Error(
            "Server returned HTTP " +
            response.status
          );

        }


        return response.json();

      })

      .then(function(result) {

        resolve(
          result
        );

      })

      .catch(function(error) {

        reject(
          error
        );

      });

    }
  );

}


/* =========================================================
   LOADING
   ========================================================= */

function showLoading(
  visible
) {

  const loading =
    document.getElementById(
      "loadingOverlay"
    );


  if (!loading) {

    return;

  }


  if (visible) {

    loading.style.display =
      "flex";

  }

  else {

    loading.style.display =
      "none";

  }

}


/* =========================================================
   HTML ESCAPE
   ========================================================= */

function escapeHTML(
  value
) {

  return String(
    value || ""
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
   INITIALIZE
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  function() {

    showPage(
      "homePage"
    );

  }
);
