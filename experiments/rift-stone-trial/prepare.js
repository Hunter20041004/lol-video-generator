const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const { resolvePlayerRadarAssets } = require('../../utils/render/playerRadarAssetPlanner');
const { selectAndStageLicensedMusic } = require('../../utils/render/licensedMusicLibrary');

async function prepare(snapshotPath, backgroundPath) {
  const model = JSON.parse(fs.readFileSync(snapshotPath,'utf8')).payloads[0].postMatchRead;
  model.assets = await resolvePlayerRadarAssets(model);
  const music = selectAndStageLicensedMusic({ random:()=>0.4 });
  if (!music) throw new Error('No verified licensed music available');
  const out = path.resolve('public/render-assets/rift-stone-trial');
  fs.mkdirSync(out,{recursive:true});
  await sharp(backgroundPath).webp({quality:92}).toFile(path.join(out,'forest.webp'));
  const props = {model, music:music.bgmFile, background:'render-assets/rift-stone-trial/forest.webp'};
  fs.writeFileSync(path.join(out,'input.json'),JSON.stringify(props,null,2));
  console.log(JSON.stringify({input:path.join(out,'input.json'),track:music.trackId,series:model.seriesContext.seriesId}));
}
if (require.main === module) prepare(...process.argv.slice(2)).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports = {prepare};
