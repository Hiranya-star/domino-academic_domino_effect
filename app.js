const TASKS_KEY = 'domino_tasks_v5';
let tasks = [];
let swRegistration = null;

// Variabel untuk Timer Fokus Kustom
let focusTimerInterval = null;
let focusSecondsRemaining = 25 * 60;
let isFocusRunning = false;

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  await registerServiceWorker();
  loadTasks();
  setupPWAInstall();
  setupNavigation();
  setupEventListeners();
  setupFocusTimerUI();
  renderAll();
  startWatchdog();
});

async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      swRegistration = await navigator.serviceWorker.register('./sw.js');
    } catch (e) { console.log('SW Error:', e); }
  }
}

function initTheme() {
  const saved = localStorage.getItem('domino_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
}

function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('domino_theme', next);
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    tasks = raw ? JSON.parse(raw) : getStarterTasks();
  } catch(e) { tasks = []; }
}

function saveTasks() {
  localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
}

function getStarterTasks() {
  const now = Date.now();
  const hr = 3600000;
  const fmt = (ms) => new Date(ms).toISOString().slice(0, 16);
  return [
    { id: '1', title: 'Penyusunan Proposal Riset', subject: 'Metodologi', teacher: 'Dr. Aris', deadline: fmt(now + 12*hr), workSchedule: fmt(now + 6*hr), duration: 2, dependsOn: '', status: 'active' },
    { id: '2', title: 'Pengolahan Data Lapangan', subject: 'Metodologi', teacher: 'Dr. Aris', deadline: fmt(now + 18*hr), workSchedule: fmt(now + 14*hr), duration: 3, dependsOn: '1', status: 'active' }
  ];
}

let deferredPrompt = null;
function setupPWAInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('installBanner').classList.remove('hidden');
  });
  document.getElementById('btnInstallApp').addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') document.getElementById('installBanner').classList.add('hidden');
      deferredPrompt = null;
    }
  });
  document.getElementById('btnCloseInstall').addEventListener('click', () => {
    document.getElementById('installBanner').classList.add('hidden');
  });
}

function calculateSlack(task) {
  if (!task.dependsOn) {
    const h = (new Date(task.deadline).getTime() - Date.now()) / 3600000;
    return Math.round((h - task.duration) * 10) / 10;
  }
  const parent = tasks.find(t => t.id === task.dependsOn);
  if (!parent) return 10;
  const slackParent = new Date(parent.deadline).getTime();
  const deadlineSelf = new Date(task.deadline).getTime();
  return Math.round(((deadlineSelf - task.duration*3600000 - slackParent) / 3600000) * 10) / 10;
}

function showScreenPopup(task) {
  document.getElementById('popupTeacherTag').textContent = `${task.teacher} • ${task.subject}`;
  document.getElementById('popupTaskTitle').textContent = task.title;
  document.getElementById('popupTerrorText').textContent = `Pengingat: Waktu pengerjaan "${task.title}" telah tiba/mendekati deadline!`;
  document.getElementById('popupTerrorBanner').classList.remove('hidden');
  
  const mode = document.getElementById('alarmModeSelect')?.value || 'sound';
  if ('vibrate' in navigator) {
    if (mode === 'silent') {
      navigator.vibrate([100, 50, 100]); // Getar senyap
    } else {
      navigator.vibrate([300, 100, 300, 100, 300]); // Getar peringatan
    }
  }
}

document.getElementById('btnClosePopup').addEventListener('click', () => {
  document.getElementById('popupTerrorBanner').classList.add('hidden');
});

async function triggerNotifications(task) {
  showScreenPopup(task);
  const mode = document.getElementById('alarmModeSelect')?.value || 'sound';
  
  if ('Notification' in window && Notification.permission === 'granted') {
    if (swRegistration && swRegistration.showNotification) {
      swRegistration.showNotification(`🚨 Pengingat: ${task.teacher}`, {
        body: `Waktu mulai: ${task.workSchedule || '-'} | Deadline: ${task.deadline}`,
        vibrate: mode === 'silent' ? [100, 50, 100] : [300, 100, 300],
        silent: mode === 'silent',
        requireInteraction: true
      });
    }
  }
}

