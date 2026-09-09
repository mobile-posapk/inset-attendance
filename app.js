/* ============================================================
   INSET 2026 ATTENDANCE SYSTEM
   FRONTEND APP.JS
   ============================================================ */


/* ============================================================
   CONFIGURATION
   ============================================================ */

const API_URL =
  'https://script.google.com/macros/s/AKfycbxtBRiR3XOLpidV5aaL0Im9emBZvJ_wsEi1CqABGV5-g0jIcZ0Ji7TqNOccygIlIflF3w/exec';

const PENDING_QR_TOKEN_KEY =
  'inset_pending_qr_token';

const LICENSE_STORAGE_KEY =
  'inset_license';

let currentParticipant = null;

let html5QrCode = null;

let scannerRunning = false;

let selectedQRDay = '2026-09-09';

let generatedQRData = null;


/* ============================================================
   PAGE HELPERS
   ============================================================ */

function getPage(id) {
  return document.getElementById(id);
}


function showPage(pageId) {

  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });

  const page = getPage(pageId);

  if (page) {
    page.classList.add('active');
  }

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}


/* ============================================================
   HOME
   ============================================================ */

function showHome() {

  stopScanner();

  currentParticipant = null;

  clearPendingQR();

  showPage('homePage');
}


function startAttendance() {

  stopScanner();

  currentParticipant = null;

  /*
   * A new scan session starts here.
   * Any abandoned pending QR from a previous attempt
   * is removed.
   */
  clearPendingQR();

  showPage('scannerPage');

  updateScannerStatus(
    'Point your camera at the attendance QR code.'
  );

  setTimeout(() => {
    startScanner();
  }, 300);
}


/* ============================================================
   REGISTRATION
   ============================================================ */

function openRegistration() {

  stopScanner();

  /*
   * Direct registration should not accidentally use
   * an old pending QR.
   */
  clearPendingQR();

  resetRegistrationForm();

  const note = getPage('registrationNote');

  if (note) {
    note.innerHTML =
      'Register your information to use the attendance system.';
  }

  showPage('registrationPage');
}


function resetRegistrationForm() {

  const fields = [
    'firstName',
    'middleName',
    'lastName',
    'registrationLicense'
  ];

  fields.forEach(id => {

    const field = getPage(id);

    if (field) {
      field.value = '';
    }

  });
}


function registerUser() {

  const firstName =
    getPage('firstName')?.value.trim() || '';

  const middleName =
    getPage('middleName')?.value.trim() || '';

  const lastName =
    getPage('lastName')?.value.trim() || '';

  const license =
    getPage('registrationLicense')?.value.trim() || '';


  if (!firstName) {

    showError('Please enter your First Name.');

    return;
  }


  if (!lastName) {

    showError('Please enter your Last Name.');

    return;
  }


  if (!license) {

    showError('Please enter your License No.');

    return;
  }


  showLoading('Registering participant...');


  apiRequest(
    'registerParticipant',
    {
      firstName: firstName,
      middleName: middleName,
      lastName: lastName,
      license: license
    }
  )
  .then(result => {

    hideLoading();


    if (!result || !result.success) {

      showError(
        result?.message ||
        'Registration failed.'
      );

      return;
    }


    /*
     * Save license locally.
     */
    localStorage.setItem(
      LICENSE_STORAGE_KEY,
      license
    );


    currentParticipant = {

      firstName:
        result.firstName || firstName,

      middleName:
        result.middleName || middleName,

      lastName:
        result.lastName || lastName,

      license:
        result.license || license

    };


    /*
     * If registration was triggered by a QR scan,
     * automatically record the QR that was already scanned.
     */
    const pendingToken =
      getPendingQR();


    if (pendingToken) {

      clearPendingQR();

      recordAttendanceWithToken(
        pendingToken,
        license
      );

      return;
    }


    /*
     * Normal direct registration.
     * Start scanner after registration.
     */
    showPage('scannerPage');

    updateScannerStatus(
      'Registration successful. Scan the attendance QR code.'
    );


    setTimeout(() => {
      startScanner();
    }, 300);

  })
  .catch(error => {

    hideLoading();

    console.error(error);

    showError(
      'Unable to connect to the attendance server.'
    );

  });

}


