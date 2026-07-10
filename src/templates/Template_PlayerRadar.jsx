import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { RadarChart } from "../components/charts/RadarChart";
import { BgmLayer } from "../video-system/BgmLayer";
import { HextechBackground, HEXTECH_COLORS } from "../video-system/HextechBackground";
import { SubtitleCaption } from "../video-system/SubtitleCaption";
import { buildTimeline, getActiveTimelineScene } from "../video-system/pacing";
import {
  GlassPanel,
  PipelineBadge,
  PipelineChrome,
  SafeStage,
  VerdictCard,
  getPipelineTheme,
} from "../video-system/VideoPrimitives";
import playerRadarHelpers from "./playerRadarHelpers";

const {
  buildConclusionVerdict,
  deriveMatchupDisplayPlayers,
  getHookProofPillValue,
  getMatchupMetricDisplay,
  getPlayer,
  getPlayerRadarCopy,
  getRoleLabel,
  isEnglishLocale,
  samePlayer,
} = playerRadarHelpers;

const PLAYER_RADAR_STAGE_INSET = "92px 72px 304px";
const PLAYER_RADAR_SUBTITLE_BOTTOM = 278;

const getProofBadgeLabel = (proofType, data = {}) => {
  const copy = getPlayerRadarCopy(data);
  return proofType === "mvp" ? copy.hookProofTypeLabels.mvp : copy.hookProofTypeLabels.key_player;
};

const buildRadarStoryboard = (data = {}) => {
  if (Array.isArray(data.storyboard) && data.storyboard.length > 0) return data.storyboard;
  const copy = getPlayerRadarCopy(data);
  const playerName = data.player?.name || data.proofSegment?.player?.name || "";
  return copy.storyboard.map((scene) => ({
    ...scene,
    text: scene.text.replace("(playerName)", playerName),
  }));
};

const normalizeStats = (data = {}) => {
  return (Array.isArray(data.radarStats) ? data.radarStats : []).slice(0, 5);
};

const shouldShowRadarChart = (radarStats = []) => radarStats.length >= 4;

const formatNumber = (value, digits = 1) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return String(value ?? "");
  if (Number.isInteger(parsed) && digits === 0) return String(parsed);
  return parsed.toFixed(digits).replace(/\.0$/, ".0");
};

const formatMetricValue = (metric = "", value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return String(value ?? "");
  if (metric === "KP%") return `${Math.round(parsed * 100)}%`;
  if (metric === "DPM" || metric === "GPM") return String(Math.round(parsed));
  if (metric === "KDA") return formatNumber(parsed, 1);
  return Number.isInteger(parsed) ? String(parsed) : String(Math.round(parsed * 10) / 10);
};

const formatMetricDelta = (metric = "", value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "";
  if (metric === "KP%") return `+${Math.round(parsed * 100)}pp`;
  if (metric === "DPM" || metric === "GPM") return `+${Math.round(parsed)}`;
  if (metric === "KDA") return `+${formatNumber(parsed, 1)}`;
  return `+${Number.isInteger(parsed) ? parsed : Math.round(parsed * 10) / 10}`;
};

const getScoreText = (match = {}) => {
  const score = String(match.seriesScore || "").trim();
  return score || "";
};

const getTeamLine = (match = {}) => [match.teamA, match.teamB].filter(Boolean).join(" vs ");

const getTemplateCopy = (data = {}) => {
  const en = isEnglishLocale(data);
  return en
    ? {
      primaryGap: "PRIMARY GAP",
      focus: "FOCUS",
      opponent: "OPPONENT",
      matchupEvidence: (name) => `${name} wins through source stats, not an abstract score`,
      proofWhyTitle: "SOURCE READ",
      proofWhyBody: "Three source-backed stats are enough for the MVP case, so the chart does not invent extra axes.",
    }
    : {
      primaryGap: "核心差距",
      focus: "觀察點",
      opponent: "對手",
      matchupEvidence: (name) => `${name} 贏在真實數據差距，不是抽象分數`,
      proofWhyTitle: "證據讀法",
      proofWhyBody: "三個來源數據足夠建立 MVP 讀法，雷達不硬補假軸。",
    };
};

