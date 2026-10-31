const {validateStorySelection}=require('../esports/matchStoryContract');
function buildMatchStoryTimeline(draft){
  validateStorySelection(draft.research,draft.selectedCandidateId,draft.segments);
  const headline=draft.research.candidates.find(candidate=>candidate.id===draft.selectedCandidateId).headline;
  if(Array.from(headline).length>18||/[\r\n]/.test(headline))throw Object.assign(new Error('標題超出安全標頭空間，請縮短並保持單行，不會裁切或縮成小字。'),{code:'MATCH_STORY_TOO_DENSE'});
  let cursor=0;
  const scenes=draft.segments.map((segment,index)=>{
    const durationInFrames=Math.max(120,Math.ceil(Array.from(segment.narration).length/6*30))+(index===draft.segments.length-1?60:0);
    const facts=segment.factIds.map(id=>structuredClone(draft.research.facts.find(fact=>fact.id===id)));
    const component=index===0?'hook':index===draft.segments.length-1?'verdict':facts.some(f=>f.scope==='game')?'event':'context';
    const characterBudget=component==='hook'?50:component==='verdict'?68:80;
    if(Array.from(segment.narration).length>characterBudget)throw Object.assign(new Error('文字超出本幕的閱讀空間，請刪減，不會裁切或縮成小字。'),{code:'MATCH_STORY_TOO_DENSE'});
    const lineBudget=component==='hook'?3:component==='verdict'?4:5;
    const lines=segment.narration.split(/\r\n|\r|\n/).reduce((sum,line)=>sum+Math.max(1,Math.ceil(Array.from(line).length/17)),0);
    if(lines>lineBudget)throw Object.assign(new Error('換行超出本幕的閱讀空間，請刪減，不會裁切。'),{code:'MATCH_STORY_TOO_DENSE'});
    const scene={id:`segment-${index+1}`,component,facts,from:cursor,durationInFrames,narration:segment.narration,factIds:[...segment.factIds]};
    cursor+=durationInFrames;return scene;
  });
  if(cursor>1200)throw Object.assign(new Error('稿件超過約40秒的閱讀預算，請刪減文字，不會自動加速。'),{code:'MATCH_STORY_TOO_DENSE'});
  return {fps:30,scenes,durationInFrames:cursor,freezeFrames:60};
}
function getMatchStoryFrameState(timeline,frame){
 const clock=Math.max(0,Math.min(frame,timeline.durationInFrames-timeline.freezeFrames));
 const scene=timeline.scenes.find(item=>clock>=item.from&&clock<item.from+item.durationInFrames);
 return {clock,scene,localFrame:clock-scene.from};
}
module.exports={buildMatchStoryTimeline,getMatchStoryFrameState};