/* ============================================================
   QR SCANNER
   ============================================================ */

function startScanner() {

  if (scannerRunning) {
    return;
  }


  if (typeof Html5Qrcode === 'undefined') {

    updateScannerStatus(
      'QR scanner is still loading. Please wait...'
    );

    setTimeout(startScanner, 500);

    return;
  }


  const readerElement =
    getPage('reader');

  if (!readerElement) {
    return;
  }


  readerElement.innerHTML = '';


  html5QrCode =
    new Html5Qrcode('reader');


  const config = {

    fps: 10,

    qrbox: function(viewfinderWidth, viewfinderHeight) {

      const minEdge =
        Math.min(
          viewfinderWidth,
          viewfinderHeight
        );

      const size =
        Math.floor(minEdge * 0.70);

      return {
        width: size,
        height: size
      };
    },

    aspectRatio: 1.0

  };


  html5QrCode
    .start(

      {
        facingMode: 'environment'
      },

      config,

      decodedText => {

        processQRCode(decodedText);

      },

      errorMessage => {

        /*
         * Scanner continuously reports unsuccessful
         * frames. We intentionally do not show these
         * as errors to the user.
         */

      }

    )
    .then(() => {

      scannerRunning = true;

      updateScannerStatus(
        'Scanner ready. Point the camera at the QR code.'
      );

    })
    .catch(error => {

      console.error(
        'Camera error:',
        error
      );

      scannerRunning = false;

      updateScannerStatus(
        'Unable to access the camera. Please allow camera permission and try again.'
      );

    });

}


/* ============================================================
   STOP SCANNER
   ============================================================ */

function stopScanner() {

  if (!html5QrCode) {

    scannerRunning = false;

    return;
  }


  if (!scannerRunning) {

    html5QrCode = null;

    return;
  }


  try {

    html5QrCode
      .stop()
      .then(() => {

        scannerRunning = false;

        html5QrCode = null;

      })
      .catch(error => {

        console.warn(
          'Scanner stop warning:',
          error
        );

        scannerRunning = false;

        html5QrCode = null;

      });

  }
  catch (error) {

    console.warn(error);

    scannerRunning = false;

    html5QrCode = null;

  }

}


/* ============================================================
   SCANNER STATUS
   ============================================================ */

function updateScannerStatus(message) {

  const element =
    getPage('scannerStatus');

  if (element) {
    element.textContent = message;
  }

}


/* ============================================================
   QR PROCESSING
   ============================================================ */

function processQRCode(qrText) {

  if (!qrText) {
    return;
  }


  /*
   * Prevent multiple detections of the same QR
   * while processing.
   */
  if (window.qrProcessing === true) {
    return;
  }

  window.qrProcessing = true;


  let token = '';


  try {

    const url =
      new URL(qrText);

    token =
      url.searchParams.get('token') || '';

  }
  catch (error) {

    /*
     * Fallback for a raw token.
     */
    token =
      String(qrText).trim();

  }


  if (!token) {

    window.qrProcessing = false;

    showError(
      'Invalid attendance QR code.'
    );

    return;
  }


  stopScanner();


  const savedLicense =
    localStorage.getItem(
      LICENSE_STORAGE_KEY
    );


  /*
   * If the participant has not registered,
   * temporarily save the QR token and open registration.
   */
  if (!savedLicense) {

    savePendingQR(token);

    showRegistrationFromQR();

    window.qrProcessing = false;

    return;
  }


  /*
   * A license exists locally.
   * Ask the server whether the participant still exists.
   */
  recordAttendanceWithToken(
    token,
    savedLicense
  );

}


/* ============================================================
   REGISTRATION TRIGGERED BY QR
   ============================================================ */

