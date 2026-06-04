/**
 * THEO'S CHRISTENING — RSVP Script
 *
 * Storage: Google Apps Script (Web App) as the backend.
 * Set APPS_SCRIPT_URL below once you deploy your Apps Script.
 * Fallback: localStorage is used if the URL is not configured,
 * so the page always works locally too.
 */

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbycQR7ARFuZZTxfV5G5hbk9uE0pXrxPTAJrhbu4zSWhKbRvY7L1T1pe2Skt1Pvz6Tv2vQ/exec'; // ← paste your Web App URL here after setup

// ─────────────────────────────────────────
// DOM REFERENCES
// ─────────────────────────────────────────
const form         = document.getElementById('rsvpForm');
const submitBtn    = document.getElementById('submitBtn');
const btnText      = submitBtn.querySelector('.btn-text');
const btnLoading   = submitBtn.querySelector('.btn-loading');
const successState = document.getElementById('successState');
const successMsg   = document.getElementById('successMessage');
const rsvpAgainBtn  = document.getElementById('rsvpAgainBtn');

// Error modal
const errorModal      = document.getElementById('errorModal');
const errorModalMsg   = document.getElementById('errorModalMessage');
const modalRetryBtn   = document.getElementById('modalRetryBtn');
const modalDismissBtn = document.getElementById('modalDismissBtn');
let   lastPayload     = null; // stored for retry

const nameInput    = document.getElementById('fullName');
const nameError    = document.getElementById('nameError');
const attError     = document.getElementById('attendanceError');
const guestField      = document.getElementById('guestField');
const guestNamesField = document.getElementById('guestNamesField');
const guestNamesList  = document.getElementById('guestNamesList');
const guestCount   = document.getElementById('guestCount');
const decrementBtn = document.getElementById('decrementBtn');
const incrementBtn = document.getElementById('incrementBtn');

// Admin
const adminPanel     = document.getElementById('adminPanel');
const adminTableBody = document.getElementById('adminTableBody');
const adminCount     = document.getElementById('adminCount');
const adminEmpty     = document.getElementById('adminEmpty');
const exportBtn      = document.getElementById('exportBtn');
const closeAdminBtn  = document.getElementById('closeAdminBtn');

// ─────────────────────────────────────────
// SHOW / HIDE GUEST FIELD BASED ON ATTENDANCE
// ─────────────────────────────────────────
document.querySelectorAll('input[name="attendance"]').forEach(radio => {
  radio.addEventListener('change', () => {
    if (radio.value === 'yes' && radio.checked) {
      guestField.classList.remove('hidden');
      updateGuestNameFields();
    } else {
      guestField.classList.add('hidden');
      guestNamesField.classList.add('hidden');
    }
  });
});

// ─────────────────────────────────────────
// NUMERIC STEPPER
// ─────────────────────────────────────────
decrementBtn.addEventListener('click', () => {
  const v = parseInt(guestCount.value, 10);
  if (v > 1) { guestCount.value = v - 1; updateGuestNameFields(); }
});
incrementBtn.addEventListener('click', () => {
  const v = parseInt(guestCount.value, 10);
  if (v < 10) { guestCount.value = v + 1; updateGuestNameFields(); }
});
guestCount.addEventListener('change', updateGuestNameFields);

// ─────────────────────────────────────────
// GUEST NAME FIELDS — dynamic render
// ─────────────────────────────────────────
function updateGuestNameFields() {
  const total = parseInt(guestCount.value, 10) || 1;
  const companions = total - 1;

  if (companions < 1) {
    guestNamesField.classList.add('hidden');
    guestNamesList.innerHTML = '';
    return;
  }

  const existing = [...guestNamesList.querySelectorAll('input')].map(i => i.value);

  guestNamesList.innerHTML = '';
  for (let i = 0; i < companions; i++) {
    const row = document.createElement('div');
    row.className = 'guest-name-row';
    row.style.animationDelay = (i * 0.06) + 's';

    const num = document.createElement('div');
    num.className = 'guest-name-number';
    num.textContent = i + 1;

    const inp = document.createElement('input');
    inp.type = 'text';
    inp.name = 'guestName[]';
    inp.placeholder = 'Guest ' + (i + 1) + ' full name';
    inp.autocomplete = 'off';
    inp.value = existing[i] || '';

    row.appendChild(num);
    row.appendChild(inp);
    guestNamesList.appendChild(row);
  }

  guestNamesField.classList.remove('hidden');
}

