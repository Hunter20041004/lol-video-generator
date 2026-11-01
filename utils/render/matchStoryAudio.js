function buildMatchStoryMusicCues(timeline,music){
 if(!music)return [];
 const end=timeline.durationInFrames-timeline.freezeFrames;
 const gains={hook:1,event:.5,context:.4,verdict:.85};
 return timeline.scenes.map(scene=>({from:scene.from,durationInFrames:Math.min(scene.durationInFrames,end-scene.from),sourceStartFrame:scene.from,bgmFile:music.bgmFile,fadeFrames:12,gain:gains[scene.component] ?? .5})).filter(c=>c.durationInFrames>0);
}
function getMatchStoryCueVolume(cue,frame){
 return cue.gain*Math.max(0,Math.min(1,frame/cue.fadeFrames,(cue.durationInFrames-1-frame)/cue.fadeFrames));
}
module.exports={buildMatchStoryMusicCues,getMatchStoryCueVolume};
