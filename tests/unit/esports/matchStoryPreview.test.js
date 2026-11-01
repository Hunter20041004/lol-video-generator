const test=require('node:test');
const assert=require('node:assert/strict');
const {researchPackage}=require('../../fixtures/match-story/research');

test('unused search leads are not described as verified film sources',async()=>{
 const {createMatchStoryPreview}=require('../../../utils/esports/matchStoryPreview');const research=researchPackage();let packet;
 research.sources.push({...research.sources[0],id:'unused-lead',readStatus:'search-lead'});
 const draft={id:'draft',revision:2,confirmedRevision:2,status:'confirmed',identity:research.identity,research,selectedCandidateId:'candidate-1',segments:[{narration:'合成測試。',factIds:['fact-1']}],rights:[]};
 const service=createMatchStoryPreview({storyService:{execute:async()=>draft},assetResolver:async()=>({}),renderer:async value=>{packet=value;return {};}});
 await service.execute({id:'draft',expectedRevision:2,scanId:research.identity.scanId,seriesId:research.identity.seriesId});
 assert.equal(packet.sourceLabel,'1 份已核對來源');
});

test('an edit in another tab during rendering prevents presenting the old result as current',async()=>{
 const {createMatchStoryPreview}=require('../../../utils/esports/matchStoryPreview');const research=researchPackage();let current;
 const draft={id:'draft',revision:2,confirmedRevision:2,status:'confirmed',identity:research.identity,research,selectedCandidateId:'candidate-1',segments:[{narration:'合成測試。',factIds:['fact-1']}],rights:[]};current=draft;
 const service=createMatchStoryPreview({storyService:{execute:async()=>current},assetResolver:async()=>({}),renderer:async()=>{current={...draft,revision:3,confirmedRevision:null,status:'draft'};return {videoUrl:'/renders/story-old.mp4'};}});
 await assert.rejects(service.execute({id:'draft',expectedRevision:2,scanId:research.identity.scanId,seriesId:research.identity.seriesId}),{code:'MATCH_STORY_VERSION_CONFLICT'});
});

test('overlapping preview requests for one draft do not start duplicate material preparation',async()=>{
 const {createMatchStoryPreview}=require('../../../utils/esports/matchStoryPreview');const research=researchPackage();let release;let preparations=0;
 const gate=new Promise(resolve=>{release=resolve});
 const draft={id:'draft',revision:2,confirmedRevision:2,status:'confirmed',identity:research.identity,research,selectedCandidateId:'candidate-1',segments:[{narration:'合成測試。',factIds:['fact-1']}],rights:[]};
 const service=createMatchStoryPreview({storyService:{execute:async()=>draft},assetResolver:async()=>{preparations++;if(preparations===1)await gate;return {};},renderer:async()=>({preview:true})});
 const request={id:'draft',expectedRevision:2,scanId:research.identity.scanId,seriesId:research.identity.seriesId};
 const first=service.execute(request);await new Promise(resolve=>setImmediate(resolve));
 try{await assert.rejects(service.execute(request),{code:'MATCH_STORY_RENDER_BUSY'});assert.equal(preparations,1);}finally{release();await first;}
 assert.deepEqual(await service.execute(request),{preview:true});
});

test('editing while assets are prepared prevents an outdated render',async()=>{
 const {createMatchStoryPreview}=require('../../../utils/esports/matchStoryPreview');const research=researchPackage();let renders=0;let current;
 const draft={id:'draft',revision:2,confirmedRevision:2,status:'confirmed',identity:research.identity,research,selectedCandidateId:'candidate-1',segments:[{narration:'合成測試。',factIds:['fact-1']}],rights:[]};current=draft;
 const service=createMatchStoryPreview({storyService:{execute:async()=>current},assetResolver:async()=>{current={...draft,revision:3,status:'draft',confirmedRevision:null};return {};},renderer:async()=>{renders++}});
 await assert.rejects(service.execute({id:'draft',expectedRevision:2,scanId:research.identity.scanId,seriesId:research.identity.seriesId}),{code:'MATCH_STORY_VERSION_CONFLICT'});
 assert.equal(renders,0);
});

test('unconfirmed current draft is rejected without calling the renderer',async()=>{
 const {createMatchStoryPreview}=require('../../../utils/esports/matchStoryPreview');
 const research=researchPackage();let renders=0;
 const draft={id:'draft',revision:2,confirmedRevision:null,status:'draft',identity:research.identity,research,selectedCandidateId:'candidate-1',segments:[{narration:'合成交戰。',factIds:['fact-1']}],rights:[]};
 const service=createMatchStoryPreview({storyService:{execute:async()=>draft},renderer:async()=>{renders++}});
 await assert.rejects(service.execute({id:'draft',expectedRevision:2,scanId:research.identity.scanId,seriesId:research.identity.seriesId}),{code:'MATCH_STORY_CONFIRM_REQUIRED'});
 assert.equal(renders,0);
});

