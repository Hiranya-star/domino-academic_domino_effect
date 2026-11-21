const TASKS_KEY = 'domino_tasks_v7';
const PROFILE_KEY = 'domino_profile_v7';
const ALARM_MODE_KEY = 'domino_alarm_mode_v7';

let tasks = [];
let userProfile = { name: '', className: '', school: '', targetHours: 3 };
let swRegistration = null;

// Variabel Timer Fokus Kustom
let focusTimerInterval = null;
let focusSecondsRemaining = 25 * 60;
let isFocusRunning = false;

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  await registerServiceWorker();
  loadProfile();
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
  updateThemeButtonText(saved);
}

function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('domino_theme', next);
  updateThemeButtonText(next);
}

function updateThemeButtonText(theme) {
  const btn = document.getElementById('btnSidebarTheme');
  if (btn) btn.textContent = theme === 'dark' ? '☀️ Mode Terang' : '🌙 Mode Gelap';
}

// Manajemen Profil Siswa (SMA / SMK)
function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) {
      userProfile = JSON.parse(raw);
      document.getElementById('pName').value = userProfile.name || '';
      document.getElementById('pClass').value = userProfile.className || '';
      document.getElementById('pSchool').value = userProfile.school || '';
      document.getElementById('pTargetHours').value = userProfile.targetHours || 3;
      if (userProfile.name) {
        document.getElementById('sidebarStudentTag').textContent = `${userProfile.name}${userProfile.className ? ' • ' + userProfile.className : ''}`;
      }
    }
  } catch (e) { console.log('Profile load error:', e); }
}

function saveProfile(e) {
  e.preventDefault();
  userProfile = {
    name: document.getElementById('pName').value.trim(),
    className: document.getElementById('pClass').value.trim(),
    school: document.getElementById('pSchool').value.trim(),
    targetHours: parseFloat(document.getElementById('pTargetHours').value) || 3
  };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(userProfile));
  if (userProfile.name) {
    document.getElementById('sidebarStudentTag').textContent = `${userProfile.name}${userProfile.className ? ' • ' + userProfile.className : ''}`;
  }
  alert('✅ Profil siswa berhasil disimpan!');
  renderAll();
}

// Manajemen Tugas (Bersih di awal tanpa contoh guru bawaan)
function loadTasks() {
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    tasks = raw ? JSON.parse(raw) : [];
  } catch(e) { tasks = []; }
}

function saveTasks() {
  localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
}

// Instalasi PWA Mandiri (Standalone WebAPK)
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

// Generator Kalimat Teror Berdasarkan Tipe Kepribadian Guru
function generateTerrorMessage(task, slack) {
  const persona = task.persona || 'killer';
  const isUrgent = slack <= 2;

  const scripts = {
    killer: isUrgent
      ? `"${task.title}" (${task.subject}) belum selesai?! Jangan harap ada dispensasi nilai dari ${task.teacher}. Kumpulkan sekarang atau tanggung akibatnya!`
      : `Ingat, ${task.teacher} tidak pernah menerima alasan lupa. Segera selesaikan "${task.title}" sebelum batas waktu habis!`,
    sarcastic: isUrgent
      ? `Santai banget ngerjain "${task.title}"? ${task.teacher} sudah siap kasih nilai kosong yang estetik buat rapor ${task.subject} kamu.`
      : `Tenang saja, deadline "${task.title}" masih ada sisa waktu. Tapi jangan sampai ${task.teacher} nyindir namamu di depan kelas.`,
    disciplined: isUrgent
      ? `PERINGATAN WAKTU: Toleransi keterlambatan dari ${task.teacher} adalah 0 detik. Tugas "${task.title}" wajib tuntas secepatnya!`
      : `Sesuai standar kedisiplinan ${task.teacher}, "${task.title}" (${task.subject}) harus mulai dicicil sesuai jadwal.`,
    friendly: isUrgent
      ? `Ayo semangat! ${task.teacher} sudah nungguin hasil "${task.title}" kamu. Jangan bikin beliau kecewa karena telat ya!`
      : `Halo, ${task.teacher} menitip pesan agar "${task.title}" (${task.subject}) dikerjakan tepat waktu supaya hasilnya maksimal.`
  };

  return scripts[persona] || scripts.killer;
}

// Kalkulasi Slack Time & Rantai Domino
function calculateSlack(task) {
  if (!task.dependsOn) {
    const h = (new Date(task.deadline).getTime() - Date.now()) / 3600000;
    return Math.round((h - task.duration) * 10) / 10;
  }
  const parent = tasks.find(t => t.id === task.dependsOn);
  if (!parent) {
    const h = (new Date(task.deadline).getTime() - Date.now()) / 3600000;
    return Math.round((h - task.duration) * 10) / 10;
  }
  const parentEnd = new Date(parent.deadline).getTime();
  const selfDeadline = new Date(task.deadline).getTime();
  return Math.round(((selfDeadline - task.duration * 3600000 - parentEnd) / 3600000) * 10) / 10;
}