const PlayerRadarHeroBackdrop = ({ data, theme, localFrame = 0, emphasis = "player" }) => {
  const match = data.matchContext || {};
  const score = getScoreText(match);
  const teamA = String(match.teamA || "");
  const teamB = String(match.teamB || "");
  const pulse = interpolate((localFrame + 20) % 120, [0, 60, 120], [0.54, 0.92, 0.54]);
  const scoreOpacity = emphasis === "verdict" ? 0.16 : 0.22;

  return (
    <div style={{ position: "absolute", inset: -72, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: "4% 2% auto",
          height: "42%",
          background: `radial-gradient(circle at 50% 40%, ${theme.accent}22, transparent 54%)`,
          opacity: pulse,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "5%",
          left: -8,
          color: "rgba(10,200,185,0.09)",
          fontSize: 142,
          fontWeight: 950,
          letterSpacing: 4,
          lineHeight: 0.9,
        }}
      >
        {teamA}
      </div>
      <div
        style={{
          position: "absolute",
          top: "16%",
          right: -8,
          color: "rgba(136,85,255,0.11)",
          fontSize: 142,
          fontWeight: 950,
          letterSpacing: 4,
          lineHeight: 0.9,
          textAlign: "right",
        }}
      >
        {teamB}
      </div>
      {score ? (
        <div
          style={{
            position: "absolute",
            inset: "16% 0 auto",
            color: `rgba(240,230,210,${scoreOpacity})`,
            fontSize: 168,
            fontWeight: 950,
            letterSpacing: -3,
            textAlign: "center",
            textShadow: "0 26px 70px rgba(0,0,0,0.84)",
            transform: "skewY(-5deg)",
          }}
        >
          {score}
        </div>
      ) : null}
      <div
        style={{
          position: "absolute",
          left: "7%",
          right: "7%",
          top: "34%",
          height: 3,
          background: `linear-gradient(90deg, transparent, ${theme.accent}99, ${HEXTECH_COLORS.gold}aa, ${theme.secondary}99, transparent)`,
          boxShadow: `0 0 34px ${theme.accent}88`,
          transform: "rotate(-3deg)",
        }}
      />
    </div>
  );
};

const ScorelineStrip = ({ data, theme }) => {
  const match = data.matchContext || {};
  const teamLine = getTeamLine(match);
  const score = getScoreText(match);
  const league = String(match.league || "").trim();

  return (
    <div
      style={{
        position: "relative",
        zIndex: 1,
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        gap: 18,
        padding: "15px 22px",
        border: `1px solid ${theme.accent}55`,
        background: "linear-gradient(90deg, rgba(3,11,24,0.36), rgba(5,21,37,0.78), rgba(3,11,24,0.36))",
        boxShadow: `0 16px 38px rgba(0,0,0,0.34), inset 0 0 22px ${theme.accent}12`,
      }}
    >
      <div style={{ color: "rgba(240,230,210,0.72)", fontSize: 20, fontWeight: 900, letterSpacing: 4 }}>
        {league}
      </div>
      <div style={{ color: HEXTECH_COLORS.gold, fontSize: 34, fontWeight: 950, lineHeight: 1 }}>
        {score}
      </div>
      <div style={{ color: "#fff", fontSize: 22, fontWeight: 950, letterSpacing: 3, textAlign: "right" }}>
        {teamLine}
      </div>
    </div>
  );
};

const MatchupStatSpotlight = ({ reason, segment, theme, data = {}, compact = false }) => {
  if (!reason) return null;
  const copy = getTemplateCopy(data);
  const values = getMatchupMetricDisplay(reason, segment);
  const metric = reason.metric || "";
  const delta = formatMetricDelta(metric, reason.delta);
  const leftValue = formatMetricValue(metric, values.leftValue);
  const rightValue = formatMetricValue(metric, values.rightValue);

  return (
    <GlassPanel
      accent={HEXTECH_COLORS.gold}
      style={{
        padding: compact ? 22 : 28,
        background: "linear-gradient(135deg, rgba(4,10,22,0.9), rgba(30,22,5,0.72))",
      }}
    >
      <div style={{ color: "rgba(240,230,210,0.66)", fontSize: compact ? 17 : 19, fontWeight: 950, letterSpacing: 4 }}>
        {copy.primaryGap}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "end", gap: 18, marginTop: compact ? 10 : 16 }}>
        <div>
          <div style={{ color: "#fff", fontSize: compact ? 42 : 58, fontWeight: 950, lineHeight: 1 }}>
            {metric}
          </div>
          <div style={{ color: "rgba(219,234,254,0.78)", fontSize: compact ? 24 : 30, fontWeight: 900, marginTop: 8 }}>
            {leftValue} vs {rightValue}
          </div>
        </div>
        <div style={{ color: HEXTECH_COLORS.gold, fontSize: compact ? 44 : 66, fontWeight: 950, lineHeight: 0.92 }}>
          {delta}
        </div>
      </div>
    </GlassPanel>
  );
};

