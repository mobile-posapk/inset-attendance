const API_URL =
  'https://script.google.com/macros/s/AKfycbxtBRiR3XOLpidV5aaL0Im9emBZvJ_wsEi1CqABGV5-g0jIcZ0Ji7TqNOccygIlIflF3w/exec';

const EVENT_DATES = [
  '2026-09-09',
  '2026-09-10',
  '2026-09-11'
];

const LICENSE_KEY = 'inset2026_license';
const SELECTED_USER_KEY = 'inset2026_selected_user';

let html5QrCode = null;
let currentQRData = null;
let currentQRMode = null;
let currentQRDate = null;
let selectedUser = null;


/* =========================================================
   PAGE NAVIGATION
   ========================================================= */

function showPage(pageId) {
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });

  const page = document.getElementById(pageId);

  if (page) {
    page.classList.add('active');
  }
}

function goHome() {
  stopScanner();

  selectedUser = null;
  localStorage.removeItem(SELECTED_USER_KEY);

  showPage('homePage');
}


/* =========================================================
   LOADING
   ========================================================= */

function showLoading(message = 'Please wait...') {
  const overlay = document.getElementById('loadingOverlay');
  const messageElement = document.getElementById('loadingMessage');

  if (messageElement) {
    messageElement.textContent = message;
  }

  if (overlay) {
    overlay.classList.add('show');
  }
}

function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');

  if (overlay) {
    overlay.classList.remove('show');
  }
}


/* =========================================================
   API
   ========================================================= */

async function apiRequest(action, data = {}) {

  const params = new URLSearchParams();

  params.set('action', action);

  Object.keys(data).forEach(key => {
    if (data[key] !== undefined && data[key] !== null) {
      params.set(key, String(data[key]));
    }
  });

  const url =
    `${API_URL}?${params.toString()}`;

  try {

    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    const text =
      await response.text();

    if (!text) {
      throw new Error(
        'Empty response from server.'
      );
    }

    let result;

    try {
      result = JSON.parse(text);
    } catch (jsonError) {

      console.error(
        'Invalid server response:',
        text
      );

      throw new Error(
        'The Google Apps Script did not return JSON. Check the Web App deployment.'
      );
    }

    return result;

  } catch (error) {

    console.error(
      `API ERROR [${action}]:`,
      error
    );

    throw error;
  }
}


/* =========================================================
   HOME
   ========================================================= */

function startAttendance() {
  showPage('identifyPage');

  const message = document.getElementById('identifyMessage');

  if (message) {
    message.textContent = '';
  }

  loadRegisteredUsers();
}


/* =========================================================
   MULTIPLE USER SELECTION
   ========================================================= */

async function loadRegisteredUsers() {
  const container =
    document.getElementById('registeredUsers');

  const message =
    document.getElementById('identifyMessage');

  if (!container) {
    return;
  }

  container.innerHTML = '';

  if (message) {
    message.textContent = '';
  }

  /*
   * Existing registration is stored in localStorage.
   *
   * We first check the locally remembered users.
   */
  let users = getSavedUsers();

  /*
   * If there is only one registered user on this phone,
   * select that user automatically.
   */
  if (users.length === 1) {
    selectUser(users[0]);
    return;
  }

  /*
   * If multiple users are registered on this phone,
   * display the selection screen.
   */
  if (users.length > 1) {
    displayUserSelection(users);
    return;
  }

  /*
   * No locally saved users.
   *
   * This means the person needs to register first.
   */
  container.innerHTML = `
    <div class="no-users-message">
      <strong>No registered user found.</strong>
      <p>
        Please register this user first.
      </p>
    </div>

    <button
      type="button"
      class="main-button register-button"
      onclick="openRegistration()">
      📝 REGISTER
    </button>
  `;

  if (message) {
    message.textContent =
      'No registered user found on this phone.';
  }
}


/* =========================================================
   DISPLAY USERS
   ========================================================= */

