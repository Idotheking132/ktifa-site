// ── State ──────────────────────────────────────────────────────────────────────
let currentUser = null;
let selectedWorker = null;
let selectedDay = null;
let selectedTime = null;
const DAY_NAMES = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];

// ── Init ───────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadUser();
  setupTabs();
  setupAdminMenu();
});

// ── Auth ───────────────────────────────────────────────────────────────────────
async function loadUser() {
  const res = await fetch('/auth/me');
  const data = await res.json();
  currentUser = data.user;

  // Check URL error
  const params = new URLSearchParams(window.location.search);
  const err = params.get('error');
  if (err) {
    window.history.replaceState({}, '', '/');
    const el = document.getElementById('loginError');
    el.textContent = err === 'no_role'
      ? 'אין לך את הרול הנדרש בשרת כדי להתחבר.'
      : 'ההתחברות נכשלה, נסה שוב.';
    el.classList.remove('hidden');
  }

  renderNav();

  if (!currentUser) {
    document.getElementById('loginPage').classList.remove('hidden');
  } else {
    document.getElementById('dashboard').classList.remove('hidden');
    if (currentUser.isAdmin) {
      document.querySelectorAll('.admin-only').forEach(e => e.classList.remove('hidden'));
    }
    loadBookStep1();
  }
}

function login() { window.location.href = '/auth/discord'; }

function renderNav() {
  const nav = document.getElementById('navActions');
  if (!currentUser) {
    nav.innerHTML = `<button class="discord-btn" style="padding:8px 18px;font-size:0.85rem" onclick="login()">התחבר</button>`;
    return;
  }
  const avatar = currentUser.avatar
    ? `https://cdn.discordapp.com/avatars/${currentUser.id}/${currentUser.avatar}.png`
    : 'https://cdn.discordapp.com/embed/avatars/0.png';
  const badge = currentUser.isAdmin
    ? `<span class="nav-badge badge-admin">מנהל</span>`
    : `<span class="nav-badge badge-member">חבר</span>`;
  nav.innerHTML = `
    <div class="nav-user">
      <img class="nav-avatar" src="${avatar}" />
      <span class="nav-name">${currentUser.username}</span>
      ${badge}
      <button class="btn-logout" onclick="window.location.href='/auth/logout'">יציאה</button>
    </div>`;
}

// ── Tabs ───────────────────────────────────────────────────────────────────────
function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.add('hidden'));
      tab.classList.add('active');
      const pane = document.getElementById('tab-' + tab.dataset.tab);
      pane.classList.remove('hidden');
      pane.classList.add('active');

      if (tab.dataset.tab === 'book') loadBookStep1();
      if (tab.dataset.tab === 'schedule') loadSchedule();
      if (tab.dataset.tab === 'my') loadMyAppts();
      if (tab.dataset.tab === 'admin') loadAdminWorkers();
    });
  });
}

function setupAdminMenu() {
  document.querySelectorAll('.amenu').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.amenu').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.asec').forEach(s => { s.classList.remove('active'); s.classList.add('hidden'); });
      btn.classList.add('active');
      const sec = document.getElementById('asec-' + btn.dataset.asec);
      sec.classList.remove('hidden');
      sec.classList.add('active');
      if (btn.dataset.asec === 'allAppts') loadAllAppts();
    });
  });
}

// ── Step 1: Pick worker ────────────────────────────────────────────────────────
async function loadBookStep1() {
  goStep(1);
  const grid = document.getElementById('workersGrid');
  grid.innerHTML = '<div class="loading">טוען...</div>';
  try {
    const res = await fetch('/api/workers');
    const workers = await res.json();
    if (!workers.length) {
      grid.innerHTML = '<div class="empty"><div class="empty-icon">✂️</div><h3>אין מקום פנוי בקטיפה</h3></div>';
      return;
    }
    grid.innerHTML = workers.map(w => `
      <div class="worker-card" onclick="pickWorker(${JSON.stringify(w).replace(/"/g,'&quot;')})">
        <div class="worker-avatar" style="background:${w.color}">${w.name[0]}</div>
        <div class="worker-name">${w.name}</div>
        <div class="worker-hours">${w.startHour} - ${w.endHour}</div>
      </div>
    `).join('');
  } catch(e) {
    grid.innerHTML = '<div class="loading">שגיאה בטעינה</div>';
  }
}

