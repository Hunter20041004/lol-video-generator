import React from "react";
import { AbsoluteFill } from "remotion";
import { resolveRenderAssetSrc } from "../../video-system/renderAssetSrc";

const LABEL_FONT = "'Barlow Condensed Post Match Read', sans-serif";
const TEXT_FONT = "'Noto Sans TC Post Match Read', sans-serif";
const SCENES = ["RESULT_HOOK", "MATCHUP_EDGE", "EARLY_CONTROL", "MAP_CONVERSION", "PLAYER_PROOF", "FINAL_READ"];

export const PostMatchReadFrame = ({ model, sceneTag, children }) => {
  const context = model.seriesContext || {};
  const gameCountLabel = Number.isInteger(context.gameCount) && context.gameCount > 0 ? ` · 共 ${context.gameCount} 局` : "";
  const sceneIndex = Math.max(0, SCENES.indexOf(sceneTag));
  const isFlow = ["EARLY_CONTROL", "MAP_CONVERSION"].includes(sceneTag);
  const headerSubtitle = model.locale === "en" ? "MATCH ANALYSIS" : "POST MATCH READ";
  return (
    <AbsoluteFill style={{ background: "#080909", color: "#F1ECE2", fontFamily: TEXT_FONT, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${resolveRenderAssetSrc("/render-assets/post-match-read/film-grain.png")})`, backgroundSize: "cover", opacity: 0.12, mixBlendMode: "screen" }} />
      <div style={{ position: "absolute", inset: 30, border: "1px solid rgba(241,236,226,.12)" }} />
      <div style={{ position: "absolute", top: 60, left: 70, right: 70, zIndex: 45, display: "flex", alignItems: "start", fontFamily: LABEL_FONT }}>
        <div><div style={{ fontSize: 32, fontWeight: 900, letterSpacing: 7 }}>{model.branding?.publicTitle || "賽後判讀"}</div><div style={{ marginTop: 8, color: "#77736C", fontSize: 19, fontWeight: 700, letterSpacing: 8 }}>{headerSubtitle}</div></div>
        <div style={{ marginLeft: "auto", color: "#B7AEA3", fontSize: 23, fontWeight: 800, letterSpacing: 4 }}>{context.teamA} {context.score} {context.teamB}</div>
      </div>
      <div style={{ position: "absolute", left: 18, top: 560, writingMode: "vertical-rl", transform: "rotate(180deg)", color: "#77736C", font: `700 17px ${LABEL_FONT}`, letterSpacing: 5 }}>{isFlow ? `GAME ${model.gameFlow?.gameNumber || 1} · TEAM FINAL` : `${context.league || "LCK"}${gameCountLabel}`}</div>
      {children}
      <div style={{ position: "absolute", left: 70, right: 70, bottom: 68, zIndex: 45, display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>{SCENES.map((tag, index) => <span key={tag} style={{ height: 4, background: index === sceneIndex ? "#E94B35" : "rgba(241,236,226,.18)" }} />)}</div>
      <div style={{ position: "absolute", left: 70, bottom: 38, color: "#77736C", font: `700 16px ${LABEL_FONT}`, letterSpacing: 3 }}>LEAGUEPEDIA · VERIFIED SERIES SNAPSHOT</div>
    </AbsoluteFill>
  );
};
