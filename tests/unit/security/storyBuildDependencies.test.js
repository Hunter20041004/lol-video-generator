const test=require('node:test');
const assert=require('node:assert/strict');
test('story build dependencies contain the reviewed denial-of-service patches',()=>{
 const lock=require('../../../package-lock.json');
 const minimums={'source-map-js':[1,2,2],'postcss-selector-parser':[7,1,6]};
 for(const [name,minimum] of Object.entries(minimums)){
  const versions=Object.entries(lock.packages).filter(([key])=>key.endsWith('/'+name));
  assert.ok(versions.length,`missing ${name}`);
  for(const [,entry] of versions){
   const actual=entry.version.split('.').map(Number);
   assert.ok(actual[0]>minimum[0]||actual[0]===minimum[0]&&(actual[1]>minimum[1]||actual[1]===minimum[1]&&actual[2]>=minimum[2]),`${name} ${entry.version} lacks required patch`);
  }
 }
});
