import React from 'react';
import { registerRoot, Composition, AbsoluteFill, Img, Audio, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { STARTS, visualFrame, sceneAt, MUSIC, musicGain } from './trialPlan';

const C = { ink:'#101a1b', stone:'#182223', gold:'#c6aa72', text:'#eee9dc', muted:'#bdb8a9', rule:'#776849' };
const asset = path => staticFile(String(path).replace(/^\//,''));
const label = {fontSize:31, color:C.muted, letterSpacing:3};
const number = {fontFamily:'Cinzel',fontWeight:700,color:C.gold,fontVariantNumeric:'tabular-nums'};
const slab = {backgroundColor:C.ink,backgroundImage:`url('${staticFile('render-assets/rift-stone-trial/forest.webp')}')`,backgroundSize:'100% 1000%',backgroundPosition:'center top',borderTop:`2px solid ${C.rule}`,borderBottom:`2px solid ${C.rule}`,padding:'30px 36px'};
const top = {position:'absolute',left:84,right:84,top:352};

function Entry({children,frame,delay=0,style={},reducedMotion}) {
  const t = Math.min(1,Math.max(0,(frame-delay)/14));
  const ease = 1-Math.pow(1-t,3);
  return <div style={{...style,opacity:ease,transform:reducedMotion?'none':`translateY(${(1-ease)*12}px)`}}>{children}</div>;
}
function Crest({crest,size=150}) {
  return <Img src={asset(crest.publicPath)} style={{width:size,height:size,objectFit:'contain'}}/>;
}
function Stat({value,title,size=72}) {
  return <div><div style={{...number,fontSize:size,lineHeight:1.2}}>{value}</div><div style={{fontSize:32,color:C.muted,marginTop:10}}>{title}</div></div>;
}
function Headline({children}) {
  return <div style={{fontSize:62,fontWeight:900,lineHeight:1.3,marginTop:18}}>{children}</div>;
}
const captions = [
  ['四局定勝負','這場系列賽，差距在哪裡？'],
  ['輔助對位差距最大','KDA、參團率與經濟一起看。'],
  ['從資源到地圖優勢','以下為單局終局統計，非事件時間軸。'],
  ['不只拿物件，更要換到塔','終局領先，落在塔數與經濟。'],
  ['數據 MVP 候選','系列賽平均；不是官方 MVP 評選。'],
  ['把領先換成塔與輸出','輔助建立差距，射手把輸出補上。'],
];

export function RiftStoneTrial({model,music,background,reducedMotion=false}) {
  const realFrame = useCurrentFrame();
  const frame = visualFrame(realFrame);
  const scene = sceneAt(frame);
  const local = frame-STARTS[scene];
  const a = model.assets;
  const edge = model.matchup.edgePlayer;
  const opponent = model.matchup.opponentPlayer;
  const player = model.proof.player;
  const teams = model.gameFlow.teamFinals;
  const enter = (children,delay=0,style={}) => <Entry frame={local} delay={delay} reducedMotion={reducedMotion} style={style}>{children}</Entry>;
  const score = model.seriesContext.score.replace('-','–');
  return <AbsoluteFill style={{background:C.ink,color:C.text,fontFamily:'Noto Trial',overflow:'hidden'}}>
    <style>{`@font-face{font-family:'Cinzel';src:url('${staticFile('fonts/Cinzel-Variable.woff2')}')}@font-face{font-family:'Noto Trial';font-weight:700;src:url('${staticFile('fonts/NotoSansTC-PostMatchRead-700.woff2')}')}@font-face{font-family:'Noto Trial';font-weight:900;src:url('${staticFile('fonts/NotoSansTC-PostMatchRead-900.woff2')}')}`}</style>
    <Img src={asset(background)} style={{position:'absolute',width:'100%',height:'100%',objectFit:'cover',transform:`scale(${reducedMotion?1:1+frame/1140*0.012})`}}/>
    <div style={{position:'absolute',top:60,left:90,right:90,textAlign:'center'}}>
      <div style={{...number,fontSize:37,letterSpacing:5}}>{model.seriesContext.league} · POST MATCH READ</div>
      <div style={{fontSize:29,color:C.muted,marginTop:12}}>{model.seriesContext.matchDate}　／　{model.seriesContext.gameCount} 局系列賽</div>
    </div>
    <div style={{position:'absolute',top:183,left:100,right:100,display:'flex',justifyContent:'center',alignItems:'center',gap:28,fontSize:34}}>
      <span>BNK FEARX</span><span style={{...number,fontSize:47}}>{score}</span><span>NONGSHIM</span>
    </div>

    {scene===0 && <>
      {enter(<div style={{textAlign:'center'}}><div style={{fontSize:71,fontWeight:900,marginTop:18}}>勝負之後，看懂勝點</div></div>,0,top)}
      {enter(<div style={{...slab,display:'flex',alignItems:'center',justifyContent:'space-between',gap:24}}><Crest crest={a.teams.teamA} size={240}/><div style={{...number,fontSize:150}}>{score}</div><Crest crest={a.teams.teamB} size={240}/></div>,7,{position:'absolute',top:650,left:72,right:72})}
      {enter(<div style={{textAlign:'center',...slab}}><div style={label}>本場三個閱讀焦點</div><div style={{display:'flex',justifyContent:'space-between',fontSize:42,lineHeight:1.8,marginTop:12}}>{['輔助差距','資源轉塔','射手效率'].map(text=><span key={text} style={{whiteSpace:'nowrap'}}>{text}</span>)}</div></div>,14,{position:'absolute',left:84,right:84,top:1150})}
    </>}

    {scene===1 && <>
      {enter(<Headline eyebrow="MATCHUP · SUPPORT">五路之中，輔助差距最大</Headline>,0,top)}
      {enter(<div style={slab}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>{[[edge,a.matchup.edge],[opponent,a.matchup.opponent]].map(([p,img])=><div key={p.name} style={{display:'flex',alignItems:'center',gap:20}}><Img src={asset(img.squareSrc)} style={{width:98,height:98,border:`2px solid ${C.rule}`}}/><div><div style={{fontFamily:'Cinzel',fontSize:48}}>{p.name}</div><div style={{fontSize:27,color:C.muted}}>{p.team}</div></div></div>)}</div>
        <div style={{display:'flex',justifyContent:'space-between',marginTop:45}}><Stat value={edge.rawStats.kda.toFixed(2)} title="Kellin · KDA"/><Stat value={opponent.rawStats.kda.toFixed(2)} title="Lehends · KDA"/></div>
        <div style={{borderTop:`1px solid ${C.rule}`,marginTop:30,paddingTop:28,display:'flex',justifyContent:'space-between'}}><Stat value={`${Math.round(edge.rawStats.kp*100)}% / ${Math.round(opponent.rawStats.kp*100)}%`} title="參團率 · Kellin / Lehends" size={48}/><Stat value={`${edge.rawStats.gpm} / ${opponent.rawStats.gpm}`} title="每分鐘經濟" size={48}/></div>
      </div>,7,{position:'absolute',top:635,left:72,right:72})}
      {enter(<div style={{...slab,textAlign:'center'}}><div style={label}>系列賽對位差距</div><div style={{...number,fontSize:82,marginTop:12}}>+6.74 KDA</div></div>,14,{position:'absolute',top:1202,left:190,right:190})}
    </>}

    {scene===2 && <>
      {enter(<Headline eyebrow="RESOURCE LEDGER">BNK FEARX 的資源帳本</Headline>,0,top)}
      {enter(<div style={slab}><div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:28,alignItems:'center'}}><div style={label}>單局終局</div><div style={{fontSize:31,color:C.gold}}>FEARX</div><div style={{fontSize:31,color:C.muted}}>NS</div>{[['虛空巢蟲','voidGrubs'],['預示者','riftHeralds'],['巴龍','barons'],['防禦塔','towers']].map(([name,key])=><React.Fragment key={key}><div style={{fontSize:44,padding:'12px 0'}}>{name}</div><div style={{...number,fontSize:68}}>{teams[0][key]}</div><div style={{...number,color:C.muted,fontSize:68}}>{teams[1][key]}</div></React.Fragment>)}</div></div>,7,{position:'absolute',top:650,left:100,right:100})}
      {enter(<div style={{...slab,fontSize:42,lineHeight:1.6}}>資源領先之外，<br/>更重要的是最後留下多少地圖優勢。</div>,14,{position:'absolute',top:1240,left:100,right:100})}
    </>}

    {scene===3 && <>
      {enter(<Headline eyebrow="MAP CONVERSION">領先，換成了什麼？</Headline>,0,top)}
      {enter(<div style={{...slab,display:'flex',alignItems:'center',justifyContent:'space-between'}}><div><div style={label}>防禦塔 · FEARX / NS</div><div style={{...number,fontSize:110}}>8–1</div></div><Crest crest={a.finalRead.winnerCrest} size={150}/></div>,7,{position:'absolute',top:620,left:96,right:96})}
      {enter(<div style={slab}><div style={label}>終局經濟差</div><div style={{...number,fontSize:110}}>+11,549</div><div style={{fontSize:33,color:C.muted,marginTop:14}}>55,491　／　43,942 GOLD</div></div>,14,{position:'absolute',top:1160,left:96,right:96})}
    </>}

    {scene===4 && <>
      {enter(<Headline eyebrow="PLAYER PROOF · ADC">{player.name}，數據 MVP 候選</Headline>,0,top)}
      {enter(<div style={{position:'relative',height:500,background:C.ink,borderBottom:`2px solid ${C.rule}`}}><Img src={asset(a.proof.playerPortrait.publicPath)} style={{position:'absolute',height:'100%',width:620,left:100,objectFit:'contain',objectPosition:'center bottom'}}/><div style={{position:'absolute',right:30,top:30}}><Crest crest={a.teams.teamA} size={120}/></div></div>,7,{position:'absolute',top:610,left:96,right:96})}
      {enter(<div style={slab}><div style={{display:'flex',justifyContent:'space-between'}}><Stat value={player.rawStats.csm.toFixed(2)} title="每分鐘補刀"/><Stat value={player.rawStats.kda.toFixed(2)} title="KDA"/><Stat value={`${Math.round(player.rawStats.kp*100)}%`} title="參團率"/></div><div style={{display:'flex',gap:25,alignItems:'center',borderTop:`1px solid ${C.rule}`,marginTop:25,paddingTop:22}}>{a.proof.champions.map(c=><Img key={c.championName} src={asset(c.src)} style={{width:64,height:64}}/>)}<div style={{fontSize:31,color:C.muted}}>GPM {player.rawStats.gpm}　／　DPM {player.rawStats.dpm}</div></div></div>,14,{position:'absolute',top:1120,left:96,right:96})}
    </>}

    {scene===5 && <>
      {enter(<div style={{textAlign:'center'}}><Headline eyebrow="FINAL READ">這場的勝點，記住兩件事</Headline></div>,0,top)}
      {enter(<div style={{...slab,textAlign:'center'}}><Crest crest={a.finalRead.winnerCrest} size={170}/><div style={{...number,fontSize:108}}>{score}</div><div style={{fontSize:42,color:C.muted}}>BNK FEARX · SERIES WIN</div></div>,7,{position:'absolute',top:645,left:130,right:130})}
      {enter(<div style={{...slab,fontSize:45,lineHeight:1.9}}><span style={{color:C.gold}}>Kellin</span>　對位 +6.74 KDA<br/><span style={{color:C.gold}}>Taeyoon</span>　每分鐘補刀 10.02</div>,14,{position:'absolute',top:1170,left:100,right:100})}
    </>}
    {enter(<div style={{position:'absolute',top:1560,left:108,right:108,textAlign:'center'}}><div style={{fontSize:54,fontWeight:900,color:C.gold,lineHeight:1.4}}>{captions[scene][0]}</div><div style={{fontSize:32,lineHeight:1.7,color:C.muted,marginTop:16}}>{captions[scene][1]}</div></div>,10)}
    <div style={{position:'absolute',top:1793,left:96,right:96,display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:28,color:C.muted}}><span>Leaguepedia 賽事資料 · 美術示意非戰術圖</span><span style={{...number,fontSize:32}}>0{scene+1} / 06</span></div>
    {MUSIC.map((clip,i)=><Sequence key={i} from={clip.from} durationInFrames={clip.duration}><Audio src={asset(music)} trimBefore={clip.source} volume={f=>musicGain(f+clip.from)}/></Sequence>)}
  </AbsoluteFill>;
}
registerRoot(()=> <Composition id="RiftStoneTrial" component={RiftStoneTrial} durationInFrames={1200} fps={30} width={1080} height={1920}/>);
