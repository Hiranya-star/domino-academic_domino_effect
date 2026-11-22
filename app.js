const TASKS_KEY = 'domifect_tasks';
const ARCHIVE_KEY = 'domifect_archive';
const PROFILE_KEY = 'domifect_profile';
const SCHEDULE_KEY = 'domifect_schedule';
const GEAR_KEY = 'domifect_gear';
const STATS_KEY = 'domifect_stats';
const ALARM_MODE_KEY = 'domifect_alarm_mode';
const EXAM_MODE_KEY = 'domifect_exam_mode';

const DAYS_LIST = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const DAY_NAMES_BY_INDEX = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const DAY_ORDER = { 'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6 };

let tasks = [];
let archivedTasks = [];
let schedules = [];
let gears = [];
let stats = { onTime: 0, late: 0, streak: 0 };
let userProfile = { name: '', className: '', school: '', targetHours: 3 };
let isExamMode = false;
let currentTaskFilter = 'all';
let lastPanicTextWA = '';
let deferredInstallPrompt = null;
const notifiedTaskWindows = new Set();

let focusTimerInterval = null;
let focusSecondsRemaining = 25 * 60;
let isFocusRunning = false;

function showToast(msg) {
  const el = document.getElementById('toastFeedback');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(function() {
    el.classList.add('hidden');
  }, 2800);
}



/* PENGHUBUNG KONTROL HTML KE FUNGSI JAVASCRIPT */
function bindUIEvents() {
  const on = (id, event, handler) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, handler);
  };

  document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
  });
  on('btnSidebarTheme', 'click', toggleTheme);
  on('btnMobileTheme', 'click', toggleTheme);
  on('btnEnableNotif', 'click', requestNotificationPermission);
  on('btnInstallPWA', 'click', installPWA);
  on('btnMobileNotif', 'click', requestNotificationPermission);
  on('btnEnableNotifMobile', 'click', requestNotificationPermission);
  on('btnQuickAdd', 'click', () => window.uiQuickAdd());
  on('btnAddFromActive', 'click', () => window.uiQuickAdd());
  on('btnPanic', 'click', triggerPanicMode);
  on('btnAntiMager', 'click', () => window.uiAntiMager());
  on('btnToggleExamMode', 'click', () => window.uiToggleExamMode());
  on('btnClosePanic', 'click', () => window.uiClosePanic());
  on('btnSharePanicWA', 'click', () => window.uiSharePanicWA());
  on('btnGoActiveTasks', 'click', () => navigateTo('active-tasks'));
  on('btnCancelEdit', 'click', () => window.uiCancelEdit());
  on('btnGenerateChat', 'click', handleGenerateChat);
  on('btnCopyChat', 'click', () => window.uiCopyChat());
  on('btnStartTimer', 'click', handleStartTimer);
  on('btnPauseTimer', 'click', () => window.uiPauseTimer());
  on('btnResetTimer', 'click', () => window.uiResetTimer());
  on('btnExportData', 'click', handleExportData);
  on('btnClosePopup', 'click', () => window.uiClosePopup());

  on('taskForm', 'submit', e => { e.preventDefault(); handleTaskSubmit(); });
  on('scheduleForm', 'submit', e => { e.preventDefault(); handleScheduleSubmit(); });
  on('gearForm', 'submit', e => { e.preventDefault(); handleGearSubmit(); });
  on('profileForm', 'submit', e => { e.preventDefault(); handleProfileSubmit(); });

  on('tQuickSchedule', 'change', e => window.uiOnQuickScheduleChange(e.target.value));
  on('tPersona', 'change', e => window.uiOnPersonaChange(e.target.value));
  on('simTaskSelect', 'change', renderSimulator);
  on('simDelaySlider', 'input', renderSimulator);
  on('customTimerInput', 'input', e => window.uiOnTimerInputChange(e.target.value));
  on('alarmModeSelect', 'change', e => window.uiOnAlarmModeChange(e.target.value));
  on('inputImportData', 'change', e => window.uiImportData(e.target));

  document.querySelectorAll('.filter-tab[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => window.uiFilterTasks(btn.dataset.filter));
  });
}

function initApp() {
  initTheme();
  loadAllData();
  setDefaultTaskDates();
  updateNotifStatusBadge();
  bindUIEvents();
  registerServiceWorker();
  setupPWAInstall();
  renderAll();
  startWatchdog();
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  navigator.serviceWorker.register('./sw.js', {scope:'./'}).then(reg => reg.update()).catch(err => console.warn('DOMIFECT SW:', err));
}

function setupPWAInstall() {
  const installBtn = document.getElementById('btnInstallPWA');
  if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
    if (installBtn) installBtn.classList.add('hidden');
  }
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); deferredInstallPrompt = event;
    if (installBtn) installBtn.classList.remove('hidden');
  });
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    if (installBtn) installBtn.classList.add('hidden');
    showToast('✅ DOMIFECT berhasil dipasang sebagai aplikasi!');
  });
}

async function installPWA() {
  if (!deferredInstallPrompt) {
    showToast('Buka menu Chrome ⋮ lalu pilih “Tambahkan ke layar utama” atau “Install app”.');
    return;
  }
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
}


function initTheme() {
  const saved = localStorage.getItem('domifect_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeButtonText(saved);
}

function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('domifect_theme', next);
  updateThemeButtonText(next);
}

function updateThemeButtonText(theme) {
  const btn = document.getElementById('btnSidebarTheme');
  const mobileBtn = document.getElementById('btnMobileTheme');
  if (btn) btn.textContent = theme === 'dark' ? '☀️ Mode Terang' : '🌙 Mode Gelap';
  if (mobileBtn) mobileBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function toLocalDatetimeInputValue(dateObj) {
  const pad = function(n) { return String(n).padStart(2, '0'); };
  return dateObj.getFullYear() + '-' + pad(dateObj.getMonth() + 1) + '-' + pad(dateObj.getDate()) + 'T' + pad(dateObj.getHours()) + ':' + pad(dateObj.getMinutes());
}

function setDefaultTaskDates() {
  const workEl = document.getElementById('tWorkSchedule');
  const deadEl = document.getElementById('tDeadline');
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 3600000);
  tomorrow.setHours(7, 0, 0, 0);
  if (workEl) workEl.value = toLocalDatetimeInputValue(now);
  if (deadEl) deadEl.value = toLocalDatetimeInputValue(tomorrow);
}

function loadAllData() {
  try {
    const rawProf = localStorage.getItem(PROFILE_KEY);
    if (rawProf) {
      userProfile = JSON.parse(rawProf);
      const pName = document.getElementById('pName');
      const pClass = document.getElementById('pClass');
      const pSchool = document.getElementById('pSchool');
      const pTargetHours = document.getElementById('pTargetHours');
      if (pName) pName.value = userProfile.name || '';
      if (pClass) pClass.value = userProfile.className || '';
      if (pSchool) pSchool.value = userProfile.school || '';
      if (pTargetHours) pTargetHours.value = userProfile.targetHours || 3;
      updateStudentTags();
    }
  } catch (e) {}

  try { tasks = JSON.parse(localStorage.getItem(TASKS_KEY)) || []; } catch (e) { tasks = []; }
  try { archivedTasks = JSON.parse(localStorage.getItem(ARCHIVE_KEY)) || []; } catch (e) { archivedTasks = []; }
  try { schedules = sortSchedulesByDay(JSON.parse(localStorage.getItem(SCHEDULE_KEY)) || []); } catch (e) { schedules = []; }
  try { gears = JSON.parse(localStorage.getItem(GEAR_KEY)) || []; } catch (e) { gears = []; }
  try { stats = JSON.parse(localStorage.getItem(STATS_KEY)) || { onTime: 0, late: 0, streak: 0 }; } catch (e) {}

  isExamMode = localStorage.getItem(EXAM_MODE_KEY) === 'true';
  updateExamModeUI();

  const savedAlarmMode = localStorage.getItem(ALARM_MODE_KEY) || 'sound';
  const alarmSelect = document.getElementById('alarmModeSelect');
  if (alarmSelect) alarmSelect.value = savedAlarmMode;
}

