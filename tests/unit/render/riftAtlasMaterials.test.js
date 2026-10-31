const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');

test('atlas strokes bleed past the score columns and dissolve before the reading area',async()=>{
 const {buildAtlasGround}=require('../../../utils/render/riftAtlasMaterials');
 const pixels=Buffer.alloc(100*100*4);
 for(let y=20;y<90;y++)for(let x=20;x<80;x++)pixels.set([255,255,255,255],(y*100+x)*4);
 const brush=await sharp(pixels,{raw:{width:100,height:100,channels:4}}).png().toBuffer();
 const result=await buildAtlasGround({brush,width:400,height:600,left:'#f0d000',right:'#e01020'});
 const {data}=await sharp(result).raw().toBuffer({resolveWithObject:true});
 assert.ok(data[(120*400+350)*4+3]>220,'right score must sit on the native paint, not its empty margin');
 const gold=(120*400+60)*4;
 assert.ok(data[gold]>230&&data[gold+1]>210,'bleeding the stroke must not turn its pale gold pigment into dull olive');
 assert.equal(data[(480*400+350)*4+3],0,'narration sits on exposed paper, without a rectangular overlay');
});

test('atlas pigments translate team colours into light paper-wash and dark paint roles',async()=>{
 const {buildAtlasGround}=require('../../../utils/render/riftAtlasMaterials');
 const brush=await sharp({create:{width:40,height:40,channels:4,background:'#ffffffff'}}).png().toBuffer();
 const result=await buildAtlasGround({brush,width:400,height:600,left:'#f0d000',right:'#e01020'});
 const {data}=await sharp(result).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const pixel=(x,y)=>[...data.subarray((y*400+x)*4,(y*400+x)*4+4)];
 const left=pixel(60,200),right=pixel(350,200);
 assert.ok(left[0]>230&&left[1]>200&&left[2]>90);
 assert.ok(right[0]<180&&right[0]>right[1]*3);
});

test('atlas relief fills enclosed forest while keeping original road and river positions',async()=>{
 const {buildAtlasMapPlate}=require('../../../utils/render/riftAtlasMaterials');
 const pixels=Buffer.alloc(16*16*4);
 for(let y=3;y<13;y++)for(let x=3;x<13;x++){
  if(x!==3&&x!==12&&y!==3&&y!==12)continue;
  const at=(y*16+x)*4;pixels.set([144,156,112,255],at);
 }
 pixels.set([15,130,165,255],(3*16+7)*4);
 pixels.set([122,83,89,255],(12*16+12)*4);
 pixels.set([70,106,143,255],(12*16+3)*4);
 const map=await sharp(pixels,{raw:{width:16,height:16,channels:4}}).png().toBuffer();
 const brush=await sharp({create:{width:16,height:16,channels:4,background:'#ffffff'}}).png().toBuffer();
 const result=await buildAtlasMapPlate({map,brush,width:160,height:160});
 const {data,info}=await sharp(result).raw().toBuffer({resolveWithObject:true});
 const p=(x,y)=>[...data.subarray((y*info.width+x)*4,(y*info.width+x)*4+4)];
 assert.equal(p(0,0)[3],0);assert.equal(p(80,80)[3],255);
 assert.equal(p(114,80)[3],0,'relief shadow must follow the silhouette, not fill its source rectangle');
 // Native 16px fixture is inset by the 12px relief margin, then contained
 // in a 140px box with 10px outer margin: source(3,3) lands near(64,64).
 const road=p(64,64),water=p(78,64),forest=p(80,80);
 assert.ok(road[0]>road[1]&&road[1]>road[2]);
 assert.ok(water[2]>water[0]&&water[0]>water[2]*.45,'river receives the light-blue material, not the saturated base-marker hue; relief can shade its brightness');assert.ok(forest[0]<road[0]);
 assert.ok(p(96,96)[0]>p(96,96)[1]*1.3,'red base marker must not become a gold road');
 assert.ok(p(64,96)[2]>p(64,96)[0]*1.4,'blue base marker retains its source colour identity');
});

