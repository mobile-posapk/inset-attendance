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
   EVENT DATES
   ========================================================= */

const EVENT_START = "2026-09-09";
const EVENT_END   = "2026-09-11";


/* =========================================================
   LOCAL STORAGE
   ========================================================= */

const LICENSE_STORAGE_KEY =
  "inset_license";

const REGISTERED_USERS_STORAGE_KEY =
  "inset_registered_users";


/* =========================================================
   GLOBAL VARIABLES
   ========================================================= */

let scanner = null;

let scannerRunning = false;

let scannerProcessing = false;

let qrCountdownTimer = null;

let currentParticipant = null;

let selectedUserIndex = null;


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

  selectedUserIndex = null;

  if (qrCountdownTimer) {

    clearInterval(qrCountdownTimer);

    qrCountdownTimer = null;

  }

  showPage("homePage");

}


/* =========================================================
   START ATTENDANCE
   ========================================================= */

function startAttendance() {

  stopScanner();

  currentParticipant = null;

  selectedUserIndex = null;


  const users =
    getRegisteredUsers();


  /*
   * No registered user on this phone.
   *
   * Registration must happen first.
   */

  if (users.length === 0) {

    openRegistration();

    return;

  }


  /*
   * Only one registered user.
   *
   * Automatically identify that user.
   */

  if (users.length === 1) {

    selectRegisteredUser(0);

    showSelectedUserConfirmation();

    return;

  }


  /*
   * TWO OR MORE REGISTERED USERS.
   *
   * Let the person identify
   * which user is attending.
   */

  showUserSelection();

}


/* =========================================================
   OPEN REGISTRATION
   ========================================================= */

function openRegistration() {

  stopScanner();

  currentParticipant = null;

  selectedUserIndex = null;


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
      "Enter your details to register for INSET 2026.";

  }


  showPage("registrationPage");

}


/* =========================================================
   REGISTERED USERS
   ========================================================= */

function getRegisteredUsers() {

  try {

    const raw =
      localStorage.getItem(
        REGISTERED_USERS_STORAGE_KEY
      );


    if (!raw) {
      return [];
    }


    const users =
      JSON.parse(raw);


    if (!Array.isArray(users)) {
      return [];
    }


    return users;

  }

  catch (error) {

    console.error(
      "Registered users storage error:",
      error
    );

    return [];

  }

}


/* =========================================================
   SAVE REGISTERED USERS
   ========================================================= */

function saveRegisteredUsers(users) {

  localStorage.setItem(
    REGISTERED_USERS_STORAGE_KEY,
    JSON.stringify(users)
  );

}


/* =========================================================
   ADD REGISTERED USER
   ========================================================= */

function addRegisteredUser(participant) {

  if (
    !participant ||
    !participant.licenseNo
  ) {

    return;

  }


  const license =
    String(
      participant.licenseNo
    )
      .trim()
      .toUpperCase();


  const users =
    getRegisteredUsers();


  const profile = {

    firstName:
      participant.firstName || "",

    middleName:
      participant.middleName || "",

    lastName:
      participant.lastName || "",

    licenseNo:
      license

  };


  const existingIndex =
    users.findIndex(function(user) {

      return String(
        user.licenseNo || ""
      )
        .trim()
        .toUpperCase() === license;

    });


  /*
   * If the user already exists
   * on this phone, update the profile.
   */

  if (existingIndex >= 0) {

    users[existingIndex] =
      profile;

  }

  else {

    users.push(profile);

  }


  saveRegisteredUsers(users);

}


/* =========================================================
   REMOVE REGISTERED USER
   ========================================================= */

function removeRegisteredUser(licenseNo) {

  const license =
    String(
      licenseNo || ""
    )
      .trim()
      .toUpperCase();


  const users =
    getRegisteredUsers()
      .filter(function(user) {

        return String(
          user.licenseNo || ""
        )
          .trim()
          .toUpperCase() !== license;

      });


  saveRegisteredUsers(users);

}


/* =========================================================
   SAVE CURRENT LICENSE
   ========================================================= */

function saveCurrentLicense(licenseNo) {

  if (!licenseNo) {
    return;
  }


  localStorage.setItem(
    LICENSE_STORAGE_KEY,
    String(
      licenseNo
    )
      .trim()
      .toUpperCase()
  );

}


/* =========================================================
   SELECT REGISTERED USER
   ========================================================= */

