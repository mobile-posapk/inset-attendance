/* =========================================================
   INSET 2026 ATTENDANCE SYSTEM
   APP.JS
   ========================================================= */


/* =========================================================
   GOOGLE APPS SCRIPT API
   ========================================================= */

/*
 * WE WILL PUT YOUR GOOGLE APPS SCRIPT WEB APP URL HERE
 * AFTER WE CREATE THE BACKEND.
 *
 * DO NOT CHANGE THIS YET.
 */

const API_URL = "https://script.google.com/macros/s/AKfycbxtBRiR3XOLpidV5aaL0Im9emBZvJ_wsEi1CqABGV5-g0jIcZ0Ji7TqNOccygIlIflF3w/exec";


/* =========================================================
   GLOBAL VARIABLESS
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


/* =========================================================
   PAGE MANAGEMENT
   ========================================================= */

function showPage(pageId) {

  const pages =
    document.querySelectorAll(".page");


  pages.forEach(
    function(page) {

      page.classList.remove(
        "active"
      );

    }
  );


  const target =
    document.getElementById(
      pageId
    );


  if (target) {

    target.classList.add(
      "active"
    );

  }

}


/* =========================================================
   HOME
   ========================================================= */

function showHome() {

  stopScanner();

  currentParticipant = null;

  showPage(
    "homePage"
  );

}


/* =========================================================
   START ATTENDANCE
   ========================================================= */

function startAttendance() {

  const savedLicense =
    localStorage.getItem(
      LICENSE_STORAGE_KEY
    );


  /*
   * If the participant already has
   * a saved License No., we can
   * immediately open the scanner.
   */

  if (savedLicense) {

    currentParticipant = {

      licenseNo:
        savedLicense

    };


    startScanner();

    return;

  }


  /*
   * No saved License No.
   */

  document.getElementById(
    "identifyLicense"
  ).value = "";


  showPage(
    "identifyPage"
  );

}


/* =========================================================
   IDENTIFY PARTICIPANT
   ========================================================= */

function identifyUser(event) {

  event.preventDefault();


  const license =
    document.getElementById(
      "identifyLicense"
    ).value
      .trim()
      .toUpperCase();


  if (!license) {

    showError(
      "Please enter your License No."
    );

    return;

  }


  showLoading(
    true
  );


  apiCall(
    "verifyParticipant",
    {
      licenseNo: license
    }
  )

  .then(
    function(result) {

      showLoading(
        false
      );


      if (
        result &&
        result.success &&
        result.found
      ) {

        currentParticipant =
          result.participant;


        localStorage.setItem(
          LICENSE_STORAGE_KEY,
          result.participant.licenseNo
        );


        startScanner();

      }

      else {

        /*
         * Participant not found.
         * Show registration page.
         */

        document.getElementById(
          "registrationLicense"
        ).value =
          license;


        showPage(
          "registrationPage"
        );

      }

    }
  )

  .catch(
    function(error) {

      showLoading(
        false
      );


      showError(
        error.message ||
        "Unable to connect to the attendance server."
      );

    }
  );

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


  showLoading(
    true
  );


  apiCall(
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
  )

  .then(
    function(result) {

      showLoading(
        false
      );


      if (
        !result ||
        !result.success
      ) {

        throw new Error(
          result &&
          result.message
            ? result.message
            : "Registration failed."
        );

      }


      currentParticipant =
        result.participant;


      localStorage.setItem(
        LICENSE_STORAGE_KEY,
        result.participant.licenseNo
      );


      /*
       * Registration complete.
       *
       * Now open the scanner.
       */

      startScanner();

    }
  )

  .catch(
    function(error) {

      showLoading(
        false
      );


      showError(
        error.message ||
        "Unable to register participant."
      );

    }
  );

}


/* =========================================================
   START QR SCANNER
   ========================================================= */

function startScanner() {

  /*
   * Stop previous scanner.
   */

  stopScanner();


  showPage(
    "scannerPage"
  );


  scannerProcessing =
    false;


  const reader =
    document.getElementById(
      "reader"
    );


  const status =
    document.getElementById(
      "scannerStatus"
    );


  reader.innerHTML = "";


  status.textContent =
    "Requesting camera access...";


  /*
   * Make sure library exists.
   */

  if (
    typeof Html5Qrcode ===
    "undefined"
  ) {

    status.textContent =
      "QR scanner library is not loaded. Please refresh the page.";

    return;

  }


  /*
   * Create scanner.
   */

  scanner =
    new Html5Qrcode(
      "reader"
    );


  /*
   * Detect available cameras.
   */

  Html5Qrcode
    .getCameras()

    .then(
      function(cameras) {

        if (
          !cameras ||
          cameras.length === 0
        ) {

          throw new Error(
            "No camera was detected on this device."
          );

        }


        /*
         * Select rear camera if available.
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

                  width:
                    size,

                  height:
                    size

                };

              },

            aspectRatio:
              1.0

          },


          function(decodedText) {

            if (
              scannerProcessing
            ) {

              return;

            }


            scannerProcessing =
              true;


            status.textContent =
              "QR code detected. Processing...";


            processQRCode(
              decodedText
            );

          },


          function(errorMessage) {

            /*
             * Normal scanning errors
             * are ignored.
             */

          }

        );

      }
    )

    .then(
      function() {

        scannerRunning =
          true;


        status.textContent =
          "Camera ready — point it at the QR code.";

      }
    )

    .catch(
      function(error) {

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

          message +

          "<br><br>" +

          "Please make sure camera permission is allowed, " +

          "then refresh the page and try again.";


        try {

          scanner.clear();

        }

        catch (e) {}


        scanner =
          null;

      }
    );

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

      .then(
        function() {

          try {

            currentScanner.clear();

          }

          catch (e) {}

        }
      )

      .catch(
        function() {

          try {

            currentScanner.clear();

          }

          catch (e) {}

        }
      );

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

