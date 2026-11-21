const TASKS_KEY = 'domifect_tasks_v1';
const PROFILE_KEY = 'domifect_profile_v1';
const ALARM_MODE_KEY = 'domifect_alarm_mode_v1';

let tasks = [];
let userProfile = { name: '', className: '', school: '', targetHours: 3 };
let swRegistration = null;

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

function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) {
      userProfile = JSON.parse(raw);
      document.getElementById('pName').value = userProfile.name || '';
      document.getElementById('pClass').value = userProfile.className || '';
      document.getElementById('pSchool').value = userProfile.school || '';
      document.getElementById('pTargetHours').value = userProfile.targetHours || 3;
      updateStudentTags();
    }
  } catch (e) { console.log('Profile load error:', e); }
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

function loadTasks() {
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    tasks = raw ? JSON.parse(raw) : [];
  } catch (e) { tasks = []; }
}

function saveTasks() {
  localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
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
      ""${t.customText}" — Terkait tugas '${t.title}' (${t.subject}).",
      "${t.teacher} berpesan: "${t.customText}" untuk penyelesaian '${t.title}'.",
      "Segera selesaikan '${t.title}'! Ingat: "${t.customText}".",
      "Status '${t.title}' masih aktif. ${t.teacher} mengingatkan: "${t.customText}".",
      "Jangan sampai '${t.title}' lewat batas waktu! "${t.customText}".",
      "Mapel ${t.subject} menunggu progresmu: "${t.customText}".",
      "Pesan tegas ${t.teacher} untuk '${t.title}': "${t.customText}".",
      "Tuntaskan '${t.title}' sekarang juga! "${t.customText}"."
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

// Menghasilkan 8 x 8 x 8 = 512 kombinasi kalimat unik per karakter guru
function generateTerrorMessage(task, slack) {
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
      swRegistration.showNotification(`🚨 DOMIFECT: ${task.teacher.toUpperCase()} (${task.subject})`, {
        body: terrorMsg,
        icon: './icon-192.png',
        vibrate: mode === 'silent' ? [120, 60, 120] : [300, 100, 300],
        silent: mode === 'silent',
        requireInteraction: true
      });
    } else {
      new Notification(`🚨 DOMIFECT: ${task.teacher.toUpperCase()} (${task.subject})`, {
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

const pageTitles = {
  dashboard: 'Dashboard Akademik & Kejuruan',
  assignments: 'Daftar Tugas & Teror Guru',
  simulator: 'Simulasi Efek Domino',
  alerts: 'Pusat Notifikasi & Teror',
  focus: 'Mode Fokus Kustom',
  profile: 'Profil Siswa (SMA / SMK)'
};

function navigateTo(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById(`page-${pageId}`).classList.add('active');
  document.querySelector(`[data-page="${pageId}"]`)?.classList.add('active');
  document.getElementById('pageTitle').textContent = pageTitles[pageId] || 'DOMIFECT';
  window.scrollTo({ top: 0, behavior: 'smooth' });
  renderAll();
}

function setupNavigation() {
  document.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
  });
}

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
            swRegistration.showNotification('⏱️ Sesi Fokus DOMIFECT Selesai!', {
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

async function requestNotificationPermission() {
  if ('Notification' in window) {
    const p = await Notification.requestPermission();
    alert(p === 'granted' ? '✅ Notifikasi sistem & teror guru berhasil diaktifkan!' : '⚠️ Izin notifikasi ditolak oleh browser.');
  } else {
    alert('⚠️ Browser ini tidak mendukung notifikasi sistem.');
  }
}

function setupEventListeners() {
  document.getElementById('btnSidebarTheme')?.addEventListener('click', toggleTheme);
  document.getElementById('btnMobileTheme')?.addEventListener('click', toggleTheme);
  document.getElementById('btnEnableNotif')?.addEventListener('click', requestNotificationPermission);
  document.getElementById('btnMobileNotif')?.addEventListener('click', requestNotificationPermission);
  document.getElementById('btnEnableNotifMobile')?.addEventListener('click', requestNotificationPermission);

  document.getElementById('profileForm').addEventListener('submit', saveProfile);
  document.getElementById('btnPanic').addEventListener('click', triggerPanicMode);

  const personaSelect = document.getElementById('tPersona');
  const customGroup = document.getElementById('customPersonaGroup');
  if (personaSelect) {
    personaSelect.addEventListener('change', (e) => {
      if (e.target.value === 'custom') {
        customGroup.classList.remove('hidden');
        document.getElementById('tCustomText').required = true;
      } else {
        customGroup.classList.add('hidden');
        document.getElementById('tCustomText').required = false;
      }
    });
  }

  const savedAlarmMode = localStorage.getItem(ALARM_MODE_KEY) || 'sound';
  const alarmSelect = document.getElementById('alarmModeSelect');
  if (alarmSelect) {
    alarmSelect.value = savedAlarmMode;
    alarmSelect.addEventListener('change', (e) => {
      localStorage.setItem(ALARM_MODE_KEY, e.target.value);
    });
  }

  document.getElementById('taskForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('editTaskId').value || ('t_' + Date.now());
    const newTask = {
      id,
      title: document.getElementById('tTitle').value.trim(),
      subject: document.getElementById('tSubject').value.trim(),
      teacher: document.getElementById('tTeacher').value.trim(),
      persona: document.getElementById('tPersona').value,
      customText: document.getElementById('tCustomText').value.trim(),
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
    customGroup.classList.add('hidden');
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
  dep.innerHTML = '<option value="">-- Tugas Mandiri --</option>';
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

  const totalWorkHours = active.reduce((sum, t) => sum + (t.duration || 0), 0);
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
    descEl.textContent = `${greeting}Waspada efek domino! Gunakan Panic Button jika waktu pengerjaan sudah mepet.`;
  } else {
    scoreEl.textContent = `✅ Jadwal Aman | Beban Mental: ${mentalLoadPercent}%`;
    descEl.textContent = `${greeting}Total estimasi kerja: ${totalWorkHours} jam. Patuhi time-blocking agar tidak menumpuk.`;
  }

  const list = document.getElementById('dashboardAlertsList');
  list.innerHTML = active.slice(0, 3).map(t => {
    const slack = calculateSlack(t);
    return `
      <div class="alert-card ${slack <= 0 ? 'urgent' : ''}">
        <strong>🚨 ${t.teacher} — ${t.subject}</strong>
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
        <div style="display:flex; gap:8px; margin-top:8px;">
          <button class="btn btn-sm btn-primary" style="flex:1;" onclick="completeTask('${t.id}')">✓ Selesai</button>
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
        <strong>🚨 ${t.teacher} (${t.subject}) — ${t.title}</strong>
        <p class="alert-msg">${generateTerrorMessage(t, slack)}</p>
        <button class="btn btn-sm btn-warning btn-block" onclick='triggerNotifications(${JSON.stringify(t).replace(/'/g, "&#39;")})' style="margin-top:10px;">🔔 Tes Pop-up Teror Guru</button>
      </div>
    `;
  }).join('') || '<p class="hint">Belum ada teror aktif. Tambahkan tugas untuk mengaktifkan pengingat.</p>';
}
