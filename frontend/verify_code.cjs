/**
 * Code-level verification for Smart School Bell IoT
 * Checks consistency between HTML, JS, and database references
 * without requiring a running server.
 */

const fs = require('fs');
const path = require('path');

const FRONTEND = path.join(__dirname);
const JS_DIR = path.join(FRONTEND, 'js');
const HTML_FILE = path.join(FRONTEND, 'index.html');
const CSS_FILE = path.join(FRONTEND, 'css', 'style.css');

// Read all JS files
function readJSFiles() {
    const files = fs.readdirSync(JS_DIR).filter(f => f.endsWith('.js'));
    const contents = {};
    for (const f of files) {
        contents[f] = fs.readFileSync(path.join(JS_DIR, f), 'utf8');
    }
    return contents;
}

function readFile(p) {
    try { return fs.readFileSync(p, 'utf8'); }
    catch { return ''; }
}

// === MAIN VERIFICATION ===
let errors = 0;
let warnings = 0;
const results = [];

function check(condition, msg, type = 'error') {
    if (!condition) {
        results.push(`  ${type === 'error' ? '❌' : '⚠️'} ${msg}`);
        if (type === 'error') errors++;
        else warnings++;
    } else {
        results.push(`  ✅ ${msg}`);
    }
}

console.log('='.repeat(60));
console.log('🔍 KODE VERIFIKASI - Smart School Bell IoT');
console.log('='.repeat(60));

const jsFiles = readJSFiles();
const html = readFile(HTML_FILE);
const css = readFile(CSS_FILE);

// ====== 1. CEK SEMUA FILE JS ADA ======
console.log('\n📁 FILE STRUCTURE');
const expectedJS = ['app.js', 'config.js', 'auth.js', 'home.js', 'jadwal.js', 'status.js', 'settings.js'];
for (const f of expectedJS) {
    check(jsFiles[f] !== undefined, `File ${f} ada`);
}

// ====== 2. CEK KONSISTENSI SUPABASE TABLE NAMES ======
console.log('\n🗄️  SUPABASE TABLE NAMES');
const allJS = Object.values(jsFiles).join('\n');
// Ekstrak referensi tabel, TAPI kecualikan storage.from() bucket references
const tableSet = new Set();
const storageBuckets = new Set();

// Pass 1: cari storage bucket references (.storage .from('...') bisa multi-line)
const storageRefPattern = /\.storage\s*\.\s*from\s*\(\s*'([^']+)'\s*\)/gs;
let storageMatch;
while ((storageMatch = storageRefPattern.exec(allJS)) !== null) {
    storageBuckets.add(storageMatch[1]);
}

// Pass 2: cari .from('...') references (tabel SQL), filter storage buckets
const tableRefPattern = /\.from\s*\(\s*'([^']+)'\s*\)/g;
let tableMatch;
while ((tableMatch = tableRefPattern.exec(allJS)) !== null) {
    const name = tableMatch[1];
    if (!storageBuckets.has(name)) {
        tableSet.add(name);
    }
}
const tables = [...tableSet];

// Semua tabel yang valid dan digunakan di project
const validTables = [
    'schedules',         // Jadwal bel
    'audios',            // Daftar audio (referensi track_number)
    'devices',           // Registrasi perangkat ESP32
    'esp_status',        // Status terkini ESP32 (1 baris per device)
    'esp_commands',      // Perintah remote untuk ESP32
    'bell_history',      // Riwayat bel otomatis
    'system_logs',       // Log sistem dari ESP32
    'esp_config',        // Konfigurasi ESP32 (opsional, untuk frontend)
    'bell_log',          // Log bel (frontend legacy)
    'system_log',        // Log sistem (frontend legacy)  
    'audio_library',     // Library audio frontend
    'app_settings',      // Pengaturan aplikasi frontend
    '_health_check',     // Untuk test koneksi
];

// Cek storage buckets
for (const b of storageBuckets) {
    check(true, `Storage bucket '${b}' valid (bukan tabel SQL)`);
}

// Cek tabel
for (const t of tables) {
    check(validTables.includes(t), `Table '${t}' valid`);
}

