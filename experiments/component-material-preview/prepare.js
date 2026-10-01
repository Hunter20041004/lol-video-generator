const fs=require('node:fs');
const path=require('node:path');
const {restyleSource,restyleFrameSource,restyleTokens,polishSceneSource,polishSurfaceSource}=require('./materialStyle');

// Generated preview copies only; incumbent source modules remain untouched.
function prepare() {
  const root=path.resolve(__dirname,'../..');
  const out=path.join(root,'.data/component-material-preview');
  fs.mkdirSync(out,{recursive:true});
  for(const [name,transform] of [
    ['PostMatchReadFrame.jsx',restyleFrameSource],
    ['PostMatchReadScenes.jsx',source=>restyleSource(polishSurfaceSource(polishSceneSource(source)))],
    ['postMatchReadVisuals.js',restyleTokens],
  ]) {
    const source=fs.readFileSync(path.join(root,'src/templates/player-radar',name),'utf8');
    const rendered=transform(source)
      .replace('"../../video-system/renderAssetSrc"','"../../src/video-system/renderAssetSrc"')
      .replace('"./postMatchReadMotion"','"../../src/templates/player-radar/postMatchReadMotion"');
    fs.writeFileSync(path.join(out,name),rendered);
  }
  console.log('Generated independent component-style preview. Original sources unchanged.');
}
if(require.main===module) prepare();
module.exports={prepare};
