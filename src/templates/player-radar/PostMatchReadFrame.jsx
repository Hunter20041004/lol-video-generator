import React from "react";
import { AbsoluteFill } from "remotion";

const LABEL_FONT = "'Barlow Condensed Post Match Read', sans-serif";

const Corner = ({ top, left, right, bottom }) => (
  <div style={{
    position: "absolute",
    top,
    left,
    right,
    bottom,
    width: 30,
    height: 30,
    borderColor: "rgba(207,173,103,0.48)",
    borderStyle: "solid",
    borderWidth: top !== undefined ? "2px 0 0 2px" : "0 2px 2px 0",
    zIndex: 50,
  }} />
);

export const PostMatchReadFrame = ({ model, sceneTag, children }) => {
  const context = model.seriesContext || {};
  const isFlow = sceneTag === "GAME_FLOW";
  const gameCountLabel = Number.isInteger(context.gameCount) && context.gameCount > 0
    ? ` · 共 ${context.gameCount} 局`
    : "";
  const leftLabel = isFlow
    ? `遊戲過程 · GAME ${model.gameFlow?.gameNumber || 1}`
    : `${model.branding?.publicTitle || "賽後判讀"} · ${context.league || "LCK"}${gameCountLabel}`;
  return (
    <AbsoluteFill style={{
      background: "radial-gradient(circle at 52% 0%, #142B37 0%, #07141D 30%, #03080C 72%)",
      fontFamily: "'Noto Sans TC Post Match Read', sans-serif",
    }}>
      <Corner top={28} left={28} />
      <Corner right={28} bottom={28} />
      <div style={{
        position: "absolute", top: 66, left: 60, right: 60, zIndex: 45,
        display: "flex", alignItems: "center", fontFamily: LABEL_FONT,
        fontSize: 24, fontWeight: 800, letterSpacing: 4.4, textTransform: "uppercase",
      }}>
        <span style={{ width: 42, height: 4, marginRight: 18, background: "#CFAD67" }} />
        <span>{leftLabel}</span>
        <span style={{ marginLeft: "auto", color: "#D5DCDE", letterSpacing: 2.2 }}>
          {context.teamA} {context.score} {context.teamB}
        </span>
      </div>
      {children}
      <div style={{
        position: "absolute", left: 60, bottom: 54, zIndex: 45,
        fontFamily: LABEL_FONT, fontSize: 19, fontWeight: 700,
        letterSpacing: 3, color: "rgba(244,234,213,0.58)", textTransform: "uppercase",
      }}>
        {isFlow ? "SCOREBOARD TEAMS · NO EVENT TIMESTAMP CLAIM" : "LEAGUEPEDIA · VERIFIED SERIES SNAPSHOT"}
      </div>
    </AbsoluteFill>
  );
};