function saveTasks() { localStorage.setItem(TASKS_KEY, JSON.stringify(tasks)); }
function saveArchive() { localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archivedTasks)); }
function saveSchedules() {
  schedules = sortSchedulesByDay(schedules);
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedules));
}
function saveGears() { localStorage.setItem(GEAR_KEY, JSON.stringify(gears)); }
function saveStats() { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); }

function sortSchedulesByDay(list) {
  return list.slice().sort(function(a, b) {
    const dayA = DAY_ORDER[a.day] || 99;
    const dayB = DAY_ORDER[b.day] || 99;
    if (dayA !== dayB) return dayA - dayB;
    return (a.subject || '').localeCompare(b.subject || '');
  });
}

function updateStudentTags() {
  const tagText = userProfile.name
    ? userProfile.name + (userProfile.className ? ' • ' + userProfile.className : '')
    : 'Planner SMA & SMK';
  const sideTag = document.getElementById('sidebarStudentTag');
  const mobTag = document.getElementById('mobileStudentTag');
  if (sideTag) sideTag.textContent = tagText;
  if (mobTag) mobTag.textContent = userProfile.name ? tagText : 'SMA & SMK';
}

function updateExamModeUI() {
  const badge = document.getElementById('examModeBadge');
  const btn = document.getElementById('btnToggleExamMode');
  if (badge) badge.classList.toggle('hidden', !isExamMode);
  if (btn) {
    btn.textContent = isExamMode
      ? '🎓 Nonaktifkan Mode Ujian / Pekan Praktik'
      : '🎓 Aktifkan Mode Ujian / Pekan Praktik (UKK / SAS)';
    btn.className = isExamMode ? 'btn btn-danger btn-block btn-sm' : 'btn btn-secondary btn-block btn-sm';
  }
}

/* NAVIGASI HALAMAN */
const pageTitles = {
  dashboard: 'Dashboard Akademik & Kejuruan',
  'create-task': 'Buat / Edit Tugas Baru',
  'active-tasks': 'Daftar Tugas Aktif & Arsip',
  simulator: 'Simulasi Efek Domino',
  schedule: 'Jadwal Pelajaran & Perlengkapan',
  alerts: 'Pusat Teror & Chat Negosiasi Guru',
  focus: 'Mode Fokus Pengerjaan Kustom',
  profile: 'Profil Siswa, Statistik & Backup'
};

function navigateTo(pageId) {
  document.querySelectorAll('.page').forEach(function(p) {
    p.classList.remove('active');
  });
  document.querySelectorAll('.nav-item').forEach(function(b) {
    b.classList.remove('active');
  });

  const targetPage = document.getElementById('page-' + pageId);
  if (targetPage) targetPage.classList.add('active');

  const targetNav = document.querySelector('.nav-item[data-page="' + pageId + '"]');
  if (targetNav) targetNav.classList.add('active');

  const titleEl = document.getElementById('pageTitle');
  if (titleEl) titleEl.textContent = pageTitles[pageId] || 'DOMIFECT';

  window.scrollTo({ top: 0, behavior: 'smooth' });
  renderAll();
}

window.navigateTo = navigateTo;

/* GLOBAL UI HANDLERS */
window.uiGoPage = function(pageId) {
  const editField = document.getElementById('editTaskId');
  if (pageId === 'create-task' && (!editField || !editField.value)) {
    resetTaskForm();
  }
  navigateTo(pageId);
};

window.uiToggleTheme = function() { toggleTheme(); };
window.uiRequestNotif = function() { requestNotificationPermission(); };
window.uiQuickAdd = function() { resetTaskForm(); navigateTo('create-task'); };
window.uiPanic = function() { triggerPanicMode(); };
window.uiClosePanic = function() {
  const box = document.getElementById('panicBox');
  if (box) box.classList.add('hidden');
};
window.uiSharePanicWA = function() {
  if (lastPanicTextWA) {
    window.open('https://wa.me/?text=' + encodeURIComponent(lastPanicTextWA), '_blank');
  }
};
window.uiAntiMager = function() {
  const targetLabel = document.getElementById('focusTaskTargetLabel');
  if (targetLabel) targetLabel.textContent = '⚡ Tantangan Anti-Mager 5 Menit — Mulai Sekarang!';
  navigateTo('focus');
  startCustomFocus(5);
};
window.uiToggleExamMode = function() {
  isExamMode = !isExamMode;
  localStorage.setItem(EXAM_MODE_KEY, String(isExamMode));
  updateExamModeUI();
  renderAll();
  showToast(isExamMode ? '🎓 Mode Ujian / UKK Aktif!' : 'Mode Ujian Dinonaktifkan');
};
window.uiFilterTasks = function(filterType) {
  currentTaskFilter = filterType || 'all';
  document.querySelectorAll('.filter-tab').forEach(function(t) {
    t.className = t.getAttribute('data-filter') === currentTaskFilter
      ? 'btn btn-sm btn-primary filter-tab'
      : 'btn btn-sm btn-secondary filter-tab';
  });
  renderAssignments();
};
window.uiCancelEdit = function() { resetTaskForm(); navigateTo('active-tasks'); };
window.uiOnQuickScheduleChange = function(val) {
  const sch = schedules.find(function(s) { return s.id === val; });
  if (sch) {
    document.getElementById('tSubject').value = sch.subject;
    document.getElementById('tTeacher').value = sch.teacher;
  }
};
window.uiOnPersonaChange = function(val) {
  const customGroup = document.getElementById('customPersonaGroup');
  if (!customGroup) return;
  if (val === 'custom') customGroup.classList.remove('hidden');
  else customGroup.classList.add('hidden');
};
window.uiSubmitTask = function(e) { if (e) e.preventDefault(); handleTaskSubmit(); return false; };
window.uiSubmitSchedule = function(e) { if (e) e.preventDefault(); handleScheduleSubmit(); return false; };
window.uiSubmitGear = function(e) { if (e) e.preventDefault(); handleGearSubmit(); return false; };
window.uiSubmitProfile = function(e) { if (e) e.preventDefault(); handleProfileSubmit(); return false; };
window.uiStartTimer = function() { handleStartTimer(); };
window.uiPauseTimer = function() {
  clearInterval(focusTimerInterval);
  isFocusRunning = false;
  showToast('⏸️ Timer dijeda');
};
window.uiResetTimer = function() {
  clearInterval(focusTimerInterval);
  isFocusRunning = false;
  const inputVal = document.getElementById('customTimerInput') ? document.getElementById('customTimerInput').value : 25;
  const mins = Math.max(1, Math.min(180, parseInt(inputVal, 10) || 25));
  focusSecondsRemaining = mins * 60;
  updateTimerDisplay();
  showToast('🔄 Timer di-reset');
};
window.uiOnTimerInputChange = function(val) {
  if (!isFocusRunning) {
    focusSecondsRemaining = Math.max(1, Math.min(180, parseInt(val, 10) || 25)) * 60;
    updateTimerDisplay();
  }
};
window.uiGenerateChat = function() { handleGenerateChat(); };
window.uiCopyChat = function() {
  const output = document.getElementById('negoChatOutput');
  if (output) {
    output.select();
    if (navigator.clipboard) navigator.clipboard.writeText(output.value);
    showToast('📋 Draf chat WhatsApp berhasil disalin!');
  }
};
window.uiOnAlarmModeChange = function(val) { localStorage.setItem(ALARM_MODE_KEY, val); };
window.uiExportData = function() { handleExportData(); };
window.uiImportData = function(inputEl) {
  if (inputEl && inputEl.files && inputEl.files[0]) {
    handleImportData(inputEl.files[0]);
  }
};
window.uiClosePopup = function() {
  const banner = document.getElementById('popupTerrorBanner');
  if (banner) banner.classList.add('hidden');
};