function showRegistrationFromQR() {

  resetRegistrationForm();

  const note =
    getPage('registrationNote');


  if (note) {

    note.innerHTML =
      '<strong>QR SCAN DETECTED.</strong><br>' +
      'You are not yet registered. Complete the registration below and your scanned QR code will automatically be recorded.';

  }


  showPage('registrationPage');

}


/* ============================================================
   RECORD ATTENDANCE
   ============================================================ */

function recordAttendanceWithToken(
  token,
  license
) {

  showLoading(
    'Recording attendance...'
  );


  apiRequest(
    'recordAttendance',
    {
      token: token,
      license: license
    }
  )
  .then(result => {

    hideLoading();


    if (!result || !result.success) {

      /*
       * The QR itself may be valid, but the participant
       * may no longer exist in the database.
       */
      if (
        result &&
        result.registrationRequired
      ) {

        localStorage.removeItem(
          LICENSE_STORAGE_KEY
        );

        savePendingQR(token);

        const returnedLicense =
          result.license || license;


        if (returnedLicense) {

          const licenseField =
            getPage('registrationLicense');

          if (licenseField) {
            licenseField.value =
              returnedLicense;
          }

        }


        showRegistrationFromQR();

        return;
      }


      showError(
        result?.message ||
        'Attendance could not be recorded.'
      );

      return;
    }


    /*
     * Successful attendance.
     */
    clearPendingQR();

    showAttendanceSuccess(result);

  })
  .catch(error => {

    hideLoading();

    console.error(error);

    showError(
      'Unable to connect to the attendance server.'
    );

  })
  .finally(() => {

    window.qrProcessing = false;

  });

}


/* ============================================================
   SUCCESS
   ============================================================ */

function showAttendanceSuccess(result) {

  const successMessage =
    getPage('successMessage');

  const successDetails =
    getPage('successDetails');


  const mode =
    result.mode ||
    result.attendanceMode ||
    'ATTENDANCE';


  if (successMessage) {

    successMessage.innerHTML =
      `<strong>${escapeHTML(mode)}</strong> successfully recorded.`;

  }


  if (successDetails) {

    const participant =
      result.participant || {};

    const name =
      result.name ||
      participant.name ||
      buildParticipantName(
        participant
      );


    const date =
      result.attendanceDate ||
      result.date ||
      '';


    const time =
      result.attendanceTime ||
      result.time ||
      '';


    let html = '';


    if (name) {

      html +=
        `<div><strong>Participant:</strong> ${escapeHTML(name)}</div>`;

    }


    if (date) {

      html +=
        `<div><strong>Date:</strong> ${escapeHTML(formatDateForDisplay(date))}</div>`;

    }


    if (time) {

      html +=
        `<div><strong>Time:</strong> ${escapeHTML(time)}</div>`;

    }


    successDetails.innerHTML = html;

  }


  showPage('successPage');

}


/* ============================================================
   ADMIN LOGIN
   ============================================================ */

function openAdminLogin() {

  stopScanner();

  const password =
    getPage('adminPassword');

  if (password) {
    password.value = '';
  }

  showPage('adminLoginPage');

}


function showAdminLogin() {
  openAdminLogin();
}


function checkAdminPassword() {

  const password =
    getPage('adminPassword')?.value || '';


  if (!password) {

    showError(
      'Please enter the admin password.'
    );

    return;
  }


  showLoading(
    'Checking admin access...'
  );


  apiRequest(
    'checkAdminPassword',
    {
      password: password
    }
  )
  .then(result => {

    hideLoading();


    if (!result || !result.success) {

      showError(
        result?.message ||
        'Invalid admin password.'
      );

      return;
    }


    showAdminPage();

  })
  .catch(error => {

    hideLoading();

    console.error(error);

    showError(
      'Unable to connect to the attendance server.'
    );

  });

}


/* ============================================================
   ADMIN PAGE
   ============================================================ */

function showAdminPage() {

  showPage('adminPage');

  clearQR();

}


/* ============================================================
   SELECT QR DAY
   ============================================================ */