function displayUserSelection(users) {
  const container =
    document.getElementById('registeredUsers');

  if (!container) {
    return;
  }

  container.innerHTML = '';

  users.forEach((user, index) => {

    const button =
      document.createElement('button');

    button.type = 'button';
    button.className = 'registered-user-button';

    button.innerHTML = `
      <span class="user-number">
        ${index + 1}
      </span>

      <span class="user-information">

        <strong>
          ${escapeHtml(
            formatFullName(
              user.firstName,
              user.middleName,
              user.lastName
            )
          )}
        </strong>

        <small>
          License No.: ${escapeHtml(user.licenseNo)}
        </small>

      </span>
    `;

    button.onclick = () => {
      selectUser(user);
    };

    container.appendChild(button);
  });
}


/* =========================================================
   SELECT USER
   ========================================================= */

function selectUser(user) {
  if (!user || !user.licenseNo) {
    showIdentifyMessage(
      '⚠️ Invalid user information.'
    );

    return;
  }

  selectedUser = {
    firstName: user.firstName || '',
    middleName: user.middleName || '',
    lastName: user.lastName || '',
    licenseNo: user.licenseNo
  };

  localStorage.setItem(
    SELECTED_USER_KEY,
    JSON.stringify(selectedUser)
  );

  /*
   * Keep the selected License No. available to the
   * existing attendance system.
   */
  localStorage.setItem(
    LICENSE_KEY,
    selectedUser.licenseNo
  );

  startScanner();
}


/* =========================================================
   SAVED USERS
   ========================================================= */

function getSavedUsers() {

  /*
   * New multi-user storage.
   */
  try {

    const raw =
      localStorage.getItem('inset2026_registered_users');

    if (raw) {

      const users = JSON.parse(raw);

      if (Array.isArray(users)) {
        return users.filter(
          user =>
            user &&
            user.licenseNo
        );
      }
    }

  } catch (error) {
    console.error(
      'Unable to read registered users:',
      error
    );
  }


  /*
   * Compatibility with the previous single-user system.
   */
  const oldLicense =
    localStorage.getItem(LICENSE_KEY);

  if (oldLicense) {

    try {

      const oldUser =
        JSON.parse(
          localStorage.getItem(
            SELECTED_USER_KEY
          )
        );

      if (
        oldUser &&
        oldUser.licenseNo
      ) {
        return [oldUser];
      }

    } catch (error) {
      console.warn(
        'Old user information could not be read.'
      );
    }

    return [
      {
        firstName: '',
        middleName: '',
        lastName: '',
        licenseNo: oldLicense
      }
    ];
  }

  return [];
}


/* =========================================================
   SAVE REGISTERED USER TO THIS PHONE
   ========================================================= */

function saveRegisteredUser(user) {

  if (
    !user ||
    !user.licenseNo
  ) {
    return;
  }

  let users = getSavedUsers();

  const normalizedLicense =
    normalizeLicense(user.licenseNo);

  /*
   * Do not add the same License No. twice.
   */
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

  localStorage.setItem(
    'inset2026_registered_users',
    JSON.stringify(users)
  );
}


/* =========================================================
   REGISTRATION
   ========================================================= */

function openRegistration() {
  showPage('registrationPage');

  const note =
    document.getElementById('registrationNote');

  if (note) {
    note.textContent = '';
  }
}


async function registerUser() {

  const firstName =
    getValue('firstName');

  const middleName =
    getValue('middleName');

  const lastName =
    getValue('lastName');

  const licenseNo =
    getValue('registrationLicense');


  if (!firstName || !lastName || !licenseNo) {

    setRegistrationMessage(
      '⚠️ Please complete the required fields.'
    );

    return;
  }


  showLoading(
    'Registering participant...'
  );


  try {

    const result =
      await apiRequest(
        'registerParticipant',
        {
          firstName,
          middleName,
          lastName,
          licenseNo
        }
      );


    if (!result.success) {

      setRegistrationMessage(
        result.message ||
        'Registration failed.'
      );

      hideLoading();

      return;
    }


    /*
     * Save this participant locally on this phone.
     *
     * This is what allows multiple registered
     * participants to use the same phone.
     */
    saveRegisteredUser({
      firstName,
      middleName,
      lastName,
      licenseNo
    });


    /*
     * Select the newly registered participant.
     */
    selectedUser = {
      firstName,
      middleName,
      lastName,
      licenseNo
    };


    localStorage.setItem(
      SELECTED_USER_KEY,
      JSON.stringify(selectedUser)
    );

    localStorage.setItem(
      LICENSE_KEY,
      licenseNo
    );


    hideLoading();


    alert(
      result.message ||
      'Registration successful.'
    );


    clearRegistrationForm();

    showPage('homePage');

  } catch (error) {

    hideLoading();

    console.error(error);

    setRegistrationMessage(
      '⚠️ Unable to connect to the attendance server.'
    );
  }
}


