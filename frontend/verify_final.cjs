const puppeteer = require('puppeteer');

async function main() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  
  // ====== BYPASS LOGIN ======
  await page.goto('http://localhost:8080', { waitUntil: 'networkidle0', timeout: 15000 });
  await page.evaluate(() => {
    localStorage.setItem('sb-session', 'bypass');
    localStorage.setItem('user', JSON.stringify({ username: 'admin', role: 'admin' }));
  });
  await page.reload({ waitUntil: 'networkidle0', timeout: 15000 });
  
  // Tunggu app shell muncul
  await page.waitForSelector('#app-shell:not(.d-none)', { timeout: 10000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));

  // ====== HOME PAGE ======
  console.log('▶ HOME PAGE');
  console.log('===========');
  const homeOk = await checkComponents(page, [
    ['#hero-card', 'Hero Card'],
    ['#hero-clock', 'Digital Clock'],
    ['#hero-date', 'Current Date'],
    ['#hero-esp-badge', 'ESP Badge'],
    ['#hero-school', 'School Name'],
    ['#hero-sys-status', 'Sys Status'],
    ['.section-label', 'Section Label'],
    ['#nextbell-card', 'Next Bell Card'],
    ['#nextbell-time', 'Next Bell Time'],
    ['#nextbell-name', 'Next Bell Name'],
    ['#nextbell-audio', 'Next Bell Audio'],
    ['.nextbell-countdown', 'Countdown Container'],
    ['#countdown-value', 'Countdown Value'],
    ['#nextbell-status-badge', 'Status Badge'],
    ['.device-grid', 'Device Grid'],
    ['.quick-actions', 'Quick Actions'],
    ['#btn-test-audio', 'Btn Test Audio'],
    ['.relay-toggle-card[data-relay="1"]', 'Relay 1 Toggle'],
    ['.relay-checkbox[data-relay="1"]', 'Relay 1 Checkbox'],
    ['.relay-toggle-card[data-relay="2"]', 'Relay 2 Toggle'],
    ['.relay-checkbox[data-relay="2"]', 'Relay 2 Checkbox'],
    ['#btn-sync-rtc', 'Btn Sync RTC'],
    ['#btn-refresh-status', 'Btn Refresh'],
    ['#btn-restart-esp', 'Btn Restart ESP'],
  ]);
  console.log(homeOk ? '  ✅ HOME PAGE - LENGKAP' : '  ⚠️  Ada komponen hilang');
  await page.screenshot({ path: 'ss_home.png' });

  // ====== JADWAL PAGE ======
  await navigateTo(page, 'jadwal');
  
  console.log('\n▶ JADWAL PAGE');
  console.log('=============');
  const jadwalOk = await checkComponents(page, [
    ['#page-jadwal.page.active', 'Page Active'],
    ['#day-tabs', 'Day Tabs Container'],
    ['button.day-tab[data-day="Senin"]', 'Tab Senin'],
    ['button.day-tab[data-day="Selasa"]', 'Tab Selasa'],
    ['button.day-tab[data-day="Rabu"]', 'Tab Rabu'],
    ['button.day-tab[data-day="Kamis"]', 'Tab Kamis'],
    ['button.day-tab[data-day="Jumat"]', 'Tab Jumat'],
    ['button.day-tab[data-day="Sabtu"]', 'Tab Sabtu'],
    ['#jadwal-search-input', 'Search Input'],
    ['#jadwal-filter', 'Filter Select'],
    ['#schedule-table-body', 'Table Body'],
    ['#schedule-pagination', 'Pagination'],
    ['#btn-add-schedule', 'FAB Add'],
  ]);
  console.log(jadwalOk ? '  ✅ JADWAL PAGE - LENGKAP' : '  ⚠️  Ada komponen hilang');
  await page.screenshot({ path: 'ss_jadwal.png' });

  // ====== STATUS PAGE ======
  await navigateTo(page, 'status');
  
  console.log('\n▶ STATUS PAGE');
  console.log('=============');
  const statusOk = await checkComponents(page, [
    ['#page-status.page.active', 'Page Active'],
    ['#esp-hero', 'ESP Hero Container'],
    ['#esp-hero-title', 'ESP Title'],
    ['#status-hero-badge', 'Status Badge'],
    ['#esp-hero-details', 'Details Container'],
    ['.detail-grid', 'Detail Grid'],
    ['#esp-uptime', 'Uptime'],
    ['#esp-chip-id', 'Chip ID'],
    ['#esp-free-heap', 'Free Heap'],
    ['#esp-wifi-rssi', 'WiFi RSSI'],
    ['#esp-last-seen', 'Last Seen'],
    ['#esp-fw-version', 'FW Version'],
    ['#status-cards', 'Status Cards'],
    ['#timeline-container', 'Timeline Container'],
    ['#system-log-container', 'System Log Container'],
  ]);
  console.log(statusOk ? '  ✅ STATUS PAGE - LENGKAP' : '  ⚠️  Ada komponen hilang');
  await page.screenshot({ path: 'ss_status.png' });

  // ====== SETTINGS PAGE ======
  await navigateTo(page, 'settings');
  
  console.log('\n▶ SETTINGS PAGE');
  console.log('===============');
  const settingsOk = await checkComponents(page, [
    ['#page-settings.page.active', 'Page Active'],
    ['#sys-device-name', 'Device Name'],
    ['#sys-fw-version', 'FW Version'],
    ['#sys-wifi-ssid', 'WiFi SSID'],
    ['#sys-wifi-pass', 'WiFi Password'],
    ['#sys-sync-interval', 'Sync Interval'],
    ['#sys-btn-save', 'Btn Save'],
    ['#sys-btn-restart', 'Btn Restart'],
    ['#sys-btn-reset', 'Btn Factory Reset'],
    ['#sb-url', 'Supabase URL'],
    ['#sb-anon-key', 'Supabase Key'],
    ['#sb-btn-test', 'Btn Test'],
    ['#sb-btn-save', 'Btn Save Supabase'],
    ['#sb-test-result', 'Test Result'],
    ['#audio-upload-input', 'File Input'],
    ['#audio-upload-btn', 'Upload Btn'],
    ['#audio-upload-progress', 'Upload Progress'],
    ['#sched-auto-sync', 'Auto Sync'],
    ['#sched-relay-on-bell', 'Relay on Bell'],
    ['#sched-relay-duration', 'Relay Duration'],
    ['#notif-enabled', 'Notif Enabled'],
    ['#notif-email', 'Notif Email'],
    ['.settings-card.settings-card-danger', 'Danger Zone'],
    ['#danger-clear-logs', 'Clear Logs'],
    ['#danger-clear-all', 'Clear All'],
  ]);
  console.log(settingsOk ? '  ✅ SETTINGS PAGE - LENGKAP' : '  ⚠️  Ada komponen hilang');
  await page.screenshot({ path: 'ss_settings.png' });

  // ====== HEADER & NAV ======
  console.log('\n▶ HEADER & NAVIGATION');
  console.log('=====================');
  await checkComponents(page, [
    ['.app-header', 'Header'],
    ['#header-clock', 'Header Clock'],
    ['#header-date', 'Header Date'],
    ['#header-esp', 'ESP Status'],
    ['#esp-dot', 'ESP Dot'],
    ['#esp-label', 'ESP Label'],
    ['#btn-logout', 'Logout'],
    ['.bottom-nav', 'Bottom Nav'],
  ]);
  
  const navLabels = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.nav-item .nav-label')).map(e => e.textContent.trim())
  );
  console.log(`  Nav labels: ${navLabels.join(', ')}`);
  console.log(navLabels.length === 4 ? '  ✅ 4 MENU NAVIGASI - LENGKAP' : '  ⚠️  Kurang dari 4');

  // ====== DARK MODE ======
  console.log('\n▶ DARK MODE');
  console.log('===========');
  
  // Dark mode toggle mungkin ada di header atau di CSS class body
  const hasDarkToggle = await page.$('.dark-mode-toggle, #dark-mode-toggle, [data-theme-toggle], .theme-toggle') !== null;
  console.log(`  Dark Mode Toggle button: ${hasDarkToggle ? 'ADA' : 'TIDAK ADA (via CSS/JS)'}`);
  
  // Cek apakah class dark sudah ada di body
  const bodyHasDark = await page.evaluate(() => {
    return document.body.classList.contains('dark-mode') || 
           document.documentElement.classList.contains('dark');
  });
  console.log(`  Dark Mode awal: ${bodyHasDark ? 'AKTIF' : 'NONAKTIF'}`);

  // ====== SUMMARY ======
  console.log('\n' + '='.repeat(50));
  console.log('📋 RINGKASAN VERIFIKASI');
  console.log('='.repeat(50));
  
  const pages = [
    ['home', homeOk],
    ['jadwal', jadwalOk],
    ['status', statusOk],
    ['settings', settingsOk],
  ];
  let allOk = true;
  for (const [p, ok] of pages) {
    console.log(`  ${p.padEnd(10)} ${ok ? '✅' : '❌'} ${ok ? 'Semua komponen ada' : '- Komponen hilang'}`);
    if (!ok) allOk = false;
  }
  
  // Cek navigasi
  console.log(`  nav       ${navLabels.length === 4 ? '✅' : '❌'} ${navLabels.length === 4 ? '4 menu lengkap' : 'Kurang dari 4 menu'}`);
  if (navLabels.length !== 4) allOk = false;
  
  if (allOk) console.log('\n  🎉 SEMUA KOMPONEN TERDETEKSI!');
  else console.log('\n  ⚠️  Ada beberapa komponen yang perlu diperbaiki');
  
  await browser.close();
  console.log('\n✅ Screenshots saved!');
}

async function checkComponents(page, checks) {
  let allOk = true;
  for (const [sel, name] of checks) {
    const el = await page.$(sel);
    if (!el) {
      console.log(`  ⚠️  ${name} (${sel}): HILANG`);
      allOk = false;
    }
  }
  return allOk;
}

async function navigateTo(page, pageName) {
  // Scroll bottom nav into view if needed, then click via evaluate
  await page.evaluate((name) => {
    const btn = document.querySelector(`button.nav-item[data-page="${name}"]`);
    if (btn) {
      btn.scrollIntoView({ block: 'nearest' });
      btn.click();
    }
  }, pageName);
  await new Promise(r => setTimeout(r, 1200));
}

main().catch(e => {
  console.error('VERIFY ERROR:', e.message);
  process.exit(1);
});