function processQRCode(
  qrText
) {

  /*
   * Participant must be identified.
   */

  if (
    !currentParticipant ||
    !currentParticipant.licenseNo
  ) {

    scannerProcessing =
      false;


    showError(
      "Participant identification is missing. Please start again."
    );


    return;

  }


  showLoading(
    true
  );


  apiCall(
    "recordAttendance",
    {

      token:
        qrText,

      licenseNo:
        currentParticipant.licenseNo

    }
  )

  .then(
    function(result) {

      showLoading(
        false
      );


      stopScanner();


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


      showSuccess(
        result
      );

    }
  )

  .catch(
    function(error) {

      showLoading(
        false
      );


      scannerProcessing =
        false;


      showError(
        error.message ||
        "Unable to record attendance."
      );

    }
  );

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


  details.innerHTML =

    "<strong>NAME</strong><br>" +

    escapeHTML(
      [
        participant.firstName || "",
        participant.middleName || "",
        participant.lastName || ""

      ]
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
    ) +

    "<br><br>" +

    "<strong>LICENSE NO.</strong><br>" +

    escapeHTML(
      participant.licenseNo || ""
    ) +

    "<br><br>" +

    "<strong>DATE</strong><br>" +

    escapeHTML(
      result.date || ""
    ) +

    "<br><br>" +

    "<strong>" +

    escapeHTML(
      result.mode || "ATTENDANCE"
    ) +

    "</strong><br>" +

    escapeHTML(
      result.time || ""
    );


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


  document.getElementById(
    "errorMessage"
  ).textContent =
    message ||
    "An unexpected error occurred.";


  showPage(
    "errorPage"
  );

}


/* =========================================================
   ADMIN LOGIN
   ========================================================= */

function showAdminLogin() {

  document.getElementById(
    "adminPassword"
  ).value = "";


  showPage(
    "adminLoginPage"
  );

}


function adminLogin(event) {

  event.preventDefault();


  const password =
    document.getElementById(
      "adminPassword"
    ).value;


  if (!password) {

    return;

  }


  showLoading(
    true
  );


  apiCall(
    "checkAdminPassword",
    {
      password:
        password
    }
  )

  .then(
    function(result) {

      showLoading(
        false
      );


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

    }
  )

  .catch(
    function(error) {

      showLoading(
        false
      );


      showError(
        error.message ||
        "Administrator login failed."
      );

    }
  );

}


/* =========================================================
   ADMIN DEFAULT VALUES
   ========================================================= */

function setAdminDefaults() {

  const dateInput =
    document.getElementById(
      "attendanceDate"
    );


  const timeInput =
    document.getElementById(
      "attendanceTime"
    );


  if (!dateInput.value) {

    dateInput.value =
      EVENT_START;

  }


  if (!timeInput.value) {

    timeInput.value =
      "08:00";

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


  const attendanceTime =
    document.getElementById(
      "attendanceTime"
    ).value;


  if (!attendanceDate) {

    alert(
      "Please select the attendance date."
    );

    return;

  }


  if (!attendanceTime) {

    alert(
      "Please select the official time."
    );

    return;

  }


  showLoading(
    true
  );


  apiCall(
    "generateQR",
    {

      mode:
        mode,

      attendanceDate:
        attendanceDate,

      attendanceTime:
        attendanceTime

    }
  )

  .then(
    function(result) {

      showLoading(
        false
      );


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

    }
  )

  .catch(
    function(error) {

      showLoading(
        false
      );


      alert(
        error.message ||
        "Unable to generate QR code."
      );

    }
  );

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


  container.innerHTML = "";


  status.textContent =
    "";


  /*
   * Load QRCode library if necessary.
   */

  loadQRCodeLibrary(
    function() {

      new QRCode(
        container,
        {

          text:
            result.url,

          width:
            250,

          height:
            250,

          correctLevel:
            QRCode.CorrectLevel.H

        }
      );


      status.innerHTML =

        "<strong>" +

        escapeHTML(
          result.mode
        ) +

        "</strong><br>" +

        escapeHTML(
          result.date
        ) +

        " — " +

        escapeHTML(
          result.time
        ) +

        "<br><br>" +

        "QR expires in " +

        "<span id=\"qrCountdown\">" +

        "10:00" +

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

  if (
    qrCountdownTimer
  ) {

    clearInterval(
      qrCountdownTimer
    );

  }


  const countdown =
    document.getElementById(
      "qrCountdown"
    );


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

  if (
    qrCountdownTimer
  ) {

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


  container.innerHTML =
    "";


  status.innerHTML =
    "";

}


/* =========================================================
   ADMIN SUMMARY
   ========================================================= */

function loadAdminSummary() {

  /*
   * Summary can be connected
   * to the backend later.
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

          method:
            "GET",

          redirect:
            "follow"

        }
      )

      .then(
        function(response) {

          if (
            !response.ok
          ) {

            throw new Error(
              "Server returned HTTP " +
              response.status
            );

          }


          return response.json();

        }
      )

      .then(
        function(result) {

          resolve(
            result
          );

        }
      )

      .catch(
        function(error) {

          reject(
            error
          );

        }
      );

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
      "loading"
    );


  if (visible) {

    loading.classList.remove(
      "hidden"
    );

  }

  else {

    loading.classList.add(
      "hidden"
    );

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
