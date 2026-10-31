const test=require('node:test');const assert=require('node:assert/strict');
const {researchPackage}=require('../../fixtures/match-story/research');

test('a short headline containing manual line breaks cannot overlap the date',()=>{
 const {buildMatchStoryTimeline}=require('../../../utils/render/matchStoryValidation');const research=researchPackage();
 research.candidates[0].headline='合成\n標題';
 assert.throws(()=>buildMatchStoryTimeline({research,selectedCandidateId:'candidate-1',segments:[{narration:'合成稿。',factIds:['fact-1']}]}),{code:'MATCH_STORY_TOO_DENSE'});
});

test('manual newlines cannot turn a short copy into twenty clipped lines',()=>{
 const {buildMatchStoryTimeline}=require('../../../utils/render/matchStoryValidation');const research=researchPackage();
 assert.throws(()=>buildMatchStoryTimeline({research,selectedCandidateId:'candidate-1',segments:[{narration:Array(20).fill('字').join('\n'),factIds:['fact-1']}]}),{code:'MATCH_STORY_TOO_DENSE'});
});

test('a three-segment story builds its own schedule instead of the old six-scene order',()=>{
 const {buildMatchStoryTimeline}=require('../../../utils/render/matchStoryValidation');
 const research=researchPackage();
 const draft={research,selectedCandidateId:'candidate-1',identity:research.identity,segments:[
   {narration:'合成比賽發生了什麼？',factIds:['fact-1']},
   {narration:'依報導，合成隊伍在河道贏下交戰。',factIds:['fact-1']},
   {narration:'這是合成測試，不是真實賽事報導。',factIds:['fact-1']},
 ]};
 const result=buildMatchStoryTimeline(draft);
 assert.equal(result.scenes.length,3);assert.equal(result.scenes[0].from,0);
 assert.equal(result.scenes[1].from,result.scenes[0].durationInFrames);
 assert.equal(result.freezeFrames,60);assert.ok(result.durationInFrames<=1200);
 assert.equal(result.scenes.at(-1).from+result.scenes.at(-1).durationInFrames,result.durationInFrames);
 assert.deepEqual(result.scenes[1].factIds,['fact-1']);
});

test('a headline that cannot fit the safe header is refused instead of covering the date',()=>{
 const {buildMatchStoryTimeline}=require('../../../utils/render/matchStoryValidation');const research=researchPackage();
 research.candidates[0].headline='合成長標題'.repeat(5);
 assert.throws(()=>buildMatchStoryTimeline({research,selectedCandidateId:'candidate-1',segments:[{narration:'合成稿。',factIds:['fact-1']}]}),{code:'MATCH_STORY_TOO_DENSE'});
});

test('copy that fits the total clock but cannot fit its scene is rejected rather than clipped',()=>{
 const {buildMatchStoryTimeline}=require('../../../utils/render/matchStoryValidation');const research=researchPackage();
 assert.throws(()=>buildMatchStoryTimeline({research,selectedCandidateId:'candidate-1',segments:[{narration:'合成排版'.repeat(15),factIds:['fact-1']}]}),{code:'MATCH_STORY_TOO_DENSE'});
});

test('overlong copy is rejected, not sped up or padded to pretend it fits forty seconds',()=>{
 const {buildMatchStoryTimeline}=require('../../../utils/render/matchStoryValidation');const research=researchPackage();
 assert.throws(()=>buildMatchStoryTimeline({research,selectedCandidateId:'candidate-1',segments:[{narration:'合成測試'.repeat(80),factIds:['fact-1']}]}),{code:'MATCH_STORY_TOO_DENSE'});
});

test('scene components follow source scope rather than assuming every match is a former-team story',()=>{
 const {buildMatchStoryTimeline}=require('../../../utils/render/matchStoryValidation');const research=researchPackage();
 research.facts.push({...research.facts[0],id:'background',scope:'background',statement:'合成背景。'});
 research.facts.push({...research.facts[0],id:'stakes',scope:'series',statement:'合成賽季背景。'});
 const timeline=buildMatchStoryTimeline({research,selectedCandidateId:'candidate-1',segments:[
  {narration:'合成問題。',factIds:['fact-1']},{narration:'合成交戰。',factIds:['fact-1']},
  {narration:'合成背景。',factIds:['background','stakes']},{narration:'合成結論。',factIds:['fact-1']},
 ]});
 assert.deepEqual(timeline.scenes.map(s=>s.component),['hook','event','context','verdict']);
 assert.equal(timeline.scenes[1].facts[0].gameNumber,4);
});

test('scene selection follows cuts and holds exactly the same state throughout the last two seconds',()=>{
 const {getMatchStoryFrameState}=require('../../../utils/render/matchStoryValidation');
 const timeline={durationInFrames:300,freezeFrames:60,scenes:[{id:'one',from:0,durationInFrames:120},{id:'two',from:120,durationInFrames:180}]};
 assert.equal(getMatchStoryFrameState(timeline,119).scene.id,'one');
 assert.equal(getMatchStoryFrameState(timeline,120).scene.id,'two');
 assert.deepEqual(getMatchStoryFrameState(timeline,240),getMatchStoryFrameState(timeline,299));
});
