const sharp=require('sharp');
const fs=require('node:fs');const path=require('node:path');
const {resolveTeamCrest}=require('./teamCrestManifest');
const {resolvePlayerPortrait}=require('./playerPortraitManifest');
const {isActiveOn,normalized}=require('./esportsAssetIdentity');
const crypto=require('node:crypto');
const {buildAtlasGround,buildAtlasMapPlate,buildMapPlate}=require('./riftAtlasMaterials');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function readSource(rootDir,name,expected){
 const bytes=fs.readFileSync(path.join(rootDir,'assets/story-source',name));
 if(hash(bytes)!==expected)throw new Error('Story source integrity mismatch.');
 return bytes;
}
async function extractTeamColour(crest){
 const {data,info}=await sharp(crest).resize(64,64,{fit:'inside'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const bins=new Map();
 for(let i=0;i<data.length;i+=info.channels){
   const rgb=[data[i],data[i+1],data[i+2]];const high=Math.max(...rgb),low=Math.min(...rgb);
   if(data[i+3]<128||high<60||high-low<40)continue;
   const key='#'+rgb.map(v=>(Math.floor(v/16)*16).toString(16).padStart(2,'0')).join('');
   bins.set(key,(bins.get(key)||0)+1);
 }
 return [...bins.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||'#808080';
}
async function resolveMatchStoryAssets(identity,{rootDir=process.cwd(),resolveTeamCrestImpl=resolveTeamCrest}={}){
 const season=identity.date.slice(0,4);
 const teamA=resolveTeamCrestImpl({team:identity.teamA,season,matchDate:identity.date},{rootDir});
 const teamB=resolveTeamCrestImpl({team:identity.teamB,season,matchDate:identity.date},{rootDir});
 const [left,right]=await Promise.all([teamA,teamB].map(crest=>extractTeamColour(fs.readFileSync(path.join(rootDir,'public',crest.publicPath)))));
 return {teamA,teamB,colours:{left,right}};
}
async function prepareMatchStoryMaterials(identity,{rootDir=process.cwd(),outputDir=path.join(rootDir,'public/story-runs'),timeline}={}){
 const assets=await resolveMatchStoryAssets(identity,{rootDir});
 const brush=readSource(rootDir,'brush017.png','bcc6d2b7a6348d75be2a520f65b2d44689dc87a544b75ce8e8b36f9cbf97c266');
 const map=readSource(rootDir,'map11-16.19-base-baron1.png','7a7d8f902cd7baf8f42df833259ecde002064eced8590d16d3d41d13a04e2614');
 const buffers={
  'territory-ground':await buildAtlasGround({brush,width:1412,height:2063,left:assets.colours.left,right:assets.colours.right}),
  'crest-left':await buildMapPlate({map:fs.readFileSync(path.join(rootDir,'public',assets.teamA.publicPath)),width:321,height:309}),
  'crest-right':await buildMapPlate({map:fs.readFileSync(path.join(rootDir,'public',assets.teamB.publicPath)),width:330,height:339}),
  map:await buildAtlasMapPlate({map,brush,width:1292,height:1065}),
 };
 fs.mkdirSync(outputDir,{recursive:true});
 const run=fs.mkdtempSync(path.join(outputDir,'run-'));const materials={},hashes={};
 for(const [id,bytes] of Object.entries(buffers)){
  fs.writeFileSync(path.join(run,id+'.png'),bytes,{flag:'wx'});
  materials[id]=`story-runs/${path.basename(run)}/${id}.png`;hashes[id]=hash(bytes);
 }
 const scenePortraits={};
 if(timeline){
  const entries=JSON.parse(fs.readFileSync(path.join(rootDir,'config/esports-player-portraits.json'),'utf8')).portraits;
  for(const scene of timeline.scenes.filter(s=>s.component==='context')){
   const matches=entries.filter(entry=>[identity.teamA,identity.teamB].some(team=>[entry.team,...(entry.teamAliases || [])].map(normalized).includes(normalized(team)))
     &&entry.season===identity.date.slice(0,4)&&isActiveOn(entry,identity.date)
     &&new RegExp(`(^|[^A-Za-z0-9])${entry.publicName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}($|[^A-Za-z0-9])`,'i').test(scene.narration));
   // Ambiguous names or multi-player context get no guessed face.
   if(matches.length!==1)continue;
   const portrait=resolvePlayerPortrait({playerId:matches[0].playerId,team:matches[0].team,season:matches[0].season,matchDate:identity.date},{rootDir});
   const id=`portrait-${Object.keys(scenePortraits).length}`;const bytes=fs.readFileSync(path.join(rootDir,'public',portrait.publicPath));
   fs.writeFileSync(path.join(run,id+'.webp'),bytes,{flag:'wx'});hashes[id]=hash(bytes);
   scenePortraits[scene.id]={...portrait,publicPath:`story-runs/${path.basename(run)}/${id}.webp`};
  }
 }
 const fingerprint=hash(Buffer.from(JSON.stringify({identity,hashes})));
 const packet={assets,materials,scenePortraits,hashes,fingerprint};
 fs.writeFileSync(path.join(run,'provenance.json'),JSON.stringify(packet,null,2)+'\n',{flag:'wx'});
 return packet;
}
module.exports={extractTeamColour,resolveMatchStoryAssets,prepareMatchStoryMaterials};
