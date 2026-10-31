const {execFile}=require('node:child_process');const {promisify}=require('node:util');
const exec=promisify(execFile);
function validateMatchStoryMediaReport(media,{durationInFrames,fps,music=false}){
 const reasons=[];
 if(media.videoCodec!=='h264')reasons.push('video must be H.264');
 if(media.width!==1080||media.height!==1920)reasons.push('video must be 1080×1920');
 if(!Number.isFinite(media.fps)||Math.abs(media.fps-fps)>0.01)reasons.push('frame rate mismatch');
 if(!Number.isFinite(media.duration)||Math.abs(media.duration-durationInFrames/fps)>0.08)reasons.push('story duration mismatch');
 if(music&&media.audioCodec!=='aac')reasons.push('music must be AAC');
 return {passed:reasons.length===0,reasons,media};
}
async function inspectMatchStoryMedia(filePath,{execFileImpl=exec}={}){
 const probe=await execFileImpl('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_type,codec_name,width,height,r_frame_rate','-of','json',filePath]);
 const json=JSON.parse(probe.stdout);const video=json.streams.find(s=>s.codec_type==='video')||{};
 const audio=json.streams.find(s=>s.codec_type==='audio')||{};const [numerator,denominator=1]=String(video.r_frame_rate).split('/').map(Number);
 return {videoCodec:video.codec_name||'',audioCodec:audio.codec_name||'',width:Number(video.width),height:Number(video.height),fps:numerator/denominator,duration:Number(json.format?.duration)};
}
module.exports={validateMatchStoryMediaReport,inspectMatchStoryMedia};