// ── Step 2: Pick day ───────────────────────────────────────────────────────────
function pickWorker(worker) {
  selectedWorker = worker;
  goStep(2);

  const row = document.getElementById('daysRow');
  const today = new Date(); today.setHours(0,0,0,0);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }

  const available = days.filter(d => worker.workDays.includes(d.getDay()));

  if (!available.length) {
    row.innerHTML = '<div class="loading">אין ימים זמינים השבוע</div>';
    return;
  }

  row.innerHTML = available.map((d, idx) => {
    const isToday = idx === 0 && d.getTime() === today.getTime();
    const dateStr = d.toISOString().split('T')[0];
    const dd = String(d.getDate()).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    return `
      <button class="day-btn ${isToday ? 'today' : ''}" onclick="pickDay('${dateStr}', '${DAY_NAMES[d.getDay()]}', '${dd}/${mm}')">
        <span class="day-name">${DAY_NAMES[d.getDay()]}</span>
        <span class="day-date">${dd}/${mm}</span>
      </button>`;
  }).join('');
}

// ── Step 3: Pick time ──────────────────────────────────────────────────────────
async function pickDay(dateStr, dayName, dateLabel) {
  selectedDay = { dateStr, dayName, dateLabel };
  goStep(3);

  document.getElementById('step3Label').textContent = `שעות פנויות - ${dayName} ${dateLabel}`;
  const grid = document.getElementById('timesGrid');
  grid.innerHTML = '<div class="loading">טוען שעות...</div>';

  try {
    const res = await fetch(`/api/workers/${selectedWorker._id}/slots?date=${dateStr}`);
    const data = await res.json();

    if (!data.slots || !data.slots.length) {
      grid.innerHTML = '<div class="loading">אין שעות זמינות ביום זה</div>';
      return;
    }

    grid.innerHTML = data.slots.map(s => {
      if (!s.available) {
        return `<button class="time-btn taken" disabled>${s.startTime}</button>`;
      }
      return `<button class="time-btn" onclick="pickTime('${s.startTime}', '${s.endTime}')">${s.startTime}</button>`;
    }).join('');
  } catch(e) {
    grid.innerHTML = '<div class="loading">שגיאה</div>';
  }
}

function pickTime(start, end) {
  selectedTime = { start, end };
  // Show confirm modal
  document.getElementById('confirmDetails').innerHTML = `
    <div><strong>עובד:</strong> ${selectedWorker.name}</div>
    <div><strong>יום:</strong> ${selectedDay.dayName} ${selectedDay.dateLabel}</div>
    <div><strong>שעה:</strong> ${start} - ${end}</div>
  `;
  document.getElementById('bookNote').value = '';
  document.getElementById('confirmModal').classList.remove('hidden');
}

async function submitBooking() {
  const note = document.getElementById('bookNote').value;
  try {
    const res = await fetch('/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workerId: selectedWorker._id,
        date: selectedDay.dateStr,
        startTime: selectedTime.start,
        note
      })
    });
    const data = await res.json();
    if (!res.ok) return showToast(data.error || 'שגיאה', true);
    closeModal('confirmModal');
    showToast('הבקשה נשלחה! ממתין לאישור');
    goStep(1);
    loadBookStep1();
  } catch(e) {
    showToast('שגיאה בשליחה', true);
  }
}

function goStep(n) {
  [1,2,3].forEach(i => {
    const el = document.getElementById('step' + i);
    if (i === n) { el.classList.remove('hidden'); }
    else { el.classList.add('hidden'); }
  });
}

