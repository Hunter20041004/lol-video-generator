import React from "react";
import { Audio, staticFile } from "remotion";
import { DEFAULT_BGM_VOLUME } from "../constants";

export const BgmLayer = ({ bgmFile = "audio/bgm1.mp3", volume = DEFAULT_BGM_VOLUME }) => {
  if (bgmFile === null) return null;
  return <Audio src={staticFile(bgmFile)} volume={volume} loop />;
};