/* =========================================================
   SCANNER
   ========================================================= */

async function startScanner() {

  if (
    !selectedUser ||
    !selectedUser.licenseNo
  ) {

    showPage('identifyPage');

    showIdentifyMessage(
      '⚠️ Please select a registered user first.'
    );

    return;
  }


  showPage('scannerPage');


  updateSelectedUserDisplay();


  const scannerStatus =
    document.getElementById('scannerStatus');

  if (scannerStatus) {
    scannerStatus.textContent =
      'Allow camera access, then scan the QR code.';
  }


  /*
   * Give the scanner page a moment to render.
   */
  setTimeout(
    initializeScanner,
    200
  );
}


async function initializeScanner() {

  const reader =
    document.getElementById('reader');

  if (!reader) {
    return;
  }


  /*
   * Stop an existing scanner first.
   */
  await stopScanner();


  html5QrCode =
    new Html5Qrcode('reader');


  const config = {
    fps: 10,
    qrbox: {
      width: 250,
      height: 250
    },
    aspectRatio: 1
  };


  try {

    await html5QrCode.start(
      {
        facingMode: 'environment'
      },

      config,

      qrCodeMessage => {
        processQRCode(qrCodeMessage);
      },

      errorMessage => {
        /*
         * Ignore normal scanning errors.
         */
      }
    );


    const scannerStatus =
      document.getElementById(
        'scannerStatus'
      );

    if (scannerStatus) {

      scannerStatus.textContent =
        `Scanning for ${formatUserName(selectedUser)}...`;

    }

  } catch (error) {

    console.error(
      'Camera error:',
      error
    );


    const scannerStatus =
      document.getElementById(
        'scannerStatus'
      );

    if (scannerStatus) {

      scannerStatus.textContent =
        '⚠️ Unable to access the camera. Please allow camera permission and try again.';

    }

  }
}


/* =========================================================
   STOP SCANNER
   ========================================================= */

async function stopScanner() {

  if (!html5QrCode) {
    return;
  }

  try {

    if (
      html5QrCode.isScanning
    ) {

      await html5QrCode.stop();

    }

  } catch (error) {

    console.warn(
      'Scanner stop warning:',
      error
    );

  }


  try {

    await html5QrCode.clear();

  } catch (error) {
    /*
     * Nothing else needed.
     */
  }


  html5QrCode = null;
}


/* =========================================================
   PROCESS QR
   ========================================================= */

let qrAlreadyProcessed = false;

async function processQRCode(decodedText) {

  if (qrAlreadyProcessed) {
    return;
  }

  qrAlreadyProcessed = true;


  await stopScanner();


  const token =
    extractQRToken(decodedText);


  if (!token) {

    qrAlreadyProcessed = false;

    showError(
      '⚠️ Invalid attendance QR code.'
    );

    return;
  }


  if (
    !selectedUser ||
    !selectedUser.licenseNo
  ) {

    qrAlreadyProcessed = false;

    showError(
      '⚠️ No user selected.'
    );

    return;
  }


  await recordAttendanceWithToken(
    token,
    selectedUser.licenseNo
  );
}


/* =========================================================
   EXTRACT QR TOKEN
   ========================================================= */

function extractQRToken(value) {

  if (!value) {
    return '';
  }

  const text =
    String(value).trim();


  /*
   * If the QR contains the token directly.
   */
  if (
    !text.includes('?') &&
    !text.includes('&')
  ) {
    return text;
  }


  /*
   * If the QR contains the web-app URL:
   *
   * https://.../exec?token=XXXXX
   */
  try {

    const url =
      new URL(text);

    return (
      url.searchParams.get(
        'token'
      ) || ''
    );

  } catch (error) {

    /*
     * Fallback for token=XXXXX
     */
    const match =
      text.match(
        /[?&]token=([^&]+)/i
      );

    if (match) {
      return decodeURIComponent(
        match[1]
      );
    }

  }


  return '';
}