function handleTaskSubmit() {
  const titleVal = (document.getElementById('tTitle')?.value || '').trim();
  const subjectVal = (document.getElementById('tSubject')?.value || '').trim();
  const teacherVal = (document.getElementById('tTeacher')?.value || '').trim();
  const workVal = document.getElementById('tWorkSchedule')?.value || '';
  const deadlineVal = document.getElementById('tDeadline')?.value || '';

  if (!titleVal || !subjectVal || !teacherVal || !deadlineVal) {
    alert('⚠️ Mohon isi Nama Tugas, Mata Pelajaran, Nama Guru, dan Deadline!');
    return;
  }

  const existingId = document.getElementById('editTaskId')?.value || '';
  const id = existingId || ('t_' + Date.now());
  const rawSubs = (document.getElementById('tSubTasks')?.value || '').trim();
  let parsedSubTasks = [];

  if (rawSubs) {
    const oldTask = tasks.find(function(t) { return t.id === existingId; });
    parsedSubTasks = rawSubs.split(',').map(function(s) { return s.trim(); }).filter(Boolean).map(function(text) {
      const prev = oldTask && oldTask.subTasks ? oldTask.subTasks.find(function(os) { return os.text === text; }) : null;
      return { text: text, done: prev ? prev.done : false };
    });
  }

  const newTask = {
    id: id,
    title: titleVal,
    subject: subjectVal,
    teacher: teacherVal,
    gradeWeight: document.getElementById('tGradeWeight')?.value || '1',
    persona: document.getElementById('tPersona')?.value || 'killer',
    customText: (document.getElementById('tCustomText')?.value || '').trim(),
    workSchedule: workVal || deadlineVal,
    deadline: deadlineVal,
    duration: parseFloat(document.getElementById('tDuration')?.value) || 1,
    dependsOn: document.getElementById('tDependsOn')?.value || '',
    subTasks: parsedSubTasks,
    groupMembers: (document.getElementById('tGroupMembers')?.value || '').trim(),
    status: 'active'
  };

  const idx = tasks.findIndex(function(t) { return t.id === id; });
  if (idx >= 0) tasks[idx] = newTask;
  else tasks.push(newTask);

  saveTasks();
  resetTaskForm();
  currentTaskFilter = 'all';
  navigateTo('active-tasks');
  showToast('✅ Tugas berhasil disimpan!');
  triggerNotifications(newTask);
}

function handleScheduleSubmit() {
  const day = document.getElementById('sDay').value;
  const subject = document.getElementById('sSubject').value.trim();
  const teacher = document.getElementById('sTeacher').value.trim();
  if (!subject || !teacher) return;
  schedules.push({ id: 's_' + Date.now(), day: day, subject: subject, teacher: teacher });
  saveSchedules();
  const form = document.getElementById('scheduleForm');
  if (form) form.reset();
  renderAll();
  showToast('📅 Mapel ' + subject + ' (' + day + ') tersimpan!');
}

function handleGearSubmit() {
  const input = document.getElementById('gearInput');
  const val = input ? input.value.trim() : '';
  if (!val) return;
  gears.push({ id: 'g_' + Date.now(), text: val, checked: false });
  saveGears();
  input.value = '';
  renderAll();
  showToast('🎒 Perlengkapan ditambahkan!');
}

function handleProfileSubmit() {
  userProfile = {
    name: document.getElementById('pName').value.trim(),
    className: document.getElementById('pClass').value.trim(),
    school: document.getElementById('pSchool').value.trim(),
    targetHours: parseFloat(document.getElementById('pTargetHours').value) || 3
  };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(userProfile));
  updateStudentTags();
  renderAll();
  showToast('✅ Profil siswa berhasil disimpan!');
}

function handleGenerateChat() {
  const taskId = document.getElementById('negoTaskSelect')?.value;
  const reason = document.getElementById('negoReasonSelect')?.value;
  const task = tasks.find(function(t) { return t.id === taskId; });
  if (!task) {
    alert('Tambahkan atau pilih tugas terlebih dahulu!');
    return;
  }
  const studentName = userProfile.name || '[Nama Saya]';
  const studentClass = userProfile.className || '[Kelas]';
  const reasonTexts = {
    alat: 'dikarenakan terdapat kendala teknis pada perangkat/alat praktik atau laptop yang sedang mengalami gangguan',
    sakit: 'dikarenakan kondisi kesehatan saya sedang kurang fit / sakit sehingga proses pengerjaan sedikit terhambat',
    bertumpuk: 'dikarenakan bersamaan dengan jadwal uji kompetensi/praktik mata pelajaran lain yang cukup padat',
    revisi: 'dikarenakan saya sedang melakukan pengecekan ulang dan penyempurnaan hasil agar sesuai dengan standar yang diminta',
    listrik: 'dikarenakan terjadi pemadaman listrik dan gangguan jaringan internet di wilayah tempat tinggal saya sejak tadi malam',
    keluarga: 'dikarenakan terdapat urusan keluarga yang sangat mendesak / anggota keluarga sedang sakit sehingga saya harus mendampingi',
    dispen: 'dikarenakan saya sedang menjalankan tugas dispensasi kegiatan sekolah / lomba mewakili sekolah',
    pkl: 'dikarenakan terdapat penyesuaian jadwal kerja / lembur di tempat PKL (Prakerin) yang baru selesai cukup malam',
    kelompok: 'dikarenakan kami masih menunggu kelengkapan data dari salah satu anggota kelompok agar laporan dapat digabungkan secara utuh'
  };

  const lines = [
    "Assalamu'alaikum / Selamat pagi/siang " + task.teacher + ".",
    "",
    "Mohon maaf mengganggu waktunya. Saya " + studentName + " dari kelas " + studentClass + ". Saya ingin mengonfirmasi terkait tugas \"" + task.title + "\" pada mata pelajaran " + task.subject + ".",
    "",
    "Saat ini progres pengerjaan sudah berjalan, namun " + (reasonTexts[reason] || reasonTexts.alat) + ". Saya memohon izin untuk dapat mengumpulkan tugas tersebut paling lambat pada [Sebutkan Jam/Hari].",
    "",
    "Terima kasih banyak atas pengertian dan bimbingannya, " + task.teacher + "."
  ];

  document.getElementById('negoChatOutput').value = lines.join('\n');
  document.getElementById('negoResultBox').classList.remove('hidden');
  showToast('✍️ Draf chat WhatsApp siap disalin!');
}