function selectQRDay(date) {

  selectedQRDay = date;


  const dateField =
    getPage('attendanceDate');

  if (dateField) {
    dateField.value = date;
  }


  /*
   * Clear previous generated QR when changing day.
   */
  clearQRDisplayOnly();

}


/* ============================================================
   GENERATE QR
   ============================================================ */

function generateQR(mode) {

  const dateField =
    getPage('attendanceDate');


  const attendanceDate =
    dateField?.value ||
    selectedQRDay ||
    '2026-09-09';


  selectedQRDay =
    attendanceDate;


  if (
    mode !== 'TIME-IN' &&
    mode !== 'TIME-OUT'
  ) {

    showQRStatus(
      'Invalid attendance mode.',
      true
    );

    return;
  }


  showLoading(
    `Generating ${mode} QR code...`
  );


  apiRequest(
    'generateQR',
    {
      mode: mode,
      attendanceDate: attendanceDate
    }
  )
  .then(result => {

    hideLoading();


    if (!result || !result.success) {

      showQRStatus(
        result?.message ||
        'Unable to generate QR code.',
        true
      );

      return;
    }


    generatedQRData = result;


    displayQRCode(result);


  })
  .catch(error => {

    hideLoading();

    console.error(error);

    showQRStatus(
      'Unable to connect to the attendance server.',
      true
    );

  });

}


/* ============================================================
   DISPLAY QR
   ============================================================ */

function displayQRCode(result) {

  const container =
    getPage('qrContainer');


  if (!container) {
    return;
  }


  container.innerHTML = '';


  const wrapper =
    document.createElement('div');

  wrapper.className =
    'generated-qr-wrapper';


  const day =
    result.day ||
    getDayNumber(
      result.attendanceDate ||
      result.date
    );


  const mode =
    result.mode ||
    'ATTENDANCE';


  const date =
    result.attendanceDate ||
    result.date ||
    '';


  const qrUrl =
    result.qrUrl ||
    result.url ||
    '';


  const title =
    document.createElement('div');

  title.className =
    'generated-qr-title';

  title.innerHTML =
    `<strong>DAY ${escapeHTML(String(day))}</strong> — ${escapeHTML(mode)}`;


  const dateText =
    document.createElement('div');

  dateText.className =
    'generated-qr-date';

  dateText.textContent =
    formatDateForDisplay(date);


  const qrImage =
    document.createElement('img');

  qrImage.className =
    'generated-qr-image';

  qrImage.alt =
    `INSET 2026 Day ${day} ${mode} QR Code`;


  /*
   * Generate a client-side QR image using a public QR
   * rendering service.
   *
   * The actual secure attendance token is contained
   * in qrUrl.
   */
  qrImage.src =
    buildQRImageURL(qrUrl);


  const validity =
    document.createElement('div');

  validity.className =
    'generated-qr-validity';


  const validFrom =
    result.validFrom
      ? formatDateTimeForDisplay(
          result.validFrom
        )
      : '';


  const expiresAt =
    result.expiresAt
      ? formatDateTimeForDisplay(
          result.expiresAt
        )
      : '';


  validity.innerHTML =
    `
      <div>
        <strong>Valid for:</strong>
        ${escapeHTML(
          String(
            result.validityHours || 24
          )
        )} hours
      </div>

      ${
        validFrom
          ? `<div><strong>Valid from:</strong> ${escapeHTML(validFrom)}</div>`
          : ''
      }

      ${
        expiresAt
          ? `<div><strong>Expires:</strong> ${escapeHTML(expiresAt)}</div>`
          : ''
      }
    `;


  wrapper.appendChild(title);

  wrapper.appendChild(dateText);

  wrapper.appendChild(qrImage);

  wrapper.appendChild(validity);


  container.appendChild(wrapper);


  /*
   * Activate download button.
   */
  const downloadButton =
    getPage('downloadQrButton');


  if (downloadButton) {

    downloadButton.disabled =
      false;

    downloadButton.textContent =
      '⬇️ DOWNLOAD QR CODE';

  }


  showQRStatus(
    `DAY ${day} ${mode} QR generated successfully.`
  );

}


