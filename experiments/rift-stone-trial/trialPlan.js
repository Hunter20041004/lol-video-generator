const STARTS = [0,150,360,570,810,1050];
const visualFrame = (frame) => Math.min(1140, Math.max(0,frame));
const sceneAt = (frame) => STARTS.findLastIndex(start => start <= visualFrame(frame));
const MUSIC = [
  { from:0, duration:75, source:0 },
  { from:564, duration:240, source:510 },
  { from:834, duration:261, source:810 },
];
function musicGain(frame) {
  const clip = MUSIC.find(c => frame >= c.from && frame < c.from+c.duration);
  if (!clip) return 0;
  const local = frame-clip.from;
  return Math.min(1,local/12,(clip.duration-1-local)/21);
}
module.exports = { STARTS, visualFrame, sceneAt, MUSIC, musicGain };
