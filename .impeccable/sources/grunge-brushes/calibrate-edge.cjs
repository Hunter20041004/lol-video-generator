// Diagnostic known-answer images only; not artwork or shipping assets.
const sharp = require('sharp');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, 'edge-calibration');
fs.mkdirSync(root, { recursive: true });
const region = { regions: [{ id: 'center-object', kind: 'image', box: { x: .2, y: .2, w: .6, h: .6 }, note: 'A centered white square with a 60px background margin on every side; known object does not contact region edges.' }] };
fs.writeFileSync(path.join(root, 'regions.json'), JSON.stringify(region));
(async () => {
  for (const background of ['#f7f7ec', '#800808']) {
    const name = background === '#800808' ? 'red' : 'light';
    await sharp({ create: { width: 400, height: 400, channels: 3, background } })
      .composite([{ input: await sharp({ create: { width: 120, height: 120, channels: 3, background: '#ffffff' } }).png().toBuffer(), left: 140, top: 140 }])
      .png().toFile(path.join(root, `${name}.png`));
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
