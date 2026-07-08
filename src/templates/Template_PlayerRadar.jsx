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

const ROLE_LABELS = {
  zh: {
    Top: "上路",
    Jungle: "打野",
    Mid: "中路",
    Adc: "射手",
    ADC: "射手",
    Support: "輔助",
  },
  en: {
    Top: "Top",
    Jungle: "Jungle",
    Mid: "Mid",
    Adc: "ADC",
    ADC: "ADC",
    Support: "Support",
  },
};

const isEnglishLocale = (data = {}) => data.locale === "en";

const getPlayerRadarCopy = (data = {}) => {
  const locale = isEnglishLocale(data) ? "en" : "zh";
  return {
    zh: {
      hookBadge: "PLAYER RADAR",
      hookSeriesLabel: "系列賽",
      hookRoleLabel: "角色",
      hookProofTypeLabels: {
        mvp: "MVP",
        key_player: "關鍵人物",
      },
      matchupTitle: "最大對位差距",
      matchupLoserHighlight: "敗方亮點",
      matchupWinnerBreak: "勝負突破口",
      edgeLeadLabel: "數據領先",
      proofBadgeLabels: {
        mvp: "MVP CASE",
        key_player: "關鍵人物",
      },
      proofSubtitle: "用數據建立關鍵人物理由",
      conclusionFallbackMatchupName: "最大對位差選手",
      conclusionFallbackProofName: "關鍵人物",
      conclusionSamePlayer: "(proofName) 同時拿到最大對位差和關鍵人物理由。",
      conclusionSplit: "最大對位差在 (matchupName)，關鍵人物理由在 (proofName)。",
      conclusionChipsSamePlayer: ["最大對位差", "MVP 案例", "同一人"],
      conclusionChipsSplit: ["對位差距", "關鍵人物", "雙判讀"],
      storyboard: [
        { tag: "HOOK", text: "(playerName)賽後雷達\n數據一眼看懂", durationInFrames: 86 },
        { tag: "MATCHUP_EDGE", text: "對位差距先看\n誰把優勢打穿", durationInFrames: 126 },
        { tag: "PLAYER_PROOF", text: "關鍵人物理由\n數據直接列出來", durationInFrames: 112 },
        { tag: "CONCLUSION_CTA", text: "這場是不是 MVP\n留言告訴我", durationInFrames: 92 },
      ],
    },
    en: {
      hookBadge: "PLAYER RADAR",
      hookSeriesLabel: "Series",
      hookRoleLabel: "Role",
      hookProofTypeLabels: {
        mvp: "MVP",
        key_player: "Key player",
      },
      matchupTitle: "BIGGEST MATCHUP EDGE",
      matchupLoserHighlight: "Loser highlight",
      matchupWinnerBreak: "Win-condition swing",
      edgeLeadLabel: "Edge winner",
      proofBadgeLabels: {
        mvp: "MVP",
        key_player: "KEY PLAYER",
      },
      proofSubtitle: "Build the key-player case with numbers.",
      conclusionFallbackMatchupName: "matchup edge player",
      conclusionFallbackProofName: "key player",
      conclusionSamePlayer: "(proofName) owns both the matchup edge and the key-player case.",
      conclusionSplit: "The matchup edge belongs to (matchupName), while the key-player case belongs to (proofName).",
      conclusionChipsSamePlayer: ["Matchup edge", "MVP case", "Same player"],
      conclusionChipsSplit: ["Matchup edge", "Key player", "Dual read"],
      storyboard: [
        { tag: "HOOK", text: "(playerName) player radar\nThe numbers tell the story", durationInFrames: 86 },
        { tag: "MATCHUP_EDGE", text: "Start with the lane swing\nWho broke the matchup open", durationInFrames: 126 },
        { tag: "PLAYER_PROOF", text: "Make the key-player case\nStack the proof cleanly", durationInFrames: 112 },
        { tag: "CONCLUSION_CTA", text: "Was this the MVP read\nDrop your take below", durationInFrames: 92 },
      ],
    },
  }[locale];
};

const getRoleLabel = (role, data = {}) => {
  const locale = isEnglishLocale(data) ? "en" : "zh";
  return ROLE_LABELS[locale][role] || role || (locale === "en" ? "Mid" : "中路");
};

const samePlayer = (left = {}, right = {}) => {
  const leftId = left.playerId || left.id;
  const rightId = right.playerId || right.id;
  if (leftId && rightId) return String(leftId).toLowerCase() === String(rightId).toLowerCase();

  return [left.name, left.team, left.role]
    .map((value) => String(value || "").trim().toLowerCase())
    .join("|") === [right.name, right.team, right.role].map((value) => String(value || "").trim().toLowerCase()).join("|");
};

const deriveMatchupDisplayPlayers = (segment = {}) => {
  const focusPlayer = segment.focusPlayer || segment.edgePlayer || {};
  const edgePlayer = segment.edgePlayer || {};
  const actualOpponent = samePlayer(focusPlayer, edgePlayer) ? segment.opponentPlayer || {} : edgePlayer;

  return {
    focusPlayer,
    edgePlayer,
    opponentPlayer: actualOpponent,
  };
};

const getProofBadgeLabel = (proofType, data = {}) => {
  const copy = getPlayerRadarCopy(data);
  return proofType === "mvp" ? copy.hookProofTypeLabels.mvp : copy.hookProofTypeLabels.key_player;
};