/* =========================================================
   RECORD ATTENDANCE
   ========================================================= */

async function recordAttendanceWithToken(
  token,
  licenseNo
) {

  showLoading(
    'Recording attendance...'
  );


  try {

    const result =
      await apiRequest(
        'recordAttendance',
        {
          token,
          licenseNo
        }
      );


    hideLoading();


    if (!result.success) {

      qrAlreadyProcessed = false;

      showError(
        result.message ||
        'Unable to record attendance.'
      );

      return;
    }


    /*
     * SUCCESS
     */
    showSuccess(
      result
    );


  } catch (error) {

    hideLoading();

    qrAlreadyProcessed = false;

    console.error(error);

    showError(
      '⚠️ Unable to connect to the attendance server.'
    );

  }
}


/* =========================================================
   SUCCESS
   ========================================================= */

function showSuccess(result) {

  const message =
    document.getElementById(
      'successMessage'
    );

  const details =
    document.getElementById(
      'successDetails'
    );


  if (message) {

    message.textContent =
      result.message ||
      'Attendance recorded successfully.';

  }


  if (details) {

    const userName =
      selectedUser
        ? formatUserName(selectedUser)
        : 'Participant';


    details.innerHTML = `
      <p>
        <strong>NAME:</strong>
        ${escapeHtml(userName)}
      </p>

      <p>
        <strong>LICENSE NO.:</strong>
        ${escapeHtml(
          selectedUser.licenseNo
        )}
      </p>

      ${
        result.date
          ? `
            <p>
              <strong>DATE:</strong>
              ${escapeHtml(result.date)}
            </p>
          `
          : ''
      }

      ${
        result.time
          ? `
            <p>
              <strong>TIME:</strong>
              ${escapeHtml(result.time)}
            </p>
          `
          : ''
      }

      ${
        result.mode
          ? `
            <p>
              <strong>TYPE:</strong>
              ${escapeHtml(result.mode)}
            </p>
          `
          : ''
      }
    `;

  }


  showPage('successPage');
}


/* =========================================================
   ERROR
   ========================================================= */

function showError(message) {

  const errorElement =
    document.getElementById(
      'errorMessage'
    );

  if (errorElement) {
    errorElement.textContent =
      message;
  }

  showPage('errorPage');
}


/* =========================================================
   ADMIN LOGIN
   ========================================================= */

function openAdminLogin() {

  showPage(
    'adminLoginPage'
  );

  const password =
    document.getElementById(
      'adminPassword'
    );

  if (password) {
    password.value = '';
    password.focus();
  }

  const message =
    document.getElementById(
      'adminLoginMessage'
    );

  if (message) {
    message.textContent = '';
  }
}


async function checkAdminPassword() {

  const password =
    getValue('adminPassword');


  if (!password) {

    const message =
      document.getElementById(
        'adminLoginMessage'
      );

    if (message) {
      message.textContent =
        '⚠️ Please enter the administrator password.';
    }

    return;
  }


  showLoading(
    'Checking administrator access...'
  );


  try {

    const result =
      await apiRequest(
        'checkAdminPassword',
        {
          password
        }
      );


    hideLoading();


    if (!result.success) {

      const message =
        document.getElementById(
          'adminLoginMessage'
        );

      if (message) {
        message.textContent =
          result.message ||
          'Incorrect administrator password.';
      }

      return;
    }


    showPage('adminPage');


  } catch (error) {

    hideLoading();

    console.error(error);

    const message =
      document.getElementById(
        'adminLoginMessage'
      );

    if (message) {
      message.textContent =
        '⚠️ Unable to connect to the server.';
    }
  }
}


/*
 * Compatibility with any existing HTML/code
 * that calls adminLogin().
 */
function adminLogin() {
  checkAdminPassword();
}


/* =========================================================
   QR GENERATOR
   ========================================================= */

function selectQRDay(date) {

  currentQRDate = date;

  const input =
    document.getElementById(
      'attendanceDate'
    );

  if (input) {
    input.value = date;
  }
}


