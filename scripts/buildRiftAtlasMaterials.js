const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const { buildTerritoryGround, buildMapPlate } = require('../utils/render/riftAtlasMaterials');
const { resolveTeamCrest } = require('../utils/render/teamCrestManifest');

async function main() {
  const root = process.cwd();
  const spec = JSON.parse(fs.readFileSync(path.join(root,'.impeccable/build/spec.json'),'utf8'));
  const brushPath = '.impeccable/sources/grunge-brushes/grunge_brushes/increased_opacity/brush017.png';
  const brush = fs.readFileSync(brushPath);
  const mapPath = process.argv[2];
  if (!mapPath) throw new Error('Provide the existing version-locked Riot map file.');
  const outputs = [];
  for (const region of spec.regions.filter(r => r.plate)) {
    const width=Math.ceil(region.px.w*1.5), height=Math.ceil(region.px.h*1.5);
    let buffer, source;
    if (region.id==='territory-ground') {
      buffer=await buildTerritoryGround({brush,width,height,left:'#f8cc37',right:'#a30a19'});
      source='Dino0040, CC0 real scanned watercolor alpha; '+brushPath;
    } else if (region.id==='map') {
      buffer=await buildMapPlate({map:fs.readFileSync(mapPath),width,height});
      source='Riot client map11 16.19 base-baron1; original topology retained with contain fit, no tactical paths; not a verified August 27 terrain variant.';
    } else {
      const team=region.id==='crest-left'?'BNK FEARX':'Nongshim RedForce';
      const crest=resolveTeamCrest({team,season:'2026',date:'2026-08-27'});
      buffer=await buildMapPlate({map:fs.readFileSync(path.join(root,'public',crest.publicPath)),width,height});
      source=crest.sourceUrl+'; verified SHA '+crest.sha256+'; '+crest.licenseNote;
    }
    const out=path.join(root,region.plate);
    fs.mkdirSync(path.dirname(out),{recursive:true});
    if (fs.existsSync(out)) throw new Error('Refusing to overwrite existing plate: '+region.plate);
    await sharp(buffer).withMetadata().png().toFile(out);
    const publicOut=path.join(root,'public/story-atlas',path.basename(out));
    fs.mkdirSync(path.dirname(publicOut),{recursive:true});
    fs.copyFileSync(out,publicOut,fs.constants.COPYFILE_EXCL);
    outputs.push({id:region.id,path:region.plate,publicPath:'/story-atlas/'+path.basename(out),width,height,source});
  }
  fs.writeFileSync('assets/plates/rift-atlas-provenance.json',JSON.stringify({generated:false,paidServices:false,detailReassemblyApproved:true,outputs},null,2)+'\n');
  console.log(JSON.stringify(outputs.map(({id,width,height})=>({id,width,height}))));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