/* ============================================================
   QR IMAGE URL
   ============================================================ */

function buildQRImageURL(qrUrl) {

  if (!qrUrl) {
    return '';
  }


  /*
   * QRServer generates the PNG image.
   * The QR itself contains only the secure token URL.
   */
  return (
    'https://api.qrserver.com/v1/create-qr-code/' +
    '?size=800x800' +
    '&margin=20' +
    '&data=' +
    encodeURIComponent(qrUrl)
  );

}


/* ============================================================
   DOWNLOAD GENERATED QR
   ============================================================ */

async function downloadGeneratedQR() {

  if (!generatedQRData) {

    showQRStatus(
      'Please generate a QR code first.',
      true
    );

    return;
  }


  const qrUrl =
    generatedQRData.qrUrl ||
    generatedQRData.url ||
    '';


  if (!qrUrl) {

    showQRStatus(
      'QR code URL is missing.',
      true
    );

    return;
  }


  const mode =
    generatedQRData.mode ||
    'ATTENDANCE';


  const date =
    generatedQRData.attendanceDate ||
    generatedQRData.date ||
    selectedQRDay;


  const day =
    generatedQRData.day ||
    getDayNumber(date);


  const filename =
    `INSET2026_DAY${day}_${mode}_${date}.png`;


  const imageURL =
    buildQRImageURL(qrUrl);


  const button =
    getPage('downloadQrButton');


  try {

    if (button) {

      button.disabled = true;

      button.textContent =
        '⏳ PREPARING DOWNLOAD...';

    }


    /*
     * Fetch the generated PNG so the browser can
     * download it with our desired filename.
     */
    const response =
      await fetch(imageURL);


    if (!response.ok) {
      throw new Error(
        'QR image download failed.'
      );
    }


    const blob =
      await response.blob();


    const blobURL =
      URL.createObjectURL(blob);


    const link =
      document.createElement('a');

    link.href =
      blobURL;

    link.download =
      filename;

    document.body.appendChild(link);

    link.click();

    link.remove();


    setTimeout(() => {

      URL.revokeObjectURL(blobURL);

    }, 1000);


    showQRStatus(
      `Downloaded: ${filename}`
    );

  }
  catch (error) {

    console.error(
      'QR download error:',
      error
    );


    /*
     * Fallback:
     * Open the QR image directly if browser CORS
     * restrictions prevent the blob download.
     */
    const link =
      document.createElement('a');

    link.href =
      imageURL;

    link.target =
      '_blank';

    link.rel =
      'noopener noreferrer';

    document.body.appendChild(link);

    link.click();

    link.remove();


    showQRStatus(
      'QR image opened in a new tab. Save the image from there.',
      true
    );

  }
  finally {

    if (button) {

      button.disabled = false;

      button.textContent =
        '⬇️ DOWNLOAD QR CODE';

    }

  }

}


/* ============================================================
   CLEAR QR
   ============================================================ */

function clearQR() {

  generatedQRData = null;

  selectedQRDay =
    '2026-09-09';


  const dateField =
    getPage('attendanceDate');

  if (dateField) {
    dateField.value =
      '2026-09-09';
  }


  clearQRDisplayOnly();


  showQRStatus('');

}


function clearQRDisplayOnly() {

  const container =
    getPage('qrContainer');


  if (container) {

    container.innerHTML =

      `
      <div class="qr-placeholder">

        <div class="qr-placeholder-icon">
          ▦
        </div>

        <p>
          Select a day and generate a QR code.
        </p>

      </div>
      `;

  }


  const button =
    getPage('downloadQrButton');


  if (button) {

    button.disabled = true;

    button.textContent =
      '⬇️ DOWNLOAD QR CODE';

  }

}


/* ============================================================
   QR STATUS
   ============================================================ */