function selectRegisteredUser(index) {

  const users =
    getRegisteredUsers();


  const user =
    users[index];


  if (!user) {
    return false;
  }


  selectedUserIndex =
    index;


  currentParticipant =
    user;


  saveCurrentLicense(
    user.licenseNo
  );


  return true;

}


/* =========================================================
   USER FULL NAME
   ========================================================= */

function getParticipantFullName(
  participant
) {

  if (!participant) {
    return "";
  }


  return [

    participant.firstName || "",

    participant.middleName || "",

    participant.lastName || ""

  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

}


/* =========================================================
   MASK LICENSE
   ========================================================= */

function maskLicense(licenseNo) {

  const license =
    String(
      licenseNo || ""
    );


  if (license.length <= 4) {

    return license;

  }


  return "*".repeat(
    license.length - 4
  ) +
  license.slice(-4);

}


/* =========================================================
   SHOW USER SELECTION
   ========================================================= */

function showUserSelection() {

  stopScanner();

  currentParticipant = null;

  selectedUserIndex = null;


  const list =
    document.getElementById(
      "registeredUsers"
    );


  if (!list) {

    /*
     * Safety fallback.
     */

    const users =
      getRegisteredUsers();

    if (users.length > 0) {

      selectRegisteredUser(0);

      showSelectedUserConfirmation();

    }

    return;

  }


  const users =
    getRegisteredUsers();


  list.innerHTML = "";


  if (users.length === 0) {

    list.innerHTML =
      `
      <div class="no-users-message">
        <strong>No registered users</strong>
        <p>Please register first.</p>
      </div>
      `;

    showPage("identifyPage");

    return;

  }


  users.forEach(
    function(user, index) {

      const button =
        document.createElement(
          "button"
        );


      button.type =
        "button";


      button.className =
        "registered-user-option";


      button.innerHTML =

        `
        <span class="user-radio">
          ○
        </span>

        <span class="registered-user-info">

          <strong class="registered-user-name">
            ${escapeHTML(
              getParticipantFullName(user)
            )}
          </strong>

          <small class="registered-user-license">
            License No. ${escapeHTML(
              maskLicense(user.licenseNo)
            )}
          </small>

        </span>
        `;


      button.addEventListener(
        "click",
        function() {

          chooseRegisteredUser(
            index
          );

        }
      );


      list.appendChild(
        button
      );

    }
  );


  showPage(
    "identifyPage"
  );

}


/* =========================================================
   CHOOSE REGISTERED USER
   ========================================================= */

function chooseRegisteredUser(index) {

  if (
    !selectRegisteredUser(index)
  ) {

    showError(
      "The selected registered user could not be found."
    );

    return;

  }


  const options =
    document.querySelectorAll(
      ".registered-user-option"
    );


  options.forEach(
    function(button, i) {

      const selected =
        i === index;


      button.classList.toggle(
        "selected",
        selected
      );


      const radio =
        button.querySelector(
          ".user-radio"
        );


      if (radio) {

        radio.textContent =
          selected
            ? "●"
            : "○";

      }

    }
  );


  /*
   * User has now identified
   * themselves.
   */

  showSelectedUserConfirmation();

}


/* =========================================================
   CONFIRM SELECTED USER
   ========================================================= */

function confirmSelectedUser() {

  if (
    selectedUserIndex === null
  ) {

    return;

  }


  if (
    !selectRegisteredUser(
      selectedUserIndex
    )
  ) {

    showError(
      "The selected registered user could not be found."
    );

    return;

  }


  showSelectedUserConfirmation();

}


/* =========================================================
   SHOW SELECTED USER
   ========================================================= */

function showSelectedUserConfirmation() {

  if (
    !currentParticipant ||
    !currentParticipant.licenseNo
  ) {

    startAttendance();

    return;

  }


  const details =
    document.getElementById(
      "selectedUserDetails"
    );


  if (details) {

    details.innerHTML =

      `
      <div class="selected-user-name">
        ${escapeHTML(
          getParticipantFullName(
            currentParticipant
          )
        )}
      </div>

      <div class="selected-user-license">
        License No.
        ${escapeHTML(
          maskLicense(
            currentParticipant.licenseNo
          )
        )}
      </div>
      `;

  }


  const selection =
    document.getElementById(
      "registeredUsers"
    );


  if (selection) {

    /*
     * Keep the selection page
     * clean when confirmation opens.
     */

    selection.innerHTML = "";

  }


  showPage(
    "scannerPage"
  );


  const confirmation =
    document.getElementById(
      "selectedUserConfirmation"
    );


  const scannerPanel =
    document.getElementById(
      "attendanceScanner"
    );


  if (confirmation) {

    confirmation.style.display =
      "block";

  }


  if (scannerPanel) {

    scannerPanel.style.display =
      "none";

  }


}


/* =========================================================
   CANCEL SELECTED USER
   ========================================================= */

function cancelSelectedUser() {

  stopScanner();

  currentParticipant = null;

  selectedUserIndex = null;

  showUserSelection();

}


/* =========================================================
   START ATTENDANCE SCANNER
   ========================================================= */

function startAttendanceScanner() {

  if (
    !currentParticipant ||
    !currentParticipant.licenseNo
  ) {

    startAttendance();

    return;

  }


  const confirmation =
    document.getElementById(
      "selectedUserConfirmation"
    );


  const scannerPanel =
    document.getElementById(
      "attendanceScanner"
    );


  if (confirmation) {

    confirmation.style.display =
      "none";

  }


  if (scannerPanel) {

    scannerPanel.style.display =
      "block";

  }


  startScanner();

}


/* =========================================================
   COMPATIBILITY: IDENTIFY USER
   ========================================================= */

function identifyUser(event) {

  if (event) {

    event.preventDefault();

  }


  /*
   * This function is kept for
   * compatibility with older HTML.
   *
   * The current system identifies
   * users from the registered-users
   * list instead.
   */

  const input =
    document.getElementById(
      "identifyLicense"
    );


  if (!input) {

    showUserSelection();

    return;

  }


  const license =
    input.value
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
      licenseNo:
        license
    }
  )

  .then(
    function(result) {

      showLoading(false);


      if (
        result &&
        result.success &&
        result.found &&
        result.participant
      ) {

        addRegisteredUser(
          result.participant
        );


        const users =
          getRegisteredUsers();


        selectedUserIndex =
          users.findIndex(
            function(user) {

              return String(
                user.licenseNo
              )
                .toUpperCase() ===
                String(
                  result.participant.licenseNo
                )
                .toUpperCase();

            }
          );


        currentParticipant =
          result.participant;


        saveCurrentLicense(
          result.participant.licenseNo
        );


        showSelectedUserConfirmation();

        return;

      }


      showError(
        "License No. not registered. Please register first."
      );

    }
  )

  .catch(
    function(error) {

      showLoading(false);

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
    )
      .value
      .trim()
      .toUpperCase();


  const middleName =
    document.getElementById(
      "middleName"
    )
      .value
      .trim()
      .toUpperCase();


  const lastName =
    document.getElementById(
      "lastName"
    )
      .value
      .trim()
      .toUpperCase();


  const licenseNo =
    document.getElementById(
      "registrationLicense"
    )
      .value
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

      showLoading(false);


      if (
        !result ||
        !result.success ||
        !result.participant
      ) {

        throw new Error(
          result &&
          result.message
            ? result.message
            : "Registration failed."
        );

      }


      /*
       * Save this participant
       * to this specific phone.
       */

      addRegisteredUser(
        result.participant
      );


      currentParticipant =
        result.participant;


      const users =
        getRegisteredUsers();


      selectedUserIndex =
        users.findIndex(
          function(user) {

            return String(
              user.licenseNo
            )
              .toUpperCase() ===
              String(
                result.participant.licenseNo
              )
              .toUpperCase();

          }
        );


      saveCurrentLicense(
        result.participant.licenseNo
      );


      showSelectedUserConfirmation();

    }
  )

  .catch(
    function(error) {

      showLoading(false);

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

  stopScanner();


  scannerProcessing =
    false;


  showPage(
    "scannerPage"
  );


  const reader =
    document.getElementById(
      "reader"
    );


  const status =
    document.getElementById(
      "scannerStatus"
    );


  const activeUser =
    document.getElementById(
      "activeAttendanceUser"
    );


  if (!reader || !status) {

    showError(
      "Scanner interface is not available."
    );

    return;

  }


  reader.innerHTML = "";


  status.textContent =
    "Requesting camera access...";


  if (activeUser) {

    activeUser.innerHTML =

      `
      <strong>ATTENDANCE FOR</strong><br>
      ${escapeHTML(
        getParticipantFullName(
          currentParticipant
        )
      )}<br>
      License No.
      ${escapeHTML(
        maskLicense(
          currentParticipant.licenseNo
        )
      )}
      `;

  }


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
              cameras[i].label ||
              ""
            )
              .toLowerCase();


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
                width,
                height
              ) {

                const minSize =
                  Math.min(
                    width,
                    height
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
             * Normal scanner
             * errors are ignored.
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

  if (
    !currentParticipant ||
    !currentParticipant.licenseNo
  ) {

    scannerProcessing =
      false;


    showError(
      "Please select a registered participant before scanning."
    );


    return;

  }


  let token =
    String(
      qrText || ""
    ).trim();


  /*
   * The QR may contain:
   *
   * https://...?...token=XXXX
   *
   * or just:
   *
   * XXXX
   */

  try {

    const scannedURL =
      new URL(
        qrText
      );


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
     * Raw token is allowed.
     */

  }


  if (!token) {

    scannerProcessing =
      false;


    showError(
      "Invalid QR code. No attendance token was found."
    );


    return;

  }


  recordAttendanceWithToken(
    token,
    currentParticipant.licenseNo
  );

}


/* =========================================================
   RECORD ATTENDANCE
   ========================================================= */

function recordAttendanceWithToken(
  token,
  licenseNo
) {

  showLoading(true);


  apiCall(
    "recordAttendance",
    {

      token:
        token,

      licenseNo:
        licenseNo

    }
  )

  .then(
    function(result) {

      showLoading(false);


      /*
       * Participant was removed
       * from the server.
       */

      if (
        result &&
        result.registrationRequired === true
      ) {

        removeRegisteredUser(
          licenseNo
        );


        localStorage.removeItem(
          LICENSE_STORAGE_KEY
        );


        currentParticipant =
          null;


        scannerProcessing =
          false;


        showError(
          "This participant is no longer registered. Please register again."
        );


        return;

      }


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

    }
  )

  .catch(
    function(error) {

      showLoading(false);


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
    result.participant ||
    currentParticipant ||
    {};


  if (details) {

    details.innerHTML =

      "<strong>NAME</strong><br>" +

      escapeHTML(
        getParticipantFullName(
          participant
        )
      ) +

      "<br><br>" +

      "<strong>LICENSE NO.</strong><br>" +

      escapeHTML(
        participant.licenseNo ||
        ""
      ) +

      "<br><br>" +

      "<strong>DATE</strong><br>" +

      escapeHTML(
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
        result.time ||
        ""
      );

  }


  currentParticipant =
    null;


  selectedUserIndex =
    null;


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
   ADMIN LOGIN PAGE
   ========================================================= */

function showAdminLogin() {

  const password =
    document.getElementById(
      "adminPassword"
    );


  if (password) {

    password.value =
      "";

  }


  showPage(
    "adminLoginPage"
  );

}


/* =========================================================
   ADMIN LOGIN
   ========================================================= */

function adminLogin(event) {

  event.preventDefault();


  const password =
    document.getElementById(
      "adminPassword"
    )
      .value;


  if (!password) {

    return;

  }


  showLoading(true);


  apiCall(
    "checkAdminPassword",
    {

      password:
        password

    }
  )

  .then(
    function(result) {

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

    }
  )

  .catch(
    function(error) {

      showLoading(false);


      /*
       * Keep the error on the
       * admin login page.
       */

      const message =
        document.getElementById(
          "adminPassword"
        );


      if (message) {

        message.focus();

      }


      const loginPage =
        document.getElementById(
          "adminLoginPage"
        );


      if (loginPage) {

        let existing =
          loginPage.querySelector(
            ".admin-login-error"
          );


        if (!existing) {

          existing =
            document.createElement(
              "div"
            );

          existing.className =
            "admin-login-error";

          existing.style.margin =
            "10px 0";

          existing.style.color =
            "#c62828";

          existing.style.fontWeight =
            "700";


          const form =
            loginPage.querySelector(
              "form"
            );


          if (form) {

            form.insertBefore(
              existing,
              form.querySelector(
                "button"
              )
            );

          }

        }


        existing.textContent =
          error.message ||
          "Unable to connect to the server.";

      }

    }
  );

}


/* =========================================================
   ADMIN DEFAULTS
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

  const dateInput =
    document.getElementById(
      "attendanceDate"
    );


  const attendanceDate =
    dateInput
      ? dateInput.value
      : "";


  if (!attendanceDate) {

    alert(
      "Please select the attendance date."
    );

    return;

  }


  if (
    attendanceDate < EVENT_START ||
    attendanceDate > EVENT_END
  ) {

    alert(
      "Attendance date must be between September 9 and September 11, 2026."
    );

    return;

  }


  showLoading(true);


  apiCall(
    "generateQR",
    {

      mode:
        mode,

      attendanceDate:
        attendanceDate

    }
  )

  .then(
    function(result) {

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

    }
  )

  .catch(
    function(error) {

      showLoading(false);


      const status =
        document.getElementById(
          "qrStatus"
        );


      if (status) {

        status.textContent =
          error.message ||
          "Unable to generate QR code.";

      }


      console.error(
        "QR GENERATION ERROR:",
        error
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


  if (!container) {

    return;

  }


  container.innerHTML =
    "";


  if (status) {

    status.textContent =
      "Loading QR code...";

  }


  loadQRCodeLibrary(
    function() {

      try {

        new QRCode(

          container,

          {

            text:
              result.url,

            width:
              300,

            height:
              300,

            correctLevel:
              QRCode.CorrectLevel.H

          }

        );


        if (status) {

          status.innerHTML =

            "<strong>" +
            escapeHTML(
              result.mode
            ) +
            "</strong><br>" +

            "Attendance Date: " +
            escapeHTML(
              result.date
            ) +

            "<br><br>" +

            "QR expires in " +

            "<span id=\"qrCountdown\">" +
            "60:00" +
            "</span>";

        }


        startQRCountdown(
          result.expiresAt
        );

      }

      catch (error) {

        console.error(
          "QR DISPLAY ERROR:",
          error
        );


        if (status) {

          status.textContent =
            "Unable to display QR code.";

        }

      }

    }
  );

}


/* =========================================================
   LOAD QR CODE LIBRARY
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


  const existing =
    document.querySelector(
      'script[data-qrcode-library="true"]'
    );


  if (existing) {

    existing.addEventListener(
      "load",
      callback,
      {
        once: true
      }
    );


    existing.addEventListener(
      "error",
      function() {

        alert(
          "Unable to load QR code generator."
        );

      },
      {
        once: true
      }
    );


    return;

  }


  const script =
    document.createElement(
      "script"
    );


  script.src =
    "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";


  script.async =
    true;


  script.dataset.qrcodeLibrary =
    "true";


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

    qrCountdownTimer =
      null;

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


      if (qrCountdownTimer) {

        clearInterval(
          qrCountdownTimer
        );

        qrCountdownTimer =
          null;

      }


      return;

    }


    const totalSeconds =
      Math.floor(
        remaining /
        1000
      );


    const minutes =
      Math.floor(
        totalSeconds /
        60
      );


    const seconds =
      totalSeconds %
      60;


    countdown.textContent =

      String(
        minutes
      )
        .padStart(
          2,
          "0"
        ) +

      ":" +

      String(
        seconds
      )
        .padStart(
          2,
          "0"
        );

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
      "";

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
   * Reserved for the attendance
   * monitoring section.
   *
   * Existing backend summary
   * remains untouched.
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
            "Google Apps Script API URL has not been configured."
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
            "follow",

          cache:
            "no-store"

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


          return response.text();

        }
      )

      .then(
        function(text) {

          if (!text) {

            throw new Error(
              "Empty response from attendance server."
            );

          }


          let result;


          try {

            result =
              JSON.parse(
                text
              );

          }

          catch (error) {

            console.error(
              "SERVER RESPONSE:",
              text
            );


            throw new Error(
              "Invalid response from attendance server."
            );

          }


          resolve(
            result
          );

        }
      )

      .catch(
        function(error) {

          console.error(
            "API ERROR:",
            action,
            error
          );


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


  if (!loading) {

    return;

  }


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
   LEGACY USER MIGRATION
   ========================================================= */

function migrateLegacyStoredUser() {

  const users =
    getRegisteredUsers();


  /*
   * If multiple-user storage
   * already exists, leave it alone.
   */

  if (
    users.length > 0
  ) {

    return;

  }


  const legacyLicense =
    localStorage.getItem(
      LICENSE_STORAGE_KEY
    );


  if (!legacyLicense) {

    return;

  }


  /*
   * We only know the old
   * License No.
   *
   * The actual name will be
   * refreshed when the user
   * registers/identifies again.
   */

  addRegisteredUser({

    firstName:
      "REGISTERED USER",

    middleName:
      "",

    lastName:
      "",

    licenseNo:
      legacyLicense

  });

}


/* =========================================================
   INITIALIZE
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  function() {

    migrateLegacyStoredUser();


    showPage(
      "homePage"
    );

  }
);