const MetricRow = ({ reason, segment, accent }) => {
  const values = getMatchupMetricDisplay(reason, segment);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "118px 1fr 112px", gap: 18, alignItems: "center" }}>
      <div style={{ color: accent, fontSize: 25, fontWeight: 950 }}>{reason.metric}</div>
      <div style={{ color: "rgba(219,234,254,0.78)", fontSize: 23, fontWeight: 850 }}>
        {formatMetricValue(reason.metric, values.leftValue)} vs {formatMetricValue(reason.metric, values.rightValue)}
      </div>
      <div style={{ color: HEXTECH_COLORS.gold, fontSize: 31, fontWeight: 950, textAlign: "right" }}>
        {formatMetricDelta(reason.metric, reason.delta)}
      </div>
    </div>
  );
};

const PlayerIdentityCard = ({ label, player = {}, accent, data, dominant = false }) => (
  <GlassPanel
    accent={accent}
    style={{
      minHeight: dominant ? 250 : 220,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      background: dominant
        ? `linear-gradient(145deg, rgba(2,6,14,0.94), ${accent}18)`
        : "rgba(2,6,14,0.7)",
    }}
  >
    <div style={{ color: accent, fontSize: 18, fontWeight: 950, letterSpacing: 4 }}>{label}</div>
    <div>
      <div style={{ color: "#fff", fontSize: dominant ? 56 : 46, fontWeight: 950, lineHeight: 1 }}>{player.name}</div>
      <div style={{ marginTop: 12, color: "rgba(219,234,254,0.8)", fontSize: 26, fontWeight: 850 }}>
        {player.team || ""} · {getRoleLabel(player.role, data)}
      </div>
    </div>
  </GlassPanel>
);

const EvidenceCard = ({ reason, index, theme, large = false }) => {
  const metric = reason.metric || "";
  const rawValue = formatMetricValue(metric, reason.rawValue);
  return (
    <GlassPanel
      accent={index === 0 ? HEXTECH_COLORS.gold : theme.accent}
      style={{
        padding: large ? 30 : 24,
        minHeight: large ? 174 : 132,
        display: "grid",
        gridTemplateColumns: large ? "72px 1fr auto" : "56px 1fr auto",
        alignItems: "center",
        gap: 18,
        background: index === 0
          ? "linear-gradient(135deg, rgba(35,25,8,0.88), rgba(5,12,24,0.86))"
          : "linear-gradient(135deg, rgba(4,10,22,0.9), rgba(4,22,34,0.72))",
      }}
    >
      <div style={{ color: HEXTECH_COLORS.gold, fontSize: large ? 52 : 40, fontWeight: 950 }}>{index + 1}</div>
      <div>
        <div style={{ color: "#fff", fontSize: large ? 44 : 34, fontWeight: 950, lineHeight: 1 }}>
          {metric}
        </div>
        <div style={{ color: "rgba(219,234,254,0.76)", fontSize: large ? 25 : 21, fontWeight: 850, marginTop: 8 }}>
          {rawValue}
        </div>
      </div>
      <div style={{ color: theme.accent, fontSize: large ? 56 : 42, fontWeight: 950, textAlign: "right" }}>
        {reason.score}
      </div>
    </GlassPanel>
  );
};

