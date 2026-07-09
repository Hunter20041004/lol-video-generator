import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { RadarChart } from "../components/charts/RadarChart";
import { BgmLayer } from "../video-system/BgmLayer";
import { HextechBackground, HEXTECH_COLORS } from "../video-system/HextechBackground";
import { SubtitleCaption } from "../video-system/SubtitleCaption";
import { buildTimeline, getActiveTimelineScene } from "../video-system/pacing";
import {
  DataPill,
  GlassPanel,
  KineticTitle,
  PipelineBadge,
  PipelineChrome,
  SafeStage,
  VerdictCard,
  getPipelineTheme,
} from "../video-system/VideoPrimitives";
import playerRadarHelpers from "./playerRadarHelpers";

const { buildConclusionVerdict, deriveMatchupDisplayPlayers, getHookProofPillValue, getMatchupMetricDisplay, getPlayer, getPlayerRadarCopy, getRoleLabel, isEnglishLocale } = playerRadarHelpers;

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

const HookScene = ({ data, theme, localFrame }) => {
  const player = getPlayer(data);
  const match = data.matchContext || {};
  const copy = getPlayerRadarCopy(data);
  const proofBadgeLabel = getProofBadgeLabel(data.proofSegment?.proofType, data);
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 30 }}>
      <PipelineBadge theme={theme} localFrame={localFrame}>{copy.hookBadge}</PipelineBadge>
      <KineticTitle
        eyebrow={`${match.league} · ${match.teamA} vs ${match.teamB} · ${match.seriesScore}`}
        title={player.name}
        subtitle={`${getRoleLabel(player.role, data)}${player.championPlayed ? ` · ${player.championPlayed}` : ""}`}
        theme={theme}
        localFrame={localFrame}
        size={128}
      />
      <div style={{ display: "flex", gap: 16, marginTop: 18 }}>
        <DataPill label={copy.hookSeriesLabel} value={match.seriesScore} color={theme.accent} />
        <DataPill label={proofBadgeLabel} value={getHookProofPillValue(data)} color={HEXTECH_COLORS.gold} />
        <DataPill label={copy.hookRoleLabel} value={getRoleLabel(player.role, data)} color={theme.secondary} />
      </div>
    </div>
  );
};

const MetricRow = ({ reason, segment, accent }) => {
  const values = getMatchupMetricDisplay(reason, segment);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 116px", gap: 18, alignItems: "center" }}>
      <div style={{ color: accent, fontSize: 26, fontWeight: 950 }}>{reason.metric}</div>
      <div style={{ color: "rgba(219,234,254,0.78)", fontSize: 23, fontWeight: 800 }}>
        {values.leftValue} vs {values.rightValue}
      </div>
      <div style={{ color: HEXTECH_COLORS.gold, fontSize: 30, fontWeight: 950, textAlign: "right" }}>
        +{reason.delta}
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
  const label = segment.edgeType === "loser-highlight" ? copy.matchupLoserHighlight : copy.matchupWinnerBreak;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 34 }}>
      <KineticTitle
        eyebrow={`${segment.role || focusPlayer.role} MATCHUP EDGE`}
        title={copy.matchupTitle}
        subtitle={`${focusPlayer.name || edgePlayer.name} vs ${opponentPlayer.name} · ${label}`}
        theme={theme}
        localFrame={localFrame}
        size={64}
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 1fr", gap: 20, alignItems: "stretch" }}>
        <GlassPanel accent={theme.accent} style={{ minHeight: 250 }}>
          <div style={{ color: theme.accent, fontSize: 20, fontWeight: 950, letterSpacing: 4 }}>FOCUS</div>
          <div style={{ marginTop: 16, color: "#fff", fontSize: 48, fontWeight: 950 }}>{focusPlayer.name || edgePlayer.name}</div>
          <div style={{ marginTop: 10, color: "rgba(219,234,254,0.78)", fontSize: 28, fontWeight: 850 }}>
            {focusPlayer.team || edgePlayer.team} · {getRoleLabel(focusPlayer.role || edgePlayer.role, data)}
          </div>
        </GlassPanel>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", color: HEXTECH_COLORS.gold, fontSize: 36, fontWeight: 950 }}>
          VS
        </div>
        <GlassPanel accent={theme.secondary} style={{ minHeight: 250 }}>
          <div style={{ color: theme.secondary, fontSize: 20, fontWeight: 950, letterSpacing: 4 }}>OPPONENT</div>
          <div style={{ marginTop: 16, color: "#fff", fontSize: 48, fontWeight: 950 }}>{opponentPlayer.name}</div>
          <div style={{ marginTop: 10, color: "rgba(219,234,254,0.78)", fontSize: 28, fontWeight: 850 }}>
            {opponentPlayer.team || ""} · {getRoleLabel(opponentPlayer.role || segment.role, data)}
          </div>
        </GlassPanel>
      </div>
      <GlassPanel accent={HEXTECH_COLORS.gold} style={{ display: "grid", gap: 18 }}>
        <div style={{ color: "#fff", fontSize: 34, fontWeight: 950 }}>
          {copy.edgeLeadLabel}: {edgePlayer.name} · {Math.round(segment.edgeScore)}
        </div>
        {reasons.map((reason) => <MetricRow key={reason.metric} reason={reason} segment={segment} accent={theme.accent} />)}
      </GlassPanel>
    </div>
  );
};

