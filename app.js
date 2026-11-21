// ==========================================================
// DOMINO — Academic Domino Effect & Teacher Terror Planner
// Separated JS Edition (HTML + CSS + JS + Push Notif & Getar)
// ==========================================================

const TASKS_KEY = 'domino_student_tasks_single_v1';
const PROFILE_KEY = 'domino_student_profile_single_v1';

let tasks = [];
let studentProfile = null;
let deferredInstallPrompt = null;

// Notification state
let snoozedUntil = {};
let notifiedTaskIds = new Set();
let currentNotifTaskId = null;
let toastAutoHideTimer = null;

// Focus Timer state
let focusSecondsRemaining = 25 * 60;
let focusInitialSeconds = 25 * 60;
let focusTimerInterval = null;

document.addEventListener('DOMContentLoaded', () => {
  injectDynamicManifest();
  loadState();
  setupPWAInstall();
  setupNavigation();
  setupEventListeners();
  checkOnboarding();
  renderAll();
  startNotificationWatchdog();
});

// Inject PWA Manifest secara dinamis
function injectDynamicManifest() {
  try {
    const manifest = {
      name: 'DOMINO — Academic Domino Effect & Teacher Terror Planner',
      short_name: 'DOMINO',
      start_url: window.location.href,
      display: 'standalone',
      background_color: '#0b1120',
      theme_color: '#6366f1',
      icons: [{
        src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Crect width='512' height='512' rx='112' fill='%230f172a'/%3E%3Crect x='130' y='130' width='84' height='168' rx='16' fill='%231e293b' stroke='%2338bdf8' stroke-width='12'/%3E%3Crect x='230' y='160' width='84' height='168' rx='16' fill='%236366f1' stroke='%23f472b6' stroke-width='12'/%3E%3C/svg%3E",
        sizes: '512x512',
        type: 'image/svg+xml'
      }]
    };
    const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = URL.createObjectURL(blob);
    document.head.appendChild(link);
  } catch (e) {}
}

function loadState() {
  try {
    const rawProfile = localStorage.getItem(PROFILE_KEY);
    if (rawProfile) studentProfile = JSON.parse(rawProfile);

    const rawTasks = localStorage.getItem(TASKS_KEY);
    if (rawTasks) tasks = JSON.parse(rawTasks);
  } catch (e) {
    tasks = [];
  }
}

function saveTasks() {
  localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
}

function saveProfile() {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(studentProfile));
}

function createStarterSampleTasks() {
  const now = Date.now();
  const hr = 3600 * 1000;
  const toISO = (ms) => {
    const d = new Date(ms);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };

  return [
    {
      id: 'st_1',
      title: 'Menyelesaikan Penelitian Biologi',
      subject: 'Biologi',
      teacher: 'Pak Yudha',
      persona: 'sarkas',
      deadline: toISO(now + 18 * hr),
      duration: 3,
      dependsOn: '',
      status: 'active',
      notifEnabled: true,
      subtasks: [
        { text: 'Ambil foto sampel praktikum', done: true },
        { text: 'Catat tabel hasil pengamatan', done: false }
      ]
    },
    {
      id: 'st_2',
      title: 'Membuat Laporan Penelitian',
      subject: 'Biologi',
      teacher: 'Pak Yudha',
      persona: 'sarkas',
      deadline: toISO(now + 22 * hr),
      duration: 3,
      dependsOn: 'st_1',
      status: 'active',
      notifEnabled: true,
      subtasks: [
        { text: 'Ketik BAB 1-3', done: false },
        { text: 'Susun kesimpulan & daftar pustaka', done: false }
      ]
    },
    {
      id: 'st_3',
      title: 'Membuat Slide Presentasi',
      subject: 'Bahasa Indonesia',
      teacher: 'Bu Rina',
      persona: 'tegas',
      deadline: toISO(now + 27 * hr),
      duration: 2.5,
      dependsOn: 'st_2',
      status: 'active',
      notifEnabled: true,
      subtasks: []
    },
    {
      id: 'st_4',
      title: 'Latihan Presentasi Kelompok',
      subject: 'Biologi',
      teacher: 'Pak Yudha',
      persona: 'sarkas',
      deadline: toISO(now + 36 * hr),
      duration: 2,
      dependsOn: 'st_3',
      status: 'active',
      notifEnabled: true,
      subtasks: []
    }
  ];
}

function checkOnboarding() {
  const modal = document.getElementById('onboardingModal');
  if (!studentProfile) {
    modal.classList.remove('hidden');
  } else {
    modal.classList.add('hidden');
    applyProfileToUI();
  }
}

function applyProfileToUI() {
  if (!studentProfile) return;
  document.getElementById('sidebarStudentTag').textContent = `${studentProfile.name} • ${studentProfile.className}`;
  document.getElementById('welcomeGreeting').textContent =
    `Halo, ${studentProfile.name} (${studentProfile.className}) — One Delayed Task, A Chain of Consequences.`;
}

// --- PWA INSTALL ---
function setupPWAInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    document.getElementById('installBanner').classList.remove('hidden');
  });

  const handleInstall = async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      if (outcome === 'accepted') {
        document.getElementById('installBanner').classList.add('hidden');
      }
      deferredInstallPrompt = null;
    } else {
      document.getElementById('installHelpDialog').showModal();
    }
  };

  document.getElementById('btnInstallApp').addEventListener('click', handleInstall);
  document.getElementById('btnSidebarInstall').addEventListener('click', handleInstall);
  document.getElementById('btnTopInstall').addEventListener('click', handleInstall);
  document.getElementById('btnCloseInstall').addEventListener('click', () => {
    document.getElementById('installBanner').classList.add('hidden');
  });
  document.getElementById('btnCloseHelpDialog').addEventListener('click', () => {
    document.getElementById('installHelpDialog').close();
  });
}

