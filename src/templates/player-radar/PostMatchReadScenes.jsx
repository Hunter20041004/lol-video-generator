import React from "react";
import { AbsoluteFill, Img } from "remotion";
import { resolveRenderAssetSrc } from "../../video-system/renderAssetSrc";
import { motionProgress } from "./postMatchReadMotion";

const COLORS = { bg: "#03080C", navy: "#07141D", paper: "#F4EAD5", gold: "#CFAD67", cyan: "#49D8D3", muted: "#93A3AA" };
const NUMBER_FONT = "'Barlow Condensed Post Match Read', sans-serif";
const TEXT_FONT = "'Noto Sans TC Post Match Read', sans-serif";
const SAFE_X = 60;
const PRIMARY_FACE = 275;
const SECONDARY_FACE = 230;
const SCORE_DIGIT_SIZE = 255;
const SCORE_SEPARATOR_SIZE = 103;
const PLAYER_PROOF_DATA_OFFSET = 304;
const SECONDARY_EVIDENCE_LABELS = {
  KDA: "KDA",
  "KP%": "KILL PART.",
  GPM: "GOLD / MIN",
};

const playerHandleFontSize = (value = "") => {
  const length = Array.from(String(value)).length;
  if (length <= 8) return 142;
  if (length <= 11) return 116;
  return Math.max(76, 116 - ((length - 11) * 8));
};

const originalNameFontSize = (value = "") => Math.max(22, 30 - Math.max(0, Array.from(String(value)).length - 18));

const enterStyle = (localFrame, start, duration, reducedMotion) => {
  const motion = motionProgress({ frame: localFrame, start, duration, reducedMotion });
  return {
    opacity: motion.opacity,
    transform: `translate3d(0, ${motion.translateY}%, 0) scale(${motion.scale})`,
  };
};

const assetSrc = (value) => value ? resolveRenderAssetSrc(value) : null;

