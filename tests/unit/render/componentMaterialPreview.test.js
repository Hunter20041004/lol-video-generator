const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { restyleSource } = require('../../../experiments/component-material-preview/materialStyle');

test('polished player layout separates portrait, identity and evidence without dropping data', () => {
  const { polishSceneSource } = require('../../../experiments/component-material-preview/materialStyle');
  const source=fs.readFileSync('src/templates/player-radar/PostMatchReadScenes.jsx','utf8');
  const output=polishSceneSource(source);
  const player=output.split('export const PlayerProofScene')[1].split('export const FinalReadScene')[0];
  assert.ok(player.includes('right: 70, top: 260, width: 500, height: 660'));
  assert.ok(player.includes('800 112px/.9'));
  assert.ok(player.includes('800 156px/.9'));
  assert.ok(player.includes('right: 70, top: 990'));
  assert.ok(player.includes('left: SAFE_X, right: 70, top: 1270'));
  assert.ok(player.indexOf('{player.name}') < player.indexOf('<SceneLabel>'));
  for(const field of ['proof.claim','secondaryEvidence.map','champions.slice','primary?.displayValue']) assert.ok(player.includes(field));
  assert.equal((output.match(/model\./g)||[]).length,(source.match(/model\./g)||[]).length);
  assert.equal((output.match(/enterStyle\(/g)||[]).length,(source.match(/enterStyle\(/g)||[]).length);
});

test('panel finish is shared across evidence, team and portrait surfaces, not photographs', () => {
  const { polishSurfaceSource } = require('../../../experiments/component-material-preview/materialStyle');
  const source=fs.readFileSync('src/templates/player-radar/PostMatchReadScenes.jsx','utf8');
  const { polishSceneSource } = require('../../../experiments/component-material-preview/materialStyle');
  const output=polishSurfaceSource(polishSceneSource(source));
  assert.ok(output.includes('const PANEL_FINISH ='));
  assert.ok(output.includes('inset 0 1px 0 rgba(240,230,210,.10)'));
  assert.ok(output.includes('0 12px 28px rgba(0,0,0,.24)'));
  assert.equal((output.match(/\.\.\.PANEL_FINISH/g)||[]).length,6);
  for(const imageStyle of output.match(/<Img[^>]+style=\{\{[^}]+/g)||[]) assert.ok(!imageStyle.includes('...PANEL_FINISH'));
  for(const labelStyle of output.match(/<span[^>]+style=\{\{[^}]+/g)||[]) assert.ok(!labelStyle.includes('...PANEL_FINISH'));
  assert.ok(output.includes('letterSpacing: -1.5'));
  assert.equal((output.match(/model\./g)||[]).length,(source.match(/model\./g)||[]).length);
});

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
