const puppeteer = require('puppeteer');

async function main() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.goto('http://localhost:8080', { waitUntil: 'networkidle0', timeout: 15000 });

  // Screenshot halaman login
  await page.screenshot({ path: 'screenshot_login.png', fullPage: true });

  // Cek struktur DOM dari halaman login
  console.log('=== VISIBLE DOM STRUCTURE ===');
  const structure = await page.evaluate(() => {
    const result = {};
    const walk = (node, depth) => {
      if (depth > 6) return;
      const style = window.getComputedStyle(node);
      const visible = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && (node.offsetParent !== null || node === document.body);
      if (!visible && node !== document.body) return;
      const tag = node.tagName ? node.tagName.toLowerCase() : '#text';
      const id = node.id ? '#' + node.id : '';
      let cls = '';
      if (node.className && typeof node.className === 'string') {
        cls = '.' + node.className.trim().split(/\s+/).join('.');
      }
      const key = tag + id + cls;
      result[key] = (result[key] || 0) + 1;
      for (const child of node.children) {
        walk(child, depth + 1);
      }
    };
    walk(document.body, 0);
    return result;
  });

  const keys = Object.keys(structure).sort();
  for (const k of keys) {
    console.log(k);
  }

  // Cek komponen spesifik
  console.log('\n=== COMPONENT CHECK ===');
  const checks = [
    { name: '1. Modern Login Page', sel: '.login-card' },
    { name: '2. Hero Dashboard Card', sel: '#home-bell-card' },
    { name: '3. Large Digital Clock', sel: '#home-clock' },
    { name: '4. Current Date', sel: '#home-date' },
    { name: '5. ESP32 Online Status', sel: '#home-esp-status' },
    { name: '6. Next Bell Card', sel: '#home-next-bell' },
    { name: '7. Countdown Timer', sel: '#home-countdown' },
    { name: '8. Device Status Grid', sel: '.device-grid' },
    { name: '9. Quick Action Buttons', sel: '.quick-actions' },
    { name: '10. Bottom Navigation', sel: '.bottom-nav' },
    { name: '11. Modern Schedule Page', sel: '.schedule-page' },
    { name: '12. Horizontal Day Tabs', sel: '.day-tabs' },
    { name: '13. Modern Schedule Table', sel: '.schedule-table' },
    { name: '14. Status Monitoring Dashboard', sel: '.status-hero' },
    { name: '15. Activity Timeline', sel: '.timeline' },
    { name: '16. System Log', sel: '.system-log' },
    { name: '17. Settings Page', sel: '.settings-page' },
    { name: '18. Dark Mode Toggle', sel: '.dark-mode-toggle' },
  ];

  for (const c of checks) {
    const el = await page.$(c.sel);
    console.log(`${c.name}: ${el ? 'YES' : 'NO'}`);
  }

  // Ambil screenshot tambahan
  // Coba klik login untuk lihat halaman utama (kalau ada)
  const loginBtn = await page.$('.login-btn');
  if (loginBtn) {
    // Isi form login dummy
    const emailInput = await page.$('#login-email');
    const passInput = await page.$('#login-password');
    if (emailInput && passInput) {
      await emailInput.type('test@example.com');
      await passInput.type('password123');
    }
  }

  await browser.close();
  console.log('\nScreenshot saved: frontend/screenshot_login.png');
}

main().catch(e => {
  console.error('VERIFY ERROR:', e.message);
  process.exit(1);
});