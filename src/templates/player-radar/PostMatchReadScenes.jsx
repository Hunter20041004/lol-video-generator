import React from "react";
import { AbsoluteFill, Img } from "remotion";
import { resolveRenderAssetSrc } from "../../video-system/renderAssetSrc";
import { broadcastLockProgress, motionProgress } from "./postMatchReadMotion";
import { BROADCAST_COLORS as COLORS, BROADCAST_FONTS as FONTS, CUT_CORNER, HEXAGON } from "./postMatchReadVisuals";

const NUMBER_FONT = FONTS.number;
const TEXT_FONT = FONTS.text;
const SAFE_X = 70;
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
const TeamCrest = ({ asset, team, dim = false }) => asset?.publicPath ? (
  <div style={{ width: 220, height: 220, display: "grid", placeItems: "center", opacity: dim ? 0.5 : 1 }}>
    <Img src={assetSrc(asset.publicPath)} style={{ width: "82%", height: "82%", objectFit: "contain", filter: dim ? "saturate(.45) brightness(.72)" : "saturate(.9) brightness(.96)" }} />
  </div>
) : (
  <div data-fallback="team-crest" style={{ width: 180, height: 208, clipPath: HEXAGON, display: "grid", placeItems: "center", border: `1px solid ${dim ? "rgba(107,124,134,.42)" : COLORS.gold}`, color: dim ? COLORS.steel : COLORS.goldBright, font: `900 54px ${NUMBER_FONT}` }}>
    {String(team || "?").slice(0, 3).toUpperCase()}
  </div>
);
const HeroFace = ({ asset, playerName = "", dim = false }) => asset?.squareSrc ? (
  <div data-champion={asset.championName || "verified-champion"} style={{ width: dim ? 252 : 306, height: dim ? 252 : 306, padding: 8, overflow: "hidden", clipPath: CUT_CORNER, background: dim ? "rgba(107,124,134,.28)" : `linear-gradient(145deg,${COLORS.gold},${COLORS.rune})` }}>
    <Img alt={asset.championName || ""} src={assetSrc(asset.squareSrc)} style={{ width: "100%", height: "100%", objectFit: "cover", clipPath: CUT_CORNER, filter: dim ? "saturate(.48) brightness(.62)" : "saturate(.9) brightness(.92)" }} />
  </div>
) : (
  <div data-fallback="identity" style={{ width: dim ? 252 : 306, height: dim ? 252 : 306, display: "grid", placeItems: "center", clipPath: CUT_CORNER, border: `1px solid ${dim ? "rgba(107,124,134,.5)" : COLORS.gold}`, background: "rgba(13,32,42,.8)", color: dim ? COLORS.steel : COLORS.goldBright, font: `900 92px ${NUMBER_FONT}` }}>
    {String(playerName || "?").slice(0, 1).toUpperCase()}
  </div>
);
const SceneLabel = ({ children }) => <div style={{ font: `800 24px ${NUMBER_FONT}`, color: COLORS.rune, letterSpacing: 6, textTransform: "uppercase" }}>{children}</div>;
const Verdict = ({ children, maxWidth = 820 }) => <div style={{ maxWidth, font: `900 58px/1.28 ${TEXT_FONT}`, letterSpacing: -3, color: COLORS.moon }}>{children}</div>;

const TeamIdentity = ({ asset, team, score, winner }) => (
  <div data-team={team} data-winner-side={winner ? "true" : "false"} style={{ width: 390, minHeight: 460, padding: "42px 24px 36px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", clipPath: CUT_CORNER, background: winner ? "linear-gradient(180deg,rgba(200,155,60,.2),rgba(13,32,42,.78))" : "rgba(13,32,42,.68)", border: `1px solid ${winner ? COLORS.gold : "rgba(107,124,134,.32)"}` }}>
    <TeamCrest asset={asset} team={team} dim={!winner} />
    <div style={{ font: `900 54px ${NUMBER_FONT}`, letterSpacing: 7, color: winner ? COLORS.goldBright : COLORS.steel }}>{team}</div>
    <div style={{ font: `900 164px/.72 ${NUMBER_FONT}`, color: winner ? COLORS.moon : COLORS.steel }}>{score}</div>
    {winner ? <div style={{ width: 42, height: 48, clipPath: HEXAGON, background: COLORS.gold }} /> : <div style={{ width: 42, height: 48 }} />}
  </div>
);