function startWatchdog() {
  setInterval(() => {
    const now = Date.now();
    tasks.forEach(t => {
      if (t.status === 'active') {
        const workTime = t.workSchedule ? new Date(t.workSchedule).getTime() : new Date(t.deadline).getTime();
        const diff = (workTime - now) / 3600000;
        if (diff <= 1 && diff > 0) {
          triggerNotifications(t);
        }
      }
    });
  }, 20000);
}

function navigateTo(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById(`page-${pageId}`).classList.add('active');
  document.querySelector(`[data-page="${pageId}"]`)?.classList.add('active');
  document.getElementById('sidebar').classList.remove('open');
  renderAll();
}

function setupNavigation() {
  document.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
  });
  document.getElementById('btnMenuToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
}

// Logika Pengatur Timer Fokus Kustom
function setupFocusTimerUI() {
  const input = document.getElementById('customTimerInput');
  const display = document.getElementById('timerDisplay');
  
  input.addEventListener('change', () => {
    if (!isFocusRunning) {
      const mins = parseInt(input.value) || 25;
      focusSecondsRemaining = mins * 60;
      updateTimerDisplay();
    }
  });

  document.getElementById('btnStartTimer').addEventListener('click', () => {
    if (!isFocusRunning) {
      isFocusRunning = true;
      focusTimerInterval = setInterval(() => {
        if (focusSecondsRemaining > 0) {
          focusSecondsRemaining--;
          updateTimerDisplay();
        } else {
          clearInterval(focusTimerInterval);
          isFocusRunning = false;
          alert('⏱️ Waktu sesi fokus selesai! Istirahatlah sejenak.');
        }
      }, 1000);
    }
  });

  document.getElementById('btnPauseTimer').addEventListener('click', () => {
    clearInterval(focusTimerInterval);
    isFocusRunning = false;
  });

  document.getElementById('btnResetTimer').addEventListener('click', () => {
    clearInterval(focusTimerInterval);
    isFocusRunning = false;
    const mins = parseInt(input.value) || 25;
    focusSecondsRemaining = mins * 60;
    updateTimerDisplay();
  });
}