function showQRStatus(
  message,
  isError = false
) {

  const status =
    getPage('qrStatus');


  if (!status) {
    return;
  }


  status.textContent =
    message || '';


  status.classList.toggle(
    'error',
    isError
  );

}


/* ============================================================
   ATTENDANCE SUMMARY
   ============================================================ */

function loadAttendanceSummary() {

  const summary =
    getPage('attendanceSummary');


  if (summary) {

    summary.innerHTML =
      '<div class="summary-loading">Loading attendance...</div>';

  }


  showLoading(
    'Loading attendance summary...'
  );


  apiRequest(
    'getAttendanceSummary',
    {}
  )
  .then(result => {

    hideLoading();


    if (!result || !result.success) {

      if (summary) {

        summary.innerHTML =
          `<div class="summary-error">${
            escapeHTML(
              result?.message ||
              'Unable to load attendance.'
            )
          }</div>`;

      }

      return;
    }


    displayAttendanceSummary(
      result
    );

  })
  .catch(error => {

    hideLoading();

    console.error(error);


    if (summary) {

      summary.innerHTML =
        '<div class="summary-error">Unable to connect to the server.</div>';

    }

  });

}


/* ============================================================
   DISPLAY ATTENDANCE SUMMARY
   ============================================================ */

function displayAttendanceSummary(result) {

  const container =
    getPage('attendanceSummary');


  if (!container) {
    return;
  }


  const rows =
    result.rows ||
    result.data ||
    result.attendance ||
    [];


  if (!Array.isArray(rows) || rows.length === 0) {

    container.innerHTML =
      '<div class="summary-empty">No attendance records found.</div>';

    return;
  }


  let html =
    '<div class="summary-table-wrapper">';

  html +=
    '<table class="summary-table">';

  html +=
    '<thead>';

  html +=
    '<tr>' +
      '<th>Name</th>' +
      '<th>License</th>' +
      '<th>Date</th>' +
      '<th>Time In</th>' +
      '<th>Time Out</th>' +
    '</tr>';

  html +=
    '</thead>';

  html +=
    '<tbody>';


  rows.forEach(row => {

    const firstName =
      row.firstName ||
      row['FIRST NAME'] ||
      row[0] ||
      '';

    const middleName =
      row.middleName ||
      row['MIDDLE NAME'] ||
      row[1] ||
      '';

    const lastName =
      row.lastName ||
      row['LAST NAME'] ||
      row[2] ||
      '';

    const date =
      row.date ||
      row['DATE'] ||
      row[3] ||
      '';

    const license =
      row.license ||
      row['LICENSE NO.'] ||
      row[4] ||
      '';

    const timeIn =
      row.timeIn ||
      row['TIME IN'] ||
      row[5] ||
      '';

    const timeOut =
      row.timeOut ||
      row['TIME OUT'] ||
      row[6] ||
      '';


    const name =
      [
        firstName,
        middleName,
        lastName
      ]
      .filter(Boolean)
      .join(' ');


    html +=
      '<tr>' +

        `<td>${escapeHTML(name)}</td>` +

        `<td>${escapeHTML(String(license))}</td>` +

        `<td>${escapeHTML(
          formatDateForDisplay(date)
        )}</td>` +

        `<td>${escapeHTML(
          String(timeIn || '—')
        )}</td>` +

        `<td>${escapeHTML(
          String(timeOut || '—')
        )}</td>` +

      '</tr>';

  });


  html +=
    '</tbody>';

  html +=
    '</table>';

  html +=
    '</div>';


  container.innerHTML =
    html;

}


/* ============================================================
   API REQUEST
   ============================================================ */

async function apiRequest(
  action,
  data = {}
) {

  const url =
    API_URL +
    '?action=' +
    encodeURIComponent(action) +
    '&data=' +
    encodeURIComponent(
      JSON.stringify(data)
    );


  const response =
    await fetch(url, {
      method: 'GET',
      cache: 'no-store'
    });


  if (!response.ok) {

    throw new Error(
      `HTTP ${response.status}`
    );

  }


  return await response.json();

}