const HookScene = ({ data, theme, localFrame }) => {
  const player = getPlayer(data);
  const match = data.matchContext || {};
  const segment = data.matchupSegment || {};
  const proofSegment = data.proofSegment || {};
  const displayPlayers = deriveMatchupDisplayPlayers(segment);
  const edgePlayer = displayPlayers.edgePlayer;
  const proofPlayer = proofSegment.player || player;
  const reasons = Array.isArray(segment.reasons) ? segment.reasons.slice(0, 3) : [];
  const primaryMatchupReason = reasons[0];
  const proofBadgeLabel = getProofBadgeLabel(proofSegment.proofType, data);
  const en = isEnglishLocale(data);
  const isSamePlayer = samePlayer(edgePlayer, proofPlayer);
  const roleLabel = getRoleLabel(edgePlayer.role || player.role, data);
  const headline = isSamePlayer
    ? (en ? `${proofPlayer.name} owns the ${roleLabel} read` : `${proofPlayer.name} 打穿${roleLabel}`)
    : (en ? `${edgePlayer.name} gap, ${proofPlayer.name} case` : `${edgePlayer.name} 對位差，${proofPlayer.name} 關鍵人物`);
  const subline = en
    ? `${getTeamLine(match)} ${getScoreText(match)} · matchup edge + ${proofBadgeLabel}`
    : `${getTeamLine(match)} ${getScoreText(match)} · 最大對位差 + ${proofBadgeLabel}`;

  return (
    <div style={{ position: "relative", height: "100%", display: "grid", gridTemplateRows: "auto 1fr", gap: 28, overflow: "hidden" }}>
      <PlayerRadarHeroBackdrop data={data} theme={theme} localFrame={localFrame} />
      <ScorelineStrip data={data} theme={theme} />
      <div style={{ position: "relative", zIndex: 1, display: "grid", alignContent: "center", gap: 28 }}>
        <div>
          <PipelineBadge theme={theme} localFrame={localFrame}>{getPlayerRadarCopy(data).hookBadge}</PipelineBadge>
          <div style={{ marginTop: 28, color: "#fff", fontSize: 84, fontWeight: 950, lineHeight: 1.02, textWrap: "balance", textShadow: `0 0 46px ${theme.accent}55` }}>
            {headline}
          </div>
          <div style={{ marginTop: 18, color: theme.secondary, fontSize: 35, fontWeight: 950, lineHeight: 1.16 }}>
            {subline}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.08fr 0.92fr", gap: 20, alignItems: "stretch" }}>
          <MatchupStatSpotlight reason={primaryMatchupReason} segment={segment} theme={theme} data={data} compact />
          <GlassPanel accent={theme.accent} style={{ padding: 24, display: "grid", alignContent: "center", gap: 8 }}>
            <div style={{ color: "rgba(240,230,210,0.66)", fontSize: 18, fontWeight: 950, letterSpacing: 4 }}>{proofBadgeLabel}</div>
            <div style={{ color: "#fff", fontSize: 46, fontWeight: 950, lineHeight: 1 }}>{getHookProofPillValue(data)}</div>
            <div style={{ color: theme.accent, fontSize: 28, fontWeight: 950 }}>{getRoleLabel(proofPlayer.role || player.role, data)}</div>
          </GlassPanel>
        </div>
      </div>
    </div>
  );
};