function handleExportData() {
  const backup = {
    userProfile: userProfile,
    tasks: tasks,
    archivedTasks: archivedTasks,
    schedules: schedules,
    gears: gears,
    stats: stats
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'DOMIFECT_Backup_' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('⬇️ File backup berhasil diunduh!');
}

function handleImportData(file) {
  const reader = new FileReader();
  reader.onload = function(ev) {
    try {
      const data = JSON.parse(ev.target.result);
      if (data.userProfile) userProfile = data.userProfile;
      if (data.tasks) tasks = data.tasks;
      if (data.archivedTasks) archivedTasks = data.archivedTasks;
      if (data.schedules) schedules = sortSchedulesByDay(data.schedules);
      if (data.gears) gears = data.gears;
      if (data.stats) stats = data.stats;
      localStorage.setItem(PROFILE_KEY, JSON.stringify(userProfile));
      saveTasks();
      saveArchive();
      saveSchedules();
      saveGears();
      saveStats();
      loadAllData();
      renderAll();
      showToast('✅ Data backup berhasil dipulihkan!');
    } catch (err) {
      alert('⚠️ File backup tidak valid!');
    }
  };
  reader.readAsText(file);
}

const terrorMatrix = {
  killer: {
    openers: ["Perhatian penuh untukmu!", "Peringatan keras dari {teacher}!", "Kesabaran {teacher} sudah di batas akhir!"],
    cores: ["Tugas '{title}' mapel {subject} masih kosong melompong tanpa progres.", "Nilai rapor {subject}-mu berada di ujung tanduk karena mengabaikan '{title}'."],
    closers: ["Kerjakan sekarang atau terima nilai nol bulat!", "Buka buku dan laptopmu detik ini juga!"]
  },
  sarcastic: {
    openers: ["Wah, luar biasa sekali santainya...", "Selamat menikmati waktu rebahanmu ya..."],
    cores: ["Tugas '{title}' dari {teacher} pasti bisa selesai sendiri lewat kekuatan pikiran.", "{teacher} sudah menyiapkan formulir remidi edisi spesial untuk {subject}."],
    closers: ["Mau lanjut santai atau mulai kerja sekarang?", "Mulai cicil sekarang sebelum waktu habis!"]
  },
  disciplined: {
    openers: ["Alarm kedisiplinan berbunyi!", "Waktu berjalan presisi tanpa kompromi!"],
    cores: ["{teacher} menghitung setiap detik keterlambatan pada pengerjaan '{title}'.", "Menunda '{title}' akan memicu efek domino ke seluruh target belajarmu."],
    closers: ["Eksekusi sesuai jadwal detik ini juga!", "Jaga stabilitas jadwalmu tetap 100%!"]
  },
  friendly: {
    openers: ["Halo, semangat ya hari ini!", "Sedikit pengingat hangat untukmu..."],
    cores: ["{teacher} menantikan hasil terbaikmu pada tugas '{title}' ({subject}).", "Jangan sampai tugas '{title}' menumpuk dan membuatmu stres."],
    closers: ["Yuk mulai kerjakan sekarang, kamu pasti bisa!", "Buat {teacher} bangga dengan hasil kerjamu!"]
  },
  vocational: {
    openers: ["Perhatian standar bengkel & lab!", "Peringatan SOP praktik kejuruan!"],
    cores: ["Laporan '{title}' pada kompetensi {subject} belum tuntas.", "Di dunia industri, keterlambatan '{title}' berarti gagal memenuhi SOP."],
    closers: ["Eksekusi sesuai prosedur sekarang juga!", "Buktikan kompetensi kejuruanmu di depan {teacher}!"]
  },
  silentkiller: {
    openers: ["Hening bukan berarti aman...", "Waspadai ketenangan {teacher}..."],
    cores: ["{teacher} jarang menegur, tapi status '{title}' milikmu sudah ditandai.", "Tanpa peringatan ulang, nilai {subject} untuk '{title}' bisa dikosongkan."],
    closers: ["Segera amankan posisimu sebelum terlambat!", "Kumpulkan '{title}' sebelum namamu dicoret!"]
  },
  motivator: {
    openers: ["Bangkit dan tatap masa depanmu!", "Mental juara ditempa dari hal-hal kecil!"],
    cores: ["Menyelesaikan '{title}' ({subject}) adalah latihan nyata menghadapi tantangan.", "{teacher} ingin melihatmu tumbuh menjadi lulusan berintegritas."],
    closers: ["Ambil kendali atas waktumu dan mulai sekarang!", "Tuntaskan '{title}' dengan kualitas terbaikmu!"]
  },
  custom: {
    openers: ["Peringatan khusus dari {teacher}!", "Ingat kata-kata {teacher}!"],
    cores: ["\"{customText}\" — Terkait tugas '{title}' ({subject})."],
    closers: ["Segera buka dan kerjakan sekarang!"]
  }
};

// 50 pesan tambahan untuk setiap karakter guru: 10 pembuka x 5 inti.
// Gaya pesan tetap jenaka dan suportif, bukan ancaman atau penghinaan.
const extraTerrorBank = {
  killer: {
    a: ["🚨 Panggilan tugas dari {teacher} masuk!", "🔔 Radar deadline mendeteksi tugasmu!", "Perhatian, {teacher} sedang mengecek progres.", "Breaking news dari meja guru {teacher}!", "Status tugasmu terpantau satelit akademik.", "Tim penyelamat deadline memanggilmu!", "Ada pesan dari wilayah {subject}.", "Alarm akademik berbunyi khusus untukmu!", "{teacher} mengirim sinyal pengingat.", "Operasi penyelamatan nilai dimulai!"],
    b: ["tugas '{title}' untuk {subject} masih menunggu sentuhan terakhirmu.", "misi '{title}' belum berubah menjadi status selesai.", "deadline '{title}' makin dekat—jangan biarkan kalender yang mengerjakannya.", "progres '{title}' perlu ditambah sedikit demi sedikit.", "'{title}' sedang antre untuk dituntaskan sebelum waktunya habis."]
  },
  sarcastic: {
    a: ["Wah, tugasmu sepertinya sedang menikmati waktu libur.", "Halo, pejuang rebahan, kalender ingin bicara.", "File tugasmu sedang menunggu diajak kenalan.", "{teacher} menitipkan salam dari dunia deadline.", "Katanya mau produktif hari ini? Ini kesempatanmu.", "Tugasmu mengirim surat: katanya kangen dikerjakan.", "Waktu tidak sedang menunggu inspirasi turun.", "Ada yang lupa punya tugas {subject}?", "Kursi belajar sudah lama tidak bertemu denganmu.", "Notifikasi ini disponsori deadline yang makin dekat."],
    b: ["'{title}' belum selesai, mungkin dia menunggu perhatianmu.", "tugas {subject} itu belum bisa mengerjakan dirinya sendiri.", "'{title}' masih ada di daftar, bukan di daftar kenangan.", "progres tugasmu tampaknya sedang mengambil cuti.", "{teacher} tentu lebih senang melihat hasil daripada alasan menunda."]
  },
  disciplined: {
    a: ["⏱️ Pemeriksaan jadwal akademik dimulai.", "Sistem disiplin mencatat waktu pengerjaanmu.", "Laporan waktu dari {teacher} telah diterima.", "Alarm ketepatan waktu aktif untuk {subject}.", "Jadwal harian meminta pembaruan progres.", "Pusat kendali deadline memanggilmu.", "Waktu adalah sumber daya yang terus berjalan.", "Pemeriksaan target belajar: saatnya evaluasi.", "{teacher} mengingatkan pentingnya konsistensi.", "Mode disiplin akademik diaktifkan."],
    b: ["tugas '{title}' perlu masuk ke urutan prioritasmu.", "target '{title}' belum mencapai status tuntas.", "waktu pengerjaan '{title}' perlu dibagi menjadi langkah realistis.", "'{title}' berpotensi menggeser jadwal lain jika terus ditunda.", "progres {subject} perlu diperbarui agar rencanamu terkendali."]
  },
  friendly: {
    a: ["Hai! Ada pengingat kecil dari {teacher}.", "Halo, semoga harimu menyenangkan!", "🌻 Semangat belajar, waktunya cek tugas.", "{teacher} mengirim dukungan untukmu.", "Hei, jangan lupa luangkan waktu untuk tugasmu.", "Satu pengingat ramah untuk hari ini.", "Kamu sudah berusaha, sekarang lanjutkan sedikit lagi.", "Salam semangat dari kelas {subject}!", "Yuk, cek kembali daftar tugasmu.", "Kamu bisa menyelesaikannya bertahap."],
    b: ["'{title}' masih menunggu progres berikutnya.", "sedikit waktu untuk {subject} hari ini akan membantu.", "kamu bisa membagi '{title}' menjadi bagian kecil.", "jangan lupa sisakan waktu untuk meninjau '{title}'.", "{teacher} ingin melihat usahamu berkembang, bukan harus sempurna sekaligus."]
  },
  vocational: {
    a: ["🧰 Panggilan dari ruang praktik akademik!", "Pemeriksaan SOP tugas {subject} dimulai.", "Tim kendali mutu mengingatkanmu.", "Laporan pekerjaan dari {teacher} telah masuk.", "Mode proyek aktif: cek daftar pekerjaanmu.", "Perhatian, teknisi tugas sedang dibutuhkan!", "Checklist kompetensi perlu diperbarui.", "Ruang kerja akademik mengirim notifikasi.", "Jadwal produksi tugas hari ini dimulai.", "Quality control tugas memanggil operatornya."],
    b: ["hasil kerja '{title}' masih perlu diperiksa dan diselesaikan.", "laporan '{title}' belum melewati pemeriksaan akhir.", "proses '{title}' perlu mengikuti rencana yang dibuat.", "komponen tugas {subject} masih menunggu penyelesaian.", "'{title}' perlu dituntaskan agar target belajarmu tercapai."]
  },
  silentkiller: {
    a: ["...Ada pengingat singkat dari {teacher}.", "Notifikasi tenang, tetapi penting.", "{teacher} mengirim satu catatan kecil.", "Status akademikmu mendapat pembaruan.", "Tidak banyak kata, hanya pengingat deadline.", "Sistem mencatat satu tugas yang perlu perhatian.", "Sebuah pengingat muncul di sela kesibukanmu.", "Cek kembali daftar tugas sebelum hari berakhir.", "Pesan singkat dari pengawas progres belajar.", "🔎 Ada tugas yang perlu kamu tinjau."],
    b: ["'{title}' masih tercatat belum selesai pada mapel {subject}.", "progres '{title}' belum diperbarui di daftar tugasmu.", "deadline '{title}' perlu masuk perhatian hari ini.", "tugas ini lebih aman diselesaikan sebelum waktunya mepet.", "{teacher} berharap kamu konsisten menuntaskan tanggung jawabmu."]
  },
  motivator: {
    a: ["🏆 Panggilan untuk calon juara akademik!", "Setiap progres kecil membawamu lebih dekat ke tujuan.", "{teacher} percaya kamu mampu menyelesaikan tantangan ini.", "Saatnya membuktikan konsistensi, bukan kesempurnaan.", "Semangat juara dimulai dari satu tugas tuntas.", "Tantangan hari ini: selesaikan satu langkah penting.", "Masa depan dibangun dari kebiasaan baik hari ini.", "Ayo nyalakan mode fokusmu!", "Kesempatan berkembang datang dari tugas sehari-hari.", "Kamu sudah sampai sejauh ini—lanjutkan!"],
    b: ["'{title}' adalah kesempatan melatih tanggung jawabmu di {subject}.", "menuntaskan '{title}' akan membuat jadwalmu lebih lega.", "progres '{title}' menunjukkan kamu bergerak menuju target.", "tugas {subject} ini bisa diselesaikan dengan strategi tepat.", "{teacher} menantikan usaha terbaik yang bisa kamu berikan."]
  },
  custom: {
    a: ["📣 Pesan khusus dari {teacher}!", "Pengingat personal untuk tugasmu.", "Ada catatan dari guru {subject}.", "Pesan yang kamu atur sendiri sedang diputar.", "Sistem mengingatkanmu dengan pesan khusus.", "Catatan penting untuk agenda belajarmu.", "Waktunya membaca pengingat personal.", "Satu pesan khusus sebelum deadline tiba.", "Pengingat buatanmu sendiri muncul kembali.", "Jangan lewatkan pesan dari {teacher}."],
    b: ["catatan pengingatnya: '{customText}' terkait tugas '{title}'.", "'{customText}' — jangan lupa meninjau tugas '{title}'.", "pesanmu berbunyi '{customText}' untuk tugas {subject}.", "ingat pesan ini: '{customText}' saat mengerjakan '{title}'.", "'{customText}' menjadi pengingat untuk menyelesaikan '{title}'."]
  }
};
const extraTerrorClosers = ["Ayo mulai sekarang!", "Satu langkah kecil lebih baik daripada panik nanti.", "Buka catatanmu dan tuntaskan misinya!", "Atur waktumu dan mulai sesuai rencana.", "Semangat, kamu pasti bisa menyelesaikannya!"];
const extraTerrorMessages = Object.keys(extraTerrorBank).reduce(function(all, persona) {
  const group = extraTerrorBank[persona];
  all[persona] = [];
  group.a.forEach(function(opener, i) {
    group.b.forEach(function(core, j) {
      all[persona].push(opener + ' ' + core + ' ' + extraTerrorClosers[(i + j) % extraTerrorClosers.length]);
    });
  });
  return all;
}, {});

function generateTerrorMessage(task) {
  const persona = task.persona || 'killer';
  const bank = extraTerrorMessages[persona] || extraTerrorMessages.killer;
  const message = bank[Math.floor(Math.random() * bank.length)];
  const customVal = (task.customText || '').trim() || ('Ayo segera selesaikan tugas ' + task.subject + ' tepat waktu!');
  return message
    .replace(/\{teacher\}/g, task.teacher || 'Guru')
    .replace(/\{title\}/g, task.title || 'tugasmu')
    .replace(/\{subject\}/g, task.subject || 'mata pelajaran')
    .replace(/\{customText\}/g, customVal);
}

function calculateSlack(task) {
  if (!task || !task.deadline) return 0;
  const deadlineTime = new Date(task.deadline).getTime();
  if (isNaN(deadlineTime)) return 0;
  const dur = parseFloat(task.duration) || 1;
  if (!task.dependsOn) {
    return Math.round(((deadlineTime - Date.now()) / 3600000 - dur) * 10) / 10;
  }
  const parent = tasks.find(function(t) { return t.id === task.dependsOn; });
  if (!parent || !parent.deadline) {
    return Math.round(((deadlineTime - Date.now()) / 3600000 - dur) * 10) / 10;
  }
  return Math.round(((deadlineTime - dur * 3600000 - new Date(parent.deadline).getTime()) / 3600000) * 10) / 10;
}

function getEffectiveWeight(task) {
  const base = parseInt(task && task.gradeWeight, 10) || 1;
  return (isExamMode && base >= 3) ? base * 2 : base;
}

function getGradeLabel(weight) {
  const w = parseInt(weight, 10) || 1;
  if (w === 4) return '🏆 Ujian Praktik / UKK (4x)';
  if (w === 3) return '📕 Project / PKL (3x)';
  if (w === 2) return '📙 Ulangan (2x)';
  return '📘 Tugas Harian (1x)';
}

function getDownstreamTasks(taskId) {
  const affected = [];
  const visited = {};
  visited[taskId] = true;
  function findChildren(parentId) {
    tasks.forEach(function(t) {
      if (t.status === 'active' && t.dependsOn === parentId && !visited[t.id]) {
        visited[t.id] = true;
        affected.push(t);
        findChildren(t.id);
      }
    });
  }
  findChildren(taskId);
  return affected;
}

function updateNotifStatusBadge() {
  const badge = document.getElementById('notifStatusBadge');
  if (!badge) return;
  if (!('Notification' in window)) {
    badge.textContent = '🔴 Browser Tidak Mendukung';
    badge.className = 'slack-pill slack-danger';
  } else if (Notification.permission === 'granted') {
    badge.textContent = '🟢 Notifikasi Pop-up Aktif';
    badge.className = 'slack-pill slack-safe';
  } else if (Notification.permission === 'denied') {
    badge.textContent = '🔴 Diblokir Browser';
    badge.className = 'slack-pill slack-danger';
  } else {
    badge.textContent = '🟡 Belum Diizinkan';
    badge.className = 'slack-pill';
  }
}

function showScreenPopup(task) {
  const banner = document.getElementById('popupTerrorBanner');
  if (!banner) return;
  document.getElementById('popupTeacherTag').textContent = task.teacher + ' • ' + task.subject;
  document.getElementById('popupTaskTitle').textContent = task.title;
  document.getElementById('popupTerrorText').textContent = generateTerrorMessage(task);
  banner.classList.remove('hidden');
}

window.triggerTestPopup = function(taskId) {
  const task = tasks.find(function(t) { return t.id === taskId; });
  if (task) triggerNotifications(task);
};

function triggerNotifications(task) {
  showScreenPopup(task);
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const windowKey = String(task.id) + ':' + Math.floor(Date.now() / 1800000);
  if (notifiedTaskWindows.has(windowKey)) return;
  notifiedTaskWindows.add(windowKey);
  const title = '🚨 DOMIFECT: ' + task.teacher.toUpperCase() + ' (' + task.subject + ')';
  const body = generateTerrorMessage(task);
  // Use the service worker notification API where available; it works better with an installed PWA.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(reg => reg.showNotification(title, {body, icon:'./icon-192.png', badge:'./icon-192.png', tag:'task-' + task.id, renotify:false, data:{url:'./index.html'}})).catch(() => {});
  } else {
    try { new Notification(title, {body}); } catch (e) {}
  }
}