const Face = ({ asset, size, dim = false }) => asset?.squareSrc ? (
  <div style={{
    width: size, height: size, position: "relative", overflow: "hidden",
    clipPath: "polygon(30px 0,100% 0,100% calc(100% - 30px),calc(100% - 30px) 100%,0 100%,0 30px)",
    border: `3px solid ${dim ? "#718188" : COLORS.gold}`,
    filter: dim ? "saturate(.38) brightness(.62)" : "saturate(.82) contrast(1.05)",
  }}>
    <Img src={assetSrc(asset.squareSrc)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
  </div>
) : null;

const TeamCrest = ({ asset, team, dim = false }) => asset?.publicPath ? (
  <div style={{ width: 330, height: 350, display: "grid", gridTemplateRows: "260px 66px", justifyItems: "center", rowGap: 24 }}>
    <div style={{ width: 300, height: 260, display: "grid", placeItems: "center", overflow: "hidden" }}>
      <Img
        src={assetSrc(asset.publicPath)}
        style={{
          width: asset.labelMode === "embedded" ? "88%" : "100%",
          height: asset.labelMode === "embedded" ? "88%" : "100%",
          objectFit: "contain",
          filter: dim
            ? "saturate(.84) brightness(.9)"
            : "drop-shadow(0 16px 30px rgba(207,173,103,.2))",
        }}
      />
    </div>
    {asset.labelMode === "embedded" ? null : <b style={{ maxWidth: 330, overflow: "hidden", whiteSpace: "nowrap", font: `900 ${String(team).length > 16 ? 44 : dim ? 54 : 66}px ${NUMBER_FONT}`, color: dim ? COLORS.muted : COLORS.paper }}>{team}</b>}
  </div>
) : null;

const Atmosphere = ({ asset, side = "center", opacity = 0.55 }) => asset?.atmosphereSrc ? (
  <Img src={assetSrc(asset.atmosphereSrc)} style={{
    position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
    objectPosition: side, opacity, filter: "saturate(.48) brightness(.48) contrast(1.08)",
  }} />
) : null;

const WinnerCrestBackdrop = ({ asset, score, localFrame, reducedMotion }) => asset?.publicPath ? (
  <div style={{
    ...enterStyle(localFrame, 5, 14, reducedMotion),
    position: "absolute", right: -72, top: 156, width: 650, height: 650,
    display: "grid", placeItems: "center",
  }}>
    <div style={{
      position: "absolute", inset: 34, border: "2px solid rgba(207,173,103,.14)", borderRadius: "50%",
      boxShadow: "inset 0 0 0 28px rgba(207,173,103,.025), inset 0 0 0 88px rgba(53,209,207,.018)",
    }} />
    <div style={{
      position: "absolute", right: 12, top: 166, color: "rgba(207,173,103,.055)",
      font: `900 210px/.8 ${NUMBER_FONT}`, letterSpacing: -10,
    }}>{score.left}{score.separator}{score.right}</div>
    <Img
      src={assetSrc(asset.publicPath)}
      style={{
        width: asset.labelMode === "embedded" ? "72%" : "82%",
        height: asset.labelMode === "embedded" ? "72%" : "82%",
        objectFit: "contain", opacity: .13, filter: "saturate(.6) brightness(.8)",
      }}
    />
  </div>
) : null;

export const MatchupBroadcastScene = ({ model, localFrame, reducedMotion, phase }) => {
  const matchup = model.matchup || {};
  const result = model.resultHook || {};
  const assets = model.assets?.matchup || {};
  const teamAssets = model.assets?.teams || {};
  const score = result.scoreParts || { left: "2", separator: "–", right: "0" };
  const resultPhase = phase === "result";
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", inset: "0 0 45%", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: "0 30% 0 0", overflow: "hidden", maskImage: "linear-gradient(90deg,#000 0 72%,transparent 100%)", WebkitMaskImage: "linear-gradient(90deg,#000 0 72%,transparent 100%)" }}><Atmosphere asset={assets.edge} side="58% center" opacity={0.66} /></div>
        <div style={{ position: "absolute", inset: "0 0 0 42%", overflow: "hidden", maskImage: "linear-gradient(90deg,transparent 0,#000 30%)", WebkitMaskImage: "linear-gradient(90deg,transparent 0,#000 30%)" }}><Atmosphere asset={assets.opponent} side="42% center" opacity={0.46} /></div>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(3,8,12,.08),rgba(3,8,12,.28) 55%,#03080C 100%)" }} />
      </div>
      {resultPhase ? (
        <div style={{ position: "absolute", inset: "245px 60px 120px", display: "grid", alignContent: "center", justifyItems: "center" }}>
          <div style={{ ...enterStyle(localFrame, -1, 12, reducedMotion), display: "flex", alignItems: "baseline", fontFamily: NUMBER_FONT, fontWeight: 900, lineHeight: .75, fontVariantNumeric: "tabular-nums" }}>
            <span style={{ fontSize: SCORE_DIGIT_SIZE }}>{score.left}</span>
            <span style={{ fontSize: SCORE_SEPARATOR_SIZE, color: COLORS.gold, margin: "0 30px" }}>{score.separator}</span>
            <span style={{ fontSize: SCORE_DIGIT_SIZE }}>{score.right}</span>
          </div>
          <div style={{ ...enterStyle(localFrame, 16, 12, reducedMotion), display: "flex", width: "100%", justifyContent: "space-between", alignItems: "start", marginTop: 115 }}>
            <TeamCrest asset={teamAssets.teamA} team={matchup.edgePlayer?.team || model.seriesContext?.teamA} />
            <TeamCrest asset={teamAssets.teamB} team={matchup.opponentPlayer?.team || model.seriesContext?.teamB} dim />
          </div>
          <div style={{ font: `800 24px ${NUMBER_FONT}`, color: COLORS.muted, letterSpacing: 4, marginTop: 90 }}>LCK REGULAR SEASON · SERIES RESULT</div>
        </div>
      ) : (
        <div style={{ position: "absolute", left: SAFE_X, right: SAFE_X, top: 300, bottom: 130 }}>
          <div style={{ ...enterStyle(localFrame, 2, 10, reducedMotion), display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Face asset={assets.edge} size={PRIMARY_FACE} />
            <Face asset={assets.opponent} size={SECONDARY_FACE} dim />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 22, fontFamily: NUMBER_FONT, fontWeight: 900, letterSpacing: 2 }}>
            <span style={{ fontSize: 48 }}>{matchup.edgePlayer?.name}</span><span style={{ fontSize: 40, color: COLORS.muted }}>{matchup.opponentPlayer?.name}</span>
          </div>
          <div style={{ ...enterStyle(localFrame, 14, 12, reducedMotion), marginTop: 74, paddingTop: 32, borderTop: "2px solid rgba(244,234,213,.18)" }}>
            <div style={{ font: `800 24px ${NUMBER_FONT}`, color: COLORS.cyan, letterSpacing: 5 }}>MID LANE · SERIES AVERAGE</div>
            <div style={{ display: "flex", alignItems: "baseline", marginTop: 24 }}><strong style={{ font: `900 188px/.8 ${NUMBER_FONT}` }}>{matchup.primaryEvidence?.displayValue?.replace(/\s*GPM/, "")}</strong><span style={{ font: `800 50px ${NUMBER_FONT}`, color: COLORS.gold, marginLeft: 16 }}>GPM</span></div>
            <div style={{ display: "flex", gap: 72, marginTop: 38, font: `700 28px/1.45 ${NUMBER_FONT}`, color: "#BAC4C8" }}>
              <span><b style={{ color: COLORS.cyan }}>{matchup.edgePlayer?.name}</b><br />{matchup.edgePlayer?.rawStats?.gpm} GPM · {matchup.edgePlayer?.rawStats?.dpm} DPM</span>
              <span><b style={{ color: COLORS.muted }}>{matchup.opponentPlayer?.name}</b><br />{matchup.opponentPlayer?.rawStats?.gpm} GPM · {matchup.opponentPlayer?.rawStats?.dpm} DPM</span>
            </div>
            <div style={{ width: 76, height: 4, background: COLORS.gold, marginTop: 92 }} />
            <div style={{ font: `900 49px/1.4 ${TEXT_FONT}`, letterSpacing: -2, marginTop: 32, maxWidth: 850 }}>{String(matchup.claim || "").split("。").filter(Boolean).map((line) => <React.Fragment key={line}>{line}。<br /></React.Fragment>)}</div>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

export const GameFlowScene = ({ model, localFrame, reducedMotion }) => {
  const flow = model.gameFlow || {};
  const mapSrc = model.assets?.mapSrc;
  return (
    <AbsoluteFill>
      {mapSrc ? <Img src={assetSrc(mapSrc)} style={{ position: "absolute", inset: "110px 0 360px", width: "100%", height: "auto", objectFit: "contain", opacity: .43, filter: "saturate(.42) brightness(.72) contrast(1.1)" }} /> : null}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(3,8,12,.04),#03080C 76%)" }} />
      <div style={{ ...enterStyle(localFrame, 3, 12, reducedMotion), position: "absolute", top: 190, left: SAFE_X, right: SAFE_X }}>
        <div style={{ font: `800 24px ${NUMBER_FONT}`, color: COLORS.gold, letterSpacing: 5 }}>OBJECTIVE CONVERSION</div>
        <div style={{ font: `900 64px/1.18 ${TEXT_FONT}`, letterSpacing: -3, marginTop: 20 }}>HLE 先拿資源，<br /><span style={{ color: COLORS.cyan }}>GEN 最後拿走地圖。</span></div>
      </div>
      <div style={{ ...enterStyle(localFrame, 18, 14, reducedMotion), position: "absolute", inset: "590px 70px 135px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ width: 330, padding: "32px 28px", background: "rgba(3,8,12,.88)", borderLeft: `5px solid ${COLORS.gold}` }}><b style={{ font: `900 78px/.9 ${NUMBER_FONT}` }}>{flow.earlyResources?.displayValue}</b><span style={{ display: "block", font: `800 20px/1.5 ${NUMBER_FONT}`, color: "#B1BDC2", letterSpacing: 2, marginTop: 18 }}>幼蟲＋預示者<br />{flow.earlyResourceTeam} 全場總數</span></div>
          <div style={{ width: 330, marginTop: 230, padding: "32px 28px", background: "rgba(3,8,12,.88)", borderLeft: `5px solid ${COLORS.cyan}` }}><b style={{ font: `900 78px/.9 ${NUMBER_FONT}`, color: COLORS.cyan }}>{flow.conversion?.displayValue}</b><span style={{ display: "block", font: `800 20px/1.5 ${NUMBER_FONT}`, color: "#B1BDC2", letterSpacing: 2, marginTop: 18 }}>巴龍轉成防禦塔<br />{flow.finalMapTeam} 全場總數</span></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 44, borderTop: "2px solid rgba(244,234,213,.18)", paddingTop: 30, marginTop: 120 }}>
          <div><strong style={{ font: `900 84px/.9 ${NUMBER_FONT}` }}>＋{Number(flow.goldDelta || 0).toLocaleString()}</strong><span style={{ display: "block", font: `800 20px ${NUMBER_FONT}`, color: COLORS.muted, letterSpacing: 3, marginTop: 12 }}>GEN 終局經濟差</span></div>
          <div><strong style={{ font: `900 84px/.9 ${NUMBER_FONT}` }}>{flow.towerScore}</strong><span style={{ display: "block", font: `800 20px ${NUMBER_FONT}`, color: COLORS.muted, letterSpacing: 3, marginTop: 12 }}>終局塔數</span></div>
        </div>
        <div style={{ font: `900 46px/1.42 ${TEXT_FONT}`, letterSpacing: -2, marginTop: 90 }}>物件本身不是勝點，<br /><b style={{ color: COLORS.gold }}>物件之後換到幾座塔才是。</b></div>
      </div>
    </AbsoluteFill>
  );
};

export const PlayerProofScene = ({ model, localFrame, reducedMotion }) => {
  const proof = model.proof || {};
  const player = proof.player || {};
  const secondaryEvidence = proof.secondaryEvidence || [];
  const seriesGameCount = Number(model.seriesContext?.gameCount) || 1;
  const portrait = model.assets?.proof?.playerPortrait;
  const champions = model.assets?.proof?.champions || [];
  return (
    <AbsoluteFill>
      <Atmosphere asset={{ atmosphereSrc: model.assets?.matchup?.edge?.atmosphereSrc }} side="57% top" opacity={.34} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,rgba(3,8,12,.98) 0 34%,rgba(3,8,12,.16) 70%,#03080C 100%),linear-gradient(180deg,transparent 42%,#03080C 82%)" }} />
      {portrait?.publicPath ? <div style={{ ...enterStyle(localFrame, 4, 13, reducedMotion), position: "absolute", right: -28, top: 185, width: 720, height: 980, overflow: "hidden", maskImage: "linear-gradient(#000 0 62%,transparent 88%)", WebkitMaskImage: "linear-gradient(#000 0 62%,transparent 88%)" }}><Img src={assetSrc(portrait.publicPath)} style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center top", filter: "drop-shadow(-20px 24px 45px rgba(0,0,0,.65))" }} /></div> : null}
      <div style={{ position: "absolute", left: 0, right: 0, top: 700, height: 260, background: "linear-gradient(180deg,transparent,#03080C 82%)" }} />
      <div style={{ ...enterStyle(localFrame, 15, 12, reducedMotion), position: "absolute", left: SAFE_X, right: SAFE_X, top: 290 }}>
        <div style={{ width: 430 }}>
          <span style={{ font: `800 23px ${NUMBER_FONT}`, color: COLORS.gold, letterSpacing: 4 }}>DATA MVP CANDIDATE</span>
          <h2 style={{ font: `900 ${playerHandleFontSize(player.name)}px/.82 ${NUMBER_FONT}`, letterSpacing: -5, margin: "24px 0 0", whiteSpace: "nowrap" }}>{player.name}</h2>
          {player.originalName ? <span style={{ display: "block", font: `800 ${originalNameFontSize(player.originalName)}px ${NUMBER_FONT}`, color: COLORS.muted, letterSpacing: 2.5, marginTop: 20, textTransform: "uppercase", whiteSpace: "nowrap" }}>{player.originalName}</span> : null}
          <span style={{ display: "block", font: `800 23px ${NUMBER_FONT}`, color: COLORS.cyan, letterSpacing: 4, marginTop: player.originalName ? 22 : 30 }}>{seriesGameCount}-GAME AVERAGE</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 34, borderTop: "2px solid rgba(244,234,213,.18)", paddingTop: 34, marginTop: PLAYER_PROOF_DATA_OFFSET }}>
          <div><strong style={{ font: `900 88px/.9 ${NUMBER_FONT}`, color: COLORS.gold }}>{player.rawStats?.csm}</strong><span style={{ display: "block", font: `800 20px ${NUMBER_FONT}`, color: COLORS.muted, letterSpacing: 3, marginTop: 12 }}>CS / MIN</span></div>
          <div><strong style={{ font: `900 88px/.9 ${NUMBER_FONT}` }}>{player.rawStats?.dpm}</strong><span style={{ display: "block", font: `800 20px ${NUMBER_FONT}`, color: COLORS.muted, letterSpacing: 3, marginTop: 12 }}>DPM</span></div>
        </div>
        <div style={{ display: "flex", gap: 18, marginTop: 50, alignItems: "center" }}>{champions.map((champion) => champion.src ? <Img key={champion.championName} src={assetSrc(champion.src)} style={{ width: 96, height: 96, objectFit: "cover", border: `2px solid ${COLORS.gold}` }} /> : null)}<span style={{ font: `800 20px/1.5 ${NUMBER_FONT}`, color: COLORS.muted, letterSpacing: 2 }}>CHAMPION<br />POOL</span></div>
        <div style={{ font: `900 46px/1.42 ${TEXT_FONT}`, letterSpacing: -2, marginTop: 80, maxWidth: 840 }}>穩定吃下經濟，<br /><b style={{ color: COLORS.cyan }}>讓地圖優勢有輸出終點。</b></div>
        {secondaryEvidence.length > 0 ? <div style={{ display: "grid", gridTemplateColumns: `repeat(${secondaryEvidence.length}, minmax(0, 1fr))`, gap: 24, borderTop: "1px solid rgba(244,234,213,.18)", paddingTop: 28, marginTop: 64, maxWidth: 780 }}>
          {secondaryEvidence.map((evidence) => <div key={evidence.metric} style={{ fontVariantNumeric: "tabular-nums" }}><strong style={{ font: `900 48px/.9 ${NUMBER_FONT}` }}>{evidence.displayValue}</strong><span style={{ display: "block", font: `800 18px ${NUMBER_FONT}`, color: COLORS.muted, letterSpacing: 2.4, marginTop: 12 }}>{SECONDARY_EVIDENCE_LABELS[evidence.metric] || evidence.metric}</span></div>)}
        </div> : null}
      </div>
    </AbsoluteFill>
  );
};

export const FinalReadScene = ({ model, localFrame, reducedMotion }) => {
  const score = model.resultHook?.scoreParts || { left: "2", separator: "–", right: "0" };
  const references = model.finalRead?.recapReferences || [];
  const conclusionParts = model.finalRead?.conclusionParts || { lead: "", emphasis: "" };
  const winnerCrest = model.assets?.finalRead?.winnerCrest;
  return (
    <AbsoluteFill>
      <Atmosphere asset={model.assets?.matchup?.edge} side="55% top" opacity={.20} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(3,8,12,.25),#03080C 76%),linear-gradient(90deg,rgba(7,20,29,.92),rgba(7,20,29,.22))" }} />
      <WinnerCrestBackdrop asset={winnerCrest} score={score} localFrame={localFrame} reducedMotion={reducedMotion} />
      <div style={{ ...enterStyle(localFrame, 3, 12, reducedMotion), position: "absolute", left: SAFE_X, top: 250, display: "flex", alignItems: "baseline", color: "rgba(207,173,103,.38)", font: `900 260px/.78 ${NUMBER_FONT}` }}><span>{score.left}</span><i style={{ font: `800 ${SCORE_SEPARATOR_SIZE}px ${NUMBER_FONT}`, margin: "0 28px", transform: "translateY(-8px)" }}>{score.separator}</i><span>{score.right}</span></div>
      <div style={{ ...enterStyle(localFrame, 15, 12, reducedMotion), position: "absolute", left: SAFE_X, right: SAFE_X, top: 660 }}>
        <div style={{ font: `800 24px ${NUMBER_FONT}`, color: COLORS.cyan, letterSpacing: 5 }}>THE FINAL READ</div>
        <h2 style={{ font: `900 66px/1.3 ${TEXT_FONT}`, letterSpacing: -4, margin: "32px 0 0", maxWidth: 900 }}>{conclusionParts.lead}<br /><b style={{ color: COLORS.gold }}>{conclusionParts.emphasis}</b></h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 34, marginTop: 110 }}>{references.map((reference) => <div key={reference.source} style={{ borderTop: "2px solid rgba(244,234,213,.18)", paddingTop: 24 }}><strong style={{ font: `900 68px ${NUMBER_FONT}` }}>{reference.displayValue}</strong><span style={{ display: "block", font: `800 20px ${NUMBER_FONT}`, color: COLORS.muted, letterSpacing: 3, marginTop: 8 }}>{reference.label}</span></div>)}</div>
        <div style={{ font: `700 25px ${TEXT_FONT}`, color: "#AAB5B9", marginTop: 120 }}><span style={{ display: "inline-block", width: 54, height: 4, background: COLORS.gold, verticalAlign: "middle", marginRight: 20 }} />最後 1.5 秒完全靜止，留給觀眾讀完</div>
      </div>
    </AbsoluteFill>
  );
};
