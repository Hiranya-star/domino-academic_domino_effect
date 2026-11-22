/* ==========================================================================
   DOMIFECT v5 — Academic & Vocational Domino Effect Planner
   Full 15-Feature Logic Engine (Bulletproof Save, Alert, Simulator & Panic)
   ========================================================================== */

const TASKS_KEY = 'domifect_tasks_v5';
const PROFILE_KEY = 'domifect_profile_v5';
const SCHEDULE_KEY = 'domifect_schedule_v5';
const GEAR_KEY = 'domifect_gear_v5';
const STATS_KEY = 'domifect_stats_v5';
const ALARM_MODE_KEY = 'domifect_alarm_mode_v5';

const DAYS_LIST = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const DAY_ORDER = {
  'Senin': 1,
  'Selasa': 2,
  'Rabu': 3,
  'Kamis': 4,
  'Jumat': 5,
  'Sabtu': 6
};

let tasks = [];
let schedules = [];
let gears = [];
let stats = { onTime: 0, late: 0, streak: 0 };
let userProfile = { name: '', className: '', school: '', targetHours: 3 };
let swRegistration = null;

let focusTimerInterval = null;
let focusSecondsRemaining = 25 * 60;
let isFocusRunning = false;

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  await registerServiceWorker();
  loadAllData();
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
    } catch (e) {
      console.log('SW Error:', e);
    }
  }
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
  } catch (e) { console.log('Profile load error:', e); }

  try {
    const rawTasks = localStorage.getItem(TASKS_KEY);
    const parsed = rawTasks ? JSON.parse(rawTasks) : [];
    tasks = Array.isArray(parsed) ? parsed : [];
  } catch (e) { tasks = []; }

  try {
    const rawSched = localStorage.getItem(SCHEDULE_KEY);
    const parsed = rawSched ? JSON.parse(rawSched) : [];
    schedules = Array.isArray(parsed) ? sortSchedulesByDay(parsed) : [];
  } catch (e) { schedules = []; }

  try {
    const rawGear = localStorage.getItem(GEAR_KEY);
    const parsed = rawGear ? JSON.parse(rawGear) : [];
    gears = Array.isArray(parsed) ? parsed : [];
  } catch (e) { gears = []; }

  try {
    const rawStats = localStorage.getItem(STATS_KEY);
    if (rawStats) stats = JSON.parse(rawStats);
  } catch (e) { stats = { onTime: 0, late: 0, streak: 0 }; }
}

function saveTasks() {
  try {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  } catch (e) {
    console.error('Failed to save tasks:', e);
  }
}

function saveSchedules() {
  try {
    schedules = sortSchedulesByDay(schedules);
    localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedules));
  } catch (e) {
    console.error('Failed to save schedules:', e);
  }
}

function saveGears() { localStorage.setItem(GEAR_KEY, JSON.stringify(gears)); }
function saveStats() { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); }

function sortSchedulesByDay(list) {
  return [...list].sort((a, b) => {
    const dayA = DAY_ORDER[a.day] || 99;
    const dayB = DAY_ORDER[b.day] || 99;
    if (dayA !== dayB) return dayA - dayB;
    return (a.subject || '').localeCompare(b.subject || '');
  });
}

function updateStudentTags() {
  const tagText = userProfile.name
    ? `${userProfile.name}${userProfile.className ? ' • ' + userProfile.className : ''}`
    : 'Planner SMA & SMK';
  const sideTag = document.getElementById('sidebarStudentTag');
  const mobTag = document.getElementById('mobileStudentTag');
  if (sideTag) sideTag.textContent = tagText;
  if (mobTag) mobTag.textContent = userProfile.name ? tagText : 'SMA & SMK';
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
  updateStudentTags();
  alert('✅ Profil siswa berhasil disimpan!');
  renderAll();
}

let deferredPrompt = null;
function setupPWAInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('installBanner')?.classList.remove('hidden');
  });
  document.getElementById('btnInstallApp')?.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') document.getElementById('installBanner')?.classList.add('hidden');
      deferredPrompt = null;
    }
  });
  document.getElementById('btnCloseInstall')?.addEventListener('click', () => {
    document.getElementById('installBanner')?.classList.add('hidden');
  });
}