// --- CORE DOMINO & SLACK ALGORITHM ---
function calculateSlackHours(task) {
  if (!task.dependsOn) {
    const hoursLeft = (new Date(task.deadline).getTime() - Date.now()) / 3600000;
    return Math.round((hoursLeft - task.duration) * 10) / 10;
  }
  const parent = tasks.find((t) => t.id === task.dependsOn && t.status !== 'done');
  if (!parent) {
    const hoursLeft = (new Date(task.deadline).getTime() - Date.now()) / 3600000;
    return Math.round((hoursLeft - task.duration) * 10) / 10;
  }
  const parentEnd = new Date(parent.deadline).getTime();
  const childStartLatest = new Date(task.deadline).getTime() - task.duration * 3600000;
  return Math.round(((childStartLatest - parentEnd) / 3600000) * 10) / 10;
}

function getDownstreamTasks(parentId) {
  const children = tasks.filter((t) => t.dependsOn === parentId && t.status !== 'done');
  let chain = [];
  for (const child of children) {
    chain.push(child);
    chain = chain.concat(getDownstreamTasks(child.id));
  }
  return chain;
}

function simulateDominoCascade(rootTaskId, extraDelayHours) {
  const root = tasks.find((t) => t.id === rootTaskId);
  if (!root) return [];

  const result = [];
  let currentFinishMs = new Date(root.deadline).getTime() + extraDelayHours * 3600000;

  result.push({
    task: root,
    delayHours: extraDelayHours,
    slackBefore: calculateSlackHours(root),
    isAffected: extraDelayHours > 0,
    newDeadlineMs: currentFinishMs
  });

  let queue = tasks.filter((t) => t.dependsOn === root.id && t.status !== 'done');
  while (queue.length > 0) {
    const curr = queue.shift();
    const origDeadlineMs = new Date(curr.deadline).getTime();
    const parentTask = tasks.find((x) => x.id === curr.dependsOn);
    const parentOrigEnd = parentTask ? new Date(parentTask.deadline).getTime() : Date.now();
    const slack = Math.round(((origDeadlineMs - curr.duration * 3600000 - parentOrigEnd) / 3600000) * 10) / 10;

    const neededFinishMs = currentFinishMs + curr.duration * 3600000;
    const pushedHours = Math.max(0, Math.round(((neededFinishMs - origDeadlineMs) / 3600000) * 10) / 10);

    result.push({
      task: curr,
      delayHours: pushedHours,
      slackBefore: slack,
      isAffected: pushedHours > 0,
      newDeadlineMs: pushedHours > 0 ? neededFinishMs : origDeadlineMs
    });

    currentFinishMs = pushedHours > 0 ? neededFinishMs : origDeadlineMs;
    queue.push(...tasks.filter((t) => t.dependsOn === curr.id && t.status !== 'done'));
  }

  return result;
}

// --- TEACHER TERROR PUSH NOTIFICATION & SHORT VIBRATION ---
function generateTeacherTerrorMessage(task, hoursLeft) {
  const stage =
    hoursLeft < 0 ? 'TERLAMBAT' :
    hoursLeft <= 6 ? 'HARI H' :
    hoursLeft <= 24 ? 'H-1' :
    hoursLeft <= 48 ? 'H-2' : 'H-3';

  const scripts = {
    sarkas: {
      'H-3': `"Tugas ${task.title} sudah Bapak/Ibu bagikan ya. Jangan tunggu sampai H-1 baru mendadak dapat ilham."`,
      'H-2': `"Sudah H-2 ${task.title}. Sudah ada isinya atau baru bikin folder sama tulis nama doang?"`,
      'H-1': `"Anak-anak, besok ${task.title} dikumpulkan. Sudah selesai atau masih dalam proses berpikir?"`,
      'HARI H': `"Hari ini batas akhir ${task.title}! Jangan alasan Wi-Fi mati, laptop nge-hang, atau file korup."`,
      'TERLAMBAT': `"Selamat, kamu resmi terlambat mengumpulkan ${task.title}. Bersiaplah menanggung efek dominonya!"`
    },
    tegas: {
      'H-3': `"Perhatikan jadwal ${task.title}. Kerjakan bertahap sesuai standar penilaian."`,
      'H-2': `"Progres ${task.title} wajib sudah 60% hari ini. Tidak ada toleransi keterlambatan."`,
      'H-1': `"Besok ${task.title} dikumpulkan tepat waktu. Keterlambatan langsung mengurangi nilai disiplin."`,
      'HARI H': `"Waktu pengumpulan ${task.title} tinggal hitungan jam. Segera kumpulkan sekarang!"`,
      'TERLAMBAT': `"Tugas ${task.title} melewati tenggat waktu! Segera selesaikan sebelum merusak jadwal mata pelajaran lain."`
    },
    santai: {
      'H-3': `"Halo semuanya, sekadar mengingatkan tugas ${task.title} masih 3 hari lagi ya, dicicil pelan-pelan."`,
      'H-2': `"Gimana kabar tugas ${task.title}? Jangan dipendam sampai malam terakhir ya."`,
      'H-1': `"Eh, besok ternyata sudah jadwal kumpul ${task.title} lho. Sudah beres kan?"`,
      'HARI H': `"Hari ini terakhir kumpul ${task.title} ya, Bapak/Ibu tunggu sampai jam deadline."`,
      'TERLAMBAT': `"Waduh, ${task.title} sudah lewat deadline nih. Yuk segera diberesin biar tugas lain nggak ikut keteteran."`
    }
  };

  return {
    stage,
    text: scripts[task.persona]?.[stage] || scripts.sarkas[stage]
  };
}

function triggerShortVibration() {
  if ('vibrate' in navigator) {
    navigator.vibrate([200, 100, 200]);
  }
}