/* ============================================================
   PENDING QR STORAGE
   ============================================================ */

function savePendingQR(token) {

  if (!token) {
    return;
  }


  localStorage.setItem(
    PENDING_QR_TOKEN_KEY,
    token
  );

}


function getPendingQR() {

  return localStorage.getItem(
    PENDING_QR_TOKEN_KEY
  );

}


function clearPendingQR() {

  localStorage.removeItem(
    PENDING_QR_TOKEN_KEY
  );

}


/* ============================================================
   ERROR
   ============================================================ */

function showError(message) {

  stopScanner();


  const errorElement =
    getPage('errorMessage');


  if (errorElement) {

    errorElement.textContent =
      message ||
      'An unexpected error occurred.';

  }


  showPage('errorPage');

}


/* ============================================================
   LOADING
   ============================================================ */

function showLoading(message) {

  const overlay =
    getPage('loadingOverlay');


  const text =
    getPage('loadingText');


  if (text) {

    text.textContent =
      message ||
      'Please wait...';

  }


  if (overlay) {

    overlay.classList.add(
      'active'
    );

  }

}


function hideLoading() {

  const overlay =
    getPage('loadingOverlay');


  if (overlay) {

    overlay.classList.remove(
      'active'
    );

  }

}


/* ============================================================
   DATE HELPERS
   ============================================================ */

function getDayNumber(dateString) {

  const dates = {

    '2026-09-09': 1,

    '2026-09-10': 2,

    '2026-09-11': 3

  };


  return dates[dateString] || 1;

}


function formatDateForDisplay(dateString) {

  if (!dateString) {
    return '';
  }


  /*
   * Handle YYYY-MM-DD without timezone shifting.
   */
  if (
    typeof dateString === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(dateString)
  ) {

    const parts =
      dateString.split('-');

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


  const date =
    new Date(dateString);


  if (isNaN(date.getTime())) {
    return String(dateString);
  }


  return date.toLocaleDateString(
    'en-US',
    {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }
  );

}


function formatDateTimeForDisplay(
  value
) {

  if (!value) {
    return '';
  }


  const date =
    new Date(value);


  if (isNaN(date.getTime())) {

    return String(value);

  }


  return date.toLocaleString(
    'en-US',
    {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit'
    }
  );

}


/* ============================================================
   NAME HELPERS
   ============================================================ */

function buildParticipantName(
  participant
) {

  if (!participant) {
    return '';
  }


  return [
    participant.firstName,
    participant.middleName,
    participant.lastName
  ]
  .filter(Boolean)
  .join(' ');

}


/* ============================================================
   HTML ESCAPING
   ============================================================ */

function escapeHTML(value) {

  if (
    value === null ||
    value === undefined
  ) {

    return '';

  }


  return String(value)

    .replace(
      /&/g,
      '&amp;'
    )

    .replace(
      /</g,
      '&lt;'
    )

    .replace(
      />/g,
      '&gt;'
    )

    .replace(
      /"/g,
      '&quot;'
    )

    .replace(
      /'/g,
      '&#039;'
    );

}


/* ============================================================
   INITIALIZATION
   ============================================================ */

document.addEventListener(
  'DOMContentLoaded',
  () => {

    /*
     * Make sure Home is the initial page.
     */
    showPage('homePage');


    /*
     * Enter key support for admin login.
     */
    const adminPassword =
      getPage('adminPassword');


    if (adminPassword) {

      adminPassword.addEventListener(
        'keydown',
        event => {

          if (event.key === 'Enter') {

            checkAdminPassword();

          }

        }
      );

    }


    /*
     * Enter key support for registration.
     */
    [
      'firstName',
      'middleName',
      'lastName',
      'registrationLicense'
    ]
    .forEach(id => {

      const input =
        getPage(id);


      if (input) {

        input.addEventListener(
          'keydown',
          event => {

            if (
              event.key === 'Enter'
            ) {

              registerUser();

            }

          }
        );

      }

    });

  }
);