// =========================================================================
// MESIN BANK KALIMAT TEROR GURU (500+ VARIASI KOMBINASI DINAMIS PER KARAKTER)
// =========================================================================
const terrorMatrix = {
  killer: {
    openers: [
      "Perhatian penuh untukmu!",
      "Peringatan keras dari ${t.teacher}!",
      "Jangan berani main-main hari ini!",
      "Kesabaran ${t.teacher} sudah di batas akhir!",
      "Buku rekap nilai sudah terbuka lebar!",
      "Awas, nama kamu sedang disorot tajam!",
      "Jangan pura-pura lupa kewajibanmu!",
      "Detik ini juga, perhatikan peringatan ini!"
    ],
    cores: [
      "Tugas '${t.title}' mapel ${t.subject} masih kosong melompong tanpa progres.",
      "${t.teacher} tidak menerima alasan klasik apa pun untuk keterlambatan '${t.title}'.",
      "Nilai rapor ${t.subject}-mu berada di ujung tanduk karena mengabaikan '${t.title}'.",
      "Semua temanmu sudah bergerak, tapi tugas '${t.title}' milikmu masih terbengkalai.",
      "Mengulur waktu pada tugas '${t.title}' sama saja menantang ketegasan ${t.teacher}.",
      "Laporan '${t.title}' wajib mendarat tepat waktu di meja ${t.teacher}.",
      "Tidak ada toleransi perpanjangan waktu untuk tugas ${t.subject} kali ini.",
      "Kelalaianmu pada '${t.title}' langsung dicatat dalam daftar hitam ${t.teacher}."
    ],
    closers: [
      "Kerjakan sekarang atau terima nilai nol bulat!",
      "Siapkan mentalmu besok pagi jika masih kosong!",
      "Buka buku dan laptopmu detik ini juga!",
      "Jangan menyesal saat daftar nilai dibagikan!",
      "Selesaikan tuntas sebelum semuanya terlambat!",
      "Tutup gangguan di HP-mu dan mulai bekerja sekarang!",
      "Tidak ada remidi gratis untuk yang malas bergerak!",
      "Buktikan kamu bertanggung jawab sebelum deadline!"
    ]
  },
  sarcastic: {
    openers: [
      "Wah, luar biasa sekali santainya...",
      "Selamat menikmati waktu rebahanmu ya...",
      "Hebat banget manajemen waktumu...",
      "Lanjutkan terus scroll media sosialnya...",
      "Tenang saja, tidak usah buru-buru kok...",
      "Kagum sekali melihat ketenanganmu...",
      "Asyik ya menunda pekerjaan terus...",
      "Sepertinya kamu sangat percaya diri..."
    ],
    cores: [
      "Tugas '${t.title}' dari ${t.teacher} pasti bisa selesai sendiri lewat kekuatan pikiran.",
      "${t.teacher} sudah menyiapkan formulir remidi edisi spesial khusus untuk nilai ${t.subject}-mu.",
      "Kamu menelantarkan '${t.title}' seolah-olah nilai ${t.subject} tidak berpengaruh pada kelulusan.",
      "Pasti seru ya menjelaskan ke ${t.teacher} kenapa '${t.title}' belum dikerjakan sama sekali.",
      "Deadline '${t.title}' semakin dekat, tapi kamu masih sibuk mencari alasan baru.",
      "${t.teacher} pasti terharu melihat betapa setianya kamu menunda tugas ${t.subject}.",
      "Jangan kaget kalau namamu dipanggil paling pertama oleh ${t.teacher} di depan kelas.",
      "Hebat, tugas '${t.title}' berhasil kamu jadikan pajangan jadwal semata."
    ],
    closers: [
      "Mau lanjut santai atau mulai kerja sekarang?",
      "Siap-siap jadi bahan sindiran satu kelas besok!",
      "Ayo bangun dari zona nyamanmu sebelum panik!",
      "Jangan nangis kalau nilai akhirnya bikin kaget!",
      "Mulai cicil sekarang sebelum waktu habis!",
      "Coba buka tugasnya sekarang, tidak menggigit kok!",
      "Kurangi drama, perbanyak aksi nyata sekarang!",
      "Tunjukkan kalau kamu masih peduli sama nilaimu!"
    ]
  },
  disciplined: {
    openers: [
      "Alarm kedisiplinan berbunyi!",
      "Waktu berjalan presisi tanpa kompromi!",
      "Evaluasi jadwal harianmu sekarang!",
      "Ketepatan waktu adalah harga mati!",
      "Periksa kembali time-blocking milikmu!",
      "Jangan merusak jadwal yang sudah disusun!",
      "Setiap menit sangat berharga!",
      "Peringatan standar ketepatan waktu!"
    ],
    cores: [
      "${t.teacher} menghitung setiap detik keterlambatan pada pengerjaan '${t.title}'.",
      "Jadwal pengerjaan '${t.title}' (${t.subject}) sudah memasuki zona rawan geser.",
      "Menunda '${t.title}' akan memicu efek domino ke seluruh target belajarmu hari ini.",
      "${t.teacher} menilai kedisiplinanmu dari ketepatan pengumpulan '${t.title}'.",
      "Struktur jadwalmu akan berantakan jika '${t.title}' tidak segera dieksekusi.",
      "Cadangan waktu aman (slack time) untuk tugas ${t.subject} semakin menipis.",
      "Keterlambatan 10 menit saja bisa merusak kualitas hasil '${t.title}'.",
      "Komitmenmu pada jadwal '${t.title}' sedang diuji sekarang."
    ],
    closers: [
      "Eksekusi sesuai jadwal detik ini juga!",
      "Patuhi rencana kerjamu tanpa penundaan!",
      "Jaga stabilitas jadwalmu tetap 100%!",
      "Fokus penuh hingga '${t.title}' selesai!",
      "Jangan biarkan efek domino menjatuhkan tugas lain!",
      "Segera mulai sesi fokusmu sekarang!",
      "Disiplin hari ini menyelamatkanmu dari begadang!",
      "Tuntaskan tepat waktu untuk ${t.teacher}!"
    ]
  },
  friendly: {
    openers: [
      "Halo, semangat ya hari ini!",
      "Sedikit pengingat hangat untukmu...",
      "Jangan lupa jaga performa belajarmu ya...",
      "Yuk luangkan waktu sebentar...",
      "Kamu pasti bisa menyelesaikan ini...",
      "Titip pesan baik dari ${t.teacher}...",
      "Ayo cicil pelan-pelan dari sekarang...",
      "Sayang sekali kalau nilaimu turun..."
    ],
    cores: [
      "${t.teacher} menantikan hasil terbaikmu pada tugas '${t.title}' (${t.subject}).",
      "Jangan sampai tugas '${t.title}' menumpuk dan membuatmu stres di akhir waktu.",
      "${t.teacher} percaya kamu mampu menuntaskan '${t.title}' dengan sangat rapi.",
      "Mengerjakan '${t.title}' lebih awal bikin istirahat malammu jauh lebih tenang.",
      "Sedikit demi sedikit, tugas ${t.subject} dari ${t.teacher} pasti segera rampung.",
      "Jangan biarkan rasa malas sesaat mengalahkan potensi hebatmu di ${t.subject}.",
      "${t.teacher} akan sangat senang melihat kamu mengumpulkan '${t.title}' tepat waktu.",
      "Ayo beri progres nyata pada '${t.title}' hari ini juga."
    ],
    closers: [
      "Yuk mulai kerjakan sekarang, kamu pasti bisa!",
      "Buka catatannya sebentar saja dulu ya!",
      "Semangat, selesaikan satu langkah demi satu langkah!",
      "Buat ${t.teacher} bangga dengan hasil kerjamu!",
      "Jangan menunda lagi ya, ayo bergerak!",
      "Waktumu cukup kalau dimulai detik ini!",
      "Fokus sebentar saja, setelah itu kamu bebas!",
      "Ayo tuntaskan dengan senyum puas!"
    ]
  },
  vocational: {
    openers: [
      "Perhatian standar bengkel & lab!",
      "Peringatan SOP praktik kejuruan!",
      "Instruktur ${t.teacher} memantau progresmu!",
      "Jangan main-main dengan kompetensi kejuruan!",
      "Kesiapan kerja dimulai dari kedisiplinan!",
      "Cek kembali kelengkapan laporan praktikmu!",
      "Alarm produktif kejuruan aktif!",
      "Jangan tertinggal dari rekan satu tim!"
    ],
    cores: [
      "Laporan dan project '${t.title}' pada kompetensi ${t.subject} belum tuntas.",
      "Di dunia industri dan bengkel, keterlambatan '${t.title}' berarti gagal memenuhi SOP.",
      "${t.teacher} mewajibkan seluruh data dan hasil '${t.title}' siap sebelum evaluasi.",
      "Jangan sampai nilai uji kompetensi dan praktik ${t.subject}-mu tertahan karena '${t.title}'.",
      "Alat dan materi sudah tersedia, tapi progres '${t.title}' milikmu masih jalan di tempat.",
      "Project PKL dan laporan kejuruan '${t.title}' tidak bisa dikerjakan sistem kebut semalam.",
      "${t.teacher} akan mengecek langsung ketuntasan '${t.title}' sesuai standar industri.",
      "Kualitas hasil kerja ${t.subject}-mu dipertaruhkan jika '${t.title}' dikerjakan terburu-buru."
    ],
    closers: [
      "Eksekusi sesuai prosedur sekarang juga!",
      "Tuntaskan laporan dan projectmu sebelum jam praktik berakhir!",
      "Buktikan kompetensi kejuruanmu di depan ${t.teacher}!",
      "Jangan sampai namamu dicoret dari daftar siap uji!",
      "Segera selesaikan dengan teliti dan rapi!",
      "Terapkan budaya kerja profesional mulai detik ini!",
      "Pastikan tidak ada langkah kerja yang terlewat!",
      "Selesaikan '${t.title}' sampai tuntas 100%!"
    ]
  },
  silentkiller: {
    openers: [
      "Hening bukan berarti aman...",
      "Tanpa banyak bicara, catatan terus berjalan...",
      "Waspadai ketenangan ${t.teacher}...",
      "Jangan tertipu suasana kelas yang tenang...",
      "Pengamatan diam-diam sedang berlangsung...",
      "Tidak ada teriakan, langsung eksekusi nilai...",
      "Sinyal bahaya tingkat tinggi...",
      "Perhatikan tanda bahaya yang sunyi ini..."
    ],
    cores: [
      "${t.teacher} jarang menegur di depan umum, tapi status '${t.title}' milikmu sudah ditandai.",
      "Tanpa peringatan ulang, nilai ${t.subject} untuk '${t.title}' bisa langsung dikosongkan.",
      "Kamu mengira ${t.teacher} lupa dengan '${t.title}'? Semua tenggat waktu tercatat rapi.",
      "Saat temanmu sibuk menyetor '${t.title}', diam-diam posisimu semakin tertinggal.",
      "${t.teacher} menilai keseriusan siswa dalam diam melalui ketuntasan '${t.title}'.",
      "Tidak akan ada pengumuman panjang jika '${t.title}' lewat dari batas waktu ${t.subject}.",
      "Daftar rekap ${t.teacher} tidak pernah berbohong soal siapa yang belum mengumpulkan '${t.title}'.",
      "Ketenangan ${t.teacher} justru tanda bahwa tidak ada kompromi untuk '${t.title}'."
    ],
    closers: [
      "Segera amankan posisimu sebelum terlambat!",
      "Kumpulkan '${t.title}' sebelum namamu dicoret!",
      "Jangan tunggu teguran karena tidak akan datang!",
      "Bergerak dalam diam dan tuntaskan sekarang!",
      "Pastikan tugasmu sudah masuk sebelum tenggat!",
      "Selamatkan nilai ${t.subject}-mu detik ini juga!",
      "Jangan beri celah sedikit pun untuk nilai kosong!",
      "Selesaikan sekarang sebelum rekap nilai dikunci!"
    ]
  },
  motivator: {
    openers: [
      "Bangkit dan tatap masa depanmu!",
      "Ingat tujuan besarmu melangkah sejauh ini!",
      "Jangan kalah oleh rasa malasmu sendiri!",
      "Mental juara ditempa dari hal-hal kecil!",
      "Kesuksesan tidak datang pada yang suka menunda!",
      "Dengarkan pesan moral dari ${t.teacher}!",
      "Setiap usaha hari ini menentukan hari esok!",
      "Jadilah pribadi yang tangguh dan bertanggung jawab!"
    ],
    cores: [
      "Menyelesaikan '${t.title}' (${t.subject}) adalah latihan nyata menghadapi tantangan hidup.",
      "${t.teacher} memberimu tugas '${t.title}' bukan untuk membebani, tapi melatih mental juaramu.",
      "Bagaimana kamu bisa meraih mimpi besar jika tugas '${t.title}' saja masih kamu tunda?",
      "Orang-orang sukses selalu menuntaskan tanggung jawab seperti '${t.title}' lebih awal.",
      "Jangan sia-siakan pengorbanan orang tuamu hanya karena malas mengerjakan '${t.title}'.",
      "Setiap halaman dan baris pada '${t.title}' adalah investasi kecerdasanmu di ${t.subject}.",
      "${t.teacher} ingin melihatmu tumbuh menjadi lulusan yang berintegritas dan siap bersaing.",
      "Rasa lelah mengerjakan '${t.title}' hanya sementara, tapi kebanggaan hasilnya bertahan lama."
    ],
    closers: [
      "Ambil kendali atas waktumu dan mulai sekarang!",
      "Buktikan kamu adalah pemenang, bukan penunda!",
      "Tuntaskan '${t.title}' dengan kualitas terbaikmu!",
      "Mulai langkah pertamamu detik ini juga!",
      "Jangan berhenti sebelum tugas ini selesai tuntas!",
      "Jadikan hari ini bukti kedewasaan belajarmu!",
      "Fokus, kerjakan, dan raih hasil maksimal!",
      "Masa depan cerah dimulai dari meja belajarmu!"
    ]
  },
  custom: {
    openers: [
      "Peringatan khusus dari ${t.teacher}!",
      "Pesan langsung untukmu!",
      "Ingat kata-kata ${t.teacher}!",
      "Alarm tugas ${t.subject} berbunyi!",
      "Jangan abaikan pesan ini!",
      "Perhatian segera!",
      "Waktunya bergerak!",
      "Pengingat penting!"
    ],
    cores: [
      `"${t.customText}" — Terkait tugas '${t.title}' (${t.subject}).`,
      `${t.teacher} berpesan: "${t.customText}" untuk penyelesaian '${t.title}'.`,
      `Segera selesaikan '${t.title}'! Ingat: "${t.customText}".`,
      `Status '${t.title}' masih aktif. ${t.teacher} mengingatkan: "${t.customText}".`,
      `Jangan sampai '${t.title}' lewat batas waktu! "${t.customText}".`,
      `Mapel ${t.subject} menunggu progresmu: "${t.customText}".`,
      `Pesan tegas ${t.teacher} untuk '${t.title}': "${t.customText}".`,
      `Tuntaskan '${t.title}' sekarang juga! "${t.customText}".`
    ],
    closers: [
      "Segera buka dan kerjakan sekarang!",
      "Jangan menunda lagi!",
      "Tuntaskan sebelum deadline tiba!",
      "Ayo fokus selesaikan!",
      "Pastikan selesai tepat waktu!",
      "Buktikan kamu bisa tuntas!",
      "Jangan sampai kena efek domino!",
      "Mulai kerjakan detik ini!"
    ]
  }
};

