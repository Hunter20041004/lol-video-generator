import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { BgmLayer } from "../video-system/BgmLayer";
import { buildTimeline, getActiveTimelineScene } from "../video-system/pacing";
import { PostMatchReadFrame } from "./player-radar/PostMatchReadFrame";
import {
  FinalReadScene,
  GameFlowScene,
  MatchupBroadcastScene,
  PlayerProofScene,
} from "./player-radar/PostMatchReadScenes";
import { freezePostMatchReadFrame } from "./player-radar/postMatchReadMotion";

export const Template_PlayerRadar = ({ data }) => {
  const rawFrame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const frame = freezePostMatchReadFrame(rawFrame);
  const model = data.postMatchRead;
  const timeline = buildTimeline(model.storyboard, fps, 0);
  const active = getActiveTimelineScene(timeline, frame);
  const common = {
    model,
    frame,
    localFrame: active.localFrame,
    reducedMotion: Boolean(data.reducedMotion),
  };

  return (
    <AbsoluteFill style={{ backgroundColor: "#03080C", color: "#F4EAD5", overflow: "hidden" }}>
      <BgmLayer bgmFile={data.bgmFile} audioPlan={model.audioPlan || data.audioPlan} />
      <PostMatchReadFrame model={model} sceneTag={active.scene?.tag}>
        {active.scene?.tag === "RESULT_HOOK" && <MatchupBroadcastScene {...common} phase="result" />}
        {active.scene?.tag === "MATCHUP_EDGE" && <MatchupBroadcastScene {...common} phase="matchup" />}
        {active.scene?.tag === "GAME_FLOW" && <GameFlowScene {...common} />}
        {active.scene?.tag === "PLAYER_PROOF" && <PlayerProofScene {...common} />}
        {active.scene?.tag === "FINAL_READ" && <FinalReadScene {...common} />}
      </PostMatchReadFrame>
    </AbsoluteFill>
  );
};