// ── Schedule ───────────────────────────────────────────────────────────────────
async function loadSchedule() {
  const view = document.getElementById('scheduleView');
  view.innerHTML = '<div class="loading">טוען...</div>';
  try {
    const res = await fetch('/api/appointments/schedule');
    const appts = await res.json();

    if (!appts.length) {
      view.innerHTML = '<div class="empty"><div class="empty-icon">📅</div><h3>אין תורים השבוע</h3></div>';
      return;
    }

    // Group by date
    const grouped = {};
    appts.forEach(a => {
      const d = new Date(a.date).toISOString().split('T')[0];
      if (!grouped[d]) grouped[d] = [];
      grouped[d].push(a);
    });

    view.innerHTML = Object.entries(grouped).map(([date, items]) => {
      const d = new Date(date);
      const label = `${DAY_NAMES[d.getDay()]} ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
      return `
        <div class="schedule-day">
          <div class="schedule-day-title">${label}</div>
          ${items.map(a => `
            <div class="schedule-item">
              <div class="schedule-dot" style="background:${a.workerId?.color || '#999'}"></div>
              <div class="schedule-time">${a.startTime} - ${a.endTime}</div>
              <div class="schedule-info">
                <div class="schedule-worker">${a.username}</div>
                <div class="schedule-user">עובד: ${a.workerId?.name || 'לא ידוע'}</div>
              </div>
              <span class="schedule-badge ${a.status === 'approved' ? 's-approved' : 's-pending'}">
                ${a.status === 'approved' ? 'אושר' : 'ממתין'}
              </span>
            </div>
          `).join('')}
        </div>`;
    }).join('');
  } catch(e) {
    view.innerHTML = '<div class="loading">שגיאה</div>';
  }
}

// ── My Appointments ────────────────────────────────────────────────────────────
async function loadMyAppts() {
  const list = document.getElementById('myList');
  list.innerHTML = '<div class="loading">טוען...</div>';
  try {
    const res = await fetch('/api/appointments/me');
    const appts = await res.json();
    if (!appts.length) {
      list.innerHTML = '<div class="empty"><div class="empty-icon">📋</div><h3>אין תורים עדיין</h3><p>קבע תור חדש</p></div>';
      return;
    }
    const labels = { pending: 'ממתין', approved: 'אושר', rejected: 'נדחה' };
    list.innerHTML = appts.map(a => {
      const d = new Date(a.date);
      const dateStr = `${DAY_NAMES[d.getDay()]} ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
      return `
        <div class="appt-item">
          <div class="appt-dot dot-${a.status}"></div>
          <div class="appt-info">
            <div class="appt-title">${a.workerId?.name || 'עובד'}</div>
            <div class="appt-meta">${dateStr} · ${a.startTime} - ${a.endTime}</div>
          </div>
          <span class="appt-badge b-${a.status}">${labels[a.status]}</span>
        </div>`;
    }).join('');
  } catch(e) {
    list.innerHTML = '<div class="loading">שגיאה</div>';
  }
}

// ── Admin: Workers ─────────────────────────────────────────────────────────────
async function loadAdminWorkers() {
  const list = document.getElementById('workersList');
  list.innerHTML = '<div class="loading">טוען...</div>';
  try {
    const res = await fetch('/api/admin/workers');
    const workers = await res.json();
    if (!workers.length) {
      list.innerHTML = '<div class="empty"><div class="empty-icon">✂️</div><h3>אין מקום פנוי</h3></div>';
      return;
    }
    const durLabels = { 30:'30 דקות', 60:'שעה', 90:'שעה וחצי', 120:'שעתיים' };
    list.innerHTML = workers.map(w => `
      <div class="worker-row">
        <div class="worker-row-dot" style="background:${w.color}"></div>
        <div class="worker-row-info">
          <div class="worker-row-name">${w.name} ${w.isActive ? '' : '🔴'}</div>
          <div class="worker-row-meta">${w.startHour} - ${w.endHour} · ${durLabels[w.slotDuration] || w.slotDuration + ' דק'} · ימים: ${w.workDays.map(d => ['א','ב','ג','ד','ה','ו','ש'][d]).join(', ')}</div>
        </div>
        <div class="row-actions">
          <button class="btn-edit" onclick='openWorkerModal(${JSON.stringify(w)})'>ערוך</button>
          <button class="btn-del" onclick="deleteWorker('${w._id}')">מחק</button>
        </div>
      </div>`).join('');
  } catch(e) {
    list.innerHTML = '<div class="loading">שגיאה</div>';
  }
}

function openWorkerModal(w) {
  document.getElementById('workerModalTitle').textContent = w ? 'ערוך עובד' : 'הוסף עובד';
  document.getElementById('wId').value = w?._id || '';
  document.getElementById('wName').value = w?.name || '';
  document.getElementById('wColor').value = w?.color || '#6366f1';
  document.getElementById('wStart').value = w?.startHour || '09:00';
  document.getElementById('wEnd').value = w?.endHour || '18:00';
  document.getElementById('wDuration').value = w?.slotDuration || 30;
  document.getElementById('wActive').checked = w ? w.isActive : true;
  document.querySelectorAll('#wDays input').forEach(cb => {
    cb.checked = w ? w.workDays.includes(parseInt(cb.value)) : true;
  });
  document.getElementById('workerModal').classList.remove('hidden');
}