export const MatchupBroadcastScene = ({ model, localFrame, reducedMotion, phase }) => {
  const matchup = model.matchup || {};
  const result = model.resultHook || {};
  const assets = model.assets?.matchup || {};
  const teamAssets = model.assets?.teams || {};
  const score = result.scoreParts || { left: "2", separator: "–", right: "0" };
  const resultPhase = phase === "result";
  const metric = matchup.primaryEvidence?.metric || "";
  const delta = matchup.primaryEvidence?.delta;
  if (resultPhase) {
    const teamA = result.displayOrder?.[0] || model.seriesContext?.teamA || "";
    const teamB = result.displayOrder?.[1] || model.seriesContext?.teamB || "";
    const winner = model.finalRead?.winnerTeam?.name || result.winnerTeam?.name || result.winnerTeam || teamB;
    return (
      <AbsoluteFill data-broadcast-component="scoreboard" data-winner={winner}>
        <div style={{ ...enterStyle(localFrame, -1, 10, reducedMotion), position: "absolute", top: 210, left: 94, right: 94, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <TeamIdentity asset={teamAssets.teamA} team={teamA} score={score.left} winner={winner === teamA} />
          <div style={{ font: `800 30px ${NUMBER_FONT}`, color: COLORS.rune, letterSpacing: 7, writingMode: "vertical-rl" }}>SERIES RESULT</div>
          <TeamIdentity asset={teamAssets.teamB} team={teamB} score={score.right} winner={winner === teamB} />
        </div>
        <div style={{ ...enterStyle(localFrame, 14, 10, reducedMotion), position: "absolute", left: SAFE_X, top: 1180, right: SAFE_X }}>
          <div style={{ width: 96, height: 2, marginBottom: 34, background: COLORS.gold }} />
          <Verdict>{result.resultClaim}</Verdict>
        </div>
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill data-broadcast-component="matchup" data-role={matchup.role || "MATCHUP"}>
      <div style={{ position: "absolute", top: 230, left: SAFE_X, right: SAFE_X, height: 420, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={enterStyle(localFrame, 2, 10, reducedMotion)}><HeroFace asset={assets.edge} playerName={matchup.edgePlayer?.name} /><div style={{ marginTop: 20, font: `900 48px ${NUMBER_FONT}`, letterSpacing: 2 }}>{matchup.edgePlayer?.name}</div></div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}><div style={{ width: 56, height: 64, clipPath: HEXAGON, display: "grid", placeItems: "center", background: COLORS.rune, color: COLORS.void, font: `900 18px ${NUMBER_FONT}` }}>{String(matchup.role || "VS").slice(0, 3)}</div><div style={{ width: 2, height: 150, background: `linear-gradient(${COLORS.rune},${COLORS.gold})` }} /><div style={{ font: `800 23px ${NUMBER_FONT}`, color: COLORS.steel, letterSpacing: 5 }}>VS</div></div>
        <div style={{ ...enterStyle(localFrame, 6, 10, reducedMotion), textAlign: "right" }}><HeroFace asset={assets.opponent} playerName={matchup.opponentPlayer?.name} dim /><div style={{ marginTop: 20, font: `900 40px ${NUMBER_FONT}`, color: COLORS.steel }}>{matchup.opponentPlayer?.name}</div></div>
      </div>
      <div style={{ ...enterStyle(localFrame, 16, 10, reducedMotion), position: "absolute", left: SAFE_X, top: 760, right: SAFE_X }} data-primary-metric={metric}>
        <SceneLabel>{matchup.role || "MATCHUP"} · SERIES AVERAGE</SceneLabel>
        <div style={{ display: "flex", alignItems: "baseline", marginTop: 28 }}><strong style={{ font: `900 240px/.8 ${NUMBER_FONT}`, color: COLORS.moon }}>{Number.isFinite(Number(delta)) ? `+${delta}` : "—"}</strong><span style={{ font: `900 56px ${NUMBER_FONT}`, color: COLORS.gold, marginLeft: 20 }}>{metric}</span></div>
        <div style={{ marginTop: 92 }}><Verdict>{matchup.claim}</Verdict></div>
      </div>
    </AbsoluteFill>
  );
};

const MapBackdrop = ({ model, opacity = 0.24 }) => model.assets?.mapSrc ? <Img alt="Summoner's Rift" src={assetSrc(model.assets.mapSrc)} style={{ position: "absolute", right: -140, top: 220, width: 920, height: 920, objectFit: "contain", opacity, filter: "saturate(.7) hue-rotate(8deg) brightness(.72) contrast(1.16)" }} /> : null;
const ObjectiveNode = ({ label, value, tone, lockProgress = 1 }) => (
  <div style={{ display: "grid", gridTemplateColumns: "94px 1fr", alignItems: "center", gap: 24, opacity: 0.55 + (lockProgress * 0.45) }}>
    <div style={{ width: 94, height: 108, clipPath: HEXAGON, display: "grid", placeItems: "center", background: tone, color: COLORS.void, font: `900 54px ${NUMBER_FONT}`, transform: `scale(${0.94 + (lockProgress * 0.06)})` }}>{value}</div>
    <div><div style={{ font: `900 34px ${NUMBER_FONT}`, letterSpacing: 4, color: COLORS.moon }}>{label}</div><div style={{ marginTop: 8, width: 160, height: 2, background: tone }} /></div>
  </div>
);
export const EarlyControlScene = ({ model, localFrame, reducedMotion }) => {
  const flow = model.gameFlow || {};
  const copy = FLOW_COPY[sceneLocale(model)];
  const firstObjectiveLock = broadcastLockProgress({ frame: localFrame, start: 8, duration: 6, reducedMotion });
  const secondObjectiveLock = broadcastLockProgress({ frame: localFrame, start: 14, duration: 6, reducedMotion });
  return (
    <AbsoluteFill data-broadcast-component="rift-objectives">
      <MapBackdrop model={model} opacity={0.3} />
      <div style={{ position: "absolute", inset: "250px 55px 580px 420px", clipPath: CUT_CORNER, border: `1px solid rgba(10,200,185,.28)`, background: "linear-gradient(145deg,rgba(7,20,28,.08),rgba(10,200,185,.06))" }} />
      <div style={{ ...enterStyle(localFrame, 3, 10, reducedMotion), position: "absolute", left: SAFE_X, top: 270, width: 650 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 58 }}>
          <ObjectiveNode label="VOID GRUBS" value={flow.earlyResources?.voidGrubs ?? "—"} tone={COLORS.rune} lockProgress={firstObjectiveLock} />
          <ObjectiveNode label="RIFT HERALD" value={flow.earlyResources?.riftHeralds ?? "—"} tone={COLORS.gold} lockProgress={secondObjectiveLock} />
        </div>
        <div style={{ marginTop: 56, font: `800 24px ${NUMBER_FONT}`, color: COLORS.steel, letterSpacing: 5 }}>{flow.earlyResourceTeam} · {copy.earlyEvidence}</div>
      </div>
      <div style={{ position: "absolute", left: SAFE_X, right: 150, top: 1150 }}><div style={{ width: 92, height: 2, marginBottom: 34, background: COLORS.rune }} /><Verdict>{copy.earlyClaim(flow.earlyResourceTeam)}</Verdict></div>
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
    <AbsoluteFill data-broadcast-component="map-conversion">
      <MapBackdrop model={model} opacity={0.22} />
      <div style={{ position: "absolute", left: 115, top: 475, width: 720, height: 2, background: `linear-gradient(90deg,${COLORS.rune},${COLORS.gold})` }} />
      <div style={{ position: "absolute", left: 92, top: 447, width: 56, height: 64, clipPath: HEXAGON, background: COLORS.rune }} />
      <div style={{ position: "absolute", left: 810, top: 447, width: 56, height: 64, clipPath: HEXAGON, background: COLORS.gold }} />
      <div style={{ ...enterStyle(localFrame, 2, 10, reducedMotion), position: "absolute", left: SAFE_X, top: 270, right: SAFE_X }}>
        <div data-evidence-slot="primary" data-evidence-kind={showGold ? "gold" : "towers"} style={{ marginTop: 220, padding: "48px 58px", width: 720, clipPath: CUT_CORNER, border: `1px solid rgba(200,155,60,.42)`, background: "rgba(13,32,42,.74)" }}>
          <div style={{ font: `900 270px/.78 ${NUMBER_FONT}`, color: COLORS.moon }}>{evidence}</div>
          <div style={{ marginTop: 34, font: `800 28px ${NUMBER_FONT}`, color: COLORS.gold, letterSpacing: 5 }}>{flow.finalMapTeam} · {label}</div>
        </div>
      </div>
      <div style={{ position: "absolute", left: SAFE_X, right: 150, top: 1210 }}><Verdict>{flow.conclusion}</Verdict></div>
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
  const teamKey = player.team === model.seriesContext?.teamB ? "teamB" : "teamA";
  const teamCrest = model.assets?.teams?.[teamKey];
  const champions = model.assets?.proof?.champions || [];
  return (
    <AbsoluteFill data-broadcast-component="player-card" data-player-team={player.team || ""}>
      <div data-portrait-stage="compact" style={{ position: "absolute", right: 58, top: 220, width: 610, height: 720, clipPath: CUT_CORNER, border: `1px solid rgba(200,155,60,.45)`, background: "linear-gradient(160deg,rgba(13,32,42,.5),rgba(10,200,185,.08))", overflow: "hidden" }}>
        {portrait?.publicPath ? <Img alt={player.name || ""} src={assetSrc(portrait.publicPath)} style={{ position: "absolute", right: -80, top: 38, width: 820, height: "auto", filter: "saturate(.78) contrast(1.08) brightness(.76)" }} /> : null}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,rgba(7,20,28,.62),transparent 45%),linear-gradient(180deg,transparent 62%,#07141C 96%)" }} />
        {teamCrest?.publicPath ? <Img alt={player.team || ""} src={assetSrc(teamCrest.publicPath)} style={{ position: "absolute", right: 34, top: 34, width: 120, height: 120, objectFit: "contain" }} /> : null}
      </div>
      <div style={{ ...enterStyle(localFrame, 5, 10, reducedMotion), position: "absolute", left: SAFE_X, top: 280, width: 610 }}>
        <SceneLabel>{proof.label || (locale === "en" ? "DATA MVP CANDIDATE" : "數據 MVP 候選")}</SceneLabel>
        <div style={{ marginTop: 22, font: `900 142px/.82 ${NUMBER_FONT}`, letterSpacing: -4 }}>{player.name}</div>
        <div style={{ marginTop: 22, display: "flex", alignItems: "center", gap: 18, color: COLORS.steel, font: `800 24px ${NUMBER_FONT}`, letterSpacing: 5 }}><span>{player.team}</span><span style={{ width: 8, height: 9, clipPath: HEXAGON, background: COLORS.gold }} /><span>{player.role}</span></div>
        <div data-primary-metric={primary?.metric || ""} style={{ marginTop: 150 }}><div style={{ font: `900 210px/.78 ${NUMBER_FONT}`, color: COLORS.moon }}>{primary?.displayValue ?? "—"}</div><div style={{ marginTop: 26, font: `800 28px ${NUMBER_FONT}`, color: COLORS.gold, letterSpacing: 5 }}>{primary?.metric || ""}</div></div>
      </div>
      {secondary ? <div data-secondary-evidence={secondary.metric} style={{ ...enterStyle(localFrame % 70, 3, 8, reducedMotion), position: "absolute", left: SAFE_X, top: 1040, padding: "22px 32px", width: 330, clipPath: CUT_CORNER, background: "rgba(13,32,42,.82)", border: `1px solid rgba(10,200,185,.35)` }}><div style={{ font: `900 70px ${NUMBER_FONT}` }}>{secondary.displayValue}</div><div style={{ font: `800 22px ${NUMBER_FONT}`, color: COLORS.rune, letterSpacing: 4 }}>{SECONDARY_EVIDENCE_LABELS[locale][secondary.metric] || secondary.metric}</div></div> : null}
      <div style={{ position: "absolute", left: SAFE_X, top: 1460, display: "flex", gap: 16 }}>{champions.slice(0, 4).map((champion) => champion.src ? <Img key={champion.championName} alt={champion.championName} src={assetSrc(champion.src)} style={{ width: 76, height: 76, objectFit: "cover", clipPath: CUT_CORNER, border: `1px solid rgba(200,155,60,.36)` }} /> : null)}</div>
      <div style={{ position: "absolute", left: 460, right: 90, top: 1200 }}><Verdict>{proof.claim}</Verdict></div>
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
    <AbsoluteFill data-broadcast-component="victory-lockup" data-reading-hold={readingHold ? "true" : "false"}>
      <div style={{ ...enterStyle(localFrame, 2, 10, reducedMotion), position: "absolute", left: 82, right: 82, top: 205, height: 540, clipPath: CUT_CORNER, border: `1px solid rgba(200,155,60,.52)`, background: "linear-gradient(145deg,rgba(200,155,60,.14),rgba(13,32,42,.76))", display: "grid", gridTemplateColumns: "320px 1fr", alignItems: "center", padding: "34px 46px" }}>
        <div style={{ width: 286, height: 330, clipPath: HEXAGON, display: "grid", placeItems: "center", background: "rgba(7,20,28,.82)", border: `1px solid ${COLORS.gold}` }}>{winnerCrest?.publicPath ? <Img alt={model.finalRead?.winnerTeam?.name || "winner"} src={assetSrc(winnerCrest.publicPath)} style={{ width: "72%", height: "72%", objectFit: "contain" }} /> : <span style={{ color: COLORS.gold, font: `900 76px ${NUMBER_FONT}` }}>{model.finalRead?.winnerTeam?.name || "WIN"}</span>}</div>
        <div style={{ paddingLeft: 46 }}><div style={{ color: COLORS.gold, font: `800 23px ${NUMBER_FONT}`, letterSpacing: 7 }}>SERIES VICTORY</div><div style={{ marginTop: 18, color: COLORS.moon, font: `900 118px/.82 ${NUMBER_FONT}` }}>{model.finalRead?.winnerTeam?.name || ""}</div><div style={{ marginTop: 30, color: COLORS.steel, font: `900 96px/.8 ${NUMBER_FONT}` }}>{score.left}{score.separator}{score.right}</div></div>
      </div>
      <div style={{ position: "absolute", left: SAFE_X, right: 70, top: 850 }}>
        <Verdict maxWidth={900}>{conclusionParts.lead}<br /><span style={{ color: COLORS.goldBright }}>{conclusionParts.emphasis}</span></Verdict>
        {!readingHold && activeReference ? <div data-recap-evidence="visible" style={{ ...enterStyle(localFrame % 45, 2, 8, reducedMotion), marginTop: 190, padding: "24px 30px", width: 380, clipPath: CUT_CORNER, border: `1px solid rgba(10,200,185,.32)`, background: "rgba(13,32,42,.74)" }}><strong style={{ font: `900 82px ${NUMBER_FONT}` }}>{activeReference.displayValue}</strong><span style={{ display: "block", marginTop: 8, font: `800 21px ${NUMBER_FONT}`, color: COLORS.rune, letterSpacing: 4 }}>{activeReference.label}</span></div> : null}
      </div>
    </AbsoluteFill>
  );
};
