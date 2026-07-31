import puppeteer from 'puppeteer';

async function main() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.goto('http://localhost:8080', { waitUntil: 'networkidle0', timeout: 10000 });

  // Screenshot login page
  await page.screenshot({ path: 'screenshot_login.png', fullPage: true });

  // Check login page
  const loginCard = await page.$('.login-card');
  const loginForm = await page.$('.login-form');
  const loginTitle = await page.$('.login-title');

  console.log('=== INITIAL PAGE CHECK ===');
  console.log('login-card:', !!loginCard);
  console.log('login-form:', !!loginForm);
  console.log('login-title:', !!loginTitle);

  // Get all visible element classes/IDs
  const structure = await page.evaluate(() => {
    const result = {};
    const el = document.body;
    if (!el) return { error: 'no body' };
    const walk = (node, depth) => {
      if (depth > 6) return;
      const style = window.getComputedStyle(node);
      const visible = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && node.offsetParent !== null;
      if (!visible && node !== document.body) return;
      const tag = node.tagName ? node.tagName.toLowerCase() : 'text';
      const id = node.id ? '#' + node.id : '';
      let cls = '';
      if (node.className && typeof node.className === 'string') {
        cls = node.className.split(' ').filter(c => c).map(c => '.' + c).join('');
      }
      const key = tag + id + cls;
      result[key] = (result[key] || 0) + 1;
      for (const child of node.children || []) {
        walk(child, depth + 1);
      }
    };
    walk(document.body, 0);
    return result;
  });

  console.log('\n=== VISIBLE DOM STRUCTURE ===');
  const keys = Object.keys(structure).sort();
  for (const k of keys) {
    console.log(k);
  }

  // Check specific components
  const checks = [
    '.login-card', '.login-form', '.login-title', '#login-email', '#login-password',
    '.login-btn', '.dark-mode-toggle',
    '.app-shell', '.app-header', '.app-content', '.bottom-nav',
    '.page-home', '.page-jadwal', '.page-status', '.page-settings',
    '#home-bell-card', '#home-clock', '#home-date', '#home-esp-status',
    '#home-next-bell', '#home-countdown', '.device-grid', '.quick-actions',
    '.schedule-page', '.day-tabs', '.schedule-table',
    '.status-hero', '.status-cards', '.timeline', '.system-log',
    '.settings-page'
  ];

  console.log('\n=== COMPONENT CHECK ===');
  for (const sel of checks) {
    const el = await page.$(sel);
    console.log(`${sel}: ${!!el ? 'YES' : 'NO'}`);
  }

  await browser.close();
}

main().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});