async function generateQR(mode) {

  if (!currentQRDate) {
    showQRStatus('⚠️ Please select an attendance date.');
    return;
  }

  mode = String(mode || '').trim().toUpperCase();

  showLoading('Generating QR code...');

  try {

    const result = await apiRequest('generateQR', {
      date: currentQRDate,
      mode: mode
    });

    if (!result || !result.success) {
      hideLoading();

      showQRStatus(
        '⚠️ ' +
        (result?.message || 'Unable to generate QR code.')
      );

      return;
    }

    if (!result.token) {
      hideLoading();

      showQRStatus(
        '⚠️ QR token was not generated.'
      );

      return;
    }

    currentQRData = result;
    currentQRMode = mode;

    await displayQR(result);

    hideLoading();

    const downloadButton =
      document.getElementById('downloadQrButton');

    if (downloadButton) {
      downloadButton.disabled = false;
    }

    showQRStatus(
      `✅ ${mode} QR generated for ${formatDate(currentQRDate)}.`
    );

  } catch (error) {

    hideLoading();

    console.error('QR GENERATION ERROR:', error);

    showQRStatus(
      '⚠️ Unable to generate QR code.'
    );
  }
}

/* =========================================================
   QR DISPLAY
   ========================================================= */

async function displayQR(data) {

  const container =
    document.getElementById('qrContainer');

  if (!container) {
    return;
  }

  container.innerHTML = '';

  if (!data || !data.token) {
    throw new Error('Missing QR token.');
  }

  /*
   * Generate a REAL QR code directly from the token.
   * No QRCode.js library is required.
   */
  const qrImage =
    document.createElement('img');

  qrImage.id = 'generatedQRImage';

  qrImage.alt =
    'INSET 2026 Attendance QR Code';

  qrImage.width = 320;
  qrImage.height = 320;

  qrImage.style.width = '320px';
  qrImage.style.height = '320px';
  qrImage.style.display = 'block';
  qrImage.style.margin = 'auto';

  /*
   * QR contains ONLY the secure attendance token.
   */
  qrImage.src =
    'https://api.qrserver.com/v1/create-qr-code/?size=800x800&data=' +
    encodeURIComponent(data.token);

  await new Promise((resolve, reject) => {

    qrImage.onload = () => {
      resolve();
    };

    qrImage.onerror = () => {
      reject(
        new Error('Unable to create QR image.')
      );
    };

  });

  container.appendChild(qrImage);
}

/* =========================================================
   LOAD QR LIBRARY
   ========================================================= */

function loadQRCodeLibrary() {

  if (
    window.QRCode &&
    typeof window.QRCode.toCanvas ===
      'function'
  ) {
    return Promise.resolve();
  }


  return new Promise(
    (resolve, reject) => {

      const script =
        document.createElement(
          'script'
        );

      script.src =
        'https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js';

      script.onload =
        () => resolve();

      script.onerror =
        () => reject(
          new Error(
            'Unable to load QR library.'
          )
        );

      document.head.appendChild(
        script
      );

    }
  );
}


/* =========================================================
   DOWNLOAD CURRENT QR
   ========================================================= */

async function downloadCurrentQR() {

  const image =
    document.getElementById(
      'generatedQRImage'
    );

  if (!image) {

    alert(
      'Please generate a QR code first.'
    );

    return;
  }

  const link =
    document.createElement('a');

  link.href =
    image.src;

  link.download =
    `INSET2026_${currentQRDate}_${currentQRMode}.png`;

  document.body.appendChild(link);

  link.click();

  document.body.removeChild(link);
}

/* =========================================================
   CLEAR QR
   ========================================================= */

function clearQR() {

  currentQRData = null;
  currentQRMode = null;
  currentQRDate = null;


  const date =
    document.getElementById(
      'attendanceDate'
    );

  if (date) {
    date.value = '';
  }


  const status =
    document.getElementById(
      'qrStatus'
    );

  if (status) {
    status.textContent = '';
  }


  const container =
    document.getElementById(
      'qrContainer'
    );

  if (container) {
    container.innerHTML = '';
  }


  const download =
    document.getElementById(
      'downloadQrButton'
    );

  if (download) {
    download.disabled = true;
  }
}


/* =========================================================
   A4 PDF — LOAD jsPDF
   ========================================================= */

