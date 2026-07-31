const puppeteer = require('puppeteer');

async function main() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.goto('http://localhost:8080', { waitUntil: 'networkidle0', timeout: 15000 });

  // ====== STEP 1: CEK HALAMAN LOGIN ======
  console.log('========================================');
  console.log('STEP 1: CEK HALAMAN LOGIN');
  console.log('========================================');
  
  const loginChecks = [
    ['Login Page Container', '#page-login.login-page'],
    ['Login Logo', '.login-logo'],
    ['Login Icon (Megaphone)', '.login-icon'],
    ['Login Title', '.login-title'],
    ['Login Subtitle', '.login-subtitle'],
    ['Form Login', '#form-login.login-form'],
    ['Input Username', '#login-username'],
    ['Input Password', '#login-password'],
    ['Button Login', '#btn-login.login-btn'],
    ['Login Footer', '.login-footer'],
  ];
  
  for (const [name, sel] of loginChecks) {
    const el = await page.$(sel);
    console.log(`${name} (${sel}): ${el ? 'YES' : 'NO'}`);
  }

  // Screenshot login
  await page.screenshot({ path: 'screenshot_01_login.png' });

  // ====== STEP 2: BYPASS LOGIN ======
  console.log('\n========================================');
  console.log('STEP 2: BYPASS LOGIN - Inject localStorage');
  console.log('========================================');
  
  // Inject session ke localStorage untuk bypass login
  await page.evaluate(() => {
    localStorage.setItem('sb-session', 'bypass');
    localStorage.setItem('user', JSON.stringify({ username: 'admin', role: 'admin' }));
  });
  
  // Reload page
  await page.reload({ waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));

  // ====== STEP 3: CEK APP SHELL ======
  console.log('STEP 3: CEK APP SHELL SETELAH LOGIN');
  
  const appShellChecks = [
    ['App Shell (visible)', '#app-shell:not(.d-none)'],
    ['Header', '.app-header'],
    ['Header Logo', '.header-logo'],
    ['Header Title', '.header-title'],
    ['Header Clock', '#header-clock'],
    ['Header Date', '#header-date'],
    ['Header ESP Status', '#header-esp'],
    ['Logout Button', '#btn-logout'],
    ['Content Area', '#app-content'],
    ['Bottom Navigation', '.bottom-nav'],
  ];
  
  for (const [name, sel] of appShellChecks) {
    try {
      let found = false;
      if (sel.includes(':not(')) {
        // Custom check for visibility
        const parts = sel.split(':not(');
        const baseSel = parts[0];
        const notSel = parts[1].replace(')', '');
        const el = await page.$(baseSel);
        if (el) {
          const hasHiddenClass = await page.evaluate((s) => {
            const e = document.querySelector(s);
            return e && e.classList.contains('d-none');
          }, baseSel.replace('#', ''));
          found = !hasHiddenClass;
        }
      } else {
        const el = await page.$(sel);
        found = !!el;
      }
      console.log(`${name} (${sel}): ${found ? 'YES' : 'NO'}`);
    } catch(e) {
      console.log(`${name} (${sel}): ERROR - ${e.message}`);
    }
  }

  // Screenshot app shell
  await page.screenshot({ path: 'screenshot_02_appshell.png' });

  // ====== STEP 4: CEK HOME PAGE ======
  console.log('\nSTEP 4: CEK HOME PAGE');
  
  const homeChecks = [
    ['Home Page visible', '#page-home.page.active'],
    ['Hero Card', '#hero-card.hero-card'],
    ['Hero School Name', '#hero-school'],
    ['Hero ESP Badge', '#hero-esp-badge'],
    ['Hero Clock', '#hero-clock'],
    ['Hero Date', '#hero-date'],
    ['Hero System Status', '#hero-sys-status'],
    ['Section Label "Bel Berikutnya"', '.section-label'],
    ['Next Bell Card', '#nextbell-card.nextbell-card'],
    ['Next Bell Time', '#nextbell-time'],
    ['Next Bell Name', '#nextbell-name'],
    ['Next Bell Audio', '#nextbell-audio'],
    ['Next Bell Countdown', '#nextbell-countdown'],
    ['Countdown Value', '#countdown-value'],
    ['Next Bell Status Badge', '#nextbell-status-badge'],
    ['Section "Status Perangkat"', '.device-grid'],
    ['Section "Aksi Cepat"', '.quick-actions'],
    ['Button Test Audio', '#btn-test-audio'],
    ['Button Relay 1 ON', '.qa-relay[data-relay="1"][data-action="on"]'],
    ['Button Relay 1 OFF', '.qa-relay[data-relay="1"][data-action="off"]'],
    ['Button Relay 2 ON', '.qa-relay[data-relay="2"][data-action="on"]'],
    ['Button Relay 2 OFF', '.qa-relay[data-relay="2"][data-action="off"]'],
    ['Button Sync RTC', '#btn-sync-rtc'],
    ['Button Refresh', '#btn-refresh-status'],
    ['Button Restart ESP', '#btn-restart-esp'],
  ];
  
  for (const [name, sel] of homeChecks) {
    const el = await page.$(sel);
    console.log(`${name} (${sel}): ${el ? 'YES' : 'NO'}`);
  }

  // Screenshot home page
  await page.screenshot({ path: 'screenshot_03_home.png' });

  // ====== STEP 5: CEK NAVIGASI BOTTOM ======
  console.log('\nSTEP 5: CEK BOTTOM NAVIGATION');
  
  const navBtns = await page.$$('.bottom-nav .nav-btn, .nav-item, .nav-link');
  console.log(`Total nav buttons found: ${navBtns.length}`);
  
  const navChecks = [
    'Home / Beranda',
    'Jadwal',
    'Status',
    'Settings / Pengaturan',
  ];
  
  for (const name of navChecks) {
    const found = await page.evaluate((n) => {
      return !!document.querySelector(`.bottom-nav *`) && 
             document.body.innerText.includes(n);
    }, name);
    console.log(`Nav "${name}" visible: ${found ? 'YES' : 'NO'}`);
  }

  // ====== STEP 6: CEK JADWAL PAGE ======
  console.log('\nSTEP 6: CEK JADWAL PAGE (click nav)');
  
  // Click jadwal nav
  const jadwalBtn = await page.$('.bottom-nav button:nth-child(2), .nav-btn:nth-child(2), [data-page="jadwal"]');
  if (jadwalBtn) {
    await jadwalBtn.click();
    await new Promise(r => setTimeout(r, 1000));
  }
  
  await page.screenshot({ path: 'screenshot_04_jadwal.png' });
  
  const jadwalChecks = [
    ['Jadwal Page visible', '#page-jadwal.page.active'],
    ['Day Tabs', '#day-tabs.day-tabs'],
    ['Tab Senin', '.day-tab[data-day="Senin"]'],
    ['Tab Selasa', '.day-tab[data-day="Selasa"]'],
    ['Tab Rabu', '.day-tab[data-day="Rabu"]'],
    ['Tab Kamis', '.day-tab[data-day="Kamis"]'],
    ['Tab Jumat', '.day-tab[data-day="Jumat"]'],
    ['Tab Sabtu', '.day-tab[data-day="Sabtu"]'],
    ['Schedule Table', '#schedule-table, .schedule-table'],
    ['Add Button', '#btn-add-schedule, .btn-add'],
  ];
  
  for (const [name, sel] of jadwalChecks) {
    const el = await page.$(sel);
    console.log(`${name} (${sel}): ${el ? 'YES' : 'NO'}`);
  }

  // ====== STEP 7: CEK STATUS PAGE ======
  console.log('\nSTEP 7: CEK STATUS PAGE');
  
  const statusBtn = await page.$('.bottom-nav button:nth-child(3), .nav-btn:nth-child(3), [data-page="status"]');
  if (statusBtn) {
    await statusBtn.click();
    await new Promise(r => setTimeout(r, 1000));
  }
  
  await page.screenshot({ path: 'screenshot_05_status.png' });
  
  const statusChecks = [
    ['Status Page visible', '#page-status.page.active'],
    ['Status Hero/Header', '#status-hero, .status-hero'],
    ['ESP Online Status', '#status-esp-status, .status-esp'],
    ['Uptime', '#status-uptime, .status-uptime'],
    ['WiFi Signal', '#status-wifi, .status-wifi'],
    ['Last Sync', '#status-last-sync, .status-last-sync'],
    ['Status Cards', '.status-cards, .stat-card'],
    ['Timeline', '#timeline, .timeline'],
    ['System Log', '#system-log, .system-log'],
    ['Log entries', '#log-list, .log-list, .log-entry'],
  ];
  
  for (const [name, sel] of statusChecks) {
    const el = await page.$(sel);
    console.log(`${name} (${sel}): ${el ? 'YES' : 'NO'}`);
  }

  // ====== STEP 8: CEK SETTINGS PAGE ======
  console.log('\nSTEP 8: CEK SETTINGS PAGE');
  
  const settingsBtn = await page.$('.bottom-nav button:nth-child(4), .nav-btn:nth-child(4), [data-page="settings"]');
  if (settingsBtn) {
    await settingsBtn.click();
    await new Promise(r => setTimeout(r, 1000));
  }
  
  await page.screenshot({ path: 'screenshot_06_settings.png' });
  
  const settingsChecks = [
    ['Settings Page visible', '#page-settings.page.active'],
    ['System Settings section', '#sys-settings, .sys-settings'],
    ['Device Name', '#sys-device-name'],
    ['WiFi SSID', '#sys-wifi-ssid'],
    ['Sync Interval', '#sys-sync-interval'],
    ['Save System Button', '#sys-btn-save'],
    ['Restart Button', '#sys-btn-restart'],
    ['Factory Reset', '#sys-btn-reset'],
    ['Supabase Settings', '#sb-settings, .supabase-settings'],
    ['Supabase URL', '#sb-url'],
    ['Supabase Key', '#sb-anon-key'],
    ['Test Connection', '#sb-btn-test'],
    ['Audio Library', '#audio-upload-btn, .audio-library'],
    ['Upload Button', '#audio-upload-btn'],
    ['Advanced Schedule', '#sched-auto-sync, .sched-advanced'],
    ['Auto Sync', '#sched-auto-sync'],
    ['Relay on Bell', '#sched-relay-on-bell'],
    ['Relay Duration', '#sched-relay-duration'],
    ['Notification Settings', '#notif-enabled, .notif-settings'],
    ['Notification Email', '#notif-email'],
    ['Danger Zone', '#danger-zone, .danger-zone'],
    ['Clear Logs Button', '#danger-clear-logs'],
    ['Clear All Button', '#danger-clear-all'],
  ];
  
  for (const [name, sel] of settingsChecks) {
    const el = await page.$(sel);
    console.log(`${name} (${sel}): ${el ? 'YES' : 'NO'}`);
  }

  // ====== STEP 9: CEK DARK MODE ======
  console.log('\nSTEP 9: CEK DARK MODE');
  
  const darkToggle = await page.$('.dark-mode-toggle, #dark-mode-toggle, [data-theme-toggle]');
  console.log(`Dark Mode Toggle button: ${darkToggle ? 'YES' : 'NO'}`);
  
  // Cek apakah dark mode bisa di-toggle
  const hasDarkClass = await page.evaluate(() => {
    return document.documentElement.classList.contains('dark') || 
           document.body.classList.contains('dark-mode') ||
           document.documentElement.getAttribute('data-theme') === 'dark';
  });
  console.log(`Dark mode active: ${hasDarkClass ? 'YES' : 'NO'}`);

  // ====== SUMMARY ======
  console.log('\n========================================');
  console.log('SUMMARY - YANG MUNCUL DI LAYAR');
  console.log('========================================');
  console.log(`
KOMPONEN                     STATUS
─────────────────────────────────────────────
Login Page                   ${(await page.$('#page-login')) ? 'ADA' : 'HILANG'}
App Shell                    ${(await page.$('#app-shell')) ? 'ADA' : 'HILANG'}
Hero Card                    ${(await page.$('#hero-card')) ? 'ADA' : 'HILANG'}
Digital Clock                ${(await page.$('#hero-clock')) ? 'ADA' : 'HILANG'}
Current Date                 ${(await page.$('#hero-date')) ? 'ADA' : 'HILANG'}
ESP Status Badge             ${(await page.$('#hero-esp-badge')) ? 'ADA' : 'HILANG'}
Next Bell Card               ${(await page.$('#nextbell-card')) ? 'ADA' : 'HILANG'}
Countdown Timer              ${(await page.$('#countdown-value')) ? 'ADA' : 'HILANG'}
Device Grid                  ${(await page.$('#device-grid')) ? 'ADA' : 'HILANG'}
Quick Actions                ${(await page.$('#quick-actions')) ? 'ADA' : 'HILANG'}
Bottom Nav                   ${(await page.$('.bottom-nav')) ? 'ADA' : 'HILANG'}
Day Tabs                     ${(await page.$('#day-tabs')) ? 'ADA' : 'HILANG'}
Schedule Table               ${(await page.$('#schedule-table')) ? 'ADA' : 'HILANG'}
Status Page                  ${(await page.$('#page-status')) ? 'ADA' : 'HILANG'}
Timeline                     ${(await page.$('#timeline, .timeline')) ? 'ADA' : 'HILANG'}
System Log                   ${(await page.$('#system-log, .system-log')) ? 'ADA' : 'HILANG'}
Settings Page                ${(await page.$('#page-settings')) ? 'ADA' : 'HILANG'}
Dark Mode Toggle             ${darkToggle ? 'ADA' : 'HILANG'}
`);

  await browser.close();
  console.log('\n✅ Screenshots saved!');
}

main().catch(e => {
  console.error('VERIFY ERROR:', e.message);
  process.exit(1);
});