function generateTerrorMessage(task) {
  const persona = task.persona || 'killer';
  const group = terrorMatrix[persona] || terrorMatrix.killer;

  const opener = group.openers[Math.floor(Math.random() * group.openers.length)];
  const core = group.cores[Math.floor(Math.random() * group.cores.length)];
  const closer = group.closers[Math.floor(Math.random() * group.closers.length)];

  const customVal = task.customText && task.customText.trim() !== ''
    ? task.customText.trim()
    : `Ayo segera selesaikan tugas ${task.subject} tepat waktu!`;

  const combined = `${opener} ${core} ${closer}`;

  return combined
    .replace(/\$\{t\.teacher\}/g, task.teacher)
    .replace(/\$\{t\.title\}/g, task.title)
    .replace(/\$\{t\.subject\}/g, task.subject)
    .replace(/\$\{t\.customText\}/g, customVal);
}

// =========================================================================
// PERHITUNGAN SLACK TIME, DEPENDENCY & GRADE IMPACT
// =========================================================================
function calculateSlack(task) {
  if (!task || !task.deadline) return 0;
  const deadlineTime = new Date(task.deadline).getTime();
  if (isNaN(deadlineTime)) return 0;
  const dur = parseFloat(task.duration) || 1;

  if (!task.dependsOn) {
    const h = (deadlineTime - Date.now()) / 3600000;
    return Math.round((h - dur) * 10) / 10;
  }
  const parent = tasks.find(t => t.id === task.dependsOn);
  if (!parent || !parent.deadline) {
    const h = (deadlineTime - Date.now()) / 3600000;
    return Math.round((h - dur) * 10) / 10;
  }
  const parentEnd = new Date(parent.deadline).getTime();
  return Math.round(((deadlineTime - dur * 3600000 - parentEnd) / 3600000) * 10) / 10;
}

function getGradeLabel(weight) {
  const w = parseInt(weight) || 1;
  if (w === 4) return '🏆 Ujian Praktik / UKK (4x)';
  if (w === 3) return '📕 Project / PKL (3x)';
  if (w === 2) return '📙 Ulangan (2x)';
  return '📘 Tugas Harian (1x)';
}

