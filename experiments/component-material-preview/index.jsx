import React from 'react';
import {AbsoluteFill,Audio,Sequence,Composition,registerRoot,useCurrentFrame,staticFile} from 'remotion';
import {buildTimeline,getActiveTimelineScene} from '../../src/video-system/pacing';
import {freezePostMatchReadFrame} from '../../src/templates/player-radar/postMatchReadMotion';
import {PostMatchReadFrame as ClassicFrame} from '../../.data/component-material-preview/PostMatchReadFrame';
import * as ClassicScenes from '../../.data/component-material-preview/PostMatchReadScenes';
import {PostMatchReadFrame as OriginalFrame} from '../../src/templates/player-radar/PostMatchReadFrame';
import * as OriginalScenes from '../../src/templates/player-radar/PostMatchReadScenes';
import {MUSIC,musicGain} from '../rift-stone-trial/trialPlan';
import '../../src/video-system/localFonts.css';

function Preview({model,music,variant='classic',reducedMotion=false}) {
  const frame=freezePostMatchReadFrame(useCurrentFrame());
  const active=getActiveTimelineScene(buildTimeline(model.storyboard,30,0),frame);
  const Frame=variant==='original'?OriginalFrame:ClassicFrame;
  const scenes=variant==='original'?OriginalScenes:ClassicScenes;
  const common={model,frame,localFrame:active.localFrame,reducedMotion};
  const tag=active.scene?.tag;
  const Scene=tag==='EARLY_CONTROL'?scenes.EarlyControlScene:
    tag==='MAP_CONVERSION'?scenes.MapConversionScene:
    tag==='PLAYER_PROOF'?scenes.PlayerProofScene:
    tag==='FINAL_READ'?scenes.FinalReadScene:scenes.MatchupBroadcastScene;
  return <AbsoluteFill><Frame model={model} sceneTag={tag}><Scene {...common} phase={tag==='RESULT_HOOK'?'result':'matchup'}/></Frame>
    {MUSIC.map((clip,i)=><Sequence key={i} from={clip.from} durationInFrames={clip.duration}><Audio src={staticFile(music)} trimBefore={clip.source} volume={f=>musicGain(f+clip.from)}/></Sequence>)}
  </AbsoluteFill>;
}
registerRoot(()=> <Composition id="ClassicComponentPreview" component={Preview} width={1080} height={1920} fps={30} durationInFrames={1200}/>);