function getDownstreamTasks(taskId) {
  let affected = [];
  tasks.forEach(t => {
    if (t.status === 'active' && t.dependsOn === taskId) {
      affected.push(t);
      affected = affected.concat(getDownstreamTasks(t.id));
    }
  });
  return affected;
}

// Notifikasi Pop-up Layar & Bar Sistem di Luar Aplikasi
function showScreenPopup(task) {
  const slack = calculateSlack(task);
  const terrorMsg = generateTerrorMessage(task, slack);

  document.getElementById('popupTeacherTag').textContent = `${task.teacher} • ${task.subject}`;
  document.getElementById('popupTaskTitle').textContent = task.title;
  document.getElementById('popupTerrorText').textContent = terrorMsg;
  document.getElementById('popupTerrorBanner').classList.remove('hidden');

  const mode = document.getElementById('alarmModeSelect')?.value || localStorage.getItem(ALARM_MODE_KEY) || 'sound';
  if ('vibrate' in navigator) {
    if (mode === 'silent') {
      navigator.vibrate([120, 60, 120]);
    } else {
      navigator.vibrate([300, 100, 300, 100, 300]);
    }
  }
}

document.getElementById('btnClosePopup').addEventListener('click', () => {
  document.getElementById('popupTerrorBanner').classList.add('hidden');
});

async function triggerNotifications(task) {
  showScreenPopup(task);
  const slack = calculateSlack(task);
  const terrorMsg = generateTerrorMessage(task, slack);
  const mode = document.getElementById('alarmModeSelect')?.value || localStorage.getItem(ALARM_MODE_KEY) || 'sound';

  if ('Notification' in window && Notification.permission === 'granted') {
    if (swRegistration && swRegistration.showNotification) {
      swRegistration.showNotification(`🚨 TEROR ${task.teacher.toUpperCase()} (${task.subject})`, {
        body: terrorMsg,
        vibrate: mode === 'silent' ? [120, 60, 120] : [300, 100, 300],
        silent: mode === 'silent',
        requireInteraction: true
      });
    } else {
      new Notification(`🚨 TEROR ${task.teacher.toUpperCase()} (${task.subject})`, {
        body: terrorMsg,
        silent: mode === 'silent'
      });
    }
  }
}

function startWatchdog() {
  setInterval(() => {
    const now = Date.now();
    tasks.forEach(t => {
      if (t.status === 'active') {
        const targetTime = t.workSchedule ? new Date(t.workSchedule).getTime() : new Date(t.deadline).getTime();
        const diffHours = (targetTime - now) / 3600000;
        if (diffHours <= 0.5 && diffHours > -0.1) {
          triggerNotifications(t);
        }
      }
    });
  }, 30000);
}

// Panic Button (Rencana Darurat Kilat)
function triggerPanicMode() {
  const active = tasks.filter(t => t.status === 'active');
  const panicBox = document.getElementById('panicBox');
  const panicContent = document.getElementById('panicContent');

  if (active.length === 0) {
    panicBox.classList.remove('hidden');
    panicContent.innerHTML = '<p class="hint">Tidak ada tugas aktif saat ini. Jadwalmu masih aman terkendali!</p>';
    return;
  }

  const sorted = [...active].sort((a, b) => calculateSlack(a) - calculateSlack(b));
  let planHtml = '<ol style="padding-left: 20px; display: flex; flex-direction: column; gap: 8px;">';

  sorted.forEach((t, idx) => {
    const slack = calculateSlack(t);
    const mins = Math.round(t.duration * 60);
    const statusText = slack <= 0 ? 'KRITIS — KERJAKAN SEKARANG!' : `Sisa cadangan ${slack} jam`;
    planHtml += `
      <li>
        <strong>[Langkah ${idx + 1}] ${t.title} (${t.subject} - ${t.teacher})</strong><br/>
        <small>Alokasi Kilat: <strong>${mins} menit</strong> • Status: <span style="color:var(--danger)">${statusText}</span></small>
      </li>
    `;
  });
  planHtml += '</ol>';

  panicBox.classList.remove('hidden');
  panicContent.innerHTML = planHtml;
}

// Navigasi Halaman
const pageTitles = {
  dashboard: 'Dashboard Akademik & Kejuruan',
  assignments: 'Daftar Tugas & Teror Guru',
  simulator: 'Simulasi Efek Domino',
  alerts: 'Pusat Notifikasi & Alarm Senyap',
  focus: 'Mode Fokus Kustom',
  profile: 'Profil Siswa (SMA / SMK)'
};