function getDownstreamTasks(taskId) {
  let affected = [];
  const visited = new Set([taskId]);

  function findChildren(parentId) {
    tasks.forEach(t => {
      if (t.status === 'active' && t.dependsOn === parentId && !visited.has(t.id)) {
        visited.add(t.id);
        affected.push(t);
        findChildren(t.id);
      }
    });
  }
  findChildren(taskId);
  return affected;
}

// =========================================================================
// NOTIFIKASI SISTEM & POPUP HEADS-UP DI LAYAR
// =========================================================================
function showScreenPopup(task) {
  const banner = document.getElementById('popupTerrorBanner');
  if (!banner) return;
  const terrorMsg = generateTerrorMessage(task);
  document.getElementById('popupTeacherTag').textContent = `${task.teacher} • ${task.subject}`;
  document.getElementById('popupTaskTitle').textContent = task.title;
  document.getElementById('popupTerrorText').textContent = terrorMsg;
  banner.classList.remove('hidden');

  const mode = document.getElementById('alarmModeSelect')?.value || localStorage.getItem(ALARM_MODE_KEY) || 'sound';
  if ('vibrate' in navigator) {
    try {
      if (mode === 'silent') navigator.vibrate([120, 60, 120]);
      else navigator.vibrate([300, 100, 300, 100, 300]);
    } catch (e) {}
  }
}

window.triggerTestPopup = (taskId) => {
  const task = tasks.find(t => t.id === taskId);
  if (task) triggerNotifications(task);
};

async function triggerNotifications(task) {
  // 1. Selalu tampilkan Pop-up Heads-up Banner langsung di layar aplikasi
  showScreenPopup(task);

  const terrorMsg = generateTerrorMessage(task);
  const mode = document.getElementById('alarmModeSelect')?.value || localStorage.getItem(ALARM_MODE_KEY) || 'sound';
  const title = `🚨 DOMIFECT: ${task.teacher.toUpperCase()} (${task.subject})`;
  const options = {
    body: terrorMsg,
    vibrate: mode === 'silent' ? [120, 60, 120] : [300, 100, 300],
    silent: mode === 'silent',
    requireInteraction: true,
    tag: 'domifect-' + task.id
  };

  // 2. Kirim Notifikasi Native HP / Browser
  if ('Notification' in window) {
    let perm = Notification.permission;
    if (perm === 'default') {
      try { perm = await Notification.requestPermission(); } catch (e) {}
    }

    if (perm === 'granted') {
      try {
        const reg = await navigator.serviceWorker?.ready;
        if (reg && reg.showNotification) {
          await reg.showNotification(title, options);
        } else {
          new Notification(title, options);
        }
      } catch (err) {
        try { new Notification(title, options); } catch (e2) {}
      }
    }
  }
}

function startWatchdog() {
  setInterval(() => {
    const now = Date.now();
    tasks.forEach(t => {
      if (t.status === 'active') {
        const targetTime = t.workSchedule ? new Date(t.workSchedule).getTime() : new Date(t.deadline).getTime();
        if (!isNaN(targetTime)) {
          const diffHours = (targetTime - now) / 3600000;
          if (diffHours <= 0.5 && diffHours > -0.1) {
            triggerNotifications(t);
          }
        }
      }
    });
  }, 45000);
}

// =========================================================================
// PANIC BUTTON (RENCANA DARURAT KILAT)
// =========================================================================
let lastPanicTextWA = '';
function triggerPanicMode() {
  const active = tasks.filter(t => t.status === 'active');
  const panicBox = document.getElementById('panicBox');
  const panicContent = document.getElementById('panicContent');

  if (!panicBox || !panicContent) return;

  if (active.length === 0) {
    panicBox.classList.remove('hidden');
    panicContent.innerHTML = '<p class="hint">Tidak ada tugas aktif saat ini. Jadwalmu masih aman terkendali!</p>';
    lastPanicTextWA = 'Jadwal DOMIFECT saat ini aman terkendali!';
    panicBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const sorted = [...active].sort((a, b) => {
    const wA = parseInt(a.gradeWeight) || 1;
    const wB = parseInt(b.gradeWeight) || 1;
    const scoreA = calculateSlack(a) / wA;
    const scoreB = calculateSlack(b) / wB;
    return scoreA - scoreB;
  });

  let planHtml = '<ol style="padding-left: 20px; display: flex; flex-direction: column; gap: 10px;">';
  let waLines = ['🚨 *RENCANA DARURAT KILAT DOMIFECT* 🚨', ''];

  sorted.forEach((t, idx) => {
    const slack = calculateSlack(t);
    const dur = parseFloat(t.duration) || 1;
    const mins = Math.round(dur * 60);
    const statusText = slack <= 0 ? 'KRITIS — KERJAKAN SEKARANG!' : `Sisa cadangan ${slack} jam`;
    planHtml += `
      <li>
        <strong>[Langkah ${idx + 1}] ${t.title} (${t.subject} - ${t.teacher})</strong><br/>
        <small>Bobot: ${getGradeLabel(t.gradeWeight)} • Alokasi Kilat: <strong>${mins} menit</strong> • Status: <span style="color:var(--danger); font-weight:600;">${statusText}</span></small>
      </li>
    `;
    waLines.push(`${idx + 1}. *${t.title}* (${t.subject} - ${t.teacher}) | ${mins} menit | ${statusText}`);
  });
  planHtml += '</ol>';

  lastPanicTextWA = waLines.join('\n');
  panicBox.classList.remove('hidden');
  panicContent.innerHTML = planHtml;
  panicBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// =========================================================================
// NAVIGASI & MODE FOKUS + ANTI-MAGER 5 MENIT
// =========================================================================
const pageTitles = {
  dashboard: 'Dashboard Akademik & Kejuruan',
  assignments: 'Daftar Tugas, Micro-Task & Kelompok',
  simulator: 'Simulasi Efek Domino',
  schedule: 'Jadwal Pelajaran & Perlengkapan',
  alerts: 'Pusat Teror & Chat Negosiasi Guru',
  focus: 'Mode Fokus Pengerjaan Kustom',
  profile: 'Profil Siswa, Statistik & Backup'
};

function navigateTo(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById(`page-${pageId}`)?.classList.add('active');
  document.querySelector(`[data-page="${pageId}"]`)?.classList.add('active');
  const titleEl = document.getElementById('pageTitle');
  if (titleEl) titleEl.textContent = pageTitles[pageId] || 'DOMIFECT';
  window.scrollTo({ top: 0, behavior: 'smooth' });
  renderAll();
}

function setupNavigation() {
  document.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
  });
  document.getElementById('btnQuickAdd')?.addEventListener('click', () => {
    resetTaskForm();
    navigateTo('assignments');
  });
}

function startCustomFocus(minutes) {
  clearInterval(focusTimerInterval);
  const input = document.getElementById('customTimerInput');
  if (input) input.value = minutes;
  focusSecondsRemaining = minutes * 60;
  updateTimerDisplay();
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
        swRegistration.showNotification('⏱️ Sesi Fokus DOMIFECT Selesai!', {
          body: 'Waktu fokusmu sudah habis. Mantap! Kamu sudah berhasil memulai.',
          silent: mode === 'silent'
        });
      }
      alert('⏱️ Waktu sesi fokus selesai!');
    }
  }, 1000);
}

