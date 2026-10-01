const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { restyleSource } = require('../../../experiments/component-material-preview/materialStyle');

test('component reskin preserves original scene positions, sizes, data and timing', () => {
  const source=fs.readFileSync('src/templates/player-radar/PostMatchReadScenes.jsx','utf8');
  const output=restyleSource(source);
  const geometry=s=>s.match(/(?:top|left|right|bottom|width|height|fontSize|gridTemplateColumns): [^,}\n]+/g);
  assert.deepEqual(geometry(output),geometry(source));
  assert.ok(output.includes('rgba(143,158,133,.35)'));
  assert.ok(!output.includes('rgba(10,200,185'));
  assert.equal((output.match(/model\./g)||[]).length,(source.match(/model\./g)||[]).length);
  assert.equal((output.match(/enterStyle\(/g)||[]).length,(source.match(/enterStyle\(/g)||[]).length);
});

test('reskin removes only background circuitry and turns frame geometry into restrained trim',()=>{
  const { restyleFrameSource, restyleTokens }=require('../../../experiments/component-material-preview/materialStyle');
  const source=fs.readFileSync('src/templates/player-radar/PostMatchReadFrame.jsx','utf8');
  const out=restyleFrameSource(source);
  assert.ok(!out.includes('data-rift-lattice'));
  assert.ok(!out.includes('radial-gradient'));
  for(const marker of ['data-series-telemetry','data-evidence-ticker','data-story-rail']) assert.ok(out.includes(marker));
  const tokens=restyleTokens(fs.readFileSync('src/templates/player-radar/postMatchReadVisuals.js','utf8'));
  assert.ok(tokens.includes('polygon(4px 0'));
  assert.ok(tokens.includes('inset(0 round 50%)'));
});
