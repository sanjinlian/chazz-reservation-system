const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const dir = 'splash_screens';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'));

let html = '';
files.forEach(f => {
  if (f === 'icon.png') return;
  const filePath = path.join(dir, f);
  const dimensions = execSync(`file "${filePath}"`).toString();
  const match = dimensions.match(/(\d+) x (\d+)/);
  if (match) {
    const width = parseInt(match[1], 10);
    const height = parseInt(match[2], 10);
    html += `    <link rel="apple-touch-startup-image" media="(device-width: ${width/3}px) and (device-height: ${height/3}px) and (-webkit-device-pixel-ratio: 3)" href="/splash_screens/${f}" />\n`;
    // The exact media queries for splash screens usually require matching device-width, device-height and pixel-ratio exactly, which is complex.
    // However, iOS 13+ actually supports a simpler `<link rel="apple-touch-startup-image" href="...">` for media queries if generated correctly.
    // Let me check if the generator produced an HTML file somewhere.
  }
});
fs.writeFileSync('splash_tags.txt', html);
