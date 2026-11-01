const test=require('node:test');const assert=require('node:assert/strict');const sharp=require('sharp');

test('prepared story map is the warm relief translation, not the raw grey-green proof',async()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
 const {prepareMatchStoryMaterials}=require('../../../utils/render/matchStoryAssets');
 const outputDir=fs.mkdtempSync(path.join(os.tmpdir(),'lol-atlas-relief-test-'));
 try{
  const p=await prepareMatchStoryMaterials({teamA:'BNK FEARX',teamB:'Nongshim RedForce',date:'2026-08-27'},{outputDir});
  const file=path.join(outputDir,path.basename(path.dirname(p.materials.map)),'map.png');
  const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let gold=0;for(let i=0;i<data.length;i+=4)if(data[i+3]>200&&data[i]>180&&data[i]>data[i+1]&&data[i+1]>data[i+2]+30)gold++;
  assert.ok(gold>info.width*info.height*.1,'source roads must carry the atlas gold material');
 }finally{fs.rmSync(outputDir,{recursive:true,force:true});}
});

test('material preparation makes a unique real-disk packet with team colours and byte fingerprints',async()=>{
 const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const crypto=require('node:crypto');
 const {prepareMatchStoryMaterials}=require('../../../utils/render/matchStoryAssets');
 const outputDir=fs.mkdtempSync(path.join(os.tmpdir(),'lol-story-material-test-'));
 try {
  const packet=await prepareMatchStoryMaterials({teamA:'T1',teamB:'Gen.G',date:'2026-08-27'},{outputDir});
  assert.equal(packet.assets.teamA.team,'T1');assert.equal(packet.assets.teamB.team,'GEN');
  assert.notEqual(packet.assets.colours.left,packet.assets.colours.right);
  for(const [id,file] of Object.entries(packet.materials)){
   assert.match(file,/^story-runs\/run-[a-zA-Z0-9]+\/[a-z-]+\.png$/);
   const bytes=fs.readFileSync(path.join(outputDir,path.basename(path.dirname(file)),path.basename(file)));
   assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),packet.hashes[id]);
  }
  assert.equal(packet.fingerprint.length,64);
 }finally{fs.rmSync(outputDir,{recursive:true,force:true});}
});

test('both real crest lookups receive the resolver matchDate contract, not an ignored date field',async()=>{
 const {resolveMatchStoryAssets}=require('../../../utils/render/matchStoryAssets');const {resolveTeamCrest}=require('../../../utils/render/teamCrestManifest');const dates=[];
 await resolveMatchStoryAssets({teamA:'BNK FEARX',teamB:'Nongshim RedForce',date:'2026-08-27'},{resolveTeamCrestImpl:(identity,options)=>{dates.push(identity.matchDate);return resolveTeamCrest(identity,options);}});
 assert.deepEqual(dates,['2026-08-27','2026-08-27']);
});

test('a named context scene uses only the dated original portrait for this match',async()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
 const {prepareMatchStoryMaterials}=require('../../../utils/render/matchStoryAssets');
 const outputDir=fs.mkdtempSync(path.join(os.tmpdir(),'lol-story-portrait-test-'));
 try{
  const packet=await prepareMatchStoryMaterials({teamA:'BNK FEARX',teamB:'Nongshim RedForce',date:'2026-08-27'},{outputDir,timeline:{scenes:[{id:'segment-2',component:'context',narration:'合成排版：Taeyoon 背景。'},{id:'segment-3',component:'context',narration:'沒有指定選手的合成背景。'}]}});
  assert.equal(packet.scenePortraits['segment-2'].publicName,'Taeyoon');
  assert.equal(packet.scenePortraits['segment-2'].team,'BNK FEARX');
  assert.equal(packet.scenePortraits['segment-3'],undefined);
  assert.match(packet.scenePortraits['segment-2'].publicPath,/^story-runs\/run-[a-zA-Z0-9]+\/portrait-\d+\.webp$/);
  assert.equal(packet.hashes['portrait-0'],'d7b397902180dee83edcd337724c63e75b3bc6287bb5863fa81c46e3e6472456');
 }finally{fs.rmSync(outputDir,{recursive:true,force:true});}
});
test('team palette extraction ignores black framing and reads the real saturated crest colour',async()=>{
 const {extractTeamColour}=require('../../../utils/render/matchStoryAssets');
 const crest=await sharp({create:{width:40,height:40,channels:4,background:'#ff0000'}}).extend({top:30,bottom:30,left:30,right:30,background:'#000000'}).png().toBuffer();
 assert.equal(await extractTeamColour(crest),'#f00000');
});

test('real dated BFX and NS crests supply identity-checked paths and both large-field colours',async()=>{
 const {resolveMatchStoryAssets}=require('../../../utils/render/matchStoryAssets');
 const result=await resolveMatchStoryAssets({teamA:'BNK FEARX',teamB:'Nongshim RedForce',date:'2026-08-27'});
 assert.equal(result.teamA.team,'BNK FEARX');assert.equal(result.teamB.team,'Nongshim RedForce');
 assert.equal(result.teamA.publicPath,'/team-crests/bnk-fearx-2026.png');
 assert.equal(result.teamB.publicPath,'/team-crests/nongshim-redforce-2026.png');
 assert.notEqual(result.colours.left,result.colours.right);assert.match(result.colours.left,/^#[0-9a-f]{6}$/);
 assert.equal(result.teamA.sha256.length,64);
});