function sendTeacherTerrorPush(task) {
  currentNotifTaskId = task.id;
  const hoursLeft = (new Date(task.deadline).getTime() - Date.now()) / 3600000;
  const msg = generateTeacherTerrorMessage(task, hoursLeft);
  const downstream = getDownstreamTasks(task.id);

  // 1. Getar sebentar di HP (tanpa suara sirine)
  triggerShortVibration();

  // 2. Tampilkan banner Push Notification in-app
  const toast = document.getElementById('terrorToast');
  document.getElementById('toastStageBadge').textContent = `TEROR GURU • ${msg.stage}`;
  document.getElementById('toastTeacher').textContent = `${task.teacher} — ${task.subject}`;
  document.getElementById('toastTaskTitle').textContent = task.title;
  document.getElementById('toastQuote').textContent = msg.text;

  const chainEl = document.getElementById('toastChainInfo');
  if (downstream.length > 0) {
    const names = downstream.map((d) => `${d.teacher} (${d.title})`).join(' ➔ ');
    chainEl.innerHTML = `⛓️ <strong>Efek Domino:</strong> ${downstream.length} tugas berikutnya ikut tertahan (${names})`;
    chainEl.classList.remove('hidden');
  } else {
    chainEl.classList.add('hidden');
  }

  toast.classList.remove('hidden');
  if (toastAutoHideTimer) clearTimeout(toastAutoHideTimer);
  toastAutoHideTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 12000);

  // 3. Kirim Native Browser / OS Push Notification
  const notifBody = downstream.length > 0
    ? `${task.title}: ${msg.text} (⚠️ Menahan ${downstream.length} tugas berikutnya!)`
    : `${task.title}: ${msg.text}`;

  sendSystemPushNotification(
    `🔔 ${task.teacher} (${task.subject}) — ${msg.stage}`,
    notifBody
  );
}

function sendSystemPushNotification(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const notif = new Notification(title, {
      body,
      vibrate: [200, 100, 200],
      tag: 'domino-teacher-terror',
      renotify: true
    });
    notif.onclick = () => {
      window.focus();
      notif.close();
    };
  } catch (e) {}
}

function startNotificationWatchdog() {
  setInterval(() => {
    const now = Date.now();
    for (const task of tasks) {
      if (task.status === 'done' || !task.notifEnabled) continue;
      if (snoozedUntil[task.id] && now < snoozedUntil[task.id]) continue;

      const hoursLeft = (new Date(task.deadline).getTime() - now) / 3600000;
      if (hoursLeft <= 24 && !notifiedTaskIds.has(task.id)) {
        notifiedTaskIds.add(task.id);
        sendTeacherTerrorPush(task);
        break;
      }
    }
  }, 15000);
}

// --- NAVIGATION & EVENTS ---
function navigateTo(pageId) {
  document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
  document.querySelectorAll('.nav-item, .m-nav').forEach((b) => b.classList.remove('active'));

  const target = document.getElementById(`page-${pageId}`);
  if (target) target.classList.add('active');
  document.querySelectorAll(`[data-page="${pageId}"]`).forEach((b) => b.classList.add('active'));

  const titles = {
    dashboard: 'Dashboard Akademik',
    assignments: 'My Assignments',
    map: 'Dependency Map (SVG)',
    simulator: 'Domino Effect Simulator',
    alerts: 'Teacher Terror Alerts',
    recovery: 'Recovery Planner',
    focus: 'Mode Fokus Pengerjaan',
    classshare: 'Bagikan & Backup Tugas Kelas'
  };
  document.getElementById('pageTitle').textContent = titles[pageId] || 'DOMINO';
  document.getElementById('sidebar').classList.remove('open');
  renderAll();
}

function setupNavigation() {
  document.querySelectorAll('[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
  });
  document.getElementById('btnMenuToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
}