function setupFocusTimerUI() {
  const input = document.getElementById('customTimerInput');
  input?.addEventListener('change', () => {
    if (!isFocusRunning) {
      const mins = Math.max(1, Math.min(180, parseInt(input.value) || 25));
      input.value = mins;
      focusSecondsRemaining = mins * 60;
      updateTimerDisplay();
    }
  });

  document.getElementById('btnStartTimer')?.addEventListener('click', () => {
    if (!isFocusRunning) {
      const mins = Math.max(1, Math.min(180, parseInt(input?.value) || 25));
      if (focusSecondsRemaining <= 0) focusSecondsRemaining = mins * 60;
      isFocusRunning = true;
      focusTimerInterval = setInterval(() => {
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
  });

  document.getElementById('btnPauseTimer')?.addEventListener('click', () => {
    clearInterval(focusTimerInterval);
    isFocusRunning = false;
  });

  document.getElementById('btnResetTimer')?.addEventListener('click', () => {
    clearInterval(focusTimerInterval);
    isFocusRunning = false;
    const mins = Math.max(1, Math.min(180, parseInt(input?.value) || 25));
    focusSecondsRemaining = mins * 60;
    updateTimerDisplay();
  });

  document.getElementById('btnAntiMager')?.addEventListener('click', () => {
    navigateTo('focus');
    startCustomFocus(5);
  });
}

function updateTimerDisplay() {
  const m = Math.floor(focusSecondsRemaining / 60);
  const s = focusSecondsRemaining % 60;
  const disp = document.getElementById('timerDisplay');
  if (disp) disp.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

async function requestNotificationPermission() {
  if ('Notification' in window) {
    const p = await Notification.requestPermission();
    alert(p === 'granted' ? '✅ Notifikasi sistem & teror guru berhasil diaktifkan!' : '⚠️ Izin notifikasi ditolak oleh browser.');
  } else {
    alert('⚠️ Browser ini tidak mendukung notifikasi sistem.');
  }
}

// =========================================================================
// EVENT LISTENERS (FORM TUGAS, EDIT, JADWAL, GEAR, CHAT GURU, BACKUP)
// =========================================================================
function resetTaskForm() {
  const form = document.getElementById('taskForm');
  if (form) form.reset();
  const editEl = document.getElementById('editTaskId');
  const titleEl = document.getElementById('formModeTitle');
  const btnEl = document.getElementById('btnSubmitTask');
  const cancelEl = document.getElementById('btnCancelEdit');
  const customEl = document.getElementById('customPersonaGroup');
  const customInput = document.getElementById('tCustomText');

  if (editEl) editEl.value = '';
  if (titleEl) titleEl.textContent = '➕ Tambah Tugas & Karakter Guru';
  if (btnEl) btnEl.textContent = '💾 Simpan Tugas & Aktifkan Teror';
  if (cancelEl) cancelEl.classList.add('hidden');
  if (customEl) customEl.classList.add('hidden');
  if (customInput) customInput.required = false;
}

function setupEventListeners() {
  document.getElementById('btnSidebarTheme')?.addEventListener('click', toggleTheme);
  document.getElementById('btnMobileTheme')?.addEventListener('click', toggleTheme);
  document.getElementById('btnEnableNotif')?.addEventListener('click', requestNotificationPermission);
  document.getElementById('btnMobileNotif')?.addEventListener('click', requestNotificationPermission);
  document.getElementById('btnEnableNotifMobile')?.addEventListener('click', requestNotificationPermission);

  document.getElementById('btnClosePopup')?.addEventListener('click', () => {
    document.getElementById('popupTerrorBanner')?.classList.add('hidden');
  });

  document.getElementById('profileForm')?.addEventListener('submit', saveProfile);
  document.getElementById('btnPanic')?.addEventListener('click', triggerPanicMode);
  document.getElementById('btnClosePanic')?.addEventListener('click', () => {
    document.getElementById('panicBox')?.classList.add('hidden');
  });

  document.getElementById('btnSharePanicWA')?.addEventListener('click', () => {
    if (!lastPanicTextWA) return;
    const url = `https://wa.me/?text=${encodeURIComponent(lastPanicTextWA)}`;
    window.open(url, '_blank');
  });

  document.getElementById('tQuickSchedule')?.addEventListener('change', (e) => {
    const sch = schedules.find(s => s.id === e.target.value);
    if (sch) {
      document.getElementById('tSubject').value = sch.subject;
      document.getElementById('tTeacher').value = sch.teacher;
    }
  });

  const personaSelect = document.getElementById('tPersona');
  const customGroup = document.getElementById('customPersonaGroup');
  personaSelect?.addEventListener('change', (e) => {
    if (e.target.value === 'custom') {
      customGroup.classList.remove('hidden');
      document.getElementById('tCustomText').required = true;
    } else {
      customGroup.classList.add('hidden');
      document.getElementById('tCustomText').required = false;
    }
  });

  document.getElementById('btnCancelEdit')?.addEventListener('click', resetTaskForm);

  const savedAlarmMode = localStorage.getItem(ALARM_MODE_KEY) || 'sound';
  const alarmSelect = document.getElementById('alarmModeSelect');
  if (alarmSelect) {
    alarmSelect.value = savedAlarmMode;
    alarmSelect.addEventListener('change', (e) => {
      localStorage.setItem(ALARM_MODE_KEY, e.target.value);
    });
  }

  // Simpan / Update Tugas (Dijamin Tersimpan & Notifikasi Langsung Muncul)
  const taskForm = document.getElementById('taskForm');
  if (taskForm) {
    taskForm.addEventListener('submit', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const titleVal = document.getElementById('tTitle')?.value.trim();
      const subjectVal = document.getElementById('tSubject')?.value.trim();
      const teacherVal = document.getElementById('tTeacher')?.value.trim();
      const workVal = document.getElementById('tWorkSchedule')?.value;
      const deadlineVal = document.getElementById('tDeadline')?.value;

      if (!titleVal || !subjectVal || !teacherVal || !deadlineVal) {
        alert('⚠️ Mohon lengkapi Nama Tugas, Mata Pelajaran, Nama Guru, dan Deadline!');
        return;
      }

      const existingId = document.getElementById('editTaskId')?.value || '';
      const id = existingId || ('t_' + Date.now());

      const rawSubs = document.getElementById('tSubTasks')?.value.trim() || '';
      let parsedSubTasks = [];
      if (rawSubs) {
        const oldTask = tasks.find(t => t.id === existingId);
        parsedSubTasks = rawSubs.split(',').map(s => s.trim()).filter(Boolean).map(text => {
          const prev = oldTask?.subTasks?.find(os => os.text === text);
          return { text, done: prev ? prev.done : false };
        });
      }

      const newTask = {
        id,
        title: titleVal,
        subject: subjectVal,
        teacher: teacherVal,
        gradeWeight: document.getElementById('tGradeWeight')?.value || '1',
        persona: document.getElementById('tPersona')?.value || 'killer',
        customText: document.getElementById('tCustomText')?.value.trim() || '',
        workSchedule: workVal || deadlineVal,
        deadline: deadlineVal,
        duration: parseFloat(document.getElementById('tDuration')?.value) || 1,
        dependsOn: document.getElementById('tDependsOn')?.value || '',
        subTasks: parsedSubTasks,
        groupMembers: document.getElementById('tGroupMembers')?.value.trim() || '',
        status: 'active'
      };

      const idx = tasks.findIndex(t => t.id === id);
      if (idx >= 0) tasks[idx] = newTask;
      else tasks.push(newTask);

      saveTasks();
      resetTaskForm();
      renderAll();

      // Scroll ke daftar tugas aktif agar terlihat langsung & picu teror notifikasi
      document.getElementById('assignmentsList')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      triggerNotifications(newTask);
    });
  }

  // Jadwal Pelajaran Form (Otomatis Terurut & Terkelompok Tetap Per Hari)
  document.getElementById('scheduleForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    schedules.push({
      id: 's_' + Date.now(),
      day: document.getElementById('sDay').value,
      subject: document.getElementById('sSubject').value.trim(),
      teacher: document.getElementById('sTeacher').value.trim()
    });
    saveSchedules();
    e.target.reset();
    renderAll();
  });

  // Checklist Perlengkapan Form
  document.getElementById('gearForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = document.getElementById('gearInput').value.trim();
    if (val) {
      gears.push({ id: 'g_' + Date.now(), text: val, checked: false });
      saveGears();
      e.target.reset();
      renderAll();
    }
  });

  // Generator Chat Negosiasi Guru (9 Situasi Darurat Lengkap)
  document.getElementById('btnGenerateChat')?.addEventListener('click', () => {
    const taskId = document.getElementById('negoTaskSelect').value;
    const reason = document.getElementById('negoReasonSelect').value;
    const task = tasks.find(t => t.id === taskId);
    if (!task) {
      alert('Pilih tugas terlebih dahulu!');
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

    const selectedReasonText = reasonTexts[reason] || reasonTexts.alat;

    const draft = `Assalamu'alaikum / Selamat pagi/siang ${task.teacher}.\n\nMohon maaf mengganggu waktunya. Saya ${studentName} dari kelas ${studentClass}. Saya ingin mengonfirmasi terkait tugas "${task.title}" pada mata pelajaran ${task.subject}.\n\nSaat ini progres pengerjaan sudah berjalan, namun ${selectedReasonText}. Saya memohon izin untuk dapat mengumpulkan tugas tersebut paling lambat pada [Sebutkan Jam/Hari].\n\nTerima kasih banyak atas pengertian dan bimbingannya, ${task.teacher}.`;

    document.getElementById('negoChatOutput').value = draft;
    document.getElementById('negoResultBox').classList.remove('hidden');
  });

  document.getElementById('btnCopyChat')?.addEventListener('click', () => {
    const output = document.getElementById('negoChatOutput');
    output.select();
    navigator.clipboard?.writeText(output.value);
    alert('📋 Draf chat WhatsApp berhasil disalin!');
  });

  // Ekspor & Impor Backup JSON
  document.getElementById('btnExportData')?.addEventListener('click', () => {
    const backup = { userProfile, tasks, schedules, gears, stats };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DOMIFECT_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('inputImportData')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.userProfile) userProfile = data.userProfile;
        if (data.tasks) tasks = data.tasks;
        if (data.schedules) schedules = sortSchedulesByDay(data.schedules);
        if (data.gears) gears = data.gears;
        if (data.stats) stats = data.stats;
        localStorage.setItem(PROFILE_KEY, JSON.stringify(userProfile));
        saveTasks(); saveSchedules(); saveGears(); saveStats();
        loadAllData();
        renderAll();
        alert('✅ Data backup berhasil dipulihkan!');
      } catch (err) {
        alert('⚠️ File backup tidak valid!');
      }
    };
    reader.readAsText(file);
  });

  document.getElementById('simTaskSelect')?.addEventListener('change', renderSimulator);
  document.getElementById('simDelaySlider')?.addEventListener('input', renderSimulator);
}

