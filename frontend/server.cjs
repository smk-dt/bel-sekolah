const http = require('http');
const fs = require('fs');
const path = require('path');

const mime = {
  'html': 'text/html',
  'js': 'text/javascript',
  'css': 'text/css',
  'png': 'image/png',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'ico': 'image/x-icon',
  'svg': 'image/svg+xml',
  'json': 'application/json',
  'woff2': 'font/woff2'
};

http.createServer((req, res) => {
  let urlPath = req.url === '/' ? 'index.html' : req.url.split('?')[0];
  let filePath = path.join('frontend', urlPath);
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
    } else {
      const ext = path.extname(filePath).slice(1);
      res.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain', 'Cache-Control': 'no-cache' });
      res.end(data);
    }
  });
}).listen(8080, () => {
  console.log('Server berjalan di http://localhost:8080');
});