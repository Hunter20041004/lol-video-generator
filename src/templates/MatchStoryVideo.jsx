import React from 'react';
import { useCurrentFrame, Sequence, Audio, staticFile } from 'remotion';
import { MatchStoryFrame } from './MatchStoryFrame';
import { getMatchStoryFrameState } from '../../utils/render/matchStoryValidation';
import { buildMatchStoryMusicCues, getMatchStoryCueVolume } from '../../utils/render/matchStoryAudio';

export const MatchStoryVideo = ({identity,timeline,headline,sourceLabel,materials,scenePortraits={},music=null}) => {
  const frame=useCurrentFrame();
  const {scene}=getMatchStoryFrameState(timeline,frame);
  const cues=buildMatchStoryMusicCues(timeline,music);
  return <>
    <MatchStoryFrame model={{identity,headline,sourceLabel,scene,materials,portrait:scenePortraits[scene.id]}} />
    {cues.map(cue=><Sequence key={cue.from} from={cue.from} durationInFrames={cue.durationInFrames} layout="none">
      <Audio src={staticFile(cue.bgmFile)} trimBefore={cue.sourceStartFrame} trimAfter={cue.sourceStartFrame+cue.durationInFrames} volume={localFrame=>getMatchStoryCueVolume(cue,localFrame)} />
    </Sequence>)}
  </>;
};
