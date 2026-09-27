import React from "react";
import { AbsoluteFill } from "remotion";
import { BROADCAST_COLORS as COLORS, BROADCAST_FONTS as FONTS, CUT_CORNER, HEXAGON } from "./postMatchReadVisuals";
const SCENES = ["RESULT_HOOK", "MATCHUP_EDGE", "EARLY_CONTROL", "MAP_CONVERSION", "PLAYER_PROOF", "FINAL_READ"];

export const PostMatchReadFrame = ({ model, sceneTag, children }) => {
  const context = model.seriesContext || {};
  const gameCountLabel = Number.isInteger(context.gameCount) && context.gameCount > 0 ? ` · 共 ${context.gameCount} 局` : "";
  const sceneIndex = Math.max(0, SCENES.indexOf(sceneTag));
  const isFlow = ["EARLY_CONTROL", "MAP_CONVERSION"].includes(sceneTag);
  const headerSubtitle = model.locale === "en" ? "MATCH ANALYSIS" : "POST MATCH READ";
  return (
    <AbsoluteFill data-visual-world="lol-broadcast" style={{ background: COLORS.void, color: COLORS.moon, fontFamily: FONTS.text, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 82% 22%, rgba(10,200,185,.13), transparent 28%), radial-gradient(circle at 18% 74%, rgba(200,155,60,.09), transparent 34%), linear-gradient(145deg, ${COLORS.voidDeep}, ${COLORS.void} 54%, #09212A)` }} />
      <div style={{ position: "absolute", inset: 0, opacity: 0.16, backgroundImage: "linear-gradient(30deg, transparent 0 48.5%, rgba(10,200,185,.22) 49% 49.4%, transparent 50%), linear-gradient(150deg, transparent 0 57%, rgba(200,155,60,.16) 57.4% 57.8%, transparent 58.2%)", backgroundSize: "390px 390px, 520px 520px" }} />
      <div style={{ position: "absolute", inset: 30, clipPath: CUT_CORNER, border: `1px solid rgba(200,155,60,.28)` }} />
      <div style={{ position: "absolute", top: 30, left: 48, width: 190, height: 2, background: COLORS.gold }} />
      <div style={{ position: "absolute", right: 48, bottom: 30, width: 190, height: 2, background: COLORS.rune }} />
      <div style={{ position: "absolute", top: 60, left: 70, right: 70, zIndex: 45, display: "flex", alignItems: "start", fontFamily: FONTS.number }}>
        <div><div style={{ fontSize: 32, fontWeight: 900, letterSpacing: 7 }}>{model.branding?.publicTitle || "賽後判讀"}</div><div style={{ marginTop: 8, color: COLORS.steel, fontSize: 19, fontWeight: 700, letterSpacing: 8 }}>{headerSubtitle}</div></div>
        <div style={{ marginLeft: "auto", padding: "10px 18px", clipPath: CUT_CORNER, background: "rgba(13,32,42,.78)", border: `1px solid rgba(200,155,60,.35)`, color: COLORS.moon, fontSize: 23, fontWeight: 800, letterSpacing: 4 }}>{context.teamA} {context.score} {context.teamB}</div>
      </div>
      <div style={{ position: "absolute", left: 18, top: 560, writingMode: "vertical-rl", transform: "rotate(180deg)", color: COLORS.steel, font: `700 17px ${FONTS.number}`, letterSpacing: 5 }}>{isFlow ? `GAME ${model.gameFlow?.gameNumber || 1} · TEAM FINAL` : `${context.league || "LCK"}${gameCountLabel}`}</div>
      {children}
      <div aria-label={`故事進度 ${sceneIndex + 1}/6`} style={{ position: "absolute", left: 70, right: 70, bottom: 62, zIndex: 45, display: "flex", justifyContent: "center", gap: 24 }}>{SCENES.map((tag, index) => <span key={tag} style={{ width: 20, height: 23, clipPath: HEXAGON, background: index === sceneIndex ? COLORS.gold : "rgba(107,124,134,.34)", boxShadow: index === sceneIndex ? `0 0 18px rgba(200,155,60,.32)` : "none" }} />)}</div>
      <div style={{ position: "absolute", left: 70, bottom: 28, color: COLORS.steel, font: `700 16px ${FONTS.number}`, letterSpacing: 3 }}>LEAGUEPEDIA · VERIFIED SERIES SNAPSHOT</div>
    </AbsoluteFill>
  );
};
