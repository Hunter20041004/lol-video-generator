import React from "react";
import { Audio, Easing, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { DEFAULT_BGM_VOLUME } from "../constants";

export const BgmLayer = ({ bgmFile, audioPlan, volume = DEFAULT_BGM_VOLUME }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!bgmFile) return null;
  if (audioPlan) {
    if (audioPlan.preprocessed) {
      return <Audio src={staticFile(bgmFile)} trimBefore={0} trimAfter={audioPlan.durationInFrames} />;
    }
    const trimBefore = Math.round(audioPlan.sourceStartSeconds * fps);
    const trimAfter = trimBefore + audioPlan.durationInFrames;
    const plannedVolume = () => {
      const fadeIn = interpolate(frame, [0, audioPlan.fadeFrames], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.out(Easing.cubic),
      });
      const fadeOut = interpolate(
        frame,
        [audioPlan.durationInFrames - audioPlan.fadeFrames, audioPlan.durationInFrames],
        [1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) }
      );
      return audioPlan.gain * Math.min(fadeIn, fadeOut);
    };
    return <Audio src={staticFile(bgmFile)} trimBefore={trimBefore} trimAfter={trimAfter} volume={plannedVolume} />;
  }
  return <Audio src={staticFile(bgmFile)} volume={volume} loop />;
};