const MatchupEdgeScene = ({ data, theme, localFrame }) => {
  const segment = data.matchupSegment || {};
  const copy = getPlayerRadarCopy(data);
  const displayPlayers = deriveMatchupDisplayPlayers(segment);
  const focusPlayer = displayPlayers.focusPlayer;
  const edgePlayer = displayPlayers.edgePlayer;
  const opponentPlayer = displayPlayers.opponentPlayer;
  const reasons = Array.isArray(segment.reasons) ? segment.reasons.slice(0, 3) : [];
  const primaryMatchupReason = reasons[0];
  const secondaryReasons = reasons.slice(1);
  const label = segment.edgeType === "loser-highlight" ? copy.matchupLoserHighlight : copy.matchupWinnerBreak;
  const templateCopy = getTemplateCopy(data);

  return (
    <div style={{ position: "relative", height: "100%", display: "grid", gridTemplateRows: "auto 1fr", gap: 24, overflow: "hidden" }}>
      <PlayerRadarHeroBackdrop data={data} theme={theme} localFrame={localFrame} />
      <ScorelineStrip data={data} theme={theme} />
      <div style={{ position: "relative", zIndex: 1, display: "grid", alignContent: "center", gap: 24 }}>
        <div>
          <div style={{ color: theme.accent, fontSize: 24, fontWeight: 950, letterSpacing: 5 }}>
            {getRoleLabel(segment.role || focusPlayer.role, data)} MATCHUP · {label}
          </div>
          <div style={{ marginTop: 10, color: "#fff", fontSize: 64, fontWeight: 950, lineHeight: 1.04 }}>
            {focusPlayer.name || edgePlayer.name} vs {opponentPlayer.name}
          </div>
          <div style={{ marginTop: 10, color: theme.secondary, fontSize: 33, fontWeight: 950 }}>
            {templateCopy.matchupEvidence(edgePlayer.name)}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 112px 1fr", gap: 18, alignItems: "stretch" }}>
          <PlayerIdentityCard label={templateCopy.focus} player={focusPlayer || edgePlayer} accent={theme.accent} data={data} dominant={samePlayer(focusPlayer, edgePlayer)} />
          <div style={{ display: "grid", placeItems: "center", color: HEXTECH_COLORS.gold, fontSize: 38, fontWeight: 950 }}>VS</div>
          <PlayerIdentityCard label={templateCopy.opponent} player={opponentPlayer} accent={theme.secondary} data={data} dominant={samePlayer(opponentPlayer, edgePlayer)} />
        </div>
        <MatchupStatSpotlight reason={primaryMatchupReason} segment={segment} theme={theme} data={data} />
        {secondaryReasons.length > 0 ? (
          <GlassPanel accent={theme.accent} style={{ display: "grid", gap: 16, padding: "22px 28px" }}>
            {secondaryReasons.map((reason) => <MetricRow key={reason.metric} reason={reason} segment={segment} accent={theme.accent} />)}
          </GlassPanel>
        ) : null}
      </div>
    </div>
  );
};