// ─────────────────────────────────────────
// FORM VALIDATION
// ─────────────────────────────────────────
function validateForm() {
  let valid = true;

  // Name
  if (!nameInput.value.trim()) {
    nameInput.classList.add('error');
    nameError.classList.add('visible');
    valid = false;
  } else {
    nameInput.classList.remove('error');
    nameError.classList.remove('visible');
  }

  // Attendance
  const att = document.querySelector('input[name="attendance"]:checked');
  if (!att) {
    attError.classList.add('visible');
    valid = false;
  } else {
    attError.classList.remove('visible');
  }

  return valid;
}

// Live validation on blur
nameInput.addEventListener('blur', () => {
  if (!nameInput.value.trim()) {
    nameInput.classList.add('error');
    nameError.classList.add('visible');
  } else {
    nameInput.classList.remove('error');
    nameError.classList.remove('visible');
  }
});

// ─────────────────────────────────────────
// FORM SUBMIT
// ─────────────────────────────────────────
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!validateForm()) return;

  const att      = document.querySelector('input[name="attendance"]:checked').value;
  const isYes    = att === 'yes';
  const guestNames = isYes
    ? [...guestNamesList.querySelectorAll('input')].map(i => i.value.trim()).filter(Boolean)
    : [];

  const payload  = {
    name:       nameInput.value.trim(),
    attending:  isYes ? 'Yes' : 'No',
    guests:     isYes ? parseInt(guestCount.value, 10) : 0,
    guestNames: guestNames,
    message:    document.getElementById('message').value.trim(),
    timestamp:  new Date().toISOString(),
  };

  setLoading(true);

  try {
    if (APPS_SCRIPT_URL) {
      await submitToGoogleSheets(payload);
    } else {
      // Fallback: save to localStorage for demo / testing
      saveLocal(payload);
      await fakeDelay(700); // simulate network
    }
    showSuccess(payload);
  } catch (err) {
    console.error('RSVP submission error:', err);
    lastPayload = payload;
    showErrorModal(err);
  } finally {
    setLoading(false);
  }
});

// ─────────────────────────────────────────
// GOOGLE SHEETS SUBMISSION
// ─────────────────────────────────────────
async function submitToGoogleSheets(payload) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Server returned ' + res.status);
  const json = await res.json().catch(() => ({}));
  if (json.status === 'error') throw new Error(json.message || 'Unknown error from server');
  // Save locally as a backup copy
  saveLocal(payload);
}

// ─────────────────────────────────────────
// LOCAL STORAGE (FALLBACK / CACHE)
// ─────────────────────────────────────────
function saveLocal(payload) {
  const key  = 'theo_rsvp_responses';
  const list = JSON.parse(localStorage.getItem(key) || '[]');
  list.push(payload);
  localStorage.setItem(key, JSON.stringify(list));
}

function getLocal() {
  return JSON.parse(localStorage.getItem('theo_rsvp_responses') || '[]');
}

// ─────────────────────────────────────────
// UI STATE HELPERS
// ─────────────────────────────────────────
function setLoading(on) {
  submitBtn.disabled = on;
  btnText.classList.toggle('hidden', on);
  btnLoading.classList.toggle('hidden', !on);
}

function showSuccess(payload) {
  form.classList.add('hidden');
  successState.classList.remove('hidden');
  successMsg.textContent = payload.attending === 'Yes'
    ? `We've received your RSVP — see you on June 13! 🎉`
    : `We understand and appreciate you letting us know. You'll be in our thoughts! 💙`;
}

rsvpAgainBtn.addEventListener('click', () => {
  form.reset();
  guestField.classList.add('hidden');
  guestNamesField.classList.add('hidden');
  form.classList.remove('hidden');
  successState.classList.add('hidden');
});

// ─────────────────────────────────────────
// ERROR MODAL
// ─────────────────────────────────────────
function showErrorModal(err) {
  const isNetwork = err instanceof TypeError;
  errorModalMsg.textContent = isNetwork
    ? "Looks like there's a network issue. Your response was saved locally — tap Try Again when you're back online."
    : "Something went wrong sending your RSVP to our sheet. Your response is saved on your device — tap Try Again or contact the organizer.";
  errorModal.classList.remove('hidden');
  modalRetryBtn.focus();
}

