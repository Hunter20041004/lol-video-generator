const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sceneAt, visualFrame } = require('../../../experiments/rift-stone-trial/trialPlan');

test('trial preserves six reading windows and freezes its last two seconds', () => {
  assert.deepEqual([0,150,360,570,810,1050].map(sceneAt), [0,1,2,3,4,5]);
  assert.equal(sceneAt(1199),5);
  assert.equal(visualFrame(1199),1140);
  assert.equal(visualFrame(1139),1139);
});

test('music leaves the evidence reading silent, with feathered entries and exits', () => {
  const { MUSIC, musicGain } = require('../../../experiments/rift-stone-trial/trialPlan');
  assert.ok(MUSIC.length === 3);
  assert.equal(musicGain(300),0);
  assert.equal(musicGain(1199),0);
  for (const clip of MUSIC) {
    assert.equal(musicGain(clip.from),0);
    assert.ok(musicGain(clip.from + 15)>0);
    assert.equal(musicGain(clip.from + clip.duration),0);
    assert.ok(clip.source + clip.duration <= 1200);
  }
});
