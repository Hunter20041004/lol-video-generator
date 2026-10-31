const test=require('node:test');const assert=require('node:assert/strict');
test('story media checks its own duration and accepts intentional silence without weakening the old validator',()=>{
 const {validateMatchStoryMediaReport}=require('../../../utils/render/matchStoryMedia');
 const media={videoCodec:'h264',width:1080,height:1920,fps:30,duration:39.7,audioCodec:''};
 assert.equal(validateMatchStoryMediaReport(media,{durationInFrames:1191,fps:30,music:false}).passed,true);
 assert.equal(validateMatchStoryMediaReport({...media,duration:25},{durationInFrames:1191,fps:30,music:false}).passed,false);
 assert.equal(validateMatchStoryMediaReport({...media,videoCodec:'vp9'},{durationInFrames:1191,fps:30,music:false}).passed,false);
 assert.equal(validateMatchStoryMediaReport(media,{durationInFrames:1191,fps:30,music:true}).passed,false);
});
