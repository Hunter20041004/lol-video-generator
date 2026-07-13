import React from "react";
import { Audio, staticFile } from "remotion";
import { DEFAULT_BGM_VOLUME } from "../constants";

export const BgmLayer = ({ bgmFile, volume = DEFAULT_BGM_VOLUME }) => {
  if (!bgmFile) return null;
  return <Audio src={staticFile(bgmFile)} volume={volume} loop />;
};
