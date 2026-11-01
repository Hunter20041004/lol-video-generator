const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const Module=require('node:module');
const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');

test('story rendering is independently registered with draft-driven duration, not Player Radar metadata',()=>{
 const root=fs.readFileSync(path.resolve(__dirname,'../../../src/Root.jsx'),'utf8');
 assert.match(root,/id="MatchStoryVideo"/);assert.match(root,/component=\{MatchStoryVideo\}/);
 assert.match(root,/durationInFrames:props\.timeline\.durationInFrames/);
});

test('video connects explicit non-looping music sequences and their fade envelope',()=>{
 const source=fs.readFileSync(path.resolve(__dirname,'../../../src/templates/MatchStoryVideo.jsx'),'utf8');
 assert.match(source,/buildMatchStoryMusicCues\(timeline,music\)/);
 assert.match(source,/from=\{cue\.from\}/);
 assert.match(source,/durationInFrames=\{cue\.durationInFrames\}/);
 assert.match(source,/trimBefore=\{cue\.sourceStartFrame\}/);
 assert.match(source,/getMatchStoryCueVolume\(cue,localFrame\)/);
 assert.doesNotMatch(source,/loop[=:]/);
});

test('a scene gets its own verified portrait, not a whole-film fixed player',()=>{
 const source=fs.readFileSync(path.resolve(__dirname,'../../../src/templates/MatchStoryVideo.jsx'),'utf8');
 assert.match(source,/portrait:scenePortraits\[scene\.id\]/);
 assert.doesNotMatch(source,/Taeyoon|Chovy|Ruler/);
});

test('the story video uses the actual clock, cuts to the next cited scene and freezes its final state',async()=>{
 const filename=path.resolve(__dirname,'../../../src/templates/MatchStoryVideo.jsx');
 const swc=require('next/dist/build/swc');await swc.loadBindings();
 const {code}=await swc.transform(fs.readFileSync(filename,'utf8'),{filename,jsc:{parser:{syntax:'ecmascript',jsx:true},transform:{react:{runtime:'classic'}}},module:{type:'commonjs'}});
 const loaded=new Module(filename,module);loaded.filename=filename;loaded.paths=module.paths;
 const nativeRequire=loaded.require.bind(loaded);let frame=0;
 loaded.require=name=>name==='remotion'?{useCurrentFrame:()=>frame}:name==='./MatchStoryFrame'?{MatchStoryFrame:({model})=>React.createElement('p',{'data-kind':model.scene.component},model.scene.narration)}:nativeRequire(name);
 loaded._compile(code,filename);
 const props={identity:{teamA:'Synthetic A',teamB:'Synthetic B'},headline:'合成影片',sourceLabel:'合成來源',timeline:{durationInFrames:300,freezeFrames:60,scenes:[{from:0,durationInFrames:120,component:'hook',narration:'合成開場'},{from:120,durationInFrames:180,component:'verdict',narration:'合成結論'}]}};
 const render=()=>renderToStaticMarkup(React.createElement(loaded.exports.MatchStoryVideo,props));
 frame=119;assert.match(render(),/合成開場/);
 frame=120;assert.match(render(),/合成結論/);
 frame=240;const frozen=render();frame=299;assert.equal(render(),frozen);
});