async function saveWorker() {
  const id = document.getElementById('wId').value;
  const name = document.getElementById('wName').value.trim();
  const color = document.getElementById('wColor').value;
  const startHour = document.getElementById('wStart').value;
  const endHour = document.getElementById('wEnd').value;
  const slotDuration = parseInt(document.getElementById('wDuration').value);
  const isActive = document.getElementById('wActive').checked;
  const workDays = Array.from(document.querySelectorAll('#wDays input:checked')).map(c => parseInt(c.value));

  if (!name) return showToast('הכנס שם', true);
  if (!workDays.length) return showToast('בחר לפחות יום אחד', true);

  const body = { name, color, startHour, endHour, slotDuration, isActive, workDays };
  try {
    const url = id ? `/api/admin/workers/${id}` : '/api/admin/workers';
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error();
    closeModal('workerModal');
    showToast('נשמר!');
    loadAdminWorkers();
  } catch(e) { showToast('שגיאה', true); }
}

async function deleteWorker(id) {
  if (!confirm('למחוק את הספר?')) return;
  await fetch(`/api/admin/workers/${id}`, { method: 'DELETE' });
  showToast('נמחק');
  loadAdminWorkers();
}

// ── Admin: All Appointments ────────────────────────────────────────────────────
async function loadAllAppts() {
  const list = document.getElementById('allApptsList');
  list.innerHTML = '<div class="loading">טוען...</div>';
  try {
    const res = await fetch('/api/admin/appointments');
    const appts = await res.json();
    if (!appts.length) {
      list.innerHTML = '<div class="empty"><div class="empty-icon">📋</div><h3>אין בקשות</h3></div>';
      return;
    }
    const labels = { pending: 'ממתין', approved: 'אושר', rejected: 'נדחה' };
    list.innerHTML = `
      <table class="a-table">
        <thead><tr><th>משתמש</th><th>ספר</th><th>תאריך</th><th>שעה</th><th>סטטוס</th><th>פעולות</th></tr></thead>
        <tbody>
          ${appts.map(a => {
            const d = new Date(a.date);
            const dateStr = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
            return `<tr>
              <td>${a.username}</td>
              <td>${a.workerId?.name || '-'}</td>
              <td>${dateStr}</td>
              <td>${a.startTime}</td>
              <td><span class="appt-badge b-${a.status}">${labels[a.status]}</span></td>
              <td>${a.status === 'pending' ? `
                <button class="btn-approve" onclick="updateStatus('${a._id}','approved')">אשר</button>
                <button class="btn-reject" onclick="updateStatus('${a._id}','rejected')">דחה</button>
              ` : '-'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  } catch(e) { list.innerHTML = '<div class="loading">שגיאה</div>'; }
}

async function updateStatus(id, status) {
  try {
    await fetch(`/api/admin/appointments/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    showToast(status === 'approved' ? 'אושר!' : 'נדחה');
    loadAllAppts();
  } catch(e) { showToast('שגיאה', true); }
}

// ── Utils ──────────────────────────────────────────────────────────────────────
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function showToast(msg, err = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast show${err ? ' err' : ''}`;
  setTimeout(() => { t.className = 'toast hidden'; }, 3000);
}


// ── Admin: Add Appointment ────────────────────────────────────────────────────
function loadAdminTab() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('adminDate').min = today;
}

async function adminAddAppointment() {
  const userName = document.getElementById('adminUserName').value.trim();
  const date = document.getElementById('adminDate').value;
  const startTime = document.getElementById('adminStartTime').value;
  const duration = parseInt(document.getElementById('adminDuration').value);
  const note = document.getElementById('adminNote').value.trim();

  if (!userName || !date || !startTime) {
    return showToast('מלא את כל השדות', true);
  }

  const [h, m] = startTime.split(':').map(Number);
  const endMins = h * 60 + m + duration;
  const endTime = `${String(Math.floor(endMins/60)).padStart(2,'0')}:${String(endMins%60).padStart(2,'0')}`;

  try {
    const res = await fetch('/api/admin/appointments/direct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName, date, startTime, endTime, note })
    });
    const data = await res.json();
    if (!res.ok) return showToast(data.error || 'שגיאה', true);
    
    showToast('✅ התור נוסף בהצלחה!');
    document.getElementById('adminUserName').value = '';
    document.getElementById('adminDate').value = '';
    document.getElementById('adminStartTime').value = '';
    document.getElementById('adminNote').value = '';
  } catch(e) {
    showToast('שגיאה', true);
  }
}
