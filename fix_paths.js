const fs = require('fs');

// Fix index.html
let indexHtml = fs.readFileSync('index.html', 'utf8');
indexHtml = indexHtml.replace(/href="public\/splash_screens\//g, 'href="/splash_screens/');
indexHtml = indexHtml.replace(/<link rel="apple-touch-icon".*?>/, '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />');
fs.writeFileSync('index.html', indexHtml);

// Fix manifest.json
let manifest = JSON.parse(fs.readFileSync('public/manifest.json', 'utf8'));
manifest.icons = [
  {
    "src": "/apple-touch-icon.png",
    "sizes": "192x192 512x512",
    "type": "image/png",
    "purpose": "any maskable"
  }
];
fs.writeFileSync('public/manifest.json', JSON.stringify(manifest, null, 2));

console.log('Fixed paths');