test('a stale revision cannot render even when the loaded draft is confirmed',async()=>{
 const {createMatchStoryPreview}=require('../../../utils/esports/matchStoryPreview');
 const research=researchPackage();let renders=0;
 const draft={revision:3,confirmedRevision:3,status:'confirmed',identity:research.identity};
 const service=createMatchStoryPreview({storyService:{execute:async()=>draft},renderer:async()=>{renders++}});
 await assert.rejects(service.execute({id:'draft',expectedRevision:2,scanId:research.identity.scanId,seriesId:research.identity.seriesId}),{code:'MATCH_STORY_VERSION_CONFLICT'});
 assert.equal(renders,0);
});

test('a different selected series cannot reuse a confirmed story',async()=>{
 const {createMatchStoryPreview}=require('../../../utils/esports/matchStoryPreview');
 const research=researchPackage();let renders=0;
 const service=createMatchStoryPreview({storyService:{execute:async()=>({revision:2,confirmedRevision:2,status:'confirmed',identity:research.identity})},renderer:async()=>{renders++}});
 await assert.rejects(service.execute({id:'draft',expectedRevision:2,scanId:research.identity.scanId,seriesId:'other-series'}),{code:'MATCH_STORY_IDENTITY_MISMATCH'});
 assert.equal(renders,0);
});

test('production or client-approved flags are refused before even loading the draft',async()=>{
 const {createMatchStoryPreview}=require('../../../utils/esports/matchStoryPreview');let loads=0;
 const service=createMatchStoryPreview({storyService:{execute:async()=>{loads++;throw new Error('should not load')}},renderer:async()=>{}});
 await assert.rejects(service.execute({id:'draft',expectedRevision:2,scanId:'scan',seriesId:'series',mode:'production',approved:true}),{code:'MATCH_STORY_INVALID_REQUEST'});
 assert.equal(loads,0);
});

test('unreviewed footage or arbitrary asset rights never enter rendering',async()=>{
 const {createMatchStoryPreview}=require('../../../utils/esports/matchStoryPreview');
 const research=researchPackage();let renders=0;
 const draft={revision:2,confirmedRevision:2,status:'confirmed',identity:research.identity,research,rights:[{type:'footage',url:'https://example.com/video.mp4',approved:true}]};
 const service=createMatchStoryPreview({storyService:{execute:async()=>draft},renderer:async()=>{renders++}});
 await assert.rejects(service.execute({id:'draft',expectedRevision:2,scanId:research.identity.scanId,seriesId:research.identity.seriesId}),{code:'MATCH_STORY_RIGHTS_UNVERIFIED'});
 assert.equal(renders,0);
});

test('confirmed source-backed copy reaches only a preview packet with its own timeline',async()=>{
 const {createMatchStoryPreview}=require('../../../utils/esports/matchStoryPreview');const research=researchPackage();let packet,assetOptions;
 const draft={id:'draft',revision:2,confirmedRevision:2,status:'confirmed',identity:research.identity,research,selectedCandidateId:'candidate-1',segments:[{narration:'這是合成測試，不是真實賽事。',factIds:['fact-1']}],rights:[]};
 const service=createMatchStoryPreview({storyService:{execute:async()=>draft},assetResolver:async(identity,options)=>{assetOptions=options;return {teamA:{team:'Synthetic Gold'},teamB:{team:'Synthetic Red'},colours:{left:'#ffc400',right:'#b50017'}};},renderer:async value=>{packet=value;return {preview:true}}});
 assert.deepEqual(await service.execute({id:'draft',expectedRevision:2,scanId:research.identity.scanId,seriesId:research.identity.seriesId}),{preview:true});
 assert.equal(packet.mode,'preview');assert.equal(packet.draftId,'draft');assert.equal(packet.revision,2);
 assert.equal(packet.headline,research.candidates[0].headline);
 assert.equal(packet.sourceLabel,`${research.sources.length} 份已核對來源`);
 assert.equal(packet.timeline.scenes.length,1);assert.equal(packet.timeline.freezeFrames,60);
 assert.deepEqual(assetOptions.timeline,packet.timeline);
 assert.equal(Object.hasOwn(packet,'rights'),false);
});

test('a missing verified crest prevents the renderer from receiving any packet',async()=>{
 const {createMatchStoryPreview}=require('../../../utils/esports/matchStoryPreview');const research=researchPackage();let renders=0;
 const draft={id:'draft',revision:2,confirmedRevision:2,status:'confirmed',identity:research.identity,research,selectedCandidateId:'candidate-1',segments:[{narration:'合成測試。',factIds:['fact-1']}],rights:[]};
 const service=createMatchStoryPreview({storyService:{execute:async()=>draft},assetResolver:async()=>{throw new Error('missing crest: private path')},renderer:async()=>{renders++}});
 await assert.rejects(service.execute({id:'draft',expectedRevision:2,scanId:research.identity.scanId,seriesId:research.identity.seriesId}),e=>e.code==='MATCH_STORY_ASSET_UNAVAILABLE'&&!e.message.includes('private'));
 assert.equal(renders,0);
});
