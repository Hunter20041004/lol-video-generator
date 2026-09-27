import React from "react";
import { AbsoluteFill } from "remotion";
import { BROADCAST_COLORS as COLORS, BROADCAST_FONTS as FONTS, CUT_CORNER, HEXAGON } from "./postMatchReadVisuals";
const SCENES = ["RESULT_HOOK", "MATCHUP_EDGE", "EARLY_CONTROL", "MAP_CONVERSION", "PLAYER_PROOF", "FINAL_READ"];
const SCENE_CODES = ["RESULT", "DUEL", "OBJECTIVE", "CONVERT", "PLAYER", "VERDICT"];

export const PostMatchReadFrame = ({ model, sceneTag, children }) => {
  const context = model.seriesContext || {};
  const gameCountLabel = Number.isInteger(context.gameCount) && context.gameCount > 0 ? ` · 共 ${context.gameCount} 局` : "";
  const sceneIndex = Math.max(0, SCENES.indexOf(sceneTag));
  const isFlow = ["EARLY_CONTROL", "MAP_CONVERSION"].includes(sceneTag);
  const headerSubtitle = model.locale === "en" ? "MATCH ANALYSIS" : "POST MATCH READ";
  const primaryEvidence = model.matchup?.primaryEvidence || {};
  const proofStats = model.proof?.player?.rawStats || {};
  const evidenceTicker = [
    { label: `${primaryEvidence.metric || "MATCHUP"} EDGE`, value: Number.isFinite(Number(primaryEvidence.delta)) ? `+${primaryEvidence.delta}` : "—", tone: COLORS.gold },
    { label: "FINAL TOWERS", value: model.gameFlow?.towerScore || "—", tone: COLORS.rune },
    { label: "GOLD LEAD", value: Number.isFinite(Number(model.gameFlow?.goldDelta)) ? `+${Number(model.gameFlow.goldDelta).toLocaleString()}` : "—", tone: COLORS.goldBright },
    { label: `${model.proof?.player?.name || "KEY PLAYER"} · CS/M`, value: Number.isFinite(Number(proofStats.csm)) ? proofStats.csm : "—", tone: COLORS.rune },
  ];
  return (
    <AbsoluteFill data-visual-world="lol-broadcast" style={{ background: COLORS.void, color: COLORS.moon, fontFamily: FONTS.text, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 82% 22%, rgba(10,200,185,.13), transparent 28%), radial-gradient(circle at 18% 74%, rgba(200,155,60,.09), transparent 34%), linear-gradient(145deg, ${COLORS.voidDeep}, ${COLORS.void} 54%, #09212A)` }} />
      <div style={{ position: "absolute", inset: 0, opacity: 0.16, backgroundImage: "linear-gradient(30deg, transparent 0 48.5%, rgba(10,200,185,.22) 49% 49.4%, transparent 50%), linear-gradient(150deg, transparent 0 57%, rgba(200,155,60,.16) 57.4% 57.8%, transparent 58.2%)", backgroundSize: "390px 390px, 520px 520px" }} />
      <div data-rift-lattice="three-lane" style={{ position: "absolute", inset: "220px 90px 250px", opacity: 0.13, clipPath: CUT_CORNER, backgroundImage: "linear-gradient(45deg,transparent 49.7%,rgba(10,200,185,.7) 49.8% 50.2%,transparent 50.3%),linear-gradient(135deg,transparent 49.7%,rgba(200,155,60,.65) 49.8% 50.2%,transparent 50.3%),radial-gradient(circle at center,rgba(240,230,210,.85) 0 3px,transparent 4px)", backgroundSize: "100% 100%,100% 100%,72px 72px" }} />
      <div style={{ position: "absolute", inset: 30, clipPath: CUT_CORNER, border: `1px solid rgba(200,155,60,.28)` }} />
      <div style={{ position: "absolute", top: 30, left: 48, width: 190, height: 2, background: COLORS.gold }} />
      <div style={{ position: "absolute", right: 48, bottom: 30, width: 190, height: 2, background: COLORS.rune }} />
      <div style={{ position: "absolute", top: 60, left: 70, right: 70, zIndex: 45, display: "flex", alignItems: "start", fontFamily: FONTS.number }}>
        <div><div style={{ fontSize: 32, fontWeight: 900, letterSpacing: 7 }}>{model.branding?.publicTitle || "賽後判讀"}</div><div style={{ marginTop: 8, color: COLORS.steel, fontSize: 19, fontWeight: 700, letterSpacing: 8 }}>{headerSubtitle}</div></div>
        <div style={{ marginLeft: "auto", padding: "10px 18px", clipPath: CUT_CORNER, background: "rgba(13,32,42,.78)", border: `1px solid rgba(200,155,60,.35)`, color: COLORS.moon, fontSize: 23, fontWeight: 800, letterSpacing: 4 }}>{context.teamA} {context.score} {context.teamB}</div>
      </div>
      <div data-series-telemetry="visible" style={{ position: "absolute", top: 150, left: 70, right: 70, zIndex: 44, height: 54, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1.3fr", alignItems: "center", padding: "0 20px", borderTop: `1px solid rgba(10,200,185,.28)`, borderBottom: `1px solid rgba(10,200,185,.28)`, background: "linear-gradient(90deg,rgba(10,200,185,.07),rgba(13,32,42,.72),rgba(200,155,60,.07))", color: COLORS.steel, font: `800 18px ${FONTS.number}`, letterSpacing: 3 }}>
        <span>{context.league || "LEAGUE"}</span>
        <span>{context.season || "—"} SEASON</span>
        <span>{context.matchDate || "DATE VERIFIED"}</span>
        <span style={{ textAlign: "right", color: COLORS.moon }}>{Number.isInteger(context.gameCount) && context.gameCount > 0 ? `${context.gameCount} GAMES` : "SERIES SNAPSHOT"}</span>
      </div>
      <div style={{ position: "absolute", left: 18, top: 560, writingMode: "vertical-rl", transform: "rotate(180deg)", color: COLORS.steel, font: `700 17px ${FONTS.number}`, letterSpacing: 5 }}>{isFlow ? `GAME ${model.gameFlow?.gameNumber || 1} · TEAM FINAL` : `${context.league || "LCK"}${gameCountLabel}`}</div>
      {children}
      <div data-evidence-ticker="persistent" style={{ position: "absolute", left: 70, right: 70, top: 1580, zIndex: 44, display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", clipPath: CUT_CORNER, border: `1px solid rgba(200,155,60,.34)`, background: "linear-gradient(90deg,rgba(3,11,16,.95),rgba(13,32,42,.94),rgba(3,11,16,.95))" }}>
        {evidenceTicker.map((item, index) => <div key={item.label} style={{ minWidth: 0, padding: "20px 18px 18px", borderRight: index < evidenceTicker.length - 1 ? `1px solid rgba(107,124,134,.22)` : "none" }}><div style={{ color: item.tone, font: `800 14px ${FONTS.number}`, letterSpacing: 2, whiteSpace: "nowrap", overflow: "hidden" }}>{item.label}</div><div style={{ marginTop: 8, color: COLORS.moon, font: `900 42px/.9 ${FONTS.number}`, whiteSpace: "nowrap" }}>{item.value}</div></div>)}
      </div>
      <div data-story-rail="6-scenes" style={{ position: "absolute", left: 70, right: 70, top: 1702, zIndex: 46, display: "grid", gridTemplateColumns: "104px repeat(6,1fr)", alignItems: "center", gap: 10, fontFamily: FONTS.number }}>
        <div style={{ color: COLORS.goldBright, fontSize: 26, fontWeight: 900, letterSpacing: 2 }}>{String(sceneIndex + 1).padStart(2, "0")} / 06</div>
        {SCENE_CODES.map((code, index) => <div key={code} style={{ minWidth: 0, color: index === sceneIndex ? COLORS.moon : COLORS.steel, opacity: index === sceneIndex ? 1 : 0.42, fontSize: 11, fontWeight: 800, letterSpacing: 1, textAlign: "center" }}><i style={{ display: "block", width: "100%", height: 2, marginBottom: 7, background: index === sceneIndex ? COLORS.gold : "rgba(107,124,134,.46)" }} /><span>{code}</span></div>)}
      </div>
      <div aria-label={`故事進度 ${sceneIndex + 1}/6`} style={{ position: "absolute", left: 70, right: 70, bottom: 62, zIndex: 45, display: "flex", justifyContent: "center", gap: 24 }}>{SCENES.map((tag, index) => <span key={tag} style={{ width: 20, height: 23, clipPath: HEXAGON, background: index === sceneIndex ? COLORS.gold : "rgba(107,124,134,.34)", boxShadow: index === sceneIndex ? `0 0 18px rgba(200,155,60,.32)` : "none" }} />)}</div>
      <div style={{ position: "absolute", left: 70, bottom: 28, color: COLORS.steel, font: `700 16px ${FONTS.number}`, letterSpacing: 3 }}>LEAGUEPEDIA · VERIFIED SERIES SNAPSHOT</div>
    </AbsoluteFill>
  );
};