function requestNotificationPermission() {
  if (!('Notification' in window)) { showToast('Browser ini belum mendukung notifikasi.'); return; }
  if (!window.isSecureContext) { showToast('Notifikasi memerlukan HTTPS. Buka DOMIFECT dari GitHub Pages.'); return; }
  Notification.requestPermission().then(function(p) {
    updateNotifStatusBadge();
    showToast(p === 'granted' ? '✅ Izin notifikasi aktif. Pengingat berjalan saat DOMIFECT terbuka.' : '⚠️ Izin notifikasi belum diberikan');
  }).catch(() => showToast('Tidak dapat meminta izin notifikasi.'));
}

function startWatchdog() {
  setInterval(function() {
    const now = Date.now();
    tasks.forEach(function(t) {
      if (t.status === 'active') {
        const targetTime = t.workSchedule ? new Date(t.workSchedule).getTime() : new Date(t.deadline).getTime();
        const diffHours = (targetTime - now) / 3600000;
        if (diffHours <= 0.5 && diffHours > -0.1) triggerNotifications(t);
      }
    });
  }, 45000);
}

function triggerPanicMode() {
  const active = tasks.filter(function(t) { return t.status === 'active'; });
  const panicBox = document.getElementById('panicBox');
  const panicContent = document.getElementById('panicContent');
  if (!panicBox || !panicContent) return;

  if (active.length === 0) {
    panicBox.classList.remove('hidden');
    panicContent.innerHTML = '<p class="hint">Tidak ada tugas aktif saat ini. Jadwalmu aman terkendali!</p>';
    lastPanicTextWA = 'Jadwal DOMIFECT aman terkendali!';
    return;
  }

  const sorted = active.slice().sort(function(a, b) {
    return (calculateSlack(a) / getEffectiveWeight(a)) - (calculateSlack(b) / getEffectiveWeight(b));
  });
  let planHtml = '<ol style="padding-left:20px; display:flex; flex-direction:column; gap:10px;">';
  const waLines = ['🚨 *RENCANA DARURAT KILAT DOMIFECT* 🚨', ''];

  sorted.forEach(function(t, idx) {
    const slack = calculateSlack(t);
    const mins = Math.round((parseFloat(t.duration) || 1) * 60);
    const statusText = slack <= 0 ? 'KRITIS — KERJAKAN SEKARANG!' : 'Sisa cadangan ' + slack + ' jam';
    planHtml += '<li><strong>[Langkah ' + (idx + 1) + '] ' + t.title + ' (' + t.subject + ' - ' + t.teacher + ')</strong><br/><small>' + getGradeLabel(t.gradeWeight) + ' • Alokasi: <strong>' + mins + ' menit</strong> • <span style="color:var(--danger);">' + statusText + '</span></small></li>';
    waLines.push((idx + 1) + '. *' + t.title + '* (' + t.subject + ') | ' + mins + ' menit | ' + statusText);
  });
  planHtml += '</ol>';
  lastPanicTextWA = waLines.join('\n');
  panicBox.classList.remove('hidden');
  panicContent.innerHTML = planHtml;
  showToast('🚨 Rencana Darurat Kilat disusun!');
}

