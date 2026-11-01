const test=require('node:test');const assert=require('node:assert/strict');

test('story music supports every evidence scene at lower gain instead of leaving a long silent middle',()=>{
 const {buildMatchStoryMusicCues}=require('../../../utils/render/matchStoryAudio');
 const timeline={durationInFrames:900,freezeFrames:60,scenes:[{from:0,durationInFrames:150,component:'hook'},{from:150,durationInFrames:450,component:'event'},{from:600,durationInFrames:300,component:'verdict'}]};
 const cues=buildMatchStoryMusicCues(timeline,{bgmFile:'render-assets/audio/verified.wav'});
 assert.deepEqual(cues.map(c=>[c.from,c.durationInFrames]),[[0,150],[150,450],[600,240]]);
 assert.deepEqual(cues.map(c=>c.sourceStartFrame),[0,150,600],'music continues through the licensed source rather than restarting each scene');
 assert.ok(cues.every(c=>c.from+c.durationInFrames<=840));
 assert.ok(cues.every(c=>c.fadeFrames===12));
 assert.deepEqual(cues.map(c=>c.gain),[1,.5,.85],'scene gains are expressive relative levels, not a repeated mastering correction');
 assert.deepEqual(buildMatchStoryMusicCues(timeline,null),[]);
});

test('each music cue fades to silence at both edges without clipping the gain',()=>{
 const {getMatchStoryCueVolume}=require('../../../utils/render/matchStoryAudio');
 const cue={durationInFrames:90,fadeFrames:12,gain:0.22};
 assert.equal(getMatchStoryCueVolume(cue,0),0);
 assert.equal(getMatchStoryCueVolume(cue,40),0.22);
 assert.equal(getMatchStoryCueVolume(cue,89),0);
 assert.equal(getMatchStoryCueVolume(cue,100),0);
});

test('a long verdict never plays beyond its verified forty-second source segment',()=>{
 const {buildMatchStoryMusicCues}=require('../../../utils/render/matchStoryAudio');
 const cues=buildMatchStoryMusicCues({durationInFrames:1200,freezeFrames:60,scenes:[{from:0,durationInFrames:120,component:'hook'},{from:120,durationInFrames:1080,component:'verdict'}]},{bgmFile:'render-assets/audio/verified.wav'});
 assert.ok(cues.every(c=>c.sourceStartFrame+c.durationInFrames<=1200));
});
