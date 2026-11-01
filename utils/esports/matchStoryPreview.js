const {createMatchStoryService}=require('./matchStoryService');
const {z}=require('zod');
const {buildMatchStoryTimeline}=require('../render/matchStoryValidation');
const {prepareMatchStoryMaterials}=require('../render/matchStoryAssets');
const id=z.string().min(1).max(2000);
const requestSchema=z.object({id,expectedRevision:z.number().int().positive(),scanId:id,seriesId:id}).strict();
function fail(code,message){throw Object.assign(new Error(message),{code});}
function createMatchStoryPreview({storyService=createMatchStoryService(),assetResolver=prepareMatchStoryMaterials,renderer}={}){
 const pending=new Set();
 return {async execute(request){
   const parsed=requestSchema.safeParse(request);
   if(!parsed.success)fail('MATCH_STORY_INVALID_REQUEST','故事預覽請求格式無效。');
   request=parsed.data;
   if(pending.has(request.id))fail('MATCH_STORY_RENDER_BUSY','這份稿件正在製作預覽，請等候，不會重複開始。');
   pending.add(request.id);
   try {
   const draft=await storyService.execute({action:'read',id:request.id,expectedRevision:request.expectedRevision});
   if(draft.revision!==request.expectedRevision)fail('MATCH_STORY_VERSION_CONFLICT','草稿已更新，請重新讀取後再操作。');
   if(draft.identity.scanId!==request.scanId||draft.identity.seriesId!==request.seriesId)fail('MATCH_STORY_IDENTITY_MISMATCH','故事稿與目前選擇的比賽不一致。');
   if(draft.status!=='confirmed'||draft.confirmedRevision!==draft.revision)fail('MATCH_STORY_CONFIRM_REQUIRED','請先確認目前的故事稿版本，再製作預覽。');
   if(!Array.isArray(draft.rights)||draft.rights.length)fail('MATCH_STORY_RIGHTS_UNVERIFIED','本版只使用專案已驗證的文字／照片素材；外加實況或素材權利尚未驗證。');
   if(!renderer)fail('MATCH_STORY_RENDER_UNAVAILABLE','故事影片製作尚未接通。');
   const timeline=buildMatchStoryTimeline(draft);
   let assets;
   try{assets=await assetResolver(draft.identity,{timeline});}catch{fail('MATCH_STORY_ASSET_UNAVAILABLE','本場已驗證素材不可用，請先補齊正確隊伍素材。');}
   const current=await storyService.execute({action:'read',id:request.id,expectedRevision:request.expectedRevision});
   if(current.revision!==request.expectedRevision)fail('MATCH_STORY_VERSION_CONFLICT','草稿已更新，請重新讀取後再操作。');
   if(current.status!=='confirmed'||current.confirmedRevision!==current.revision)fail('MATCH_STORY_CONFIRM_REQUIRED','請先確認目前的故事稿版本，再製作預覽。');
   const headline=draft.research.candidates.find(candidate=>candidate.id===draft.selectedCandidateId).headline;
   const referencedFacts=new Set(draft.segments.flatMap(segment=>segment.factIds));
   const referencedSources=new Set(draft.research.facts.filter(fact=>referencedFacts.has(fact.id)).flatMap(fact=>fact.sourceIds));
   const verifiedSourceCount=draft.research.sources.filter(source=>referencedSources.has(source.id)&&['report','stats','reviewed-video'].includes(source.readStatus)).length;
   const result=await renderer({mode:'preview',draftId:draft.id,revision:draft.revision,identity:structuredClone(draft.identity),timeline,assets,headline,sourceLabel:`${verifiedSourceCount} 份已核對來源`});
   const latest=await storyService.execute({action:'read',id:request.id,expectedRevision:request.expectedRevision});
   if(latest.revision!==request.expectedRevision)fail('MATCH_STORY_VERSION_CONFLICT','草稿已更新，請重新讀取後再操作。');
   if(latest.status!=='confirmed'||latest.confirmedRevision!==latest.revision)fail('MATCH_STORY_CONFIRM_REQUIRED','請先確認目前的故事稿版本，再製作預覽。');
   return result;
   }finally{pending.delete(request.id);}
 }};
}
module.exports={createMatchStoryPreview};