// =========================================================================
// RENDER SELURUH HALAMAN & INTERAKSI ITEM
// =========================================================================
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
  const active = tasks.filter(t => t.status === 'active');
  const dep = document.getElementById('tDependsOn');
  const sim = document.getElementById('simTaskSelect');
  const nego = document.getElementById('negoTaskSelect');
  const quickSch = document.getElementById('tQuickSchedule');

  if (dep) {
    const prevDep = dep.value;
    dep.innerHTML = '<option value="">-- Tugas Mandiri --</option>';
    active.forEach(t => {
      dep.innerHTML += `<option value="${t.id}">${t.title} (${t.subject})</option>`;
    });
    if (prevDep) dep.value = prevDep;
  }
  if (sim) {
    const prevSim = sim.value;
    sim.innerHTML = active.length ? '' : '<option value="">-- Belum ada tugas --</option>';
    active.forEach(t => {
      sim.innerHTML += `<option value="${t.id}">${t.title} — ${t.teacher}</option>`;
    });
    if (prevSim && active.some(t => t.id === prevSim)) sim.value = prevSim;
  }
  if (nego) {
    const prevNego = nego.value;
    nego.innerHTML = active.length ? '' : '<option value="">-- Belum ada tugas --</option>';
    active.forEach(t => {
      nego.innerHTML += `<option value="${t.id}">${t.title} (${t.teacher})</option>`;
    });
    if (prevNego && active.some(t => t.id === prevNego)) nego.value = prevNego;
  }
  if (quickSch) {
    const sortedSch = sortSchedulesByDay(schedules);
    quickSch.innerHTML = '<option value="">-- Pilih Mapel dari Jadwal Tersimpan --</option>';
    sortedSch.forEach(s => {
      quickSch.innerHTML += `<option value="${s.id}">[${s.day}] ${s.subject} — ${s.teacher}</option>`;
    });
  }
}

function renderDashboard() {
  const active = tasks.filter(t => t.status === 'active');
  const navCount = document.getElementById('navTaskCount');
  if (navCount) navCount.textContent = active.length;

  const streakBadge = document.getElementById('streakBadge');
  if (streakBadge) streakBadge.textContent = `🔥 Streak: ${stats.streak} Tepat Waktu`;

  const critical = active.filter(t => calculateSlack(t) <= 0);
  const totalWorkHours = active.reduce((sum, t) => sum + (parseFloat(t.duration) || 0), 0);
  const targetDaily = userProfile.targetHours || 3;
  const mentalLoadPercent = Math.min(100, Math.round((totalWorkHours / (targetDaily * 2)) * 100));

  const scoreEl = document.getElementById('stabilityScore');
  const descEl = document.getElementById('stabilityDesc');
  const greeting = userProfile.name ? `Halo, ${userProfile.name}! ` : '';

  if (active.length === 0) {
    scoreEl.textContent = '100% — Jadwal Stabil | Beban Mental: 0%';
    descEl.textContent = `${greeting}Belum ada tugas terdaftar. Tekan "+ Tugas" untuk mulai mengatur jadwal teori maupun kejuruan.`;
  } else if (critical.length > 0) {
    scoreEl.textContent = `⚠️ Jalur Kritis (${critical.length} Tugas) | Beban Mental: ${mentalLoadPercent}%`;
    descEl.textContent = `${greeting}Waspada efek domino! Gunakan Panic Button untuk urutan penyelamatan nilai rapor.`;
  } else {
    scoreEl.textContent = `✅ Jadwal Aman | Beban Mental: ${mentalLoadPercent}%`;
    descEl.textContent = `${greeting}Total estimasi kerja: ${totalWorkHours} jam. Patuhi time-blocking agar tidak menumpuk.`;
  }

  const list = document.getElementById('dashboardAlertsList');
  if (list) {
    list.innerHTML = active.slice(0, 3).map(t => {
      const slack = calculateSlack(t);
      return `
        <div class="alert-card ${slack <= 0 ? 'urgent' : ''}">
          <strong>🚨 ${t.teacher} — ${t.subject}</strong>
          <p class="alert-msg">${generateTerrorMessage(t)}</p>
        </div>
      `;
    }).join('') || '<p class="hint">Belum ada teror pengingat aktif.</p>';
  }

  const priorityList = document.getElementById('todayActionList');
  if (priorityList) {
    const sorted = [...active].sort((a, b) => {
      const scoreA = calculateSlack(a) / (parseInt(a.gradeWeight) || 1);
      const scoreB = calculateSlack(b) / (parseInt(b.gradeWeight) || 1);
      return scoreA - scoreB;
    });

    priorityList.innerHTML = sorted.slice(0, 4).map((t, i) => {
      const slack = calculateSlack(t);
      return `
        <div class="alert-card ${slack <= 0 ? 'urgent' : ''}">
          <strong>#${i + 1} ${t.title} (${t.subject})</strong>
          <p class="hint">${getGradeLabel(t.gradeWeight)} • Slack: ${slack} jam</p>
        </div>
      `;
    }).join('') || '<p class="hint">Belum ada daftar prioritas tugas.</p>';
  }
}

