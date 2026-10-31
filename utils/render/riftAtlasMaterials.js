const sharp = require('sharp');

// Re-colour real scanned alpha, never synthesize brush contours or map paths.
async function buildTerritoryGround({ brush, width, height, left, right }) {
  if (![width,height].every(v => Number.isInteger(v) && v >= 2 && v <= 4096)
    || ![left,right].every(v => /^#[0-9a-f]{6}$/i.test(v))) throw new Error('Invalid territory dimensions or colours.');
  const alpha=await sharp(brush).resize(width,height,{fit:'fill'}).ensureAlpha().extractChannel(3).raw().toBuffer();
  const colours=[left,right].map(hex=>[1,3,5].map(at=>parseInt(hex.slice(at,at+2),16)));
  const pixels=Buffer.alloc(width*height*4);
  for(let y=0;y<height;y++){
    let first=0;while(first<width&&alpha[y*width+first]<16)first++;
    // The diagonal is the layout; its irregular edge comes from the scanned paint,
    // not a polygon mask. The map itself is never altered by this operation.
    const edge=width*(0.72-0.44*y/height)+(first-width*0.5)*0.035;
    for(let x=0;x<width;x++){
      const ink=alpha[y*width+x]/255;
      const rightWeight=Math.max(0,Math.min(1,(x-edge+3+ink*9)/12));
      const at=(y*width+x)*4;
      for(let c=0;c<3;c++)pixels[at+c]=Math.round((colours[0][c]*(1-rightWeight)+colours[1][c]*rightWeight)*(0.84+ink*0.16));
      pixels[at+3]=alpha[y*width+x];
    }
  }
  return sharp(pixels,{raw:{width,height,channels:4}}).png().toBuffer();
}
async function buildMapPlate({ map, width, height }) {
  const padding = Math.round(Math.min(width,height)*0.06);
  const image = await sharp(map).resize(width-padding*2,height-padding*2,{fit:'contain',background:'#00000000'}).png().toBuffer();
  return sharp({create:{width,height,channels:4,background:'#00000000'}}).composite([{input:image,left:padding,top:padding}]).png().toBuffer();
}
async function buildAtlasGround({brush,width,height,left,right}){
 const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
 const hex=values=>'#'+values.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
 const paper=[250,242,216];
 const light=hex(rgb(left).map((v,i)=>v*.45+paper[i]*.55));
 const dark=hex(rgb(right).map(v=>v*.64));
 const result=await buildTerritoryGround({brush,width,height,left:light,right:dark});
 const {data}=await sharp(result).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const original=Buffer.from(data);
 const fade=t=>Math.max(0,Math.min(1,t));
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const at=(y*width+x)*4;
  // The scan's actual contour is reflected to build broad paired strokes.
  // Clear gaps remain clear; fades dissolve paint into the same paper ground.
  const sourceX=Math.min(width-1,Math.floor(width*.22+x*.56));
  const sourceY=Math.min(height-1,Math.floor(height*.2+y*.7));
  const source=(sourceY*width+sourceX)*4;
  const mirror=(sourceY*width+width-1-sourceX)*4;
  const alpha=Math.max(original[source+3],original[mirror+3]);
  const pigment=(.96+.04*alpha/255)/(.84+.16*original[at+3]/255);
  for(let c=0;c<3;c++)data[at+c]=Math.min(255,Math.round(original[at+c]*pigment));
  const edgeFade=fade((y/height-.02)/.08)*fade((.77-y/height)/.16);
  data[at+3]=Math.round(alpha*edgeFade);
 }
 return sharp(data,{raw:{width,height,channels:4}}).png().toBuffer();
}
// Material translation of the source bitmap, not new tactical geometry.
// Flood fill only identifies enclosed transparent jungle areas. Original
// coloured pixels retain their coordinates; open space remains transparent.
async function buildAtlasMapPlate({map,brush,width,height}){
 const {data,info}=await sharp(map).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const w=info.width,h=info.height,size=w*h;
 const ink=await sharp(brush).resize(w,h,{fit:'fill'}).ensureAlpha().extractChannel(3).raw().toBuffer();
 const outside=new Uint8Array(size),queue=new Int32Array(size);let head=0,tail=0;
 const visit=i=>{if(!outside[i]&&data[i*4+3]<48){outside[i]=1;queue[tail++]=i;}};
 for(let x=0;x<w;x++){visit(x);visit((h-1)*w+x);}
 for(let y=0;y<h;y++){visit(y*w);visit(y*w+w-1);}
 while(head<tail){const i=queue[head++],x=i%w,y=Math.floor(i/w);if(x)visit(i-1);if(x<w-1)visit(i+1);if(y)visit(i-w);if(y<h-1)visit(i+w);}
 // Distance is derived from the existing forest/road boundary. It supplies
 // relief, not new trees, roads, or event locations.
 const depth=new Float32Array(size);
 for(let i=0;i<size;i++)if(!outside[i]&&data[i*4+3]<48)depth[i]=w+h;
 for(let y=1;y<h;y++)for(let x=1;x<w;x++){const i=y*w+x;if(depth[i])depth[i]=Math.min(depth[i],depth[i-1]+1,depth[i-w]+1);}
 for(let y=h-2;y>=0;y--)for(let x=w-2;x>=0;x--){const i=y*w+x;if(depth[i])depth[i]=Math.min(depth[i],depth[i+1]+1,depth[i+w]+1);}
 const pixels=Buffer.alloc(size*4),elevation=new Float32Array(size);
 for(let i=0;i<size;i++){
  if(outside[i])continue;
  const at=i*4,[r,g,b,a]=data.subarray(at,at+4),grain=ink[i]/255;
  let colour;
  if(a<48){const rim=Math.exp(-depth[i]/4);colour=[52+grain*20+rim*110,36+grain*15+rim*74,17+grain*8+rim*28];elevation[i]=18+Math.min(22,depth[i]*1.7)+grain*3;}
  else if((r>g*1.25&&r>b*1.08)||(b>g*1.3&&b>r*1.4)){colour=[r,g,b];elevation[i]=14;}
  else if(b>r*1.6&&g>r*1.5){colour=[145,202,217];elevation[i]=3;}
  else if(g>r+8&&b>r+8){colour=[171+(r-90)*.4,174+(g-130)*.4,161+(b-130)*.4];elevation[i]=12;}
  else{colour=[244,208,131];elevation[i]=18;}
  pixels.set(colour.map(v=>Math.max(0,Math.min(255,Math.round(v)))),at);pixels[at+3]=a<48?255:a;
 }
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
  const i=y*w+x;if(!pixels[i*4+3])continue;
  const light=Math.max(.55,Math.min(1.22,1+(elevation[i-w-1]-elevation[i+w+1])*.018));
  for(let c=0;c<3;c++)pixels[i*4+c]=Math.round(Math.min(255,pixels[i*4+c]*light));
 }
 const painted=await sharp(pixels,{raw:{width:w,height:h,channels:4}}).png().toBuffer();
 const pad=12;
 const shadowPixels=Buffer.from(pixels);
 for(let i=0;i<size;i++)shadowPixels.set([48,33,15],i*4);
 const shadow=await sharp(shadowPixels,{raw:{width:w,height:h,channels:4}}).png().toBuffer();
 const relief=await sharp({create:{width:w+pad*2,height:h+pad*2,channels:4,background:'#00000000'}})
  .composite([{input:shadow,left:pad+3,top:pad+7},{input:painted,left:pad,top:pad}]).png().toBuffer();
 return buildMapPlate({map:relief,width,height});
}
module.exports = { buildTerritoryGround, buildMapPlate, buildAtlasMapPlate, buildAtlasGround };