window.focusOnTask = function(taskId) {
  const t = tasks.find(function(item) { return item.id === taskId; });
  const targetLabel = document.getElementById('focusTaskTargetLabel');
  if (targetLabel && t) targetLabel.textContent = '🎯 Sedang Fokus: "' + t.title + '" (' + t.subject + ')';
  const mins = t ? Math.min(180, Math.max(5, Math.round((parseFloat(t.duration) || 1) * 60))) : 25;
  navigateTo('focus');
  startCustomFocus(mins);
};

function startCustomFocus(minutes) {
  clearInterval(focusTimerInterval);
  const inputEl = document.getElementById('customTimerInput');
  if (inputEl) inputEl.value = minutes;
  focusSecondsRemaining = minutes * 60;
  updateTimerDisplay();
  isFocusRunning = true;
  focusTimerInterval = setInterval(function() {
    if (focusSecondsRemaining > 0) {
      focusSecondsRemaining--;
      updateTimerDisplay();
    } else {
      clearInterval(focusTimerInterval);
      isFocusRunning = false;
      alert('⏱️ Waktu sesi fokus selesai!');
    }
  }, 1000);
}

function handleStartTimer() {
  if (!isFocusRunning) {
    const inputVal = document.getElementById('customTimerInput') ? document.getElementById('customTimerInput').value : 25;
    const mins = Math.max(1, Math.min(180, parseInt(inputVal, 10) || 25));
    if (focusSecondsRemaining <= 0) focusSecondsRemaining = mins * 60;
    isFocusRunning = true;
    showToast('▶️ Timer fokus berjalan!');
    focusTimerInterval = setInterval(function() {
      if (focusSecondsRemaining > 0) {
        focusSecondsRemaining--;
        updateTimerDisplay();
      } else {
        clearInterval(focusTimerInterval);
        isFocusRunning = false;
        alert('⏱️ Waktu sesi fokus selesai!');
      }
    }, 1000);
  }
}

