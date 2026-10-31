import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';

const placements = [
  ['territory-ground',0,0,100,82.24],
  ['crest-left',14.03,23.2,22.74,12.32],
  ['crest-right',63.76,22.61,23.38,13.52],
  ['map',4.89,39,91.5,42.46],
];
const plateOrigins={
  'territory-ground':'assets/plates/territory-ground.png',
  'crest-left':'assets/plates/crest-left.png',
  'crest-right':'assets/plates/crest-right.png',
  map:'assets/plates/map.png',
};
const defaultModel={headline:'上路先倒，還能打嗎？',identity:{teamA:'BNK FEARX',teamB:'Nongshim RedForce',seriesScore:'3-1',league:'LCK',date:'2026-08-27'},summary:'第四局的預示者團\nFEARX 把人頭追回 6–6'};
export const MatchStoryFrame = ({plateOnly=false,model=defaultModel}) => {
  const identity=model.identity || defaultModel.identity;
  const [left,right]=identity.seriesScore.split('-');
  const scene=model.scene;
  const detail=scene&&['event','context'].includes(scene.component);
  const verdict=scene?.component==='verdict';
  const hook=!detail&&!verdict;
  const portrait=scene?.component==='context' ? model.portrait : null;
  const scenePlacements=plateOnly ? placements : detail ? [
    ['territory-ground',0,portrait?0:10,100,portrait?82.24:34],['crest-left',6,13,14,8],['crest-right',80,13,14,8],
  ] : hook ? [
    ['territory-ground',0,10,100,50],['crest-left',15,26,23,10],['crest-right',62,26,23,10],
  ] : [
    ['territory-ground',0,10,100,40],['crest-left',4,13,18,10],['crest-right',78,13,18,10],
  ];
  const games=[...new Set((scene?.facts || []).filter(f=>f.scope==='game').map(f=>f.gameNumber))];
  const gameFacts=(scene?.facts || []).filter(f=>f.scope==='game');
  const evidenceLabel=gameFacts.every(f=>f.evidenceType==='reviewed-video')?'片段回看':gameFacts.every(f=>f.evidenceType==='report')?'報導描述':'賽事資料';
  const scope=scene ? (games.length ? games.map(n=>`第${n}局`).join('／')+' · '+evidenceLabel : scene.component==='verdict' ? '系列賽結論' : scene.component==='context' ? '背景與賽季脈絡' : '本場看點') : '系列賽結果 · 第四局片段回看';
  return <AbsoluteFill data-visual-world="rift-atlas" data-scene={scene?.component || 'proof'} style={{background:'#f6f3df',color:'#101717',fontFamily:'Noto Sans TC Story',overflow:'hidden'}}>
    {scenePlacements.filter(([id])=>plateOnly || id!=='map').map(([id,x,y,w,h])=><Img key={id} data-region={id} data-source-plate={model.materials ? model.materials[id] : plateOrigins[id]} src={staticFile(model.materials ? model.materials[id] : `story-atlas/${id}.png`)} style={{position:'absolute',left:`${x}%`,top:`${y}%`,width:`${w}%`,height:`${h}%`,objectFit:!plateOnly&&id==='territory-ground'?'fill':'contain',filter:!plateOnly&&id.startsWith('crest-')?'drop-shadow(0px 4px 4px rgba(16,23,23,.22))':undefined}} />)}
    {!plateOnly&&portrait&&<>
      <Img data-region="player-portrait" src={staticFile(portrait.publicPath)} style={{position:'absolute',left:'17%',top:'23%',width:'66%',height:'32%',objectFit:'contain'}} />
      <p style={{position:'absolute',top:'56%',left:'6%',right:'6%',margin:0,fontSize:54,fontFamily:'Barlow Condensed Post Match Read',fontWeight:900,textAlign:'center',color:'#101717'}}>{portrait.publicName}</p>
    </>}
    {!plateOnly && <>
      <h1 style={{position:'absolute',top:'2.2%',left:'5%',width:'90%',margin:0,fontSize:Array.from(model.headline || '').length>13?54:72,lineHeight:1.18,fontWeight:900,textAlign:'center'}}>{model.headline}</h1>
      <p style={{position:'absolute',top:'8.2%',left:'5%',width:'90%',margin:0,fontFamily:'Barlow Condensed Post Match Read',fontWeight:800,fontSize:29,letterSpacing:5,textAlign:'center'}}>{identity.league} / {identity.date.replaceAll('-','.')}</p>
      {!detail&&<div aria-label={`系列賽結果 ${left} 比 ${right}`} style={{position:'absolute',top:hook?'10%':'11%',left:hook?'18%':'25%',width:hook?'64%':'50%',display:'flex',justifyContent:'space-between',alignItems:'center',fontFamily:'Barlow Condensed Post Match Read',fontSize:hook?340:250,lineHeight:.9,fontWeight:900}}><span>{left}</span><span style={{fontSize:hook?160:110}}>–</span><span style={{color:'#f6f3df'}}>{right}</span></div>}
      <p style={{position:'absolute',top:detail?'21%':hook?'36.5%':'25%',left:hook?'10%':'5%',width:hook?'33%':'40%',margin:0,textAlign:'center',fontSize:44,lineHeight:1.05,fontFamily:'Barlow Condensed Post Match Read',fontWeight:900}}>{identity.teamA.toUpperCase()}</p>
      <p style={{position:'absolute',top:detail?'21%':hook?'36.5%':'25%',right:hook?'10%':'5%',width:hook?'33%':'40%',margin:0,textAlign:'center',fontSize:44,lineHeight:1.05,fontFamily:'Barlow Condensed Post Match Read',fontWeight:900,color:'#f6f3df'}}>{identity.teamB.toUpperCase()}</p>
      <div data-region="story-reading" style={{position:'absolute',left:'6%',right:'6%',top:detail?(portrait?'62%':'36%'):verdict?'42%':'49%',borderTop:'2px solid #101717',paddingTop:22}}>
        {(!hook||!scene)&&<p style={{margin:0,fontSize:34,lineHeight:1.3,fontWeight:700}}>{scope}</p>}
        <p style={{margin:'14px 0 0',fontSize:detail&&!portrait?72:55,lineHeight:1.35,fontWeight:900,whiteSpace:'pre-line',overflowWrap:'anywhere',wordBreak:'break-all'}}>{scene?.narration || model.summary}</p>
      </div>
      <p style={{position:'absolute',bottom:'12%',left:'6%',right:'6%',margin:0,fontSize:32,lineHeight:1.3,fontWeight:700}}>來源：{model.sourceLabel || 'OPLoLReplay／Kuki／Fomos'} · {portrait?'原始選手照片':'文字摘要'}</p>
    </>}
  </AbsoluteFill>
};
