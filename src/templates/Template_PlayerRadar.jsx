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
  RevealList,
  SafeStage,
  VerdictCard,
  getPipelineTheme,
} from "../video-system/VideoPrimitives";

const ROLE_LABELS = {
  Top: "上路",
  Jungle: "打野",
  Mid: "中路",
  Adc: "射手",
  ADC: "射手",
  Support: "輔助",
};

const buildRadarStoryboard = (data = {}) => {
  if (Array.isArray(data.storyboard) && data.storyboard.length > 0) return data.storyboard;
  return [
    { tag: "HOOK", text: `${data.player?.name || "選手"}賽後雷達\n數據一眼看懂`, durationInFrames: 86 },
    { tag: "RADAR", text: "五維表現攤開\n強項弱點很明顯", durationInFrames: 126 },
    { tag: "BREAKDOWN", text: "關鍵指標不是 KDA\n團戰參與更重要", durationInFrames: 112 },
    { tag: "CONCLUSION_CTA", text: "這場是不是 MVP\n留言告訴我", durationInFrames: 92 },
  ];
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
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 30 }}>
      <PipelineBadge theme={theme} localFrame={localFrame}>PLAYER RADAR</PipelineBadge>
      <KineticTitle
        eyebrow={`${match.league || "LCK"} · ${match.teamA || "T1"} vs ${match.teamB || "GEN"} · ${match.seriesScore || "Game 1"}`}
        title={player.name || "Player"}
        subtitle={`${ROLE_LABELS[player.role] || player.role || "中路"}${player.championPlayed ? ` · ${player.championPlayed}` : ""}`}
        theme={theme}
        localFrame={localFrame}
        size={128}
      />
      <div style={{ display: "flex", gap: 16, marginTop: 18 }}>
        <DataPill label="強項" value={data.highlight || "KP%"} color={theme.accent} />
        <DataPill label="隱憂" value={data.weakness || "Vision"} color={HEXTECH_COLORS.gold} />
        <DataPill label="評級" value={data.grade || "A+"} color={theme.secondary} />
      </div>
    </div>
  );
};

const RadarScene = ({ data, theme, localFrame }) => {
  const frame = useCurrentFrame();
  const player = getPlayer(data);
  const stats = normalizeStats(data);
  const chartIn = spring({ frame: Math.max(0, localFrame - 8), fps: 30, config: { stiffness: 120, damping: 15 } });

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <KineticTitle eyebrow="FIVE-AXIS PROFILE" title={`${player.name || "Player"} 的真實形狀`} subtitle="強項與弱點會自己浮出來" theme={theme} localFrame={localFrame} size={62} />
      <div
        style={{
          marginTop: 26,
          transform: `translateY(${interpolate(chartIn, [0, 1], [44, 0])}px) scale(${interpolate(chartIn, [0, 1], [0.9, 1])})`,
          opacity: chartIn,
          filter: `drop-shadow(0 0 36px ${theme.accent}66)`,
        }}
      >
        <RadarChart radarStats={stats} size={760} fillColor={theme.accent} strokeColor={theme.accent} highlightLabel={data.highlight || stats[0]?.label} appearStartFrame={0} expandDuration={30} />
      </div>
      <div style={{ display: "flex", gap: 13, marginTop: -8 }}>
        {stats.slice(0, 5).map((stat) => (
          <DataPill key={stat.label} label={stat.label} value={stat.normalizedScore} color={stat.label === data.highlight ? theme.accent : HEXTECH_COLORS.gold} />
        ))}
      </div>
    </div>
  );
};

const BreakdownScene = ({ data, theme, localFrame }) => {
  const stats = normalizeStats(data)
    .slice()
    .sort((a, b) => Number(b.normalizedScore || 0) - Number(a.normalizedScore || 0))
    .slice(0, 3);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <KineticTitle eyebrow="KEY TAKEAWAYS" title="不是只有 KDA" subtitle="真正影響比賽的是這三項" theme={theme} localFrame={localFrame} size={68} />
      <div style={{ width: "90%", marginTop: 48 }}>
        <RevealList
          items={stats}
          localFrame={localFrame - 8}
          accent={theme.accent}
          renderItem={(stat, index) => (
            <GlassPanel accent={index === 0 ? theme.accent : theme.secondary} style={{ display: "grid", gridTemplateColumns: "1fr 140px", alignItems: "center", minHeight: 124 }}>
              <div>
                <div style={{ color: "#fff", fontSize: 42, fontWeight: 950 }}>{stat.label}</div>
                <div style={{ color: "rgba(219,234,254,0.78)", fontSize: 25, fontWeight: 850, marginTop: 6 }}>原始數據：{stat.rawValue}</div>
              </div>
              <div style={{ color: index === 0 ? theme.accent : HEXTECH_COLORS.gold, fontSize: 62, fontWeight: 950, textAlign: "right" }}>{stat.normalizedScore}</div>
            </GlassPanel>
          )}
        />
      </div>
    </div>
  );
};

const ConclusionScene = ({ data, theme, localFrame }) => (
  <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
    <VerdictCard
      theme={theme}
      localFrame={localFrame}
      title="RADAR VERDICT"
      body={data.verdict || "這場不是單純數據漂亮，而是關鍵回合真的有接管能力。"}
      chips={["MVP 候選", "團戰影響", "下一場觀察"]}
    />
  </div>
);

export const Template_PlayerRadar = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = getPipelineTheme("PLAYER_RADAR");
  const storyboard = buildRadarStoryboard(data);
  const timeline = buildTimeline(storyboard, fps);
  const active = getActiveTimelineScene(timeline, frame);
  const tag = active.scene?.tag || "HOOK";

  const renderScene = () => {
    if (tag === "RADAR" || tag === "STAT_REVEAL") return <RadarScene data={data} theme={theme} localFrame={active.localFrame} />;
    if (tag === "BREAKDOWN") return <BreakdownScene data={data} theme={theme} localFrame={active.localFrame} />;
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