function setupEventListeners() {
  // Onboarding
  document.getElementById('onboardingForm').addEventListener('submit', (e) => {
    e.preventDefault();
    studentProfile = {
      name: document.getElementById('obName').value.trim(),
      className: document.getElementById('obClass').value.trim(),
      dailyHours: parseFloat(document.getElementById('obStudyHours').value) || 3
    };
    saveProfile();

    const mode = document.getElementById('obStartMode').value;
    if (mode === 'sample' && tasks.length === 0) {
      tasks = createStarterSampleTasks();
      saveTasks();
    }

    document.getElementById('onboardingModal').classList.add('hidden');
    applyProfileToUI();
    renderAll();
  });

  document.getElementById('btnEditProfile').addEventListener('click', () => {
    if (studentProfile) {
      document.getElementById('obName').value = studentProfile.name;
      document.getElementById('obClass').value = studentProfile.className;
      document.getElementById('obStudyHours').value = studentProfile.dailyHours;
    }
    document.getElementById('onboardingModal').classList.remove('hidden');
  });

  // Task Form
  document.getElementById('taskForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const editId = document.getElementById('editTaskId').value;
    const notesRaw = document.getElementById('tNotes').value.trim();
    const subtasksArr = notesRaw
      ? notesRaw.split(',').map((s) => s.trim()).filter(Boolean).map((text) => ({ text, done: false }))
      : [];

    if (editId) {
      const idx = tasks.findIndex((t) => t.id === editId);
      if (idx !== -1) {
        tasks[idx] = {
          ...tasks[idx],
          title: document.getElementById('tTitle').value.trim(),
          subject: document.getElementById('tSubject').value.trim(),
          teacher: document.getElementById('tTeacher').value.trim(),
          persona: document.getElementById('tPersona').value,
          deadline: document.getElementById('tDeadline').value,
          duration: parseFloat(document.getElementById('tDuration').value),
          dependsOn: document.getElementById('tDependsOn').value,
          notifEnabled: document.getElementById('tNotifEnabled').value === 'true',
          subtasks: subtasksArr.length > 0 ? subtasksArr : tasks[idx].subtasks
        };
      }
      resetTaskFormMode();
    } else {
      tasks.push({
        id: 'task_' + Date.now(),
        title: document.getElementById('tTitle').value.trim(),
        subject: document.getElementById('tSubject').value.trim(),
        teacher: document.getElementById('tTeacher').value.trim(),
        persona: document.getElementById('tPersona').value,
        deadline: document.getElementById('tDeadline').value,
        duration: parseFloat(document.getElementById('tDuration').value),
        dependsOn: document.getElementById('tDependsOn').value,
        status: 'active',
        notifEnabled: document.getElementById('tNotifEnabled').value === 'true',
        subtasks: subtasksArr
      });
    }

    saveTasks();
    e.target.reset();
    renderAll();
  });

  document.getElementById('btnCancelEdit').addEventListener('click', resetTaskFormMode);
  document.getElementById('filterStatus').addEventListener('change', renderAssignments);

  // Simulator
  document.getElementById('simTaskSelect').addEventListener('change', renderSimulator);
  document.getElementById('simDelaySlider').addEventListener('input', renderSimulator);

  // Focus Timer
  document.getElementById('btnStartTimer').addEventListener('click', startFocusTimer);
  document.getElementById('btnPauseTimer').addEventListener('click', pauseFocusTimer);
  document.getElementById('btnFinishSession').addEventListener('click', finishFocusSession);

  // Push Notification Toast Controls
  document.getElementById('btnCloseToast').addEventListener('click', () => {
    document.getElementById('terrorToast').classList.add('hidden');
  });

  document.getElementById('btnToastDomino').addEventListener('click', () => {
    document.getElementById('terrorToast').classList.add('hidden');
    navigateTo('simulator');
    if (currentNotifTaskId) {
      document.getElementById('simTaskSelect').value = currentNotifTaskId;
      document.getElementById('simDelaySlider').value = 12;
      renderSimulator();
    }
  });

  document.getElementById('btnToastSnooze').addEventListener('click', () => {
    document.getElementById('terrorToast').classList.add('hidden');
    if (currentNotifTaskId) {
      snoozedUntil[currentNotifTaskId] = Date.now() + 5 * 60 * 1000;
      notifiedTaskIds.delete(currentNotifTaskId);
    }
  });

  document.getElementById('btnToastFocus').addEventListener('click', () => {
    document.getElementById('terrorToast').classList.add('hidden');
    navigateTo('focus');
    if (currentNotifTaskId) {
      document.getElementById('focusTaskSelect').value = currentNotifTaskId;
    }
    startFocusTimer();
  });

  const testPushHandler = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission().catch(() => {});
    }
    const active = tasks.filter((t) => t.status !== 'done');
    const target = active[0] || createStarterSampleTasks()[0];
    sendTeacherTerrorPush(target);
  };
  document.getElementById('btnTopTestTerror').addEventListener('click', testPushHandler);
  document.getElementById('btnSidebarTestTerror').addEventListener('click', testPushHandler);
  document.getElementById('btnTriggerChainTerror').addEventListener('click', testPushHandler);

  // Notification Permission
  document.getElementById('btnEnableNotif').addEventListener('click', async () => {
    if (!('Notification' in window)) {
      alert('Browser ini tidak mendukung Push Notification.');
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      triggerShortVibration();
      sendSystemPushNotification('DOMINO Push Notification Aktif!', 'Notifikasi teror guru siap dikirim ke HP kamu.');
      alert('✅ Push notification & getar singkat berhasil diaktifkan!');
    } else {
      alert('⚠️ Izin notifikasi ditolak di pengaturan browser.');
    }
  });

  // Panic Mode
  document.getElementById('btnPanicMode').addEventListener('click', () => {
    const active = tasks.filter((t) => t.status !== 'done');
    if (active.length === 0) return;
    let cursor = Date.now() + 1800000;
    active.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
    active.forEach((t) => {
      cursor += t.duration * 3600000;
      const d = new Date(cursor);
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      t.deadline = d.toISOString().slice(0, 16);
    });
    saveTasks();
    renderAll();
    alert('🔥 Panic Mode diterapkan! Seluruh tugas diurutkan ulang berantai mulai dari sekarang.');
  });

  // Class Share & Backup
  document.getElementById('btnGenerateShareCode').addEventListener('click', () => {
    const active = tasks.filter((t) => t.status !== 'done');
    if (active.length === 0) return alert('Belum ada tugas aktif.');
    const payload = btoa(unescape(encodeURIComponent(JSON.stringify(active))));
    const box = document.getElementById('shareCodeBox');
    box.value = payload;
    box.select();
    navigator.clipboard?.writeText(payload).catch(() => {});
    alert('📋 Kode tugas kelas disalin! Bagikan ke grup WhatsApp kelas.');
  });

  document.getElementById('btnShareWhatsApp').addEventListener('click', () => {
    const active = tasks.filter((t) => t.status !== 'done');
    if (active.length === 0) return alert('Belum ada tugas aktif.');
    const lines = active.map((t, i) => {
      const dl = new Date(t.deadline).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
      return `${i + 1}. *${t.subject}* — ${t.title} (${t.teacher}) | Deadline: ${dl}`;
    });
    const text = `📚 *Daftar Tugas Kelas (${studentProfile?.className || 'SMA'})*\n\n${lines.join('\n')}\n\n_Dikelola via DOMINO_`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  });

  document.getElementById('btnImportShareCode').addEventListener('click', () => {
    const raw = document.getElementById('importCodeBox').value.trim();
    if (!raw) return;
    try {
      const decoded = JSON.parse(decodeURIComponent(escape(atob(raw))));
      if (!Array.isArray(decoded)) throw new Error();
      const idMap = {};
      decoded.forEach((item) => {
        const newId = 'imp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        idMap[item.id] = newId;
        tasks.push({ ...item, id: newId, status: 'active' });
      });
      tasks.forEach((t) => {
        if (t.dependsOn && idMap[t.dependsOn]) t.dependsOn = idMap[t.dependsOn];
      });
      saveTasks();
      document.getElementById('importCodeBox').value = '';
      renderAll();
      alert(`✅ ${decoded.length} tugas dari teman sekelas berhasil ditambahkan!`);
    } catch (e) {
      alert('❌ Kode tidak valid.');
    }
  });

  document.getElementById('btnExportJsonFile').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ profile: studentProfile, tasks }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DOMINO-Backup-${studentProfile?.name || 'Siswa'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

function resetTaskFormMode() {
  document.getElementById('editTaskId').value = '';
  document.getElementById('formModeTitle').textContent = '➕ Tambah Tugas Sekolah';
  document.getElementById('btnSubmitTask').textContent = '💾 Simpan Tugas';
  document.getElementById('btnCancelEdit').classList.add('hidden');
  document.getElementById('taskForm').reset();
}

// --- FOCUS TIMER ---
window.setFocusMinutes = (mins) => {
  pauseFocusTimer();
  focusInitialSeconds = mins * 60;
  focusSecondsRemaining = focusInitialSeconds;
  updateTimerDisplay();
};

function updateTimerDisplay() {
  const m = String(Math.floor(focusSecondsRemaining / 60)).padStart(2, '0');
  const s = String(focusSecondsRemaining % 60).padStart(2, '0');
  document.getElementById('timerDisplay').textContent = `${m}:${s}`;
}

function startFocusTimer() {
  if (focusTimerInterval) return;
  document.getElementById('focusStatusText').textContent = '🔥 Sedang fokus mengerjakan tugas...';
  focusTimerInterval = setInterval(() => {
    if (focusSecondsRemaining > 0) {
      focusSecondsRemaining--;
      updateTimerDisplay();
    } else {
      pauseFocusTimer();
      finishFocusSession();
    }
  }, 1000);
}

function pauseFocusTimer() {
  if (focusTimerInterval) {
    clearInterval(focusTimerInterval);
    focusTimerInterval = null;
    document.getElementById('focusStatusText').textContent = '⏸️ Timer dijeda.';
  }
}

function finishFocusSession() {
  pauseFocusTimer();
  triggerShortVibration();
  const elapsedMinutes = Math.max(1, Math.round((focusInitialSeconds - focusSecondsRemaining) / 60));
  const elapsedHours = Math.round((elapsedMinutes / 60) * 10) / 10;
  const taskId = document.getElementById('focusTaskSelect').value;
  const task = tasks.find((t) => t.id === taskId);

  if (task && elapsedHours > 0) {
    task.duration = Math.max(0.5, Math.round((task.duration - elapsedHours) * 10) / 10);
    saveTasks();
    renderAll();
    alert(`🎉 Mantap! Sisa estimasi pengerjaan "${task.title}" berkurang menjadi ${task.duration} jam!`);
  }
  setFocusMinutes(25);
}

// --- RENDERING ---
function renderAll() {
  populateSelectOptions();
  renderDashboard();
  renderAssignments();
  renderDependencySvg();
  renderSimulator();
  renderAlerts();
  renderRecoveryPlanner();
}

function populateSelectOptions() {
  const activeTasks = tasks.filter((t) => t.status !== 'done');
  const depSelect = document.getElementById('tDependsOn');
  const simSelect = document.getElementById('simTaskSelect');
  const focusSelect = document.getElementById('focusTaskSelect');

  const prevSim = simSelect.value;
  const prevFocus = focusSelect.value;

  depSelect.innerHTML = '<option value="">-- Tidak Ada (Tugas Awal / Mandiri) --</option>';
  simSelect.innerHTML = '';
  focusSelect.innerHTML = '';

  activeTasks.forEach((t) => {
    depSelect.innerHTML += `<option value="${t.id}">${t.title} (${t.subject})</option>`;
    simSelect.innerHTML += `<option value="${t.id}">${t.title} — ${t.teacher}</option>`;
    focusSelect.innerHTML += `<option value="${t.id}">${t.title} (Sisa ${t.duration}j)</option>`;
  });

  if (prevSim && activeTasks.some((t) => t.id === prevSim)) simSelect.value = prevSim;
  if (prevFocus && activeTasks.some((t) => t.id === prevFocus)) focusSelect.value = prevFocus;
}

function renderDashboard() {
  const active = tasks.filter((t) => t.status !== 'done');
  const doneCount = tasks.filter((t) => t.status === 'done').length;
  const critical = active.filter((t) => calculateSlackHours(t) <= 0);
  const chained = active.filter((t) => t.dependsOn || tasks.some((c) => c.dependsOn === t.id && c.status !== 'done'));

  document.getElementById('navTaskCount').textContent = active.length;

  const penalty = critical.length * 18 + Math.max(0, active.length - 4) * 4;
  const stability = active.length === 0 ? 100 : Math.max(10, Math.min(100, 100 - penalty));

  document.getElementById('stabilityScore').textContent =
    `${stability}% — ${stability >= 75 ? 'Jadwal Stabil' : stability >= 45 ? 'Waspada Jalur Kritis' : 'Bahaya Efek Domino!'}`;
  document.getElementById('stabilityDesc').textContent =
    active.length === 0
      ? 'Belum ada tugas aktif. Tambahkan tugasmu di menu My Assignments.'
      : critical.length > 0
      ? `Terdeteksi ${critical.length} tugas di jalur kritis yang berisiko memicu efek domino.`
      : 'Semua rantai tugas memiliki waktu cadangan aman.';
  document.getElementById('stabilityFill').style.width = `${stability}%`;
  document.getElementById('stabilityBanner').classList.toggle('danger-mode', stability < 50);

  document.getElementById('kpiActive').textContent = active.length;
  document.getElementById('kpiDoneSummary').textContent = `${doneCount} selesai`;
  document.getElementById('kpiCritical').textContent = critical.length;
  document.getElementById('kpiChainCount').textContent = `${chained.length} Tugas`;

  const sorted = [...active].sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  if (sorted.length > 0) {
    const nearest = sorted[0];
    const hrs = Math.round((new Date(nearest.deadline) - Date.now()) / 3600000);
    document.getElementById('kpiNearest').textContent = hrs >= 0 ? `${hrs} Jam Lagi` : `Telat ${Math.abs(hrs)}j`;
    document.getElementById('kpiNearestTask').textContent = `${nearest.title} (${nearest.subject})`;
  } else {
    document.getElementById('kpiNearest').textContent = '-';
    document.getElementById('kpiNearestTask').textContent = 'Tidak ada tugas aktif';
  }

  // Dashboard Alerts
  const dashAlerts = document.getElementById('dashboardAlertsList');
  dashAlerts.innerHTML = sorted.slice(0, 3).map((t) => {
    const hrs = (new Date(t.deadline) - Date.now()) / 3600000;
    const msg = generateTeacherTerrorMessage(t, hrs);
    const downstream = getDownstreamTasks(t.id);
    return `
      <div class="alert-card ${hrs <= 24 ? 'urgent' : ''}">
        <div class="alert-head">
          <strong>${t.teacher} — ${t.subject}</strong>
          <span class="slack-pill ${hrs <= 24 ? 'slack-danger' : 'slack-warn'}">${msg.stage}</span>
        </div>
        <p class="alert-msg">${msg.text}</p>
        ${downstream.length > 0 ? `<div class="chain-terror-tag">⛓️ Teror Berantai: Menahan ${downstream.length} tugas berikutnya!</div>` : ''}
      </div>
    `;
  }).join('') || '<p class="hint">Belum ada teror guru aktif.</p>';

  // Priority & Domino Chain
  const actionList = document.getElementById('todayActionList');
  actionList.innerHTML = sorted.slice(0, 4).map((t, idx) => {
    const slack = calculateSlackHours(t);
    const cls = slack <= 0 ? 'slack-danger' : slack <= 6 ? 'slack-warn' : 'slack-safe';
    return `
      <div class="task-item" style="margin-bottom:8px;">
        <div class="task-top">
          <strong>#${idx + 1} ${t.title}</strong>
          <span class="slack-pill ${cls}">Slack: ${slack}j</span>
        </div>
        <small class="hint">${t.subject} • ${t.teacher} • Durasi ${t.duration} jam</small>
      </div>
    `;
  }).join('') || '<p class="hint">Belum ada tugas aktif.</p>';
}

function renderAssignments() {
  const filter = document.getElementById('filterStatus').value;
  const filtered = tasks.filter((t) => (filter === 'all' ? true : t.status === filter));
  document.getElementById('totalTasksLabel').textContent = filtered.length;

  const container = document.getElementById('assignmentsList');
  if (filtered.length === 0) {
    container.innerHTML = '<p class="hint">Belum ada tugas pada kategori ini.</p>';
    return;
  }

  container.innerHTML = filtered.map((t) => {
    const slack = calculateSlackHours(t);
    const parent = tasks.find((p) => p.id === t.dependsOn);
    const slackClass = slack <= 0 ? 'slack-danger' : slack <= 6 ? 'slack-warn' : 'slack-safe';
    const deadlineFormatted = new Date(t.deadline).toLocaleString('id-ID', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    });

    const subtasksHtml = (t.subtasks && t.subtasks.length > 0)
      ? `<div class="subtask-list">
          ${t.subtasks.map((st, sIdx) => `
            <label class="subtask-item ${st.done ? 'checked' : ''}">
              <input type="checkbox" ${st.done ? 'checked' : ''} onchange="toggleSubtask('${t.id}', ${sIdx})" />
              <span>${st.text}</span>
            </label>
          `).join('')}
        </div>`
      : '';

    return `
      <div class="task-item ${t.status === 'done' ? 'done' : ''} ${slack <= 0 && t.status !== 'done' ? 'critical' : ''}">
        <div class="task-top">
          <span class="subject-pill">${t.subject}</span>
          <span class="slack-pill ${slackClass}">Slack: ${slack} jam</span>
        </div>
        <h4>${t.title}</h4>
        <div class="task-meta">
          <span>👨‍🏫 Guru: <strong>${t.teacher}</strong> (${t.persona})</span>
          <span>⏰ Deadline: <strong>${deadlineFormatted}</strong></span>
          <span>⏳ Estimasi Durasi: ${t.duration} jam</span>
          ${parent ? `<span>⛓️ Bergantung pada: <strong>${parent.title}</strong></span>` : ''}
        </div>
        ${subtasksHtml}
        <div class="task-footer">
          <button class="btn btn-sm ${t.status === 'done' ? 'btn-secondary' : 'btn-primary'}" onclick="toggleTaskStatus('${t.id}')">
            ${t.status === 'done' ? '↩️ Buka Lagi' : '✅ Selesai'}
          </button>
          <div>
            <button class="btn btn-sm btn-outline" onclick="editTask('${t.id}')">✏️</button>
            <button class="btn btn-sm btn-outline" onclick="deleteTask('${t.id}')">🗑️</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

window.toggleSubtask = (taskId, subIdx) => {
  const t = tasks.find((x) => x.id === taskId);
  if (t && t.subtasks[subIdx]) {
    t.subtasks[subIdx].done = !t.subtasks[subIdx].done;
    saveTasks();
    renderAssignments();
  }
};

window.toggleTaskStatus = (id) => {
  const t = tasks.find((x) => x.id === id);
  if (t) {
    t.status = t.status === 'done' ? 'active' : 'done';
    saveTasks();
    renderAll();
  }
};

window.editTask = (id) => {
  const t = tasks.find((x) => x.id === id);
  if (!t) return;
  document.getElementById('editTaskId').value = t.id;
  document.getElementById('tTitle').value = t.title;
  document.getElementById('tSubject').value = t.subject;
  document.getElementById('tTeacher').value = t.teacher;
  document.getElementById('tPersona').value = t.persona;
  document.getElementById('tDeadline').value = t.deadline;
  document.getElementById('tDuration').value = t.duration;
  document.getElementById('tDependsOn').value = t.dependsOn || '';
  document.getElementById('tNotifEnabled').value = String(t.notifEnabled);
  document.getElementById('tNotes').value = (t.subtasks || []).map((s) => s.text).join(', ');

  document.getElementById('formModeTitle').textContent = '✏️ Edit Tugas';
  document.getElementById('btnSubmitTask').textContent = '💾 Simpan Perubahan';
  document.getElementById('btnCancelEdit').classList.remove('hidden');
  document.getElementById('taskForm').scrollIntoView({ behavior: 'smooth' });
};

window.deleteTask = (id) => {
  if (!confirm('Hapus tugas ini?')) return;
  tasks = tasks.filter((x) => x.id !== id);
  tasks.forEach((x) => { if (x.dependsOn === id) x.dependsOn = ''; });
  saveTasks();
  renderAll();
};

// --- SVG DEPENDENCY MAP ---
function renderDependencySvg() {
  const svg = document.getElementById('dependencySvg');
  const active = tasks.filter((t) => t.status !== 'done');
  if (active.length === 0) {
    svg.innerHTML = '<text x="450" y="220" fill="#94a3b8" text-anchor="middle">Belum ada tugas aktif untuk dipetakan.</text>';
    return;
  }

  const levels = {};
  const getLevel = (task) => {
    if (levels[task.id] !== undefined) return levels[task.id];
    if (!task.dependsOn) return (levels[task.id] = 0);
    const parent = active.find((p) => p.id === task.dependsOn);
    return (levels[task.id] = parent ? getLevel(parent) + 1 : 0);
  };
  active.forEach(getLevel);

  const grouped = {};
  active.forEach((t) => {
    const lv = levels[t.id];
    if (!grouped[lv]) grouped[lv] = [];
    grouped[lv].push(t);
  });

  const coords = {};
  Object.keys(grouped).forEach((lvStr) => {
    const lv = parseInt(lvStr, 10);
    grouped[lv].forEach((t, idx) => {
      coords[t.id] = { x: 40 + lv * 220, y: 50 + idx * 115 };
    });
  });

  let edgesSvg = '';
  let nodesSvg = '';

  active.forEach((t) => {
    if (t.dependsOn && coords[t.dependsOn]) {
      const p1 = coords[t.dependsOn];
      const p2 = coords[t.id];
      const slack = calculateSlackHours(t);
      const color = slack <= 0 ? '#ef4444' : slack <= 6 ? '#f59e0b' : '#10b981';
      const dash = slack > 6 ? 'stroke-dasharray="6,4"' : '';
      const cls = slack <= 0 ? 'edge-critical' : '';

      const x1 = p1.x + 170;
      const y1 = p1.y + 36;
      const x2 = p2.x;
      const y2 = p2.y + 36;
      const cx = (x1 + x2) / 2;

      edgesSvg += `<path d="M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}" fill="none" stroke="${color}" stroke-width="3" ${dash} class="${cls}" />`;
    }
  });

  active.forEach((t) => {
    const { x, y } = coords[t.id];
    const slack = calculateSlackHours(t);
    const stroke = slack <= 0 ? '#ef4444' : slack <= 6 ? '#f59e0b' : '#6366f1';
    nodesSvg += `
      <g transform="translate(${x}, ${y})">
        <rect width="170" height="72" rx="10" fill="#131c31" stroke="${stroke}" stroke-width="2" />
        <text x="10" y="22" fill="#a5b4fc" font-size="11" font-weight="bold">${t.subject}</text>
        <text x="10" y="40" fill="#f1f5f9" font-size="12" font-weight="600">${t.title.slice(0, 21)}</text>
        <text x="10" y="58" fill="#94a3b8" font-size="10">${t.teacher} • Slack: ${slack}j</text>
      </g>
    `;
  });

  svg.innerHTML = edgesSvg + nodesSvg;
}

// --- DOMINO SIMULATOR ---
function renderSimulator() {
  const rootId = document.getElementById('simTaskSelect').value;
  const delayHours = parseInt(document.getElementById('simDelaySlider').value, 10) || 0;
  const delayDays = (delayHours / 24).toFixed(1);

  document.getElementById('simDelayLabel').textContent = `+${delayHours} Jam (${delayDays} Hari)`;
  document.getElementById('simMetricDelay').textContent = `${delayDays} Hari`;

  const chain = simulateDominoCascade(rootId, delayHours);
  const stage = document.getElementById('dominoVisualStage');
  const conclusion = document.getElementById('simConclusionBox');

  if (chain.length === 0) {
    stage.innerHTML = '<p class="hint">Tambahkan tugas aktif terlebih dahulu untuk menjalankan simulasi efek domino.</p>';
    conclusion.innerHTML = '';
    return;
  }

  const firstChildSlack = chain.length > 1 ? chain[1].slackBefore : chain[0].slackBefore;
  const affectedItems = chain.filter((c, i) => i > 0 && c.isAffected);

  document.getElementById('simMetricSlack').textContent = `${firstChildSlack} Jam`;
  document.getElementById('simMetricAffected').textContent = `${affectedItems.length} Tugas`;

  stage.innerHTML = chain.map((item, idx) => {
    const stateCls = item.isAffected ? 'fallen' : item.slackBefore <= 6 ? 'warn' : '';
    const newTime = new Date(item.newDeadlineMs).toLocaleString('id-ID', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    });
    return `
      ${idx > 0 ? '<div class="domino-arrow">➔</div>' : ''}
      <div class="domino-tile ${stateCls}">
        <span class="subject-pill">${item.task.subject}</span>
        <h4 style="margin:8px 0 4px;">${item.task.title}</h4>
        <small class="hint">Guru: ${item.task.teacher}</small><br/>
        <small class="hint">Waktu cadangan: ${item.slackBefore} jam</small>
        <div style="margin-top:8px; font-size:0.8rem; font-weight:bold; color:${item.isAffected ? '#f87171' : '#34d399'};">
          ${item.isAffected ? `⚠️ Mundur +${item.delayHours} jam (${newTime})` : '✅ Jadwal Aman'}
        </div>
      </div>
    `;
  }).join('');

  if (delayHours === 0) {
    conclusion.innerHTML = `<strong>Hasil Simulasi (0 Jam):</strong> Jadwal tugas berikutnya masih dapat dipertahankan berdasarkan waktu cadangan (${firstChildSlack} jam).`;
  } else if (affectedItems.length === 0) {
    conclusion.innerHTML = `<strong>Aman Terkendali:</strong> Keterlambatan +${delayHours} jam masih diserap oleh waktu cadangan (${firstChildSlack} jam).`;
  } else {
    const affectedTeachers = [...new Set(affectedItems.map((x) => `${x.task.teacher} (${x.task.subject})`))].join(', ');
    conclusion.innerHTML = `
      <strong>🚨 EFEK DOMINO TERJADI!</strong> Keterlambatan +${delayHours} jam melampaui waktu cadangan dan menjatuhkan <strong>${affectedItems.length} tugas berikutnya</strong>.<br/>
      <span style="color:#fca5a5;">🔔 Teror Berantai Aktif: <strong>${affectedTeachers}</strong> akan mengirim notifikasi penagihan!</span>
    `;
  }
}

// --- TEACHER TERROR ALERTS ---
function renderAlerts() {
  const active = tasks.filter((t) => t.status !== 'done');
  document.getElementById('alertCountBadge').textContent = active.length;

  const list = document.getElementById('fullAlertsList');
  list.innerHTML = active.map((t) => {
    const hrs = (new Date(t.deadline) - Date.now()) / 3600000;
    const msg = generateTeacherTerrorMessage(t, hrs);
    const downstream = getDownstreamTasks(t.id);
    return `
      <div class="alert-card ${hrs <= 24 ? 'urgent' : ''}">
        <div class="alert-head">
          <strong>${t.teacher} — ${t.subject} (${t.title})</strong>
          <div>
            <span class="slack-pill ${hrs <= 24 ? 'slack-danger' : 'slack-warn'}">${msg.stage}</span>
            <button class="btn btn-sm btn-danger" style="margin-left:6px;" onclick="triggerPushForId('${t.id}')">📲 Kirim Push Teror</button>
          </div>
        </div>
        <p class="alert-msg">${msg.text}</p>
        ${downstream.length > 0 ? `<div class="chain-terror-tag">⛓️ Jika tugas ini terlambat, ${downstream.length} tugas lanjutan (${downstream.map(d => d.title).join(' ➔ ')}) akan memicu teror guru berikutnya!</div>` : ''}
      </div>
    `;
  }).join('') || '<p class="hint">Tidak ada notifikasi teror aktif.</p>';
}

window.triggerPushForId = (id) => {
  const t = tasks.find((x) => x.id === id);
  if (t) sendTeacherTerrorPush(t);
};

// --- RECOVERY PLANNER ---
function renderRecoveryPlanner() {
  const container = document.getElementById('recoveryOptions');
  const active = tasks.filter((t) => t.status !== 'done');
  if (active.length === 0) {
    container.innerHTML = '<p class="hint">Semua tugas sudah selesai, jadwal aman!</p>';
    return;
  }

  container.innerHTML = `
    <div class="recovery-card">
      <div>
        <span class="subject-pill">Strategi 1 • Buffer Expansion</span>
        <h4 style="margin:8px 0;">Majukan Target Pribadi Prasyarat (-4 Jam)</h4>
        <p class="hint">Memajukan target selesai tugas awal sebesar 4 jam agar waktu cadangan tugas berikutnya kembali aman.</p>
      </div>
      <button class="btn btn-primary" onclick="applyEarlyTarget(4)">⚡ Terapkan Jadwal Ini</button>
    </div>

    <div class="recovery-card">
      <div>
        <span class="subject-pill">Strategi 2 • Fokus Pomodoro</span>
        <h4 style="margin:8px 0;">Padatkan Durasi Pengerjaan (-25%)</h4>
        <p class="hint">Menggunakan teknik fokus 25 menit sehingga durasi tiap tugas berkurang 25% tanpa mengubah deadline guru.</p>
      </div>
      <button class="btn btn-primary" onclick="applyDurationCompress()">⚡ Terapkan Kompresi</button>
    </div>

    <div class="recovery-card">
      <div>
        <span class="subject-pill">Strategi 3 • Prioritas Rantai</span>
        <h4 style="margin:8px 0;">Geser Tugas Mandiri (+24 Jam)</h4>
        <p class="hint">Memundurkan tugas tanpa ketergantungan +24 jam untuk menyelamatkan rantai proyek utama.</p>
      </div>
      <button class="btn btn-primary" onclick="applyDeferIndependent()">⚡ Amankan Rantai Utama</button>
    </div>
  `;
}

window.applyEarlyTarget = (hours) => {
  tasks.forEach((t) => {
    const hasChild = tasks.some((c) => c.dependsOn === t.id && c.status !== 'done');
    if (t.status !== 'done' && hasChild) {
      const d = new Date(new Date(t.deadline).getTime() - hours * 3600000);
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      t.deadline = d.toISOString().slice(0, 16);
    }
  });
  saveTasks();
  renderAll();
  alert('✅ Target tugas prasyarat dimajukan 4 jam!');
};

window.applyDurationCompress = () => {
  tasks.forEach((t) => {
    if (t.status !== 'done') {
      t.duration = Math.max(0.5, Math.round(t.duration * 0.75 * 10) / 10);
    }
  });
  saveTasks();
  renderAll();
  alert('✅ Estimasi durasi tugas dipadatkan 25%!');
};

window.applyDeferIndependent = () => {
  tasks.forEach((t) => {
    const hasChild = tasks.some((c) => c.dependsOn === t.id);
    if (t.status !== 'done' && !t.dependsOn && !hasChild) {
      const d = new Date(new Date(t.deadline).getTime() + 24 * 3600000);
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      t.deadline = d.toISOString().slice(0, 16);
    }
  });
  saveTasks();
  renderAll();
  alert('✅ Tugas mandiri berhasil digeser +24 jam!');
};