function renderAssignments() {
  const active = tasks.filter(t => t.status === 'active');
  const labelEl = document.getElementById('totalTasksLabel');
  if (labelEl) labelEl.textContent = active.length;
  const container = document.getElementById('assignmentsList');
  if (!container) return;

  container.innerHTML = active.map(t => {
    const slack = calculateSlack(t);
    const parent = t.dependsOn ? tasks.find(p => p.id === t.dependsOn) : null;

    let subTasksHtml = '';
    if (t.subTasks && t.subTasks.length > 0) {
      const doneCount = t.subTasks.filter(s => s.done).length;
      const pct = Math.round((doneCount / t.subTasks.length) * 100);
      subTasksHtml = `
        <div style="margin-top:4px;">
          <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--text-muted);">
            <span>Progres Micro-Task</span>
            <strong>${pct}% (${doneCount}/${t.subTasks.length})</strong>
          </div>
          <div class="progress-wrap"><div class="progress-fill" style="width:${pct}%"></div></div>
          <div class="subtask-box">
            ${t.subTasks.map((st, sIdx) => `
              <label class="subtask-row ${st.done ? 'done' : ''}">
                <input type="checkbox" ${st.done ? 'checked' : ''} onchange="toggleSubTask('${t.id}', ${sIdx})" />
                <span>${st.text}</span>
              </label>
            `).join('')}
          </div>
        </div>
      `;
    }

    const groupHtml = t.groupMembers
      ? `<div class="group-box">👥 <strong>Tim:</strong> ${t.groupMembers}</div>`
      : '';

    const workText = t.workSchedule ? t.workSchedule.replace('T', ' ') : '-';
    const deadlineText = t.deadline ? t.deadline.replace('T', ' ') : '-';

    return `
      <div class="task-item">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:4px;">
          <span class="subject-pill">${t.subject}</span>
          <span class="grade-pill">${getGradeLabel(t.gradeWeight)}</span>
          <span class="slack-pill ${slack <= 0 ? 'slack-danger' : 'slack-safe'}">Slack: ${slack}j</span>
        </div>
        <h4>${t.title}</h4>
        <small class="hint">Guru/Instruktur: ${t.teacher}</small>
        <small class="hint">Mulai Kerja: ${workText}</small>
        <small class="hint">Deadline: ${deadlineText}</small>
        ${parent ? `<small class="hint">⛓️ Bergantung pada: ${parent.title}</small>` : ''}
        ${groupHtml}
        ${subTasksHtml}
        <div style="display:flex; gap:6px; margin-top:8px;">
          <button type="button" class="btn btn-sm btn-primary" style="flex:1;" onclick="completeTask('${t.id}')">✓ Selesai</button>
          <button type="button" class="btn btn-sm btn-secondary" onclick="editTask('${t.id}')">✏️ Edit</button>
          <button type="button" class="btn btn-sm btn-danger" onclick="deleteTask('${t.id}')">🗑️</button>
        </div>
      </div>
    `;
  }).join('') || '<p class="hint">Belum ada tugas yang ditambahkan.</p>';
}

window.toggleSubTask = (taskId, subIndex) => {
  const t = tasks.find(item => item.id === taskId);
  if (t && t.subTasks && t.subTasks[subIndex]) {
    t.subTasks[subIndex].done = !t.subTasks[subIndex].done;
    saveTasks();
    renderAssignments();
  }
};