function navigateTo(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById(`page-${pageId}`).classList.add('active');
  document.querySelector(`[data-page="${pageId}"]`)?.classList.add('active');
  document.getElementById('pageTitle').textContent = pageTitles[pageId] || 'DOMINO';
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

// Timer Fokus Kustom
function setupFocusTimerUI() {
  const input = document.getElementById('customTimerInput');
  input.addEventListener('change', () => {
    if (!isFocusRunning) {
      const mins = Math.max(1, Math.min(180, parseInt(input.value) || 25));
      input.value = mins;
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
          const mode = document.getElementById('alarmModeSelect')?.value || 'sound';
          if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
          if ('Notification' in window && Notification.permission === 'granted' && swRegistration) {
            swRegistration.showNotification('⏱️ Sesi Fokus Selesai!', {
              body: 'Waktu fokusmu sudah habis. Silakan istirahat sejenak sebelum lanjut tugas berikutnya.',
              silent: mode === 'silent'
            });
          }
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
    const mins = Math.max(1, Math.min(180, parseInt(input.value) || 25));
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
  document.getElementById('profileForm').addEventListener('submit', saveProfile);
  document.getElementById('btnPanic').addEventListener('click', triggerPanicMode);

  const savedAlarmMode = localStorage.getItem(ALARM_MODE_KEY) || 'sound';
  const alarmSelect = document.getElementById('alarmModeSelect');
  if (alarmSelect) {
    alarmSelect.value = savedAlarmMode;
    alarmSelect.addEventListener('change', (e) => {
      localStorage.setItem(ALARM_MODE_KEY, e.target.value);
    });
  }

  document.getElementById('btnEnableNotif').addEventListener('click', async () => {
    if ('Notification' in window) {
      const p = await Notification.requestPermission();
      alert(p === 'granted' ? '✅ Notifikasi sistem & teror pop-up berhasil diaktifkan!' : '⚠️ Izin notifikasi ditolak oleh browser.');
    } else {
      alert('⚠️ Browser ini tidak mendukung notifikasi sistem.');
    }
  });

  document.getElementById('taskForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('editTaskId').value || ('t_' + Date.now());
    const newTask = {
      id,
      title: document.getElementById('tTitle').value.trim(),
      subject: document.getElementById('tSubject').value.trim(),
      teacher: document.getElementById('tTeacher').value.trim(),
      persona: document.getElementById('tPersona').value,
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
  sim.innerHTML = active.length ? '' : '<option value="">-- Belum ada tugas --</option>';
  active.forEach(t => {
    dep.innerHTML += `<option value="${t.id}">${t.title} (${t.subject})</option>`;
    sim.innerHTML += `<option value="${t.id}">${t.title} — ${t.teacher}</option>`;
  });
}

function renderDashboard() {
  const active = tasks.filter(t => t.status === 'active');
  document.getElementById('navTaskCount').textContent = active.length;
  const critical = active.filter(t => calculateSlack(t) <= 0);

  // Kalkulasi Skor Beban Mental (Mental Load Meter)
  const totalWorkHours = active.reduce((sum, t) => sum + (t.duration || 0), 0);
  const targetDaily = userProfile.targetHours || 3;
  const mentalLoadPercent = Math.min(100, Math.round((totalWorkHours / (targetDaily * 2)) * 100));

  const scoreEl = document.getElementById('stabilityScore');
  const descEl = document.getElementById('stabilityDesc');
  const greeting = userProfile.name ? `Halo, ${userProfile.name}! ` : '';

  if (active.length === 0) {
    scoreEl.textContent = '100% — Jadwal Stabil | Beban Mental: 0%';
    descEl.textContent = `${greeting}Belum ada tugas yang ditambahkan. Klik "+ Tugas Baru" untuk mulai mengatur jadwal teori maupun kejuruan.`;
  } else if (critical.length > 0) {
    scoreEl.textContent = `⚠️ Jalur Kritis (${critical.length} Tugas) | Beban Mental: ${mentalLoadPercent}%`;
    descEl.textContent = `${greeting}Waspada efek domino! Gunakan Panic Button jika waktu pengerjaan sudah sangat mepet.`;
  } else {
    scoreEl.textContent = `✅ Jadwal Aman | Beban Mental: ${mentalLoadPercent}%`;
    descEl.textContent = `${greeting}Total estimasi kerja: ${totalWorkHours} jam. Tetap patuhi time-blocking agar tidak menumpuk.`;
  }

  const list = document.getElementById('dashboardAlertsList');
  list.innerHTML = active.slice(0, 3).map(t => {
    const slack = calculateSlack(t);
    return `
      <div class="alert-card ${slack <= 0 ? 'urgent' : ''}">
        <strong>${t.teacher} — ${t.subject}</strong>
        <p class="alert-msg">${generateTerrorMessage(t, slack)}</p>
      </div>
    `;
  }).join('') || '<p class="hint">Belum ada teror pengingat aktif.</p>';

  const priorityList = document.getElementById('todayActionList');
  const sorted = [...active].sort((a, b) => calculateSlack(a) - calculateSlack(b));
  priorityList.innerHTML = sorted.slice(0, 4).map((t, i) => {
    const slack = calculateSlack(t);
    return `
      <div class="alert-card ${slack <= 0 ? 'urgent' : ''}">
        <strong>#${i + 1} ${t.title} (${t.subject})</strong>
        <p class="hint">Pengampu: ${t.teacher} • Sisa Cadangan (Slack): ${slack} jam</p>
      </div>
    `;
  }).join('') || '<p class="hint">Belum ada daftar prioritas tugas.</p>';
}

function renderAssignments() {
  const active = tasks.filter(t => t.status === 'active');
  document.getElementById('totalTasksLabel').textContent = active.length;
  const container = document.getElementById('assignmentsList');
  container.innerHTML = active.map(t => {
    const slack = calculateSlack(t);
    const parent = t.dependsOn ? tasks.find(p => p.id === t.dependsOn) : null;
    return `
      <div class="task-item">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span class="subject-pill">${t.subject}</span>
          <span class="slack-pill ${slack <= 0 ? 'slack-danger' : 'slack-safe'}">Slack: ${slack}j</span>
        </div>
        <h4>${t.title}</h4>
        <small class="hint">Guru/Instruktur: ${t.teacher}</small>
        <small class="hint">Mulai Kerja: ${t.workSchedule ? t.workSchedule.replace('T', ' ') : '-'}</small>
        <small class="hint">Deadline: ${t.deadline.replace('T', ' ')}</small>
        ${parent ? `<small class="hint">⛓️ Bergantung pada: ${parent.title}</small>` : ''}
        <div style="display:flex; gap:6px; margin-top:8px;">
          <button class="btn btn-sm btn-primary" onclick="completeTask('${t.id}')">✓ Selesai</button>
          <button class="btn btn-sm btn-secondary" onclick="deleteTask('${t.id}')">Hapus</button>
        </div>
      </div>
    `;
  }).join('') || '<p class="hint">Belum ada tugas yang ditambahkan.</p>';
}

window.completeTask = (id) => {
  tasks = tasks.filter(t => t.id !== id);
  saveTasks();
  renderAll();
};

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
  if (!id) {
    box.innerHTML = '<p class="hint">Tambahkan tugas terlebih dahulu untuk menjalankan simulasi.</p>';
    return;
  }
  const selectedTask = tasks.find(t => t.id === id);
  const downstream = getDownstreamTasks(id);
  if (delay === 0) {
    box.innerHTML = `<div class="alert-card">✅ <strong>Jadwal Stabil:</strong> Tugas "${selectedTask?.title}" berjalan tepat waktu.</div>`;
    return;
  }
  if (downstream.length === 0) {
    const slack = calculateSlack(selectedTask);
    const over = delay - slack;
    box.innerHTML = over > 0
      ? `<div class="alert-card urgent">⚠️ <strong>Melewati Deadline:</strong> Keterlambatan +${delay} jam membuat tugas ini telat ${Math.round(over * 10) / 10} jam! ${generateTerrorMessage(selectedTask, -1)}</div>`
      : `<div class="alert-card">⚠️ <strong>Waktu Cadangan Berkurang:</strong> Masih aman karena tertutup slack time (${slack} jam), namun tidak ada tugas lanjutan yang bergantung padanya.</div>`;
  } else {
    const affectedNames = downstream.map(d => `${d.title} (${d.teacher})`).join(', ');
    box.innerHTML = `<div class="alert-card urgent">🚨 <strong>Efek Domino Terjadi!</strong> Keterlambatan +${delay} jam pada "${selectedTask?.title}" mengacaukan ${downstream.length} tugas berikutnya: <strong>${affectedNames}</strong>.</div>`;
  }
}

function renderAlerts() {
  const active = tasks.filter(t => t.status === 'active');
  document.getElementById('alertCountBadge').textContent = active.length;
  document.getElementById('fullAlertsList').innerHTML = active.map(t => {
    const slack = calculateSlack(t);
    return `
      <div class="alert-card">
        <strong>${t.teacher} (${t.subject}) — ${t.title}</strong>
        <p class="alert-msg">${generateTerrorMessage(t, slack)}</p>
        <button class="btn btn-sm btn-warning" onclick='triggerNotifications(${JSON.stringify(t).replace(/'/g, "&#39;")})' style="margin-top:8px;">🔔 Tes Pop-up & Notifikasi Luar</button>
      </div>
    `;
  }).join('') || '<p class="hint">Belum ada teror aktif. Tambahkan tugas untuk mengaktifkan pengingat.</p>';
}