function loadJsPDF() {

  if (
    window.jspdf &&
    window.jspdf.jsPDF
  ) {
    return Promise.resolve();
  }


  return new Promise(
    (resolve, reject) => {

      const script =
        document.createElement(
          'script'
        );

      script.src =
        'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';

      script.onload =
        () => resolve();

      script.onerror =
        () => reject(
          new Error(
            'Unable to load jsPDF.'
          )
        );

      document.head.appendChild(
        script
      );

    }
  );
}


/* =========================================================
   DOWNLOAD ALL 6 QR CODES — A4 PDF
   ========================================================= */

async function downloadAllQRCodesPDF() {

  showLoading(
    'Preparing all 6 QR codes...'
  );


  try {

    await loadQRCodeLibrary();
    await loadJsPDF();


    const qrList = [

      {
        date: '2026-09-09',
        mode: 'TIME-IN'
      },

      {
        date: '2026-09-09',
        mode: 'TIME-OUT'
      },

      {
        date: '2026-09-10',
        mode: 'TIME-IN'
      },

      {
        date: '2026-09-10',
        mode: 'TIME-OUT'
      },

      {
        date: '2026-09-11',
        mode: 'TIME-IN'
      },

      {
        date: '2026-09-11',
        mode: 'TIME-OUT'
      }

    ];


    const generated = [];


    for (
      const item of qrList
    ) {

      const result =
        await apiRequest(
          'generateQR',
          {
            date: item.date,
            mode: item.mode
          }
        );


      if (!result.success) {

        throw new Error(
          result.message ||
          `Unable to generate ${item.mode}.`
        );

      }


      const canvas =
        document.createElement(
          'canvas'
        );


      await new Promise(
        (resolve, reject) => {

          QRCode.toCanvas(
            canvas,
            result.token,
            {
              width: 1000,
              margin: 2
            },
            error => {

              if (error) {
                reject(error);
              } else {
                resolve();
              }

            }
          );

        }
      );


      generated.push({
        ...item,
        image:
          canvas.toDataURL(
            'image/png'
          )
      });

    }


    const {
      jsPDF
    } = window.jspdf;


    const pdf =
      new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });


    const pageWidth =
      210;

    const pageHeight =
      297;


    for (
      let i = 0;
      i < generated.length;
      i++
    ) {

      if (i > 0) {
        pdf.addPage();
      }


      const item =
        generated[i];


      pdf.setFontSize(26);

      pdf.text(
        'INSET 2026',
        pageWidth / 2,
        35,
        {
          align: 'center'
        }
      );


      pdf.setFontSize(22);

      pdf.text(
        `${item.mode}`,
        pageWidth / 2,
        52,
        {
          align: 'center'
        }
      );


      pdf.setFontSize(17);

      pdf.text(
        `DAY ${Math.floor(i / 2) + 1} — ${formatDate(item.date)}`,
        pageWidth / 2,
        65,
        {
          align: 'center'
        }
      );


      const qrSize =
        135;

      const qrX =
        (pageWidth - qrSize) / 2;

      const qrY =
        78;


      pdf.addImage(
        item.image,
        'PNG',
        qrX,
        qrY,
        qrSize,
        qrSize
      );


      pdf.setFontSize(16);

      pdf.text(
        `SCAN HERE FOR ${item.mode}`,
        pageWidth / 2,
        235,
        {
          align: 'center'
        }
      );


      pdf.setFontSize(12);

      pdf.text(
        'INSET 2026 ATTENDANCE',
        pageWidth / 2,
        250,
        {
          align: 'center'
        }
      );

    }


    pdf.save(
      'INSET2026_ATTENDANCE_QR_CODES_A4.pdf'
    );


    hideLoading();


  } catch (error) {

    hideLoading();

    console.error(error);

    alert(
      'Unable to create the A4 PDF.\n\n' +
      error.message
    );

  }
}


/* =========================================================
   ATTENDANCE SUMMARY
   ========================================================= */

async function loadAttendanceSummary() {

  const container =
    document.getElementById(
      'attendanceSummary'
    );


  if (!container) {
    return;
  }


  container.innerHTML =
    'Loading attendance summary...';


  try {

    const result =
      await apiRequest(
        'getAttendanceSummary'
      );


    if (!result.success) {

      container.innerHTML =
        `<p>${escapeHtml(
          result.message ||
          'Unable to load summary.'
        )}</p>`;

      return;
    }


    renderAttendanceSummary(
      result
    );


  } catch (error) {

    console.error(error);

    container.innerHTML =
      '<p>⚠️ Unable to load attendance summary.</p>';

  }
}


