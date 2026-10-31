const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
async function loadFrame(){
 const filename=path.resolve(__dirname,'../../../src/templates/MatchStoryFrame.jsx');
 const swc=require('next/dist/build/swc');await swc.loadBindings();
 const {code}=await swc.transform(fs.readFileSync(filename,'utf8'),{filename,jsc:{parser:{syntax:'ecmascript',jsx:true},transform:{react:{runtime:'classic'}}},module:{type:'commonjs'}});
 const component=new Module(filename,module);component.filename=filename;component.paths=module.paths;
 const nativeRequire=component.require.bind(component);
 // SSR has no Remotion timeline. Only image readiness is replaced here;
 // the true Img/config boundary is verified by a real rendered still.
 component.require=(name)=>name==='remotion'?{...nativeRequire(name),Img:(props)=>React.createElement('img',props)}:nativeRequire(name);
 component._compile(code,filename);return component.exports.MatchStoryFrame;
}

test('original crest silhouettes have no invented black square and detail names remain readable',async()=>{
 const Frame=await loadFrame();
 const html=renderToStaticMarkup(React.createElement(Frame,{model:{headline:'合成測試',identity:{teamA:'T1',teamB:'Gen.G',seriesScore:'3-1',league:'TEST',date:'2026-08-27'},scene:{component:'event',narration:'合成測試。',facts:[]}}}));
 const images=html.match(/<img[^>]+>/g);
 for(const side of ['crest-left','crest-right'])assert.doesNotMatch(images.find(tag=>tag.includes(`data-region="${side}"`)),/background:#101717/);
 const names=html.match(/<p[^>]+>T1<\/p>|<p[^>]+>GEN\.G<\/p>/g);
 assert.equal(names.length,2);
 for(const name of names)assert.match(name,/font-size:44px/);
 for(const name of names)assert.match(name,/top:21%/,'compact scene names sit below their crests, within their own colour field');
});

test('event frame displays only its cited game and copy, without hardcoded fourth-game context',async()=>{
 const Frame=await loadFrame();
 const html=renderToStaticMarkup(React.createElement(Frame,{model:{headline:'合成故事',identity:{teamA:'Synthetic Gold',teamB:'Synthetic Red',seriesScore:'2-0',league:'TEST',date:'2026-08-27'},summary:'忽略的舊摘要',scene:{component:'event',narration:'合成第二局事件。',facts:[{scope:'game',gameNumber:2}],factIds:['synthetic-1']},sourceLabel:'合成測試來源'}}));
 assert.match(html,/第2局/);assert.match(html,/合成第二局事件。/);assert.match(html,/合成測試來源/);
 assert.doesNotMatch(html,/第四局|忽略的舊摘要|OPLoLReplay/);
 assert.match(html,/data-scene="event"/);
 assert.doesNotMatch(html,/font-size:270px/);
 assert.match(html,/data-region="story-reading"[^>]+top:36%/);
 assert.match(html,/font-size:72px;line-height:1.35/);
 assert.match(html,/data-region="territory-ground"[^>]+top:10%[^>]+height:34%[^>]+object-fit:fill/,'paint fills the identity stage while header and evidence retain exposed paper');
});

test('reported game facts do not claim that the video was personally reviewed',async()=>{
 const Frame=await loadFrame();
 const html=renderToStaticMarkup(React.createElement(Frame,{model:{headline:'合成測試',scene:{component:'event',narration:'依報導的合成測試。',facts:[{scope:'game',gameNumber:2,evidenceType:'report'}]}}}));
 assert.match(html,/第2局 · 報導描述/);assert.doesNotMatch(html,/片段回看/);
});

test('long Latin words wrap inside the reading area without changing font size',async()=>{
 const Frame=await loadFrame();
 const html=renderToStaticMarkup(React.createElement(Frame,{model:{headline:'合成測試',scene:{component:'hook',narration:'W'.repeat(49),facts:[]}}}));
 assert.match(html,/overflow-wrap:anywhere/);assert.match(html,/font-size:55px;line-height:1.35/);
});

test('the verdict keeps the series score but gives longer conclusion copy a larger reading area',async()=>{
 const Frame=await loadFrame();const narration='這是合成結論排版，文字需要足夠空間，不能壓到來源，也不能把人頭當成系列比分。';
 const html=renderToStaticMarkup(React.createElement(Frame,{model:{headline:'合成結論',scene:{component:'verdict',narration,facts:[]}}}));
 assert.match(html,/系列賽結果/);assert.match(html,/系列賽結論/);assert.match(html,/top:42%/);
 assert.doesNotMatch(html,/data-region="map"/);assert.ok(html.includes(narration));
});

test('story scenes without spatial evidence never insert a decorative map',async()=>{
 const Frame=await loadFrame();
 for(const component of ['hook','event','context','verdict']){
 const story=renderToStaticMarkup(React.createElement(Frame,{model:{headline:'合成測試',scene:{component,narration:'已引用的段落內容。',facts:[]}}}));
 assert.doesNotMatch(story,/data-region="map"|示意地圖/,'knowing the game number alone is not verified spatial evidence');
 assert.match(story,/已引用的段落內容。/);
 }
 const html=renderToStaticMarkup(React.createElement(Frame,{model:{headline:'合成測試',scene:{component:'hook',narration:'合成測試。',facts:[]}}}));
 const crest=html.match(/<img[^>]+data-region="crest-left"[^>]+>/)[0];
 assert.match(crest,/top:26%/);assert.match(html,/font-size:340px/);
 assert.doesNotMatch(html,/height:10.5%/);
});

test('verified context portrait replaces the map without generating or cropping a face',async()=>{
 const Frame=await loadFrame();
 const html=renderToStaticMarkup(React.createElement(Frame,{model:{headline:'合成背景',scene:{component:'context',narration:'合成 Taeyoon 排版。',facts:[]},portrait:{publicName:'Taeyoon',publicPath:'story-runs/synthetic/portrait-0.webp'}}}));
 assert.match(html,/story-runs\/synthetic\/portrait-0\.webp/);assert.match(html,/Taeyoon/);
 assert.doesNotMatch(html,/data-region="map"/);assert.match(html,/原始選手照片/);
 assert.match(html,/object-fit:contain/);
 assert.match(html,/<p[^>]+color:#101717[^>]*>Taeyoon<\/p>/,'name on exposed paper uses dark ink');
});

test('long mixed-language headlines use a smaller display size without truncating source copy',async()=>{
 const Frame=await loadFrame();const headline='合成測試 FEARX 的河道交戰回看';
 const html=renderToStaticMarkup(React.createElement(Frame,{model:{headline,summary:'合成文字。'}}));
 assert.match(html,/font-size:54px/);assert.ok(html.includes(headline));
});

test('a prepared match uses all four of its own materials rather than the BFX–NS proof',async()=>{
 const Frame=await loadFrame();const materials=Object.fromEntries(['territory-ground','crest-left','crest-right','map'].map(id=>[id,`story-runs/synthetic/${id}.png`]));
 const html=renderToStaticMarkup(React.createElement(Frame,{plateOnly:true,model:{materials}}));
 for(const id of Object.keys(materials))assert.match(html,new RegExp('/story-runs/synthetic/'+id+'\\.png'));
 assert.doesNotMatch(html,/\/story-atlas\//);
});
test('visual proof places four independent verified materials, never the flattened comp',async()=>{
 const Frame=await loadFrame();
 const html=renderToStaticMarkup(React.createElement(Frame,{plateOnly:true}));
 for(const asset of ['territory-ground','crest-left','crest-right','map'])assert.match(html,new RegExp('/story-atlas/'+asset+'\\.png'));
 assert.doesNotMatch(html,/rift-atlas-map-correction-safe|賽後判讀/);
});

test('the isolated visual proof is registered separately from the old Player Radar film',()=>{
 const root=fs.readFileSync(path.resolve(__dirname,'../../../src/Root.jsx'),'utf8');
 assert.match(root,/id="MatchStoryVisualProof"/);
 assert.match(root,/component=\{MatchStoryFrame\}/);
});

test('story framing distinguishes series score from the fourth-game evidence and escapes copy',async()=>{
 const Frame=await loadFrame();
 const html=renderToStaticMarkup(React.createElement(Frame,{model:{headline:'上路先倒，還能打嗎？',identity:{teamA:'BNK FEARX',teamB:'Nongshim RedForce',seriesScore:'3-1',league:'LCK',date:'2026-08-27'},summary:'<script>unsafe</script>'}}));
 assert.match(html,/上路先倒，還能打嗎？/);assert.match(html,/系列賽結果/);assert.match(html,/第四局/);
 assert.match(html,/font-size:32px/);assert.match(html,/font-size:34px/);
 assert.match(html,/bottom:12%/);
 assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);
});
