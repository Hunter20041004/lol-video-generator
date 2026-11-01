const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const {execFile}=require('node:child_process');const {promisify}=require('node:util');
const {selectAndStageLicensedMusic}=require('./licensedMusicLibrary');
const {inspectMatchStoryMedia,validateMatchStoryMediaReport}=require('./matchStoryMedia');
const exec=promisify(execFile);
function fail(code,message){throw Object.assign(new Error(message),{code});}
async function renderMatchStoryPreview(packet,{rootDir=process.cwd(),execFileImpl=exec,inspectImpl=inspectMatchStoryMedia,musicSelector=selectAndStageLicensedMusic}={}){
 if(packet?.mode!=='preview')fail('MATCH_STORY_INVALID_REQUEST','故事影片只能製作預覽。');
 const {assets}=packet;const keys=['territory-ground','crest-left','crest-right','map'];
 for(const id of keys){
  const relative=assets?.materials?.[id];
  if(typeof relative!=='string'||!new RegExp(`^story-runs/run-[a-zA-Z0-9]+/${id}\\.png$`).test(relative))fail('MATCH_STORY_ASSET_UNAVAILABLE','故事素材不可用。');
  const bytes=fs.readFileSync(path.join(rootDir,'public',relative));
  if(crypto.createHash('sha256').update(bytes).digest('hex')!==assets.hashes[id])fail('MATCH_STORY_ASSET_UNAVAILABLE','故事素材已變更，請重新準備。');
 }
 for(const portrait of Object.values(assets.scenePortraits || {})){
  const match=/^story-runs\/run-[a-zA-Z0-9]+\/(portrait-\d+)\.webp$/.exec(portrait.publicPath || '');
  if(!match)fail('MATCH_STORY_ASSET_UNAVAILABLE','選手照片必須使用本場已驗證的本機素材。');
  const bytes=fs.readFileSync(path.join(rootDir,'public',portrait.publicPath));
  const digest=crypto.createHash('sha256').update(bytes).digest('hex');
  if(digest!==portrait.sha256||digest!==assets.hashes[match[1]])fail('MATCH_STORY_ASSET_UNAVAILABLE','選手照片已變更，請重新準備。');
 }
 const music=musicSelector({rootDir});
 const props={identity:packet.identity,timeline:packet.timeline,headline:packet.headline,sourceLabel:packet.sourceLabel,materials:assets.materials,scenePortraits:assets.scenePortraits,music};
 const filename=`story-${crypto.randomUUID()}.mp4`;const directory=path.join(rootDir,'public/renders');fs.mkdirSync(directory,{recursive:true});
 const output=path.join(directory,filename);const propsFile=path.join(directory,filename+'.props.json');
 fs.writeFileSync(propsFile,JSON.stringify(props),{flag:'wx'});
 try{
  await execFileImpl('npx',['remotion','render',path.join(rootDir,'src/index.jsx'),'MatchStoryVideo',output,`--props=${propsFile}`,'--codec=h264','--video-bitrate=8M','--concurrency=2','--timeout=120000'],{cwd:rootDir,shell:false,maxBuffer:50*1024*1024});
 }catch{fail('MATCH_STORY_RENDER_FAILED','影片製作失敗，稿件仍保留，請重試。');}
 finally{fs.unlinkSync(propsFile);}
 const validation=validateMatchStoryMediaReport(await inspectImpl(output),{...packet.timeline,music:!!music});
 if(!validation.passed)fail('MATCH_STORY_MEDIA_INVALID','影片規格未通過，未提供預覽。');
 return {draftId:packet.draftId,revision:packet.revision,videoUrl:`/renders/${filename}`,materialFingerprint:assets.fingerprint,validation};
}
module.exports={renderMatchStoryPreview};