function renderAttendanceSummary(result) {

  const container =
    document.getElementById(
      'attendanceSummary'
    );


  if (!container) {
    return;
  }


  const rows =
    result.rows ||
    result.data ||
    [];


  if (!rows.length) {

    container.innerHTML =
      '<p>No attendance records found.</p>';

    return;
  }


  let html = `
    <div class="summary-table-wrapper">

      <table class="summary-table">

        <thead>
          <tr>
            <th>NAME</th>
            <th>DATE</th>
            <th>LICENSE NO.</th>
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
            formatFullName(
              row.firstName,
              row.middleName,
              row.lastName
            )
          )}
        </td>

        <td>
          ${escapeHtml(
            row.date || ''
          )}
        </td>

        <td>
          ${escapeHtml(
            row.licenseNo ||
            row.license ||
            ''
          )}
        </td>

        <td>
          ${escapeHtml(
            row.timeIn ||
            ''
          )}
        </td>

        <td>
          ${escapeHtml(
            row.timeOut ||
            ''
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


  container.innerHTML =
    html;
}


/* =========================================================
   UI HELPERS
   ========================================================= */

function updateSelectedUserDisplay() {

  const element =
    document.getElementById(
      'selectedUserDisplay'
    );


  if (!element) {
    return;
  }


  if (!selectedUser) {

    element.innerHTML = '';

    return;
  }


  element.innerHTML = `
    <strong>
      ${escapeHtml(
        formatUserName(
          selectedUser
        )
      )}
    </strong>

    <small>
      License No.:
      ${escapeHtml(
        selectedUser.licenseNo
      )}
    </small>
  `;
}


function showIdentifyMessage(message) {

  const element =
    document.getElementById(
      'identifyMessage'
    );

  if (element) {
    element.textContent =
      message || '';
  }
}


function setRegistrationMessage(message) {

  const element =
    document.getElementById(
      'registrationNote'
    );

  if (element) {
    element.textContent =
      message || '';
  }
}


function showQRStatus(message) {

  const element =
    document.getElementById(
      'qrStatus'
    );

  if (element) {
    element.textContent =
      message || '';
  }
}


/* =========================================================
   FORMATTERS
   ========================================================= */

function formatUserName(user) {

  if (!user) {
    return '';
  }

  return formatFullName(
    user.firstName,
    user.middleName,
    user.lastName
  );
}


function formatFullName(
  firstName,
  middleName,
  lastName
) {

  return [
    firstName,
    middleName,
    lastName
  ]
    .map(value =>
      String(value || '').trim()
    )
    .filter(Boolean)
    .join(' ');
}


function formatDate(dateString) {

  if (!dateString) {
    return '';
  }


  const parts =
    String(dateString).split('-');


  if (parts.length !== 3) {
    return dateString;
  }


  const date =
    new Date(
      Number(parts[0]),
      Number(parts[1]) - 1,
      Number(parts[2])
    );


  return date.toLocaleDateString(
    'en-US',
    {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }
  );
}


/* =========================================================
   NORMALIZATION
   ========================================================= */

function normalizeLicense(value) {

  return String(
    value || ''
  )
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}


/* =========================================================
   GET VALUE
   ========================================================= */

function getValue(id) {

  const element =
    document.getElementById(id);

  if (!element) {
    return '';
  }

  return String(
    element.value || ''
  ).trim();
}


/* =========================================================
   CLEAR REGISTRATION FORM
   ========================================================= */

function clearRegistrationForm() {

  [
    'firstName',
    'middleName',
    'lastName',
    'registrationLicense'
  ].forEach(id => {

    const element =
      document.getElementById(id);

    if (element) {
      element.value = '';
    }

  });


  const note =
    document.getElementById(
      'registrationNote'
    );

  if (note) {
    note.textContent = '';
  }
}


/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHtml(value) {

  return String(
    value ?? ''
  )
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


/* =========================================================
   INITIALIZE
   ========================================================= */

document.addEventListener(
  'DOMContentLoaded',
  () => {

    /*
     * Reset scanner state.
     */
    html5QrCode = null;

    selectedUser = null;

    qrAlreadyProcessed = false;

  }
);