const PlayerProofScene = ({ data, theme, localFrame }) => {
  const segment = data.proofSegment || {};
  const copy = getPlayerRadarCopy(data);
  const player = segment.player || {};
  const reasons = Array.isArray(segment.proofReasons) ? segment.proofReasons.slice(0, 3) : [];
  const proofReasons = reasons;
  const proofLabel = segment.proofType === "mvp" ? copy.proofBadgeLabels.mvp : copy.proofBadgeLabels.key_player;
  const radarStats = normalizeStats({ radarStats: player.radarStats || data.radarStats });
  const chartIn = spring({ frame: Math.max(0, localFrame - 6), fps: 30, config: { stiffness: 120, damping: 16 } });

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 34, alignItems: "center" }}>
      <div style={{ display: "grid", gap: 24 }}>
        <div>
          <PipelineBadge theme={theme} localFrame={localFrame}>{proofLabel}</PipelineBadge>
          <KineticTitle
            eyebrow={`${player.team || ""} · ${getRoleLabel(player.role, data)}`}
            title={player.name}
            subtitle={segment.verdict || data.verdict || copy.proofSubtitle}
            theme={theme}
            localFrame={localFrame}
            size={76}
          />
        </div>
        <div
          style={{
            transform: `translateY(${interpolate(chartIn, [0, 1], [20, 0])}px) scale(${interpolate(chartIn, [0, 1], [0.96, 1])})`,
            opacity: chartIn,
            width: 320,
          }}
        >
          <RadarChart
            radarStats={radarStats}
            size={320}
            fillColor={theme.accent}
            strokeColor={theme.accent}
            highlightLabel={proofReasons[0]?.metric || radarStats[0]?.label}
            appearStartFrame={0}
            expandDuration={20}
          />
        </div>
      </div>
      <GlassPanel accent={theme.accent} style={{ display: "grid", gap: 20 }}>
        {proofReasons.map((reason, index) => (
          <div key={reason.metric || index} style={{ display: "grid", gridTemplateColumns: "74px 1fr 92px", gap: 18, alignItems: "center" }}>
            <div style={{ color: HEXTECH_COLORS.gold, fontSize: 42, fontWeight: 950 }}>{index + 1}</div>
            <div>
              <div style={{ color: "#fff", fontSize: 34, fontWeight: 950 }}>{reason.metric}</div>
              <div style={{ color: "rgba(219,234,254,0.72)", fontSize: 22, fontWeight: 800 }}>{reason.rawValue}</div>
            </div>
            <div style={{ color: theme.accent, fontSize: 44, fontWeight: 950, textAlign: "right" }}>{reason.score}</div>
          </div>
        ))}
      </GlassPanel>
    </div>
  );
};

const ConclusionScene = ({ data, theme, localFrame }) => {
  const verdict = buildConclusionVerdict(data);

  return (
    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <VerdictCard
        theme={theme}
        localFrame={localFrame}
        title="RADAR VERDICT"
        body={verdict.body}
        chips={verdict.chips}
      />
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
      <SafeStage>{renderScene()}</SafeStage>
      <SubtitleCaption scene={active.scene} activeStart={active.start} accent={theme.accent} />
    </AbsoluteFill>
  );
};