function closeErrorModal() {
  errorModal.classList.add('hidden');
}

modalRetryBtn.addEventListener('click', async () => {
  if (!lastPayload) return;
  closeErrorModal();
  setLoading(true);
  try {
    await submitToGoogleSheets(lastPayload);
    showSuccess(lastPayload);
  } catch (err) {
    console.error('Retry failed:', err);
    showErrorModal(err);
  } finally {
    setLoading(false);
  }
});

modalDismissBtn.addEventListener('click', closeErrorModal);

// Close on overlay click
errorModal.addEventListener('click', (e) => {
  if (e.target === errorModal) closeErrorModal();
});

// Close on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !errorModal.classList.contains('hidden')) closeErrorModal();
});

// ─────────────────────────────────────────
// FAKE DELAY (for demo without backend)
// ─────────────────────────────────────────
function fakeDelay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─────────────────────────────────────────
// ADMIN PANEL
// ─────────────────────────────────────────
function openAdmin() {
  const responses = getLocal();
  adminPanel.classList.remove('hidden');
  renderAdminTable(responses);
}

function renderAdminTable(responses) {
  adminTableBody.innerHTML = '';
  adminCount.textContent = `${responses.length} response${responses.length !== 1 ? 's' : ''}`;

  if (responses.length === 0) {
    adminEmpty.style.display = 'block';
    return;
  }
  adminEmpty.style.display = 'none';

  responses.forEach((r, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td><strong>${escHtml(r.name)}</strong></td>
      <td>${r.attending === 'Yes'
        ? '<span style="color:#22c55e;font-weight:700;">✓ Yes</span>'
        : '<span style="color:#94a3b8;">✗ No</span>'}</td>
      <td>${r.guests > 0 ? r.guests : '—'}</td>
      <td style="max-width:180px;word-break:break-word;">${r.guestNames && r.guestNames.length ? escHtml(r.guestNames.join(', ')) : '—'}</td>
      <td style="max-width:180px;word-break:break-word;">${r.message ? escHtml(r.message) : '—'}</td>
      <td style="white-space:nowrap;">${formatDate(r.timestamp)}</td>
    `;
    adminTableBody.appendChild(tr);
  });
}

closeAdminBtn.addEventListener('click', () => {
  adminPanel.classList.add('hidden');
});
adminPanel.addEventListener('click', (e) => {
  if (e.target === adminPanel) adminPanel.classList.add('hidden');
});

// ─────────────────────────────────────────
// CSV EXPORT
// ─────────────────────────────────────────
exportBtn.addEventListener('click', () => {
  const responses = getLocal();
  if (!responses.length) { alert('No responses to export yet.'); return; }

  const header = ['#', 'Name', 'Attending', 'Guests', 'Guest Names', 'Message', 'Submitted'];
  const rows   = responses.map((r, i) => [
    i + 1,
    `"${r.name.replace(/"/g, '""')}"`,
    r.attending,
    r.guests,
    `"${(r.guestNames || []).join('; ').replace(/"/g, '""')}"`,
    `"${(r.message || '').replace(/"/g, '""')}"`,
    formatDate(r.timestamp),
  ]);

  const csv  = [header.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'theo-christening-rsvp.csv';
  a.click();
  URL.revokeObjectURL(url);
});

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────
function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-PH', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

// ─────────────────────────────────────────
// ADMIN ACCESS — visit ?admin=1 or type
// the secret in console: openAdmin()
// ─────────────────────────────────────────
if (new URLSearchParams(window.location.search).get('admin') === '1') {
  openAdmin();
}
// Also expose globally for console access
window.openAdmin = openAdmin;

// ─────────────────────────────────────────
// BABY PHOTO — graceful fallback to placeholder
// ─────────────────────────────────────────
const photoImg = document.querySelector('.hero-photo-img');
if (photoImg) {
  photoImg.addEventListener('error', () => {
    photoImg.classList.add('img-error');
  });
  if (photoImg.complete && photoImg.naturalWidth === 0) {
    photoImg.classList.add('img-error');
  }
}
