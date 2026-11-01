const test=require('node:test');const assert=require('node:assert/strict');

test('the story renderer refuses production before material or process work',async()=>{
 const {renderMatchStoryPreview}=require('../../../utils/render/matchStoryRenderer');let processes=0;
 await assert.rejects(renderMatchStoryPreview({mode:'production'},{execFileImpl:async()=>{processes++}}),{code:'MATCH_STORY_INVALID_REQUEST'});
 assert.equal(processes,0);
});

test('a changed or remote portrait cannot bypass local byte verification before rendering',async()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
 const {prepareMatchStoryMaterials}=require('../../../utils/render/matchStoryAssets');const {renderMatchStoryPreview}=require('../../../utils/render/matchStoryRenderer');
 const rootDir=fs.mkdtempSync(path.join(os.tmpdir(),'lol-story-portrait-guard-'));let processes=0;
 try{
  const identity={teamA:'BNK FEARX',teamB:'Nongshim RedForce',date:'2026-08-27'};
  const timeline={durationInFrames:300,fps:30,freezeFrames:60,scenes:[{id:'segment-1',component:'context',narration:'合成 Taeyoon 排版。',from:0,durationInFrames:300}]};
  const assets=await prepareMatchStoryMaterials(identity,{timeline,outputDir:path.join(rootDir,'public/story-runs')});
  assets.scenePortraits['segment-1'].publicPath='https://example.com/face.webp';
  await assert.rejects(renderMatchStoryPreview({mode:'preview',identity,timeline,assets},{rootDir,musicSelector:()=>null,execFileImpl:async()=>{processes++;},inspectImpl:async()=>({videoCodec:'h264',width:1080,height:1920,fps:30,duration:10})}),{code:'MATCH_STORY_ASSET_UNAVAILABLE'});
  assert.equal(processes,0);
 }finally{fs.rmSync(rootDir,{recursive:true,force:true});}
});

test('a verified packet renders the story composition with separate props and validates its result',async()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
 const {prepareMatchStoryMaterials}=require('../../../utils/render/matchStoryAssets');
 const {renderMatchStoryPreview}=require('../../../utils/render/matchStoryRenderer');
 const rootDir=fs.mkdtempSync(path.join(os.tmpdir(),'lol-story-render-test-'));let recorded;
 try{
  const identity={teamA:'BNK FEARX',teamB:'Nongshim RedForce',date:'2026-08-27',seriesScore:'3-1',league:'SYNTHETIC'};
  const timeline={durationInFrames:300,fps:30,freezeFrames:60,scenes:[{id:'segment-1',from:0,durationInFrames:300,component:'context',narration:'合成 Taeyoon 排版測試。',facts:[]}]};
  const assets=await prepareMatchStoryMaterials(identity,{outputDir:path.join(rootDir,'public/story-runs'),timeline});
  const result=await renderMatchStoryPreview({mode:'preview',draftId:'synthetic',revision:2,identity,timeline,assets,headline:'合成測試',sourceLabel:'合成來源'},{rootDir,musicSelector:()=>null,execFileImpl:async(command,args,options)=>{
   assert.equal(command,'npx');assert.equal(options.shell,false);assert.equal(args[3],'MatchStoryVideo');
   const propsPath=args.find(arg=>arg.startsWith('--props=')).slice(8);recorded=JSON.parse(fs.readFileSync(propsPath,'utf8'));fs.writeFileSync(args[4],'mock render boundary');
  },inspectImpl:async()=>({videoCodec:'h264',audioCodec:'',width:1080,height:1920,fps:30,duration:10})});
  assert.equal(recorded.timeline.scenes.length,1);assert.equal(recorded.headline,'合成測試');
  assert.deepEqual(recorded.materials,assets.materials);assert.equal(result.revision,2);assert.equal(result.validation.passed,true);
  assert.deepEqual(recorded.scenePortraits,assets.scenePortraits);
  assert.match(result.videoUrl,/^\/renders\/story-[a-f0-9-]+\.mp4$/);
  assert.equal(result.materialFingerprint,assets.fingerprint);
 }finally{fs.rmSync(rootDir,{recursive:true,force:true});}
});