function updateTimerDisplay() {
  const m = Math.floor(focusSecondsRemaining / 60);
  const s = focusSecondsRemaining % 60;
  const disp = document.getElementById('timerDisplay');
  if (disp) disp.textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function resetTaskForm() {
  const form = document.getElementById('taskForm');
  if (form) form.reset();
  const editId = document.getElementById('editTaskId');
  if (editId) editId.value = '';
  const formTitle = document.getElementById('formModeTitle');
  if (formTitle) formTitle.textContent = '➕ Buat Tugas & Karakter Guru';
  const btnSub = document.getElementById('btnSubmitTask');
  if (btnSub) btnSub.textContent = '💾 Simpan Tugas & Aktifkan Teror';
  const btnCancel = document.getElementById('btnCancelEdit');
  if (btnCancel) btnCancel.classList.add('hidden');
  const custGroup = document.getElementById('customPersonaGroup');
  if (custGroup) custGroup.classList.add('hidden');
  setDefaultTaskDates();
}

function renderAll() {
  renderDropdowns();
  renderDashboard();
  renderAssignments();
  renderSimulator();
  renderScheduleAndGear();
  renderAlerts();
  renderStats();
}

function renderDropdowns() {
  const active = tasks.filter(function(t) { return t.status === 'active'; });
  const dep = document.getElementById('tDependsOn');
  const sim = document.getElementById('simTaskSelect');
  const nego = document.getElementById('negoTaskSelect');
  const quickSch = document.getElementById('tQuickSchedule');

  if (dep) {
    const prev = dep.value;
    dep.innerHTML = '<option value="">-- Tugas Mandiri --</option>' + active.map(function(t) {
      return '<option value="' + t.id + '">' + t.title + ' (' + t.subject + ')</option>';
    }).join('');
    if (prev) dep.value = prev;
  }
  if (sim) {
    const prev = sim.value;
    sim.innerHTML = active.length ? active.map(function(t) {
      return '<option value="' + t.id + '">' + t.title + ' — ' + t.teacher + '</option>';
    }).join('') : '<option value="">-- Belum ada tugas --</option>';
    if (prev && active.some(function(t) { return t.id === prev; })) sim.value = prev;
  }
  if (nego) {
    const prev = nego.value;
    nego.innerHTML = active.length ? active.map(function(t) {
      return '<option value="' + t.id + '">' + t.title + ' (' + t.teacher + ')</option>';
    }).join('') : '<option value="">-- Belum ada tugas --</option>';
    if (prev && active.some(function(t) { return t.id === prev; })) nego.value = prev;
  }
  if (quickSch) {
    quickSch.innerHTML = '<option value="">-- Pilih Mapel dari Jadwal Tersimpan --</option>' + sortSchedulesByDay(schedules).map(function(s) {
      return '<option value="' + s.id + '">[' + s.day + '] ' + s.subject + ' — ' + s.teacher + '</option>';
    }).join('');
  }
}

function renderDashboard() {
  const active = tasks.filter(function(t) { return t.status === 'active'; });
  const navCount = document.getElementById('navTaskCount');
  if (navCount) navCount.textContent = active.length;
  const streakEl = document.getElementById('streakBadge');
  if (streakEl) streakEl.textContent = '🔥 Streak: ' + stats.streak + ' Tepat Waktu';

  const critical = active.filter(function(t) { return calculateSlack(t) <= 0; });
  const totalWorkHours = active.reduce(function(sum, t) { return sum + (parseFloat(t.duration) || 0); }, 0);
  const mentalLoadPercent = Math.min(100, Math.round((totalWorkHours / ((userProfile.targetHours || 3) * 2)) * 100));
  const greeting = userProfile.name ? 'Halo, ' + userProfile.name + '! ' : '';

  const scoreEl = document.getElementById('stabilityScore');
  const descEl = document.getElementById('stabilityDesc');
  if (scoreEl && descEl) {
    if (active.length === 0) {
      scoreEl.textContent = '100% — Jadwal Stabil | Beban Mental: 0%';
      descEl.textContent = greeting + 'Belum ada tugas terdaftar. Tekan "+ Tugas" untuk mulai mengatur jadwal.';
    } else if (critical.length > 0) {
      scoreEl.textContent = '⚠️ Jalur Kritis (' + critical.length + ' Tugas) | Beban Mental: ' + mentalLoadPercent + '%';
      descEl.textContent = greeting + 'Waspada efek domino! Gunakan Panic Button untuk urutan penyelamatan nilai.';
    } else {
      scoreEl.textContent = '✅ Jadwal Aman | Beban Mental: ' + mentalLoadPercent + '%';
      descEl.textContent = greeting + 'Total estimasi kerja: ' + totalWorkHours + ' jam.';
    }
  }

  const tomorrowBox = document.getElementById('tomorrowGearAlert');
  if (tomorrowBox) {
    const tomorrowIdx = (new Date().getDay() + 1) % 7;
    const tomorrowName = DAY_NAMES_BY_INDEX[tomorrowIdx];
    const tomorrowSubjects = schedules.filter(function(s) { return s.day === tomorrowName; });
    const uncheckedGears = gears.filter(function(g) { return !g.checked; });
    if (tomorrowSubjects.length > 0 || uncheckedGears.length > 0) {
      tomorrowBox.classList.remove('hidden');
      document.getElementById('tomorrowDayLabel').textContent = tomorrowName;
      document.getElementById('tomorrowScheduleHint').textContent = tomorrowSubjects.length
        ? 'Jadwal ' + tomorrowName + ': ' + tomorrowSubjects.map(function(s) { return s.subject; }).join(', ')
        : 'Tidak ada jadwal kelas tercatat untuk hari ' + tomorrowName + '.';
      document.getElementById('tomorrowGearSummary').innerHTML = uncheckedGears.length
        ? '<small style="color:var(--warning);">Belum siap (' + uncheckedGears.length + '): ' + uncheckedGears.map(function(g) { return g.text; }).join(', ') + '</small>'
        : '<small style="color:var(--success);">✓ Semua perlengkapan besok sudah siap!</small>';
    } else {
      tomorrowBox.classList.add('hidden');
    }
  }

  const priorityList = document.getElementById('todayActionList');
  if (priorityList) {
    const sorted = active.slice().sort(function(a, b) {
      return (calculateSlack(a) / getEffectiveWeight(a)) - (calculateSlack(b) / getEffectiveWeight(b));
    });
    priorityList.innerHTML = sorted.slice(0, 5).map(function(t, i) {
      const slack = calculateSlack(t);
      return '<div class="alert-card ' + (slack <= 0 ? 'urgent' : '') + '" style="display:flex; justify-content:space-between; align-items:center; gap:8px;">' +
        '<div><strong>#' + (i + 1) + ' ' + t.title + ' (' + t.subject + ')</strong><p class="hint">' + getGradeLabel(t.gradeWeight) + ' • Slack: ' + slack + ' jam</p></div>' +
        '<button type="button" class="btn btn-sm btn-primary" onclick="focusOnTask(\'' + t.id + '\')">⏱️ Fokus</button>' +
      '</div>';
    }).join('') || '<p class="hint">Belum ada daftar prioritas tugas.</p>';
  }
}

function renderAssignments() {
  const active = tasks.filter(function(t) { return t.status === 'active'; });
  const totalLabel = document.getElementById('totalTasksLabel');
  const archLabel = document.getElementById('archiveCountLabel');
  if (totalLabel) totalLabel.textContent = active.length;
  if (archLabel) archLabel.textContent = archivedTasks.length;
  const container = document.getElementById('assignmentsList');
  if (!container) return;

  if (currentTaskFilter === 'archive') {
    container.innerHTML = archivedTasks.map(function(t) {
      return '<div class="task-item" style="opacity:0.85;">' +
        '<div style="display:flex; justify-content:space-between;"><span class="subject-pill">' + t.subject + '</span><span class="slack-pill slack-safe">✓ Selesai</span></div>' +
        '<h4>' + t.title + '</h4>' +
        '<small class="hint">Guru: ' + t.teacher + ' • Selesai: ' + (t.completedAt || '-') + '</small>' +
        '<div style="display:flex; gap:6px; margin-top:8px;">' +
          '<button type="button" class="btn btn-sm btn-secondary" style="flex:1;" onclick="restoreArchivedTask(\'' + t.id + '\')">↩️ Aktifkan Lagi</button>' +
          '<button type="button" class="btn btn-sm btn-danger" onclick="deleteArchivedTask(\'' + t.id + '\')">🗑️</button>' +
        '</div>' +
      '</div>';
    }).join('') || '<p class="hint">Belum ada riwayat tugas selesai.</p>';
    return;
  }

  let filtered = active;
  if (currentTaskFilter === 'critical') {
    filtered = active.filter(function(t) { return calculateSlack(t) <= 0; });
  } else if (currentTaskFilter === 'today') {
    const todayStr = new Date().toISOString().slice(0, 10);
    filtered = active.filter(function(t) { return (t.deadline || '').indexOf(todayStr) === 0; });
  }

  container.innerHTML = filtered.map(function(t) {
    const slack = calculateSlack(t);
    const parent = t.dependsOn ? tasks.find(function(p) { return p.id === t.dependsOn; }) : null;
    const subs = Array.isArray(t.subTasks) ? t.subTasks : [];
    const doneCount = subs.filter(function(s) { return s.done; }).length;
    const pct = subs.length ? Math.round((doneCount / subs.length) * 100) : 0;

    const subHtml = subs.length ? (
      '<div class="progress-wrap"><div class="progress-fill" style="width:' + pct + '%"></div></div>' +
      '<div style="margin-bottom:4px;">' +
        subs.map(function(st, sIdx) {
          return '<label class="subtask-row ' + (st.done ? 'done' : '') + '">' +
            '<input type="checkbox" ' + (st.done ? 'checked' : '') + ' onchange="toggleSubTask(\'' + t.id + '\', ' + sIdx + ')" />' +
            '<span>' + st.text + '</span>' +
          '</label>';
        }).join('') +
      '</div>'
    ) : '';

    return '<div class="task-item">' +
      '<div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:4px;">' +
        '<span class="subject-pill">' + t.subject + '</span>' +
        '<span class="grade-pill">' + getGradeLabel(t.gradeWeight) + '</span>' +
        '<span class="slack-pill ' + (slack <= 0 ? 'slack-danger' : 'slack-safe') + '">Slack: ' + slack + 'j</span>' +
      '</div>' +
      '<h4>' + t.title + '</h4>' +
      '<small class="hint">Guru: ' + t.teacher + '</small>' +
      '<small class="hint">Deadline: ' + (t.deadline || '').replace('T', ' ') + '</small>' +
      (parent ? '<small class="hint">⛓️ Bergantung pada: ' + parent.title + '</small>' : '') +
      (t.groupMembers ? '<small class="hint">👥 Kelompok: ' + t.groupMembers + '</small>' : '') +
      subHtml +
      '<div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:8px;">' +
        '<button type="button" class="btn btn-sm btn-primary" style="flex:1;" onclick="completeTask(\'' + t.id + '\')">✓ Selesai</button>' +
        '<button type="button" class="btn btn-sm btn-warning" onclick="focusOnTask(\'' + t.id + '\')">⏱️</button>' +
        '<button type="button" class="btn btn-sm btn-secondary" onclick="editTask(\'' + t.id + '\')">✏️</button>' +
        '<button type="button" class="btn btn-sm btn-danger" onclick="deleteTask(\'' + t.id + '\')">🗑️</button>' +
      '</div>' +
    '</div>';
  }).join('') || '<p class="hint">Tidak ada tugas pada kategori ini.</p>';
}

window.toggleSubTask = function(taskId, subIdx) {
  const t = tasks.find(function(item) { return item.id === taskId; });
  if (t && Array.isArray(t.subTasks) && t.subTasks[subIdx]) {
    t.subTasks[subIdx].done = !t.subTasks[subIdx].done;
    saveTasks();
    renderAssignments();
  }
};

window.editTask = function(id) {
  const t = tasks.find(function(item) { return item.id === id; });
  if (!t) return;
  navigateTo('create-task');
  document.getElementById('editTaskId').value = t.id;
  document.getElementById('tTitle').value = t.title;
  document.getElementById('tSubject').value = t.subject;
  document.getElementById('tTeacher').value = t.teacher;
  document.getElementById('tGradeWeight').value = t.gradeWeight || '1';
  document.getElementById('tPersona').value = t.persona || 'killer';
  window.uiOnPersonaChange(t.persona || 'killer');
  document.getElementById('tCustomText').value = t.customText || '';
  document.getElementById('tWorkSchedule').value = t.workSchedule || '';
  document.getElementById('tDeadline').value = t.deadline || '';
  document.getElementById('tDuration').value = t.duration || 2;
  document.getElementById('tDependsOn').value = t.dependsOn || '';
  document.getElementById('tSubTasks').value = Array.isArray(t.subTasks) ? t.subTasks.map(function(s) { return s.text; }).join(', ') : '';
  document.getElementById('tGroupMembers').value = t.groupMembers || '';
  document.getElementById('formModeTitle').textContent = '✏️ Edit Tugas';
  document.getElementById('btnSubmitTask').textContent = '💾 Simpan Perubahan';
  document.getElementById('btnCancelEdit').classList.remove('hidden');
};

window.completeTask = function(id) {
  const t = tasks.find(function(item) { return item.id === id; });
  if (t) {
    if (Date.now() > new Date(t.deadline).getTime()) {
      stats.late++;
      stats.streak = 0;
    } else {
      stats.onTime++;
      stats.streak++;
    }
    saveStats();
    archivedTasks.unshift(Object.assign({}, t, { status: 'completed', completedAt: new Date().toLocaleString('id-ID') }));
    saveArchive();
  }
  tasks = tasks.filter(function(item) { return item.id !== id; });
  saveTasks();
  renderAll();
  showToast('🎉 Tugas selesai!');
};

window.restoreArchivedTask = function(id) {
  const t = archivedTasks.find(function(item) { return item.id === id; });
  if (t) {
    tasks.push(Object.assign({}, t, { status: 'active' }));
    archivedTasks = archivedTasks.filter(function(item) { return item.id !== id; });
    saveTasks();
    saveArchive();
    renderAll();
  }
};
window.deleteArchivedTask = function(id) {
  archivedTasks = archivedTasks.filter(function(item) { return item.id !== id; });
  saveArchive();
  renderAll();
};
window.deleteTask = function(id) {
  tasks = tasks.filter(function(item) { return item.id !== id; });
  saveTasks();
  renderAll();
  showToast('🗑️ Tugas dihapus');
};

window.renderSimulator = function() {
  const simSelect = document.getElementById('simTaskSelect');
  const simSlider = document.getElementById('simDelaySlider');
  const delayLabel = document.getElementById('simDelayLabel');
  const box = document.getElementById('simConclusionBox');
  if (!box) return;

  const id = simSelect ? simSelect.value : '';
  const delay = simSlider ? (parseInt(simSlider.value, 10) || 0) : 0;
  if (delayLabel) delayLabel.textContent = '+' + delay + ' Jam';

  const selectedTask = tasks.find(function(t) { return t.id === id; });
  if (!selectedTask) {
    box.innerHTML = '<p class="hint">Tambahkan tugas terlebih dahulu untuk menjalankan simulasi domino.</p>';
    return;
  }

  const downstream = getDownstreamTasks(id);
  const slack = calculateSlack(selectedTask);
  const over = Math.round((delay - slack) * 10) / 10;

  if (delay === 0) {
    box.innerHTML = '<div class="alert-card">✅ <strong>Normal (+0 Jam):</strong> "' + selectedTask.title + '" aman dengan sisa cadangan ' + slack + ' jam.</div>';
    return;
  }

  let html = over > 0
    ? '<div class="alert-card urgent">⚠️ <strong>Melewati Deadline:</strong> Menunda +' + delay + ' jam membuat "' + selectedTask.title + '" telat ' + over + ' jam!<p class="alert-msg">"' + generateTerrorMessage(selectedTask) + '"</p></div>'
    : '<div class="alert-card">⏳ <strong>Cadangan Menipis:</strong> Sisa waktu aman tinggal ' + (Math.round((slack - delay) * 10) / 10) + ' jam.</div>';

  if (downstream.length > 0) {
    html += '<div class="alert-card urgent" style="margin-top:10px;">🚨 <strong>EFEK DOMINO (' + downstream.length + ' Tugas Terdampak):</strong><ul style="padding-left:18px; margin-top:6px;">' +
      downstream.map(function(d) { return '<li>' + d.title + ' (' + d.subject + ')</li>'; }).join('') +
      '</ul></div>';
  }
  box.innerHTML = html;
};

function renderScheduleAndGear() {
  const schList = document.getElementById('scheduleList');
  if (schList) {
    const sortedSch = sortSchedulesByDay(schedules);
    schList.innerHTML = sortedSch.length === 0 ? '<p class="hint">Belum ada jadwal tersimpan.</p>' : DAYS_LIST.map(function(day) {
      const items = sortedSch.filter(function(s) { return s.day === day; });
      if (!items.length) return '';
      return '<div style="margin-bottom:10px;"><strong style="color:var(--primary); font-size:0.82rem;">📌 ' + day + '</strong>' +
        items.map(function(s) {
          return '<div class="alert-card" style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;"><div><strong>' + s.subject + '</strong><p class="hint">' + s.teacher + '</p></div><button type="button" class="btn btn-sm btn-danger" onclick="deleteSchedule(\'' + s.id + '\')">✕</button></div>';
        }).join('') +
      '</div>';
    }).join('');
  }

  const gearList = document.getElementById('gearList');
  if (gearList) {
    gearList.innerHTML = gears.map(function(g) {
      return '<div class="alert-card" style="display:flex; justify-content:space-between; align-items:center;">' +
        '<label class="subtask-row ' + (g.checked ? 'done' : '') + '" style="flex:1;"><input type="checkbox" ' + (g.checked ? 'checked' : '') + ' onchange="toggleGear(\'' + g.id + '\')" /><span>' + g.text + '</span></label>' +
        '<button type="button" class="btn btn-sm btn-danger" onclick="deleteGear(\'' + g.id + '\')">✕</button>' +
      '</div>';
    }).join('') || '<p class="hint">Belum ada daftar perlengkapan.</p>';
  }
}

window.deleteSchedule = function(id) { schedules = schedules.filter(function(s) { return s.id !== id; }); saveSchedules(); renderAll(); };
window.toggleGear = function(id) { const g = gears.find(function(item) { return item.id === id; }); if (g) { g.checked = !g.checked; saveGears(); renderAll(); } };
window.deleteGear = function(id) { gears = gears.filter(function(g) { return g.id !== id; }); saveGears(); renderAll(); };

function renderAlerts() {
  const active = tasks.filter(function(t) { return t.status === 'active'; });
  const badge = document.getElementById('alertCountBadge');
  if (badge) badge.textContent = active.length;
  updateNotifStatusBadge();
  const listEl = document.getElementById('fullAlertsList');
  if (listEl) {
    listEl.innerHTML = active.map(function(t) {
      return '<div class="alert-card">' +
        '<strong>🚨 ' + t.teacher + ' (' + t.subject + ') — ' + t.title + '</strong>' +
        '<p class="alert-msg">' + generateTerrorMessage(t) + '</p>' +
        '<button type="button" class="btn btn-sm btn-warning btn-block" onclick="triggerTestPopup(\'' + t.id + '\')" style="margin-top:8px;">🔔 Tes Pop-up Teror Guru</button>' +
      '</div>';
    }).join('') || '<p class="hint">Belum ada teror aktif.</p>';
  }
}

function renderStats() {
  const onTimeEl = document.getElementById('statOnTime');
  const lateEl = document.getElementById('statLate');
  const streakEl = document.getElementById('statStreak');
  if (onTimeEl) onTimeEl.textContent = stats.onTime || 0;
  if (lateEl) lateEl.textContent = stats.late || 0;
  if (streakEl) streakEl.textContent = (stats.streak || 0) + ' 🔥';
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
