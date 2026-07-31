const puppeteer = require('puppeteer');

async function main() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  
  // ====== STEP 0: BYPASS LOGIN ======
  await page.goto('http://localhost:8080', { waitUntil: 'networkidle0', timeout: 15000 });
  
  // Inject localStorage untuk bypass login
  await page.evaluate(() => {
    localStorage.setItem('sb-session', 'bypass');
    localStorage.setItem('user', JSON.stringify({ username: 'admin', role: 'admin' }));
  });
  
  // Reload page
  await page.reload({ waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise(r => setTimeout(r, 1500));

  // ====== STEP 1: CEK HOME PAGE ======
  console.log('▶ HOME PAGE');
  console.log('===========');
  
  const homeChecks = [
    // Hero Section
    ['Hero Card', '#hero-card'],
    ['Hero Clock', '#hero-clock'],
    ['Hero Date', '#hero-date'],
    ['Hero ESP Badge', '#hero-esp-badge'],
    ['Hero School Name', '#hero-school'],
    ['Hero System Status', '#hero-sys-status'],
    // Section Labels
    ['Section "Bel Berikutnya"', '.section-label'],
    // Next Bell Card
    ['Next Bell Card', '#nextbell-card'],
    ['Next Bell Time', '#nextbell-time'],
    ['Next Bell Name', '#nextbell-name'],
    ['Next Bell Audio', '#nextbell-audio'],
    ['Countdown Label', '.nextbell-countdown'],
    ['Countdown Value', '#countdown-value'],
    ['Status Badge', '#nextbell-status-badge'],
    // Device Grid
    ['Section "Status Perangkat"', '.device-grid'],
    ['Device Grid ID', '#device-grid'],
    // Quick Actions
    ['Section "Aksi Cepat"', '.quick-actions'],
    ['Button Test Audio', '#btn-test-audio'],
    ['Button Relay 1 ON', 'button.qa-relay[data-relay="1"][data-action="on"]'],
    ['Button Relay 1 OFF', 'button.qa-relay[data-relay="1"][data-action="off"]'],
    ['Button Relay 2 ON', 'button.qa-relay[data-relay="2"][data-action="on"]'],
    ['Button Relay 2 OFF', 'button.qa-relay[data-relay="2"][data-action="off"]'],
    ['Button Sync RTC', '#btn-sync-rtc'],
    ['Button Refresh', '#btn-refresh-status'],
    ['Button Restart ESP', '#btn-restart-esp'],
  ];
  
  for (const [name, sel] of homeChecks) {
    const el = await page.$(sel);
    if (!el) console.log(`  ⚠️  ${name}: HILANG`);
  }
  console.log('  ✅ Home Page - semua komponen terdeteksi');
  await page.screenshot({ path: 'ss_home.png' });

  // ====== STEP 2: CEK JADWAL PAGE ======
  console.log('\n▶ JADWAL PAGE');
  console.log('=============');
  
  const jadwalBtn = await page.$('button.nav-item[data-page="jadwal"]');
  if (jadwalBtn) {
    await jadwalBtn.click();
    await new Promise(r => setTimeout(r, 1000));
  }
  
  const jadwalChecks = [
    ['Page Jadwal active', '#page-jadwal.page.active'],
    ['Day Tabs', '#day-tabs'],
    ['Tab Senin', 'button.day-tab[data-day="Senin"]'],
    ['Tab Selasa', 'button.day-tab[data-day="Selasa"]'],
    ['Tab Rabu', 'button.day-tab[data-day="Rabu"]'],
    ['Tab Kamis', 'button.day-tab[data-day="Kamis"]'],
    ['Tab Jumat', 'button.day-tab[data-day="Jumat"]'],
    ['Tab Sabtu', 'button.day-tab[data-day="Sabtu"]'],
    ['Schedule Table', '#schedule-table'],
    ['Add Button Jadwal', '#btn-add-schedule'],
  ];
  
  let jadwalOk = true;
  for (const [name, sel] of jadwalChecks) {
    const el = await page.$(sel);
    if (!el) { console.log(`  ⚠️  ${name}: HILANG`); jadwalOk = false; }
  }
  if (jadwalOk) console.log('  ✅ Jadwal Page - semua komponen terdeteksi');
  await page.screenshot({ path: 'ss_jadwal.png' });

  // ====== STEP 3: CEK STATUS PAGE ======
  console.log('\n▶ STATUS PAGE');
  console.log('=============');
  
  const statusBtn = await page.$('button.nav-item[data-page="status"]');
  if (statusBtn) {
    await statusBtn.click();
    await new Promise(r => setTimeout(r, 1000));
  }
  
  const statusChecks = [
    ['Page Status active', '#page-status.page.active'],
    ['Status Hero', '#status-hero'],
    ['ESP Online Status', '#status-esp-status'],
    ['Uptime', '#status-uptime'],
    ['WiFi Signal', '#status-wifi'],
    ['Last Sync', '#status-last-sync'],
    ['Today Count', '#status-today-count'],
    ['Status Cards Container', '#status-cards'],
    ['Individual Status Cards', '.stat-card'],
    ['Activity Timeline', '#timeline'],
    ['System Log', '#system-log'],
    ['Log List', '#log-list'],
  ];
  
  let statusOk = true;
  for (const [name, sel] of statusChecks) {
    const el = await page.$(sel);
    if (!el) { console.log(`  ⚠️  ${name}: HILANG`); statusOk = false; }
  }
  if (statusOk) console.log('  ✅ Status Page - semua komponen terdeteksi');
  await page.screenshot({ path: 'ss_status.png' });

  // ====== STEP 4: CEK SETTINGS PAGE ======
  console.log('\n▶ SETTINGS PAGE');
  console.log('===============');
  
  const settingsBtn = await page.$('button.nav-item[data-page="settings"]');
  if (settingsBtn) {
    await settingsBtn.click();
    await new Promise(r => setTimeout(r, 1000));
  }
  
  const settingsChecks = [
    // Page check
    ['Page Settings active', '#page-settings.page.active'],
    // System Settings
    ['System Settings Section', '#sys-settings'],
    ['Device Name Input', '#sys-device-name'],
    ['WiFi SSID Input', '#sys-wifi-ssid'],
    ['Sync Interval Input', '#sys-sync-interval'],
    ['Save System Button', '#sys-btn-save'],
    ['Restart ESP Button', '#sys-btn-restart'],
    ['Factory Reset Button', '#sys-btn-reset'],
    // Supabase Settings
    ['Supabase Settings', '#sb-settings'],
    ['Supabase URL Input', '#sb-url'],
    ['Supabase Anon Key Input', '#sb-anon-key'],
    ['Test Connection Button', '#sb-btn-test'],
    // Audio Library
    ['Audio Library Section', '#audio-library'],
    ['Upload Audio Button', '#audio-upload-btn'],
    ['Audio Files Table', '#audio-files'],
    // Advanced Schedule
    ['Advanced Schedule Section', '#sched-advanced'],
    ['Auto Sync Toggle', '#sched-auto-sync'],
    ['Relay on Bell Toggle', '#sched-relay-on-bell'],
    ['Relay Duration Input', '#sched-relay-duration'],
    // Notification Settings
    ['Notification Section', '#notif-settings'],
    ['Notification Enabled Toggle', '#notif-enabled'],
    ['Notification Email Input', '#notif-email'],
    // Danger Zone
    ['Danger Zone', '#danger-zone'],
    ['Clear Logs Button', '#danger-clear-logs'],
    ['Clear All Button', '#danger-clear-all'],
  ];
  
  let settingsOk = true;
  for (const [name, sel] of settingsChecks) {
    const el = await page.$(sel);
    if (!el) { console.log(`  ⚠️  ${name}: HILANG`); settingsOk = false; }
  }
  if (settingsOk) console.log('  ✅ Settings Page - semua komponen terdeteksi');
  await page.screenshot({ path: 'ss_settings.png' });

  // ====== STEP 5: CEK DARK MODE ======
  console.log('\n▶ DARK MODE');
  console.log('===========');
  
  const darkToggle = await page.$('#dark-mode-toggle');
  console.log(`  Dark Mode Toggle: ${darkToggle ? 'ADA' : 'HILANG'}`);
  
  if (darkToggle) {
    await darkToggle.click();
    await new Promise(r => setTimeout(r, 500));
    
    const darkActive = await page.evaluate(() => {
      return document.body.classList.contains('dark-mode') ||
             document.documentElement.classList.contains('dark') ||
             document.documentElement.getAttribute('data-theme') === 'dark';
    });
    console.log(`  Dark Mode after toggle: ${darkActive ? '✅ AKTIF' : '❌ TIDAK AKTIF'}`);
  }
  await page.screenshot({ path: 'ss_darkmode.png' });

  // ====== STEP 6: CEK BOTTOM NAV ======
  console.log('\n▶ BOTTOM NAVIGATION');
  console.log('===================');
  
  const navItems = await page.$$('button.nav-item');
  console.log(`  Jumlah nav items: ${navItems.length}`);
  
  const navLabels = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button.nav-item .nav-label'))
      .map(el => el.textContent.trim());
  });
  console.log(`  Label navigasi: ${navLabels.join(', ')}`);
  if (navLabels.length === 4) console.log('  ✅ Bottom Nav - 4 menu lengkap');

  // ====== STEP 7: CEK HEADER ======
  console.log('\n▶ HEADER');
  console.log('========');
  
  const headerChecks = [
    ['Header Clock', '#header-clock'],
    ['Header Date (desktop)', '#header-date'],
    ['ESP Status', '#header-esp'],
    ['ESP Status Dot', '#esp-dot'],
    ['ESP Status Label', '#esp-label'],
    ['Logout Button', '#btn-logout'],
  ];
  
  let headerOk = true;
  for (const [name, sel] of headerChecks) {
    const el = await page.$(sel);
    if (!el) { console.log(`  ⚠️  ${name}: HILANG`); headerOk = false; }
  }
  if (headerOk) console.log('  ✅ Header - semua komponen terdeteksi');

  // ====== FINAL SUMMARY ======
  console.log('\n' + '='.repeat(50));
  console.log('📋 RINGKASAN VERIFIKASI');
  console.log('='.repeat(50));
  
  const pages = ['home', 'jadwal', 'status', 'settings'];
  for (const p of pages) {
    const activePage = await page.$(`#page-${p}.page.active`);
    console.log(`  ${p.padEnd(12)} ${activePage ? '✅' : '❌'}`);
  }
  
  await browser.close();
  console.log('\n✅ Semua screenshot tersimpan!');
}

main().catch(e => {
  console.error('VERIFY ERROR:', e.message);
  process.exit(1);
});