const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');

// Read the actual Unicode cmap (format 12), not a hand-maintained glyph list.
function glyphId(font, codePoint) {
  const tables=font.readUInt16BE(4);
  for(let i=0;i<tables;i++) {
    const record=12+i*16;
    if(font.toString('ascii',record,record+4)!=='cmap')continue;
    const cmap=font.readUInt32BE(record+8),count=font.readUInt16BE(cmap+2);
    for(let j=0;j<count;j++) {
      const table=cmap+font.readUInt32BE(cmap+4+j*8+4);
      if(font.readUInt16BE(table)!==12)continue;
      const groups=font.readUInt32BE(table+12);
      for(let k=0;k<groups;k++) {
        const group=table+16+k*12,start=font.readUInt32BE(group),end=font.readUInt32BE(group+4);
        if(codePoint>=start&&codePoint<=end)return font.readUInt32BE(group+8)+codePoint-start;
      }
    }
  }
  return 0;
}

test('editable story copy uses the pinned full TC font, not the old fixed-copy subset', () => {
  const font = fs.readFileSync(path.join(root, 'public/fonts/NotoSansTC-Story-Variable.ttf'));
  assert.equal(crypto.createHash('sha256').update(font).digest('hex'), '864727d210d54f2537bbe23b3a839436c3992af72de9322af5270897246bd44f');
  const css = fs.readFileSync(path.join(root, 'src/video-system/localFonts.css'), 'utf8');
  assert.match(css, /font-family: "Noto Sans TC Story"/);
  assert.match(css, /NotoSansTC-Story-Variable\.ttf/);
  assert.match(fs.readFileSync(path.join(root, 'src/templates/MatchStoryFrame.jsx'), 'utf8'), /fontFamily:'Noto Sans TC Story'/);
});

test('binary font coverage is calibrated and includes the reviewed story Han characters', () => {
  const font=fs.readFileSync(path.join(root,'public/fonts/NotoSansTC-Story-Variable.ttf'));
  assert.ok(glyphId(font,'A'.codePointAt(0))>0,'known Latin glyph');
  assert.ok(glyphId(font,'中'.codePointAt(0))>0,'known Han glyph');
  assert.equal(glyphId(font,0x10ffff),0,'known unmapped code point');
  const script=JSON.parse(fs.readFileSync(path.join(root,'docs/research/2026-10-01-bfx-ns-reviewed-script.json'),'utf8'));
  for(const character of new Set(JSON.stringify(script).match(/[\u3400-\u9fff]/g)))assert.ok(glyphId(font,character.codePointAt(0))>0,`missing ${character}`);
});