const PlayerProofScene = ({ data, theme, localFrame }) => {
  const segment = data.proofSegment || {};
  const copy = getPlayerRadarCopy(data);
  const player = segment.player || {};
  const proofReasons = Array.isArray(segment.proofReasons) ? segment.proofReasons.slice(0, 3) : [];
  const proofLabel = segment.proofType === "mvp" ? copy.proofBadgeLabels.mvp : copy.proofBadgeLabels.key_player;
  const radarStats = normalizeStats({ radarStats: player.radarStats || data.radarStats });
  const showRadar = shouldShowRadarChart(radarStats);
  const templateCopy = getTemplateCopy(data);
  const cardIn = spring({ frame: Math.max(0, localFrame - 8), fps: 30, config: { stiffness: 140, damping: 17 } });

  return (
    <div style={{ position: "relative", height: "100%", display: "grid", gridTemplateRows: "auto 1fr", gap: 24, overflow: "hidden" }}>
      <PlayerRadarHeroBackdrop data={data} theme={theme} localFrame={localFrame} />
      <ScorelineStrip data={data} theme={theme} />
      <div style={{ position: "relative", zIndex: 1, display: "grid", gridTemplateColumns: "0.88fr 1.12fr", gap: 30, alignItems: "center" }}>
        <div style={{ transform: `translateY(${interpolate(cardIn, [0, 1], [24, 0])}px)`, opacity: cardIn }}>
          <PipelineBadge theme={theme} localFrame={localFrame}>{proofLabel}</PipelineBadge>
          <div style={{ marginTop: 24, color: "rgba(240,230,210,0.72)", fontSize: 24, fontWeight: 950, letterSpacing: 5 }}>
            {player.team || ""} · {getRoleLabel(player.role, data)}
          </div>
          <div style={{ marginTop: 10, color: "#fff", fontSize: 82, fontWeight: 950, lineHeight: 0.98, textShadow: `0 0 46px ${theme.accent}55` }}>
            {player.name}
          </div>
          <div style={{ marginTop: 18, color: theme.secondary, fontSize: 31, fontWeight: 950, lineHeight: 1.2, textWrap: "balance" }}>
            {segment.verdict || data.verdict || copy.proofSubtitle}
          </div>
          {showRadar ? (
            <div style={{ marginTop: 20, width: 238, opacity: 0.86 }}>
              <RadarChart
                radarStats={radarStats}
                size={238}
                fillColor={theme.accent}
                strokeColor={theme.accent}
                highlightLabel={proofReasons[0]?.metric || radarStats[0]?.label}
                appearStartFrame={0}
                expandDuration={20}
              />
            </div>
          ) : (
            <GlassPanel accent={HEXTECH_COLORS.gold} style={{ marginTop: 24, padding: 22 }}>
              <div style={{ color: HEXTECH_COLORS.gold, fontSize: 20, fontWeight: 950, letterSpacing: 4 }}>{templateCopy.proofWhyTitle}</div>
              <div style={{ marginTop: 8, color: "#fff", fontSize: 31, fontWeight: 950, lineHeight: 1.16 }}>
                {templateCopy.proofWhyBody}
              </div>
            </GlassPanel>
          )}
        </div>
        <div style={{ display: "grid", gap: 18 }}>
          {proofReasons.map((reason, index) => (
            <EvidenceCard
              key={reason.metric || index}
              reason={reason}
              index={index}
              theme={theme}
              large={index === 0}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const ConclusionScene = ({ data, theme, localFrame }) => {
  const verdict = buildConclusionVerdict(data);
  const segment = data.matchupSegment || {};
  const displayPlayers = deriveMatchupDisplayPlayers(segment);
  const proofPlayer = data.proofSegment?.player || {};
  const edgePlayer = displayPlayers.edgePlayer || {};
  const reason = Array.isArray(segment.reasons) ? segment.reasons[0] : null;
  const en = isEnglishLocale(data);
  const roleLabel = getRoleLabel(edgePlayer.role || segment.role, data);
  const body = samePlayer(edgePlayer, proofPlayer)
    ? (en
      ? `${proofPlayer.name} owns the ${roleLabel} gap and the MVP case.`
      : `${proofPlayer.name} 同時拿下${roleLabel}差距和 MVP 理由。`)
    : verdict.body;
  const chips = reason
    ? [roleLabel, `${reason.metric} ${formatMetricDelta(reason.metric, reason.delta)}`, ...(verdict.chips || []).slice(0, 1)]
    : verdict.chips;

  return (
    <div style={{ position: "relative", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <PlayerRadarHeroBackdrop data={data} theme={theme} localFrame={localFrame} emphasis="verdict" />
      <div style={{ position: "relative", zIndex: 1, width: "100%" }}>
        <VerdictCard
          theme={theme}
          localFrame={localFrame}
          title={en ? "CREATOR READ" : "賽後判讀"}
          body={body}
          chips={chips}
          bodySize={44}
          chipFontSize={19}
          panelStyle={{
            background: "linear-gradient(135deg, rgba(4,10,22,0.93), rgba(4,30,42,0.82))",
          }}
        />
      </div>
    </div>
  );
};

export const Template_PlayerRadar = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = getPipelineTheme("PLAYER_RADAR");
  const storyboard = buildRadarStoryboard(data);
  const timeline = buildTimeline(storyboard, fps);
  const active = getActiveTimelineScene(timeline, frame);
  const tag = active.scene?.tag || "HOOK";

  const renderScene = () => {
    if (active.scene?.tag === "MATCHUP_EDGE") return <MatchupEdgeScene data={data} theme={theme} localFrame={active.localFrame} />;
    if (active.scene?.tag === "PLAYER_PROOF") return <PlayerProofScene data={data} theme={theme} localFrame={active.localFrame} />;
    if (tag === "CONCLUSION_CTA" || tag === "OUTRO") return <ConclusionScene data={data} theme={theme} localFrame={active.localFrame} />;
    return <HookScene data={data} theme={theme} localFrame={active.localFrame} />;
  };

  return (
    <AbsoluteFill style={{ backgroundColor: "#07111f", color: "#fff", fontFamily: "'Outfit', 'Noto Sans TC', sans-serif", overflow: "hidden" }}>
      <HextechBackground tactical />
      <PipelineChrome theme={theme} left="PLAYER RADAR" right="MATCH DATA / PERFORMANCE" />
      <BgmLayer bgmFile={data.bgmFile || "audio/bgm1.mp3"} />
      <SafeStage inset={PLAYER_RADAR_STAGE_INSET}>{renderScene()}</SafeStage>
      <SubtitleCaption
        scene={active.scene}
        activeStart={active.start}
        accent={theme.accent}
        bottom={PLAYER_RADAR_SUBTITLE_BOTTOM}
        variant="lowerThird"
      />
    </AbsoluteFill>
  );
};