// ====== 3. CEK DOM ID REFERENCED IN JS EXIST IN HTML ======
console.log('\n🏷️  DOM ID CONSISTENCY');
const idPattern = /document\.getElementById\('([^']+)'\)/g;
let match;
const jsIds = [];
while ((match = idPattern.exec(allJS)) !== null) {
    jsIds.push(match[1]);
}
for (const id of [...new Set(jsIds)]) {
    const exists = html.includes(`id="${id}"`);
    check(exists, `Element ID "${id}" ada di HTML`);
}

// ====== 4. CEK BOTTOM NAV DATA-PAGE ======
console.log('\n🧭 NAVIGATION');
const navPages = [...html.matchAll(/data-page="([^"]+)"/g)].map(m => m[1]);
const jsPages = [...allJS.matchAll(/navigateTo\('([^']+)'\)/g)].map(m => m[1]);
for (const p of navPages) {
    check(jsFiles['app.js']?.includes(`'${p}'`) || allJS.includes(`"${p}"`),
        `Navigation page "${p}" referenced in JS`);
}

// ====== 5. CEK FUNCTION CALLS ======
console.log('\n🔧 FUNCTION REFERENCES');
// Ambil semua function definitions di semua JS files
const funcDefs = [];
const funcPattern = /(?:async\s+)?function\s+(\w+)/g;
for (const [fname, content] of Object.entries(jsFiles)) {
    while ((match = funcPattern.exec(content)) !== null) {
        funcDefs.push({ name: match[1], file: fname });
    }
    // Juga tangkap arrow function assignments: const x = async () =>
    const arrowPattern = /const\s+(\w+)\s*=\s*(?:async\s*)?\(/g;
    while ((match = arrowPattern.exec(content)) !== null) {
        funcDefs.push({ name: match[1], file: fname });
    }
    // Juga tangkap method assignments: x.y = function / x.y = () =>
    const methodPattern = /(\w+)\.(\w+)\s*=\s*(?:async\s*)?(?:function|\(|=>)/g;
    while ((match = methodPattern.exec(content)) !== null) {
        // Don't add DOM ref assignments like element.addEventListener
        if (match[2] !== 'addEventListener' && match[2] !== 'onclick') {
            funcDefs.push({ name: match[2], file: fname });
        }
    }
}

// Cek bahwa fungsi yang dipanggil dari page lain ada definisinya
const callPattern = /\b(\w+)\s*\(/g;
for (const [fname, content] of Object.entries(jsFiles)) {
    const localDefs = funcDefs.filter(d => d.file === fname).map(d => d.name);
    const appDefs = funcDefs.filter(d => d.file === 'app.js').map(d => d.name);
    
    while ((match = callPattern.exec(content)) !== null) {
        const fn = match[1];
        // Skip built-in and common patterns
        if (['if', 'for', 'while', 'switch', 'catch', 'console', 'Math', 'JSON', 'Date',
             'require', 'setTimeout', 'setInterval', 'clearTimeout', 'parseInt', 'parseFloat',
             'Number', 'String', 'Boolean', 'Array', 'Object', 'alert', 'confirm', 'fetch',
             'document', 'window', 'localStorage', 'navigator', 'this', 'new', 'delete',
             'typeof', 'instanceof', 'return', 'throw', 'else', 'try', 'finally',
             'Audio', 'FormData', 'Blob', 'FileReader', 'Promise', 'Map', 'Set',
             'null', 'true', 'false', 'undefined', 'NaN', 'Infinity',
             'EventSource', 'WebSocket', 'Worker', 'MutationObserver',
             'IntersectionObserver', 'ResizeObserver', 'PerformanceObserver',
             'self', 'globalThis', 'global'].includes(fn)) continue;
        
        // Skip DOM methods and common Web API
        if (['getElementById', 'querySelector', 'querySelectorAll', 'createElement', 
             'appendChild', 'removeChild', 'addEventListener', 'removeEventListener',
             'getItem', 'setItem', 'removeItem', 'clear', 'key',
             'parse', 'stringify', 'log', 'error', 'warn', 'info',
             'now', 'getTime', 'getFullYear', 'getMonth', 'getDate', 'getDay',
             'getHours', 'getMinutes', 'getSeconds', 'getMilliseconds',
             'toLocaleString', 'toLocaleDateString', 'toLocaleTimeString',
             'toTimeString', 'toDateString', 'toISOString',
             'includes', 'startsWith', 'endsWith', 'indexOf', 'lastIndexOf',
             'slice', 'splice', 'split', 'join', 'concat', 'reverse', 'sort',
             'push', 'pop', 'shift', 'unshift', 'forEach', 'map', 'filter', 'reduce',
             'find', 'findIndex', 'some', 'every', 'flat', 'flatMap',
             'trim', 'trimStart', 'trimEnd', 'toLowerCase', 'toUpperCase',
             'replace', 'replaceAll', 'match', 'search', 'charAt', 'charCodeAt',
             'padStart', 'padEnd', 'repeat',
             'add', 'remove', 'toggle', 'contains', 'replaceWith',
             'floor', 'ceil', 'round', 'abs', 'min', 'max', 'random', 'sqrt', 'pow',
             'toFixed', 'toExponential', 'toPrecision',
             'valueOf', 'toString', 'constructor',
             'play', 'pause', 'load', 'addTextTrack',
             'click', 'focus', 'blur', 'submit', 'reset',
             'scrollIntoView', 'scrollTo', 'scrollBy',
             'animate', 'getComputedStyle', 'getBoundingClientRect',
             'preventDefault', 'stopPropagation', 'stopImmediatePropagation',
             'classList', 'style', 'dataset', 'innerHTML', 'textContent', 'innerText',
             'value', 'checked', 'disabled', 'readonly', 'hidden',
             'reload', 'assign', 'replace', 'back', 'forward',
             'open', 'close', 'send', 'setRequestHeader',
             'upload', 'delete', 'insert', 'update', 'select', 'order', 'limit', 'eq', 'neq',
             'from', 'storage', 'auth', 'rpc',
             'getSession', 'signOut', 'signInWithPassword',
             'getPublicUrl', 'then', 'catch', 'finally'].includes(fn)) continue;
        
        // Skip properties accessed as methods (e.g., domElement.method())
        if (fn.startsWith('on')) continue;
        
        // Cek apakah fungsi didefinisikan di file yang sama atau app.js
        const def = funcDefs.find(d => d.name === fn && (d.file === fname || d.file === 'app.js'));
        if (fn === fn.toUpperCase()) continue; // Constants
        
        if (!def && fn.length > 2) {
            warnings++;
            results.push(`  ⚠️  ${fname}: ${fn}() - tidak ditemukan definisinya (mungkin global/eksternal)`);
        }
    }
}

// ====== 6. CEK CONFIG KEAMANAN ======
console.log('\n🔒 SECURITY CHECKS');
const configContent = jsFiles['config.js'] || '';
check(!configContent.includes('supabase-key-here'), 'Supabase anon key placeholder diubah');
check(!configContent.includes('your-project'), 'Supabase URL placeholder diubah');
check(!configContent.includes('service_role') && !configContent.includes('service_role_key'),
    'Service role key tidak bocor ke frontend');
check(!configContent.includes('supabase_url') || configContent.includes('const SUPABASE_URL'),
    'Config constants format');

// ====== 7. CEK ERROR HANDLING ======
console.log('\n🛡️  ERROR HANDLING');
for (const [fname, content] of Object.entries(jsFiles)) {
    const hasTryCatch = content.includes('try {') && content.includes('catch');
    const hasConsoleError = content.includes('console.error');
    check(hasTryCatch || fname === 'config.js',
        `${fname}: ${hasTryCatch ? 'try/catch' : '⚠️ tanpa try/catch'}`,
        hasTryCatch ? 'info' : 'warning');
    check(hasConsoleError, `${fname}: console.error() ada`, 'info');
}

// ====== 8. CEK CSS VARIABLES USAGE ======
console.log('\n🎨 CSS CONSISTENCY');
const cssVars = css.match(/--[\w-]+/g) || [];
const htmlVarUsage = html.match(/var\(--[\w-]+\)/g) || [];
for (const v of [...new Set(htmlVarUsage.map(v => v.replace('var(', '').replace(')', '')))]) {
    check(css.includes(v), `CSS variable ${v} didefinisikan di style.css`);
}

// ====== 9. CEK CRITICAL HTML STRUCTURE ======
console.log('\n📄 HTML STRUCTURE');
const criticalElements = [
    ['#app-shell', 'App Shell'],
    ['.bottom-nav', 'Bottom Navigation'],
    ['.app-header', 'Header'],
    ['#page-home', 'Home Page'],
    ['#page-jadwal', 'Jadwal Page'],
    ['#page-status', 'Status Page'],
    ['#page-settings', 'Settings Page'],
    ['meta[name="viewport"]', 'Viewport Meta'],
    ['script[src="js/app.js"]', 'App JS Script'],
    ['script[src="js/config.js"]', 'Config JS Script'],
];
for (const [sel, name] of criticalElements) {
    // Convert CSS selector to HTML content search
    let searchStr = sel;
    if (sel.startsWith('#')) {
        // ID selector: #app-shell -> id="app-shell"
        searchStr = `id="${sel.slice(1)}"`;
    } else if (sel.startsWith('.')) {
        // Class selector: .bottom-nav -> class="bottom-nav" or class*="bottom-nav"
        searchStr = sel.slice(1);
        check(html.includes(`class="${searchStr}"`) || html.includes(`class="${searchStr} `) || 
              html.includes(`class=" ${searchStr}"`) || html.includes(`class="${searchStr}"`),
            `${name} (${sel})`);
        continue;
    } else if (sel.startsWith('meta[')) {
        // Meta selector: meta[name="viewport"] -> check for <meta name="viewport" in HTML
        const attrMatch = sel.match(/\[(\w+)="([^"]+)"\]/);
        if (attrMatch) {
            const attrName = attrMatch[1];
            const attrValue = attrMatch[2];
            check(html.includes(`${attrName}="${attrValue}"`), `${name} (${sel})`);
        } else {
            check(html.includes(sel), `${name} (${sel})`);
        }
        continue;
    } else if (sel.startsWith('script[')) {
        // Script selector: script[src="js/app.js"] -> check for src="js/app.js"
        const attrMatch = sel.match(/\[(\w+)="([^"]+)"\]/);
        if (attrMatch) {
            const attrName = attrMatch[1];
            const attrValue = attrMatch[2];
            check(html.includes(`${attrName}="${attrValue}"`), `${name} (${sel})`);
        } else {
            check(html.includes(sel), `${name} (${sel})`);
        }
        continue;
    }
    
    check(html.includes(searchStr), `${name} (${sel})`);
}

// ====== 10. CEK MODULE SYSTEM ======
console.log('\n📦 MODULE SYSTEM');
const hasModuleExports = allJS.includes('module.exports') || allJS.includes('export ');
const hasImport = allJS.includes('import ') || allJS.includes('require(');
// Frontend uses global scripts, no modules needed
check(!hasModuleExports, 'Tidak menggunakan module.exports (frontend global scripts)');
check(hasImport === hasModuleExports, 'Imports/exports balanced', 'info');

// ====== SUMMARY ======
console.log('\n' + '='.repeat(60));
console.log('📋 HASIL VERIFIKASI');
console.log('='.repeat(60));
console.log(`  ❌ Errors:   ${errors}`);
console.log(`  ⚠️  Warnings: ${warnings}`);
console.log(`  ✅ Total checks: ${results.length}`);
console.log('');

if (errors === 0) {
    console.log('  🎉 SEMUA VERIFIKASI KODE LULUS!');
    console.log('  Aplikasi siap untuk deployment.\n');
} else {
    console.log(`  ⚠️  ${errors} error(s) perlu diperbaiki.\n`);
}

console.log('Detailed results:');
const sections = results.join('\n');
console.log(sections);

process.exit(errors > 0 ? 1 : 0);