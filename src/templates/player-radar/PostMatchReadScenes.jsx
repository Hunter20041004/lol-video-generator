import React from "react";
import { AbsoluteFill, Img } from "remotion";
import { resolveRenderAssetSrc } from "../../video-system/renderAssetSrc";
import { motionProgress } from "./postMatchReadMotion";

const COLORS = { bg: "#080909", paper: "#F1ECE2", red: "#E94B35", muted: "#77736C" };
const NUMBER_FONT = "'Barlow Condensed Post Match Read', sans-serif";
const TEXT_FONT = "'Noto Sans TC Post Match Read', sans-serif";
const SAFE_X = 70;
const PROOF_MARK = "/render-assets/post-match-read/proof-mark.png";
const SECONDARY_EVIDENCE_LABELS = {
  zh: { KDA: "KDA", "KP%": "參戰率", GPM: "每分鐘經濟" },
  en: { KDA: "KDA", "KP%": "PARTICIPATION", GPM: "GOLD / MIN" },
};
const FLOW_COPY = {
  zh: {
    earlyEvidence: "幼蟲 ＋ 預示者 · TEAM FINAL",
    earlyClaim: (team) => `${team} 先控制前期資源。`,
    gold: "終局經濟差",
    towers: "終局塔數",
  },
  en: {
    earlyEvidence: "VOID GRUBS + HERALD · TEAM FINAL",
    earlyClaim: (team) => `${team} controlled the early objectives.`,
    gold: "FINAL GOLD LEAD",
    towers: "FINAL TOWERS",
  },
};

const assetSrc = (value) => value ? resolveRenderAssetSrc(value) : null;
const sceneLocale = (model) => model.locale === "en" ? "en" : "zh";
const enterStyle = (localFrame, start, duration, reducedMotion) => {
  const motion = motionProgress({ frame: localFrame, start, duration, reducedMotion });
  return { opacity: motion.opacity, transform: `translate3d(0, ${motion.translateY}%, 0) scale(${motion.scale})` };
};
const ProofMark = ({ style = {} }) => <Img src={assetSrc(PROOF_MARK)} style={{ position: "absolute", objectFit: "contain", ...style }} />;
const Atmosphere = ({ asset, position = "center", opacity = 0.42 }) => asset?.atmosphereSrc ? (
  <Img src={assetSrc(asset.atmosphereSrc)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: position, opacity, filter: "grayscale(1) contrast(1.18) brightness(.48)" }} />
) : null;
const TeamCrest = ({ asset, team, dim = false }) => asset?.publicPath ? (
  <div style={{ width: 220, height: 220, display: "grid", placeItems: "center", opacity: dim ? 0.42 : 0.96 }}>
    <Img src={assetSrc(asset.publicPath)} style={{ width: "82%", height: "82%", objectFit: "contain", filter: "grayscale(1) contrast(1.18)" }} />
    {asset.labelMode === "embedded" ? null : <span style={{ font: `900 34px ${NUMBER_FONT}`, letterSpacing: 4, color: dim ? COLORS.muted : COLORS.paper }}>{team}</span>}
  </div>
) : null;
const HeroFace = ({ asset, dim = false }) => asset?.squareSrc ? (
  <div style={{ width: dim ? 242 : 286, height: dim ? 242 : 286, overflow: "hidden", borderBottom: `6px solid ${dim ? COLORS.muted : COLORS.red}` }}>
    <Img src={assetSrc(asset.squareSrc)} style={{ width: "100%", height: "100%", objectFit: "cover", filter: `grayscale(1) contrast(1.16) brightness(${dim ? 0.55 : 0.9})` }} />
  </div>
) : null;
const SceneLabel = ({ children }) => <div style={{ font: `800 24px ${NUMBER_FONT}`, color: COLORS.red, letterSpacing: 6, textTransform: "uppercase" }}>{children}</div>;
const Verdict = ({ children, maxWidth = 820 }) => <div style={{ maxWidth, font: `900 58px/1.28 ${TEXT_FONT}`, letterSpacing: -3, color: COLORS.paper }}>{children}</div>;

