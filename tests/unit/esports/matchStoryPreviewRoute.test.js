const test=require('node:test');const assert=require('node:assert/strict');
const request=body=>new Request('http://localhost:49765/api/esports/story/preview',{method:'POST',headers:{'content-type':'application/json',origin:'http://localhost:49765'},body:JSON.stringify(body)});

test('the independent Next route wires only the story preview service and renderer',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const source=fs.readFileSync(path.resolve(__dirname,'../../../app/api/esports/story/preview/route.js'),'utf8');
 assert.match(source,/runtime = "nodejs"/);assert.match(source,/createMatchStoryPreviewPost/);
 assert.match(source,/createMatchStoryPreview\(\{ renderer: renderMatchStoryPreview \}\)/);
 assert.doesNotMatch(source,/createPublishJobs|production|runPlayerRadar/);
});
test('preview response is separate from draft writes and inherits the bounded same-origin envelope',async()=>{
 const {createMatchStoryPreviewPost}=require('../../../utils/esports/matchStoryPreviewApi');let calls=0;
 const post=createMatchStoryPreviewPost({execute:async body=>{calls++;return {draftId:body.id,revision:2,videoUrl:'/renders/story-synthetic.mp4'};}});
 const result=await post(request({id:'synthetic',expectedRevision:2,scanId:'synthetic-scan',seriesId:'synthetic-series'}));
 const json=await result.json();assert.equal(json.success,true);assert.equal(json.preview.draftId,'synthetic');assert.equal(Object.hasOwn(json,'draft'),false);
 const foreign=new Request('http://localhost:49765/api/esports/story/preview',{method:'POST',headers:{'content-type':'application/json',origin:'https://example.com'},body:'{}'});
 assert.equal((await post(foreign)).status,403);assert.equal(calls,1);
});

test('preview safety failures keep their actionable code without exposing renderer paths',async()=>{
 const {createMatchStoryPreviewPost}=require('../../../utils/esports/matchStoryPreviewApi');
 for(const code of ['MATCH_STORY_CONFIRM_REQUIRED','MATCH_STORY_RENDER_BUSY','MATCH_STORY_ASSET_UNAVAILABLE','MATCH_STORY_TOO_DENSE','MATCH_STORY_RIGHTS_UNVERIFIED']){
  const post=createMatchStoryPreviewPost({execute:async()=>{throw Object.assign(new Error('/private/secrets/renderer'),{code});}});
  const response=await post(request({}));assert.equal(response.status,409);
  const body=await response.json();assert.equal(body.code,code);assert.equal(JSON.stringify(body).includes('/private'),false);
 }
});