function updateTimerDisplay() {
  const m = Math.floor(focusSecondsRemaining / 60);
  const s = focusSecondsRemaining % 60;
  document.getElementById('timerDisplay').textContent = 
    `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function setupEventListeners() {
  document.getElementById('btnSidebarTheme').addEventListener('click', toggleTheme);
  document.getElementById('btnEnableNotif').addEventListener('click', async () => {
    if ('Notification' in window) {
      const p = await Notification.requestPermission();
      alert(p === 'granted' ? '✅ Notifikasi sistem & pop-up berhasil diaktifkan!' : '⚠️ Izin notifikasi ditolak.');
    }
  });

  document.getElementById('taskForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('editTaskId').value || ('t_' + Date.now());
    const newTask = {
      id,
      title: document.getElementById('tTitle').value,
      subject: document.getElementById('tSubject').value,
      teacher: document.getElementById('tTeacher').value,
      deadline: document.getElementById('tDeadline').value,
      workSchedule: document.getElementById('tWorkSchedule').value,
      duration: parseFloat(document.getElementById('tDuration').value),
      dependsOn: document.getElementById('tDependsOn').value,
      status: 'active'
    };
    const idx = tasks.findIndex(t => t.id === id);
    if (idx >= 0) tasks[idx] = newTask; else tasks.push(newTask);
    saveTasks();
    e.target.reset();
    document.getElementById('editTaskId').value = '';
    renderAll();
    navigateTo('assignments');
  });

  document.getElementById('simTaskSelect').addEventListener('change', renderSimulator);
  document.getElementById('simDelaySlider').addEventListener('input', renderSimulator);
}

function renderAll() {
  renderDropdowns();
  renderDashboard();
  renderAssignments();
  renderSimulator();
  renderAlerts();
}

function renderDropdowns() {
  const active = tasks.filter(t => t.status === 'active');
  const dep = document.getElementById('tDependsOn');
  const sim = document.getElementById('simTaskSelect');
  dep.innerHTML = '<option value="">-- Tidak Ada (Tugas Mandiri) --</option>';
  sim.innerHTML = '';
  active.forEach(t => {
    dep.innerHTML += `<option value="${t.id}">${t.title} (${t.subject})</option>`;
    sim.innerHTML += `<option value="${t.id}">${t.title} — ${t.teacher}</option>`;
  });
}

function renderDashboard() {
  const active = tasks.filter(t => t.status === 'active');
  document.getElementById('navTaskCount').textContent = active.length;
  const critical = active.filter(t => calculateSlack(t) <= 0);
  document.getElementById('stabilityScore').textContent = critical.length > 0 ? '⚠️ Terdeteksi Jalur Kritis!' : '100% — Jadwal Stabil';
  
  const list = document.getElementById('dashboardAlertsList');
  list.innerHTML = active.slice(0, 3).map(t => `
    <div class="alert-card ${calculateSlack(t) <= 0 ? 'urgent' : ''}">
      <strong>${t.teacher} — ${t.subject}</strong>
      <p class="alert-msg">Tugas: ${t.title} (Mulai: ${t.workSchedule ? t.workSchedule.replace('T', ' ') : '-'})</p>
    </div>
  `).join('') || '<p class="hint">Tidak ada tugas aktif.</p>';
}

function renderAssignments() {
  const active = tasks.filter(t => t.status === 'active');
  document.getElementById('totalTasksLabel').textContent = active.length;
  const container = document.getElementById('assignmentsList');
  container.innerHTML = active.map(t => {
    const slack = calculateSlack(t);
    return `
      <div class="task-item">
        <div style="display:flex; justify-content:space-between;">
          <span class="subject-pill">${t.subject}</span>
          <span class="slack-pill ${slack <= 0 ? 'slack-danger' : 'slack-safe'}">Slack: ${slack}j</span>
        </div>
        <h4>${t.title}</h4>
        <small class="hint">Mulai: ${t.workSchedule ? t.workSchedule.replace('T', ' ') : '-'}</small>
        <small class="hint">Deadline: ${t.deadline.replace('T', ' ')}</small>
        <button class="btn btn-sm btn-secondary" onclick="deleteTask('${t.id}')" style="margin-top:6px;">Hapus</button>
      </div>
    `;
  }).join('') || '<p class="hint">Belum ada tugas.</p>';
}

window.deleteTask = (id) => {
  tasks = tasks.filter(t => t.id !== id);
  saveTasks();
  renderAll();
};

function renderSimulator() {
  const id = document.getElementById('simTaskSelect').value;
  const delay = parseInt(document.getElementById('simDelaySlider').value) || 0;
  document.getElementById('simDelayLabel').textContent = `+${delay} Jam`;
  const box = document.getElementById('simConclusionBox');
  if (!id) { box.innerHTML = 'Pilih tugas untuk disimulasikan.'; return; }
  box.innerHTML = delay > 0 ? `⚠️ Keterlambatan ${delay} jam akan mendatangkan risiko hambatan pada rantai tugas berikutnya!` : '✅ Jadwal dalam kondisi stabil.';
}

function renderAlerts() {
  const active = tasks.filter(t => t.status === 'active');
  document.getElementById('alertCountBadge').textContent = active.length;
  document.getElementById('fullAlertsList').innerHTML = active.map(t => `
    <div class="alert-card">
      <strong>${t.teacher} (${t.subject})</strong>
      <p class="alert-msg">Waktu Mulai: ${t.workSchedule ? t.workSchedule.replace('T', ' ') : '-'}</p>
      <button class="btn btn-sm btn-warning" onclick="triggerNotifications(${JSON.stringify(t).replace(/"/g, '&quot;')})" style="margin-top:8px;">🔔 Tes Notifikasi</button>
    </div>
  `).join('') || '<p class="hint">Tidak ada pengingat aktif.</p>';
}
