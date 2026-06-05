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
  // Example output: 10.2__iPad_landscape.png: PNG image data, 1620 x 2160, 8-bit/color RGBA, non-interlaced
  const match = dimensions.match(/(\d+) x (\d+)/);
  if (match) {
    const width = match[1];
    const height = match[2];
    // determine media query roughly
    const isLandscape = width > height;
    const deviceWidth = isLandscape ? height : width;
    const deviceHeight = isLandscape ? width : height;
    
    html += `    <link rel="apple-touch-startup-image" media="screen and (device-width: ${deviceWidth}px) and (device-height: ${deviceHeight}px) and (-webkit-device-pixel-ratio: 2) and (orientation: ${isLandscape ? 'landscape' : 'portrait'})" href="/splash_screens/${f}" />\n`;
  }
});
fs.writeFileSync('splash_tags.txt', html);
console.log('Tags generated');