export const MatchupBroadcastScene = ({ model, localFrame, reducedMotion, phase }) => {
  const matchup = model.matchup || {};
  const result = model.resultHook || {};
  const assets = model.assets?.matchup || {};
  const teamAssets = model.assets?.teams || {};
  const score = result.scoreParts || { left: "2", separator: "–", right: "0" };
  const resultPhase = phase === "result";
  const metric = matchup.primaryEvidence?.metric || "";
  const delta = matchup.primaryEvidence?.delta;
  if (resultPhase) return (
    <AbsoluteFill>
      <Atmosphere asset={assets.edge} position="58% center" opacity={0.2} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(8,9,9,.2),#080909 72%)" }} />
      <div style={{ ...enterStyle(localFrame, -1, 10, reducedMotion), position: "absolute", top: 190, left: SAFE_X, right: SAFE_X }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", font: `900 390px/.76 ${NUMBER_FONT}`, color: COLORS.paper, letterSpacing: -18 }}><span>{score.left}</span><span style={{ fontSize: 150, color: COLORS.red, margin: "0 34px" }}>{score.separator}</span><span>{score.right}</span></div>
      </div>
      <div style={{ ...enterStyle(localFrame, 14, 10, reducedMotion), position: "absolute", top: 680, left: 88, right: 88, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <TeamCrest asset={teamAssets.teamA} team={model.seriesContext?.teamA} />
        <span style={{ font: `800 25px ${NUMBER_FONT}`, color: COLORS.muted, letterSpacing: 5 }}>SERIES RESULT</span>
        <TeamCrest asset={teamAssets.teamB} team={model.seriesContext?.teamB} dim />
      </div>
      <div style={{ position: "absolute", left: SAFE_X, top: 1120, right: 260 }}><Verdict>{result.resultClaim}</Verdict><ProofMark style={{ left: -20, top: 104, width: 620, height: 220 }} /></div>
    </AbsoluteFill>
  );
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", top: 250, left: SAFE_X, right: SAFE_X, display: "flex", alignItems: "end", justifyContent: "space-between" }}>
        <div style={enterStyle(localFrame, 2, 10, reducedMotion)}><HeroFace asset={assets.edge} /><div style={{ marginTop: 18, font: `900 48px ${NUMBER_FONT}` }}>{matchup.edgePlayer?.name}</div></div>
        <div style={{ paddingBottom: 74, font: `800 23px ${NUMBER_FONT}`, color: COLORS.muted, letterSpacing: 5 }}>VS</div>
        <div style={{ ...enterStyle(localFrame, 6, 10, reducedMotion), textAlign: "right" }}><HeroFace asset={assets.opponent} dim /><div style={{ marginTop: 18, font: `900 40px ${NUMBER_FONT}`, color: COLORS.muted }}>{matchup.opponentPlayer?.name}</div></div>
      </div>
      <div style={{ ...enterStyle(localFrame, 16, 10, reducedMotion), position: "absolute", left: SAFE_X, top: 760, right: SAFE_X }}>
        <SceneLabel>{matchup.role || "MATCHUP"} · SERIES AVERAGE</SceneLabel>
        <div style={{ display: "flex", alignItems: "baseline", marginTop: 28 }}><strong style={{ font: `900 240px/.8 ${NUMBER_FONT}`, color: COLORS.paper }}>{Number.isFinite(Number(delta)) ? `+${delta}` : "—"}</strong><span style={{ font: `900 56px ${NUMBER_FONT}`, color: COLORS.red, marginLeft: 20 }}>{metric}</span></div>
        <div style={{ marginTop: 92 }}><Verdict>{matchup.claim}</Verdict></div>
      </div>
    </AbsoluteFill>
  );
};

const MapBackdrop = ({ model }) => model.assets?.mapSrc ? <Img src={assetSrc(model.assets.mapSrc)} style={{ position: "absolute", right: -150, top: 260, width: 900, height: 900, objectFit: "contain", opacity: 0.18, filter: "grayscale(1) contrast(1.35)" }} /> : null;
export const EarlyControlScene = ({ model, localFrame, reducedMotion }) => {
  const flow = model.gameFlow || {};
  const copy = FLOW_COPY[sceneLocale(model)];
  return (
    <AbsoluteFill>
      <MapBackdrop model={model} />
      <div style={{ ...enterStyle(localFrame, 3, 10, reducedMotion), position: "absolute", left: SAFE_X, top: 290, right: SAFE_X }}><SceneLabel>EARLY CONTROL</SceneLabel><div style={{ marginTop: 78, font: `900 300px/.76 ${NUMBER_FONT}`, color: COLORS.paper }}>{flow.earlyResources?.displayValue}</div><div style={{ marginTop: 34, font: `800 28px ${NUMBER_FONT}`, color: COLORS.muted, letterSpacing: 5 }}>{copy.earlyEvidence}</div></div>
      <div style={{ position: "absolute", left: SAFE_X, right: 170, top: 1090 }}><Verdict>{copy.earlyClaim(flow.earlyResourceTeam)}</Verdict><ProofMark style={{ left: -30, top: 120, width: 650, height: 230 }} /></div>
    </AbsoluteFill>
  );
};
export const MapConversionScene = ({ model, localFrame, reducedMotion }) => {
  const flow = model.gameFlow || {};
  const copy = FLOW_COPY[sceneLocale(model)];
  const showGold = localFrame >= 120;
  const evidence = showGold ? `+${Number(flow.goldDelta || 0).toLocaleString()}` : flow.towerScore;
  const label = showGold ? copy.gold : copy.towers;
  return (
    <AbsoluteFill>
      <MapBackdrop model={model} />
      <div style={{ ...enterStyle(localFrame, 2, 10, reducedMotion), position: "absolute", left: SAFE_X, top: 300, right: SAFE_X }}><SceneLabel>MAP CONVERSION</SceneLabel><div style={{ marginTop: 88, font: `900 270px/.78 ${NUMBER_FONT}`, color: COLORS.paper }}>{evidence}</div><div style={{ marginTop: 34, font: `800 28px ${NUMBER_FONT}`, color: COLORS.muted, letterSpacing: 5 }}>{flow.finalMapTeam} · {label}</div></div>
      <div style={{ position: "absolute", left: SAFE_X, right: 150, top: 1090 }}><Verdict>{flow.conclusion}</Verdict></div>
    </AbsoluteFill>
  );
};

export const PlayerProofScene = ({ model, localFrame, reducedMotion }) => {
  const proof = model.proof || {};
  const player = proof.player || {};
  const portrait = model.assets?.proof?.playerPortrait;
  const secondaryEvidence = proof.secondaryEvidence || [];
  const locale = sceneLocale(model);
  const primary = Number.isFinite(Number(player.rawStats?.csm)) ? { displayValue: player.rawStats.csm, metric: "CS / MIN" } : secondaryEvidence[0];
  const secondary = secondaryEvidence[Math.min(Math.floor(localFrame / 70), Math.max(secondaryEvidence.length - 1, 0))];
  return (
    <AbsoluteFill>
      {portrait?.publicPath ? <Img src={assetSrc(portrait.publicPath)} style={{ position: "absolute", right: -80, top: 240, width: 780, height: 1120, objectFit: "contain", objectPosition: "right top", filter: "grayscale(1) contrast(1.14) brightness(.72)" }} /> : null}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,#080909 0 30%,rgba(8,9,9,.72) 48%,rgba(8,9,9,.08) 78%),linear-gradient(180deg,transparent 54%,#080909 82%)" }} />
      <div style={{ ...enterStyle(localFrame, 5, 10, reducedMotion), position: "absolute", left: SAFE_X, top: 300, width: 610 }}><SceneLabel>{proof.label || (locale === "en" ? "DATA MVP CANDIDATE" : "數據 MVP 候選")}</SceneLabel><div style={{ marginTop: 24, font: `900 150px/.82 ${NUMBER_FONT}`, letterSpacing: -5 }}>{player.name}</div><div style={{ marginTop: 180, font: `900 210px/.78 ${NUMBER_FONT}`, color: COLORS.paper }}>{primary?.displayValue ?? "—"}</div><div style={{ marginTop: 26, font: `800 28px ${NUMBER_FONT}`, color: COLORS.red, letterSpacing: 5 }}>{primary?.metric || ""}</div></div>
      {secondary ? <div style={{ ...enterStyle(localFrame % 70, 3, 8, reducedMotion), position: "absolute", left: SAFE_X, top: 1190 }}><div style={{ font: `900 70px ${NUMBER_FONT}` }}>{secondary.displayValue}</div><div style={{ font: `800 22px ${NUMBER_FONT}`, color: COLORS.muted, letterSpacing: 4 }}>{SECONDARY_EVIDENCE_LABELS[locale][secondary.metric] || secondary.metric}</div></div> : null}
      <div style={{ position: "absolute", left: SAFE_X, right: 120, top: 1480 }}><Verdict>{proof.claim}</Verdict></div>
    </AbsoluteFill>
  );
};

export const FinalReadScene = ({ model, localFrame, reducedMotion }) => {
  const score = model.resultHook?.scoreParts || { left: "2", separator: "–", right: "0" };
  const references = model.finalRead?.recapReferences || [];
  const conclusionParts = model.finalRead?.conclusionParts || { lead: "", emphasis: "" };
  const winnerCrest = model.assets?.finalRead?.winnerCrest;
  const activeReference = references[Math.min(Math.floor(localFrame / 45), Math.max(references.length - 1, 0))];
  const readingHold = localFrame >= 90;
  return (
    <AbsoluteFill>
      {winnerCrest?.publicPath ? <Img src={assetSrc(winnerCrest.publicPath)} style={{ position: "absolute", right: -80, top: 180, width: 650, height: 650, objectFit: "contain", opacity: .12, filter: "grayscale(1)" }} /> : null}
      <div style={{ ...enterStyle(localFrame, 2, 10, reducedMotion), position: "absolute", left: SAFE_X, top: 220, font: `900 250px/.8 ${NUMBER_FONT}`, color: "rgba(241,236,226,.2)" }}>{score.left}{score.separator}{score.right}</div>
      <div style={{ position: "absolute", left: SAFE_X, right: 80, top: 760 }}><SceneLabel>THE FINAL READ</SceneLabel><div style={{ marginTop: 52 }}><Verdict maxWidth={880}>{conclusionParts.lead}<br /><span style={{ color: COLORS.paper }}>{conclusionParts.emphasis}</span></Verdict></div><ProofMark style={{ left: -38, top: 190, width: 720, height: 250 }} />{!readingHold && activeReference ? <div style={{ ...enterStyle(localFrame % 45, 2, 8, reducedMotion), marginTop: 230 }}><strong style={{ font: `900 86px ${NUMBER_FONT}` }}>{activeReference.displayValue}</strong><span style={{ display: "block", marginTop: 10, font: `800 21px ${NUMBER_FONT}`, color: COLORS.muted, letterSpacing: 4 }}>{activeReference.label}</span></div> : null}</div>
    </AbsoluteFill>
  );
};