test('forest relief has raised contour depth even when the scanned pigment is uniform',async()=>{
 const {buildAtlasMapPlate}=require('../../../utils/render/riftAtlasMaterials');
 const pixels=Buffer.alloc(32*32*4);
 for(let y=3;y<29;y++)for(let x=3;x<29;x++)if(x===3||x===28||y===3||y===28)pixels.set([144,156,112,255],(y*32+x)*4);
 const map=await sharp(pixels,{raw:{width:32,height:32,channels:4}}).png().toBuffer();
 const brush=await sharp({create:{width:32,height:32,channels:4,background:'#ffffff'}}).png().toBuffer();
 const result=await buildAtlasMapPlate({map,brush,width:256,height:256});
 const {data}=await sharp(result).raw().toBuffer({resolveWithObject:true});
 const red=(x,y)=>data[(y*256+x)*4];
 assert.ok(red(85,128)>red(128,128)+15,'forest edges catch light while the interior remains deep, rather than a flat fill');
});

test('territory paint changes the broad background with both requested team colours', async () => {
  const { buildTerritoryGround } = require('../../../utils/render/riftAtlasMaterials');
  const brush = await sharp({ create: { width: 80, height: 100, channels: 4, background: '#ffffffff' } }).png().toBuffer();
  const result = await buildTerritoryGround({ brush, width: 400, height: 600, left: '#ffc400', right: '#b50017' });
  const { data, info } = await sharp(result).raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 400); assert.equal(info.height, 600);
  const pixel = (x,y) => [...data.subarray((y*info.width+x)*info.channels,(y*info.width+x)*info.channels+3)];
  assert.deepEqual(pixel(40,100), [255,196,0]);
  assert.deepEqual(pixel(360,100), [181,0,23]);
});

test('invalid dimensions or unvalidated colour values are rejected before image processing', async () => {
  const { buildTerritoryGround } = require('../../../utils/render/riftAtlasMaterials');
  await assert.rejects(buildTerritoryGround({ brush: Buffer.alloc(0), width: 99999, height: 600, left: '#ffc400', right: '#b50017' }), /Invalid territory/);
});

test('map placement preserves all four corners and transparent margin without cropping routes', async () => {
  const { buildMapPlate } = require('../../../utils/render/riftAtlasMaterials');
  const map = await sharp({ create: { width: 100, height: 100, channels: 4, background: '#125b40ff' } }).png().toBuffer();
  const result = await buildMapPlate({ map, width: 600, height: 400 });
  const { data, info } = await sharp(result).raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.channels,4); assert.equal(data[3],0);
  for (const [x,y] of [[135,35],[465,35],[135,365],[465,365]]) {
    const at=(y*600+x)*4; assert.deepEqual([...data.subarray(at,at+4)],[18,91,64,255]);
  }
});

test('transparent brush gaps expose paper instead of becoming opaque flat colour',async()=>{
 const {buildTerritoryGround}=require('../../../utils/render/riftAtlasMaterials');
 const brush=await sharp({create:{width:8,height:8,channels:4,background:'#00000000'}}).png().toBuffer();
 const result=await buildTerritoryGround({brush,width:400,height:600,left:'#ffc400',right:'#b50017'});
 const {data,info}=await sharp(result).raw().toBuffer({resolveWithObject:true});
 for(const x of [20,380]){const at=(50*400+x)*info.channels;assert.equal(data[at+3],0);}
});

test('paint territories cross diagonally rather than a rigid vertical half-screen seam',async()=>{
 const {buildTerritoryGround}=require('../../../utils/render/riftAtlasMaterials');
 const brush=await sharp({create:{width:8,height:8,channels:4,background:'#ffffffff'}}).png().toBuffer();
 const image=await buildTerritoryGround({brush,width:400,height:600,left:'#ffc400',right:'#b50017'});
 const {data,info}=await sharp(image).raw().toBuffer({resolveWithObject:true});
 const p=y=>[...data.subarray((y*400+200)*info.channels,(y*400+200)*info.channels+3)];
 assert.deepEqual(p(70),[255,196,0]);assert.deepEqual(p(530),[181,0,23]);
});