window.editTask = (id) => {
  const t = tasks.find(item => item.id === id);
  if (!t) return;
  document.getElementById('editTaskId').value = t.id;
  document.getElementById('tTitle').value = t.title;
  document.getElementById('tSubject').value = t.subject;
  document.getElementById('tTeacher').value = t.teacher;
  document.getElementById('tGradeWeight').value = t.gradeWeight || '1';
  document.getElementById('tPersona').value = t.persona || 'killer';
  document.getElementById('tCustomText').value = t.customText || '';
  document.getElementById('tWorkSchedule').value = t.workSchedule || '';
  document.getElementById('tDeadline').value = t.deadline || '';
  document.getElementById('tDuration').value = t.duration || 2;
  document.getElementById('tDependsOn').value = t.dependsOn || '';
  document.getElementById('tSubTasks').value = t.subTasks ? t.subTasks.map(s => s.text).join(', ') : '';
  document.getElementById('tGroupMembers').value = t.groupMembers || '';

  if (t.persona === 'custom') {
    document.getElementById('customPersonaGroup').classList.remove('hidden');
  } else {
    document.getElementById('customPersonaGroup').classList.add('hidden');
  }

  document.getElementById('formModeTitle').textContent = '✏️ Edit Tugas & Jadwal';
  document.getElementById('btnSubmitTask').textContent = '💾 Simpan Perubahan Tugas';
  document.getElementById('btnCancelEdit').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.completeTask = (id) => {
  const t = tasks.find(item => item.id === id);
  if (t) {
    const isLate = Date.now() > new Date(t.deadline).getTime();
    if (isLate) {
      stats.late++;
      stats.streak = 0;
    } else {
      stats.onTime++;
      stats.streak++;
    }
    saveStats();
  }
  tasks = tasks.filter(item => item.id !== id);
  saveTasks();
  renderAll();
};

window.deleteTask = (id) => {
  tasks = tasks.filter(item => item.id !== id);
  saveTasks();
  renderAll();
};

// =========================================================================
// SIMULATOR DOMINO LENGKAP (MENGHITUNG SLACK, DAMPAK BERANTAI & RISIKO NILAI)
// =========================================================================
function renderSimulator() {
  const selectEl = document.getElementById('simTaskSelect');
  const sliderEl = document.getElementById('simDelaySlider');
  const label = document.getElementById('simDelayLabel');
  const box = document.getElementById('simConclusionBox');
  if (!box) return;

  const id = selectEl?.value;
  const delay = parseInt(sliderEl?.value) || 0;
  if (label) label.textContent = `+${delay} Jam`;

  if (!id) {
    box.innerHTML = '<p class="hint">Tambahkan tugas terlebih dahulu di menu Tugas untuk menjalankan simulasi efek domino.</p>';
    return;
  }

  const selectedTask = tasks.find(t => t.id === id);
  if (!selectedTask) {
    box.innerHTML = '<p class="hint">Pilih tugas yang valid untuk disimulasikan.</p>';
    return;
  }

  const downstream = getDownstreamTasks(id);
  const slack = calculateSlack(selectedTask);
  const gradeImpactNote = `Bobot Rapor: <strong>${getGradeLabel(selectedTask.gradeWeight)}</strong>.`;

  if (delay === 0) {
    box.innerHTML = `
      <div class="alert-card">
        ✅ <strong>Kondisi Normal (+0 Jam):</strong> Tugas <strong>"${selectedTask.title}"</strong> (${selectedTask.subject}) berjalan sesuai jadwal.
        <p class="hint" style="margin-top:4px;">Cadangan Waktu (Slack): <strong>${slack} jam</strong> • ${gradeImpactNote}</p>
      </div>`;
    return;
  }

  const over = Math.round((delay - slack) * 10) / 10;
  let html = '';

  if (over > 0) {
    html += `
      <div class="alert-card urgent">
        ⚠️ <strong>Melewati Deadline Tugas Utama:</strong> Menunda <strong>+${delay} jam</strong> menghabiskan cadangan waktu (${slack} jam) dan membuat <strong>"${selectedTask.title}"</strong> telat <strong>${over} jam</strong> dari batas akhir!
        <p class="hint" style="margin-top:4px;">${gradeImpactNote}</p>
        <p class="alert-msg" style="margin-top:6px;">"${generateTerrorMessage(selectedTask)}"</p>
      </div>`;
  } else {
    html += `
      <div class="alert-card">
        ⏳ <strong>Cadangan Waktu Menipis:</strong> Keterlambatan <strong>+${delay} jam</strong> pada <strong>"${selectedTask.title}"</strong> masih tertahan oleh slack time (${slack} jam), namun sisa waktu aman tinggal <strong>${Math.round((slack - delay) * 10) / 10} jam</strong>.
        <p class="hint" style="margin-top:4px;">${gradeImpactNote}</p>
      </div>`;
  }

  if (downstream.length > 0) {
    const listItems = downstream.map((d, index) => {
      const dSlack = calculateSlack(d);
      const dImpact = Math.round((delay - dSlack) * 10) / 10;
      const statusStr = dImpact > 0
        ? `<span style="color:var(--danger); font-weight:700;">Ikut Telat ${dImpact} jam!</span>`
        : `<span style="color:var(--warning);">Cadangan waktu tergerus ${delay} jam</span>`;
      return `<li><strong>Domino #${index + 1}: ${d.title}</strong> (${d.subject} - ${d.teacher}) — ${statusStr}</li>`;
    }).join('');

    html += `
      <div class="alert-card urgent" style="margin-top:10px;">
        🚨 <strong>RANTAI EFEK DOMINO TERPICU (${downstream.length} Tugas Terdampak):</strong>
        <ul style="padding-left:18px; margin-top:6px; display:flex; flex-direction:column; gap:5px; font-size:0.86rem;">
          ${listItems}
        </ul>
      </div>`;
  } else {
    html += `<p class="hint" style="margin-top:6px;">ℹ️ Tugas ini belum memiliki tugas lanjutan yang bergantung padanya (Hubungkan tugas lain di kolom "Bergantung Pada Tugas" untuk melihat rantai domino).</p>`;
  }

  box.innerHTML = html;
}

// =========================================================================
// JADWAL TETAP PER HARI (SENIN - SABTU) & PERLENGKAPAN
// =========================================================================
function renderScheduleAndGear() {
  const schList = document.getElementById('scheduleList');
  if (schList) {
    const sortedSch = sortSchedulesByDay(schedules);
    if (sortedSch.length === 0) {
      schList.innerHTML = '<p class="hint">Belum ada jadwal pelajaran tetap yang tersimpan.</p>';
    } else {
      let groupedHtml = '';
      DAYS_LIST.forEach(dayName => {
        const itemsForDay = sortedSch.filter(s => s.day === dayName);
        if (itemsForDay.length > 0) {
          groupedHtml += `
            <div style="margin-bottom: 12px;">
              <div style="font-size:0.8rem; font-weight:700; color:var(--primary); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px; border-bottom:1px solid var(--border); padding-bottom:3px;">
                📌 Hari ${dayName} (${itemsForDay.length} Mapel)
              </div>
              ${itemsForDay.map(s => `
                <div class="alert-card" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                  <div>
                    <strong>${s.subject}</strong>
                    <p class="hint">Pengampu: ${s.teacher}</p>
                  </div>
                  <button type="button" class="btn btn-sm btn-danger" onclick="deleteSchedule('${s.id}')">✕</button>
                </div>
              `).join('')}
            </div>
          `;
        }
      });
      schList.innerHTML = groupedHtml;
    }
  }

  const gearList = document.getElementById('gearList');
  if (gearList) {
    gearList.innerHTML = gears.map(g => `
      <div class="alert-card" style="display:flex; justify-content:space-between; align-items:center;">
        <label class="subtask-row ${g.checked ? 'done' : ''}" style="flex:1;">
          <input type="checkbox" ${g.checked ? 'checked' : ''} onchange="toggleGear('${g.id}')" />
          <span>${g.text}</span>
        </label>
        <button type="button" class="btn btn-sm btn-danger" onclick="deleteGear('${g.id}')">✕</button>
      </div>
    `).join('') || '<p class="hint">Belum ada daftar perlengkapan praktik.</p>';
  }
}

window.deleteSchedule = (id) => {
  schedules = schedules.filter(s => s.id !== id);
  saveSchedules();
  renderAll();
};

window.toggleGear = (id) => {
  const g = gears.find(item => item.id === id);
  if (g) {
    g.checked = !g.checked;
    saveGears();
    renderScheduleAndGear();
  }
};

window.deleteGear = (id) => {
  gears = gears.filter(g => g.id !== id);
  saveGears();
  renderScheduleAndGear();
};

function renderAlerts() {
  const active = tasks.filter(t => t.status === 'active');
  const badge = document.getElementById('alertCountBadge');
  if (badge) badge.textContent = active.length;

  const list = document.getElementById('fullAlertsList');
  if (list) {
    list.innerHTML = active.map(t => `
      <div class="alert-card">
        <strong>🚨 ${t.teacher} (${t.subject}) — ${t.title}</strong>
        <p class="alert-msg">${generateTerrorMessage(t)}</p>
        <button type="button" class="btn btn-sm btn-warning btn-block" onclick="triggerTestPopup('${t.id}')" style="margin-top:10px;">🔔 Tes Pop-up Teror Guru</button>
      </div>
    `).join('') || '<p class="hint">Belum ada teror aktif. Tambahkan tugas untuk mengaktifkan pengingat.</p>';
  }
}

function renderStats() {
  const onTimeEl = document.getElementById('statOnTime');
  const lateEl = document.getElementById('statLate');
  const streakEl = document.getElementById('statStreak');
  if (onTimeEl) onTimeEl.textContent = stats.onTime || 0;
  if (lateEl) lateEl.textContent = stats.late || 0;
  if (streakEl) streakEl.textContent = `${stats.streak || 0} 🔥`;
}