const buildRadarStoryboard = (data = {}) => {
  if (Array.isArray(data.storyboard) && data.storyboard.length > 0) return data.storyboard;
  const copy = getPlayerRadarCopy(data);
  const playerName = data.player?.name || (isEnglishLocale(data) ? "Player" : "選手");
  return copy.storyboard.map((scene) => ({
    ...scene,
    text: scene.text.replace("(playerName)", playerName),
  }));
};

const normalizeStats = (data = {}) => {
  const fallback = [
    { label: "KDA", rawValue: "8.2", normalizedScore: 88 },
    { label: "DPM", rawValue: "612", normalizedScore: 82 },
    { label: "KP%", rawValue: "78%", normalizedScore: 92 },
    { label: "Vision", rawValue: "1.8/分", normalizedScore: 64 },
    { label: "Gold", rawValue: "412 GPM", normalizedScore: 85 },
  ];
  return (Array.isArray(data.radarStats) && data.radarStats.length > 0 ? data.radarStats : fallback).slice(0, 5);
};

const getPlayer = (data = {}) => data.player || { name: data.playerName || "Player", role: data.playerRole || data.role || "Mid", championPlayed: data.championPlayed || "" };

const HookScene = ({ data, theme, localFrame }) => {
  const player = getPlayer(data);
  const match = data.matchContext || {};
  const copy = getPlayerRadarCopy(data);
  const proofBadgeLabel = getProofBadgeLabel(data.proofSegment?.proofType, data);
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 30 }}>
      <PipelineBadge theme={theme} localFrame={localFrame}>{copy.hookBadge}</PipelineBadge>
      <KineticTitle
        eyebrow={`${match.league || "LCK"} · ${match.teamA || "T1"} vs ${match.teamB || "GEN"} · ${match.seriesScore || "Game 1"}`}
        title={player.name || "Player"}
        subtitle={`${getRoleLabel(player.role, data)}${player.championPlayed ? ` · ${player.championPlayed}` : ""}`}
        theme={theme}
        localFrame={localFrame}
        size={128}
      />
      <div style={{ display: "flex", gap: 16, marginTop: 18 }}>
        <DataPill label={copy.hookSeriesLabel} value={match.seriesScore || "Game 1"} color={theme.accent} />
        <DataPill label={proofBadgeLabel} value={data.recommendedMvp || player.name || "MVP"} color={HEXTECH_COLORS.gold} />
        <DataPill label={copy.hookRoleLabel} value={getRoleLabel(player.role, data)} color={theme.secondary} />
      </div>
    </div>
  );
};

const MetricRow = ({ reason, accent }) => (
  <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 116px", gap: 18, alignItems: "center" }}>
    <div style={{ color: accent, fontSize: 26, fontWeight: 950 }}>{reason.metric}</div>
    <div style={{ color: "rgba(219,234,254,0.78)", fontSize: 23, fontWeight: 800 }}>
      {reason.winnerValue} vs {reason.loserValue}
    </div>
    <div style={{ color: HEXTECH_COLORS.gold, fontSize: 30, fontWeight: 950, textAlign: "right" }}>
      +{reason.delta}
    </div>
  </div>
);

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
        eyebrow={`${segment.role || focusPlayer.role || "ROLE"} MATCHUP EDGE`}
        title={copy.matchupTitle}
        subtitle={`${focusPlayer.name || edgePlayer.name || "Focus"} vs ${opponentPlayer.name || "Opponent"} · ${label}`}
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
          <div style={{ marginTop: 16, color: "#fff", fontSize: 48, fontWeight: 950 }}>{opponentPlayer.name || "Opponent"}</div>
          <div style={{ marginTop: 10, color: "rgba(219,234,254,0.78)", fontSize: 28, fontWeight: 850 }}>
            {opponentPlayer.team || ""} · {getRoleLabel(opponentPlayer.role || segment.role, data)}
          </div>
        </GlassPanel>
      </div>
      <GlassPanel accent={HEXTECH_COLORS.gold} style={{ display: "grid", gap: 18 }}>
        <div style={{ color: "#fff", fontSize: 34, fontWeight: 950 }}>
          {copy.edgeLeadLabel}: {edgePlayer.name || "Edge player"} · {Math.round(segment.edgeScore || 0)}
        </div>
        {reasons.map((reason) => <MetricRow key={reason.metric} reason={reason} accent={theme.accent} />)}
      </GlassPanel>
    </div>
  );
};

const PlayerProofScene = ({ data, theme, localFrame }) => {
  const segment = data.proofSegment || {};
  const copy = getPlayerRadarCopy(data);
  const player = segment.player || getPlayer(data);
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
            title={player.name || "Player"}
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
  const copy = getPlayerRadarCopy(data);
  const matchupName = data.matchupSegment?.edgePlayer?.name || copy.conclusionFallbackMatchupName;
  const proofName = data.proofSegment?.player?.name || copy.conclusionFallbackProofName;
  const isSamePlayer = samePlayer(data.matchupSegment?.edgePlayer, data.proofSegment?.player);
  const body = (isSamePlayer ? copy.conclusionSamePlayer : copy.conclusionSplit)
    .replace("(proofName)", proofName)
    .replace("(matchupName)", matchupName);

  return (
    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <VerdictCard
        theme={theme}
        localFrame={localFrame}
        title="RADAR VERDICT"
        body={body}
        chips={isSamePlayer ? copy.conclusionChipsSamePlayer : copy.conclusionChipsSplit}
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
      <BgmLayer bgmFile={data.bgmFile} />
      <SafeStage>{renderScene()}</SafeStage>
      <SubtitleCaption scene={active.scene} activeStart={active.start} accent={theme.accent} />
    </AbsoluteFill>
  );
};
