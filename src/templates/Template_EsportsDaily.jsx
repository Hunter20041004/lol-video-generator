import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
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
  getPipelineTheme,
} from "../video-system/VideoPrimitives";

const ROLE_LABELS = {
  Top: "TOP",
  Jungle: "JGL",
  Mid: "MID",
  Adc: "ADC",
  Support: "SUP",
};

const asArray = (value) => (Array.isArray(value) ? value : []);

const getTeams = (data = {}) => {
  const teams = data.match?.teams || data.teams || [];
  return {
    left: teams[0] || data.teamA || "Team A",
    right: teams[1] || data.teamB || "Team B",
  };
};

const teamColor = (team = "", fallback = HEXTECH_COLORS.gold) => {
  const normalized = String(team || "").toLowerCase();
  if (normalized === "t1" || normalized.includes("t1 ")) return "#ef233c";
  if (normalized.includes("team liquid") || normalized === "tl") return "#3b82f6";
  return fallback;
};

const getMatchInfo = (data = {}) => {
  const teams = getTeams(data);
  const winner = data.match?.winningTeam || data.winningTeam || teams.left;
  const loser = winner === teams.left ? teams.right : teams.left;
  return {
    teams,
    winner,
    loser,
    score: data.match?.score || data.score || "SERIES",
    league: data.match?.league || "ESPORTS",
    tournament: data.match?.tournament || data.tournament || "",
  };
};

const buildDailyStoryboard = (data = {}, fallbackTag) => {
  if (Array.isArray(data.storyboard) && data.storyboard.length > 0) return data.storyboard;
  if (fallbackTag === "MATCHUPS") {
    return [
      { tag: "HOOK", text: `${data.title || "Head-to-Head Radar"}\n五路對位開拆`, durationInFrames: 90 },
      { tag: "MATCHUPS", text: "同一場系列賽\n五個位置直接比", durationInFrames: 300 },
      { tag: "CONCLUSION_CTA", text: data.cta || "留言你覺得最關鍵的位置", durationInFrames: 90 },
    ];
  }
  return [
    { tag: "HOOK", text: `${data.title || "Match Recap"}\n賽後數據快報`, durationInFrames: 74 },
    { tag: "RECAP_POINTS", text: "三個數據差距\n說清楚勝負關鍵", durationInFrames: 238 },
    { tag: "CONCLUSION_CTA", text: data.cta || "下一場前先收藏這支", durationInFrames: 84 },
  ];
};

const HookScene = ({ data, theme, localFrame, badge }) => {
  const teams = getTeams(data);
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 28 }}>
      <PipelineBadge theme={theme} localFrame={localFrame}>{badge}</PipelineBadge>
      <KineticTitle
        eyebrow={`${data.match?.league || "ESPORTS"} · ${data.match?.score || data.score || "SERIES"}`}
        title={data.title || `${teams.left} vs ${teams.right}`}
        subtitle={data.caption || "series-level data only"}
        theme={theme}
        localFrame={localFrame}
        size={74}
      />
      <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
        <DataPill label="LEFT" value={teams.left} color={theme.accent} />
        <DataPill label="RIGHT" value={teams.right} color={theme.secondary} />
      </div>
    </div>
  );
};

const ScoreTeam = ({ team, label, score, active, color }) => (
  <div
    style={{
      minWidth: 278,
      padding: "18px 20px",
      borderRadius: 8,
      border: `2px solid ${active ? color : "rgba(240,230,210,0.28)"}`,
      background: active ? `linear-gradient(135deg, ${color}2e, rgba(5,10,18,0.88))` : "rgba(5,10,18,0.62)",
      boxShadow: active ? `0 0 34px ${color}44` : "0 14px 28px rgba(0,0,0,0.38)",
    }}
  >
    <div style={{ color: "rgba(240,230,210,0.62)", fontSize: 18, fontWeight: 950, letterSpacing: 4 }}>{label}</div>
    <div style={{ marginTop: 8, display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 14 }}>
      <div style={{ color: active ? "#fff" : "rgba(240,230,210,0.82)", fontSize: 46, fontWeight: 950, lineHeight: 1 }}>
        {team}
      </div>
      {score !== undefined ? (
        <div style={{ color: active ? color : "rgba(240,230,210,0.54)", fontSize: 52, fontWeight: 950, lineHeight: 1 }}>
          {score}
        </div>
      ) : null}
    </div>
  </div>
);

const splitScore = (score = "") => {
  const match = String(score || "").match(/(\d+)\D+(\d+)/);
  return match ? [match[1], match[2]] : ["", ""];
};

const RecapHookScene = ({ data, theme, localFrame }) => {
  const { fps } = useVideoConfig();
  const info = getMatchInfo(data);
  const winnerColor = data.winnerColor || teamColor(info.winner, theme.accent);
  const loserColor = data.loserColor || teamColor(info.loser, theme.secondary);
  const [leftScore, rightScore] = splitScore(info.score);
  const titleIn = spring({ frame: Math.max(0, localFrame - 5), fps, config: { stiffness: 130, damping: 16 } });
  const scoreIn = spring({ frame: Math.max(0, localFrame - 14), fps, config: { stiffness: 180, damping: 17 } });

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 34 }}>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <PipelineBadge theme={{ ...theme, accent: winnerColor }} localFrame={localFrame}>
          {info.league} RECAP
        </PipelineBadge>
      </div>
      <div
        style={{
          textAlign: "center",
          transform: `translateY(${interpolate(titleIn, [0, 1], [34, 0])}px)`,
          opacity: titleIn,
        }}
      >
        <div style={{ color: winnerColor, fontSize: 26, fontWeight: 950, letterSpacing: 7, marginBottom: 18 }}>
          {info.tournament ? "MID-SEASON INVITATIONAL" : "SERIES RESULT"}
        </div>
        <h1 style={{ margin: 0, color: "#fff", fontSize: 82, fontWeight: 950, lineHeight: 1.02, textWrap: "balance" }}>
          {data.headline || `${info.winner} 直落三帶走系列賽`}
        </h1>
        <div style={{ marginTop: 18, color: "rgba(240,230,210,0.86)", fontSize: 32, fontWeight: 850, lineHeight: 1.22 }}>
          {data.caption || "不是只看比分，重點在野輔節奏和關鍵選手狀態。"}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "stretch",
          gap: 18,
          transform: `translateY(${interpolate(scoreIn, [0, 1], [30, 0])}px)`,
          opacity: scoreIn,
        }}
      >
        <ScoreTeam team={info.teams.left} label="BLUE SIDE" score={leftScore} active={info.winner === info.teams.left} color={winnerColor} />
        <div style={{ alignSelf: "center", color: "rgba(240,230,210,0.72)", fontSize: 28, fontWeight: 950, letterSpacing: 4 }}>VS</div>
        <ScoreTeam team={info.teams.right} label="RED SIDE" score={rightScore} active={info.winner === info.teams.right} color={info.winner === info.teams.right ? winnerColor : loserColor} />
      </div>
      <div style={{ textAlign: "center", color: winnerColor, fontSize: 24, fontWeight: 950, letterSpacing: 5 }}>
        {data.editorialTag || "3 個賽後重點"}
      </div>
    </div>
  );
};

const MatchupRows = ({ data, theme, localFrame }) => {
  const { fps } = useVideoConfig();
  const edges = asArray(data.matchupEdges).slice(0, 5);
  const rowsIn = spring({ frame: Math.max(0, localFrame - 8), fps, config: { stiffness: 120, damping: 18 } });

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <KineticTitle eyebrow="ROLE EDGES" title="五路差距" subtitle="同位置直接對位，不改變中英結論" theme={theme} localFrame={localFrame} size={62} />
      <div
        style={{
          display: "grid",
          gap: 16,
          marginTop: 42,
          transform: `translateY(${interpolate(rowsIn, [0, 1], [42, 0])}px)`,
          opacity: rowsIn,
        }}
      >
        {edges.map((edge, index) => {
          const reason = asArray(edge.reasons)[0];
          return (
            <GlassPanel
              key={`${edge.role}-${index}`}
              accent={index % 2 === 0 ? theme.accent : theme.secondary}
              style={{ minHeight: 138, display: "grid", gridTemplateColumns: "120px 1fr 168px", alignItems: "center", gap: 18 }}
            >
              <div style={{ color: theme.accent, fontSize: 34, fontWeight: 950 }}>{ROLE_LABELS[edge.role] || edge.role}</div>
              <div>
                <div style={{ color: "#fff", fontSize: 38, fontWeight: 950, lineHeight: 1.05 }}>{edge.edgePlayer || "Edge player"}</div>
                <div style={{ color: "rgba(219,234,254,0.74)", fontSize: 22, fontWeight: 800, marginTop: 8 }}>
                  {edge.edgeWinner || "Team"} edge · {reason?.metric || "radar"} {reason?.delta ? `+${reason.delta}` : ""}
                </div>
              </div>
              <div style={{ color: HEXTECH_COLORS.gold, fontSize: 48, fontWeight: 950, textAlign: "right" }}>{Math.round(edge.edgeScore || 0)}</div>
            </GlassPanel>
          );
        })}
      </div>
    </div>
  );
};

const formatRecapPoint = (point = {}, index = 0) => ({
  kicker: point.kicker || point.metric || `POINT ${index + 1}`,
  title: point.title || point.summary || point.id || "Data point",
  body: point.body || point.insight || "",
  value: point.displayValue || point.value,
});

const RecapRows = ({ data, theme, localFrame, scene }) => {
  const { fps } = useVideoConfig();
  const info = getMatchInfo(data);
  const winnerColor = data.winnerColor || teamColor(info.winner, theme.accent);
  const scenePoints = asArray(scene?.points);
  const points = (scenePoints.length > 0 ? scenePoints : asArray(data.recapPoints)).slice(0, 4);
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ textAlign: "left", marginBottom: 34 }}>
        <div style={{ color: winnerColor, fontSize: 24, fontWeight: 950, letterSpacing: 7 }}>{scene?.kicker || "CREATOR READ"}</div>
        <h2 style={{ margin: "10px 0 0", color: "#fff", fontSize: 64, fontWeight: 950, lineHeight: 1.02 }}>
          {scene?.title || data.recapTitle || "T1 贏在哪裡？"}
        </h2>
        <div style={{ marginTop: 12, color: "rgba(240,230,210,0.74)", fontSize: 28, fontWeight: 850 }}>
          {scene?.subtitle || data.recapSubtitle || "只用公開賽後資訊，不補不存在的會戰敘事。"}
        </div>
      </div>
      <div style={{ display: "grid", gap: 18 }}>
        {points.map((point, index) => {
          const copy = formatRecapPoint(point, index);
          const pop = spring({ frame: Math.max(0, localFrame - 10 - index * 10), fps, config: { stiffness: 160, damping: 18 } });
          const accent = index === 0 ? winnerColor : HEXTECH_COLORS.gold;
          return (
            <div
              key={point.id || index}
              style={{
                minHeight: 178,
                display: "grid",
                gridTemplateColumns: "88px 1fr 122px",
                alignItems: "center",
                gap: 22,
                padding: "24px 28px",
                borderRadius: 8,
                border: `2px solid ${accent}66`,
                background: `linear-gradient(135deg, rgba(4,10,22,0.92), ${index === 0 ? `${winnerColor}18` : "rgba(21,19,12,0.78)"})`,
                boxShadow: `0 18px 44px rgba(0,0,0,0.42), 0 0 28px ${accent}1f`,
                transform: `translateX(${interpolate(pop, [0, 1], [index % 2 ? 42 : -42, 0])}px)`,
                opacity: pop,
              }}
            >
              <div style={{ color: accent, fontSize: 56, fontWeight: 950, lineHeight: 1, textAlign: "center" }}>
                {index + 1}
              </div>
              <div>
                <div style={{ color: accent, fontSize: 20, fontWeight: 950, letterSpacing: 4 }}>{copy.kicker}</div>
                <div style={{ marginTop: 8, color: "#fff", fontSize: 36, fontWeight: 950, lineHeight: 1.12, textWrap: "balance" }}>
                  {copy.title}
                </div>
                {copy.body ? (
                  <div style={{ marginTop: 10, color: "rgba(219,234,254,0.72)", fontSize: 23, fontWeight: 800, lineHeight: 1.24 }}>
                    {copy.body}
                  </div>
                ) : null}
              </div>
              <div
                style={{
                  justifySelf: "end",
                  minWidth: 106,
                  padding: "13px 12px",
                  borderRadius: 8,
                  textAlign: "center",
                  color: "#07111f",
                  background: `linear-gradient(135deg, ${accent}, #f4d58d)`,
                  fontSize: 28,
                  fontWeight: 950,
                }}
              >
                {copy.value !== undefined ? String(copy.value) : "KEY"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const CtaScene = ({ data, theme, localFrame }) => (
  <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 28 }}>
    <PipelineBadge theme={theme} localFrame={localFrame}>DAILY SERIES</PipelineBadge>
    <KineticTitle
      eyebrow="NEXT MATCH READY"
      title={data.cta || "Follow for the next recap"}
      subtitle="no timeline claims, no unsupported fight narrative"
      theme={theme}
      localFrame={localFrame}
      size={66}
    />
  </div>
);

const RecapCtaScene = ({ data, theme, localFrame }) => {
  const info = getMatchInfo(data);
  const winnerColor = data.winnerColor || teamColor(info.winner, theme.accent);
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 30, textAlign: "center" }}>
      <PipelineBadge theme={{ ...theme, accent: winnerColor }} localFrame={localFrame}>NEXT QUESTION</PipelineBadge>
      <div style={{ color: winnerColor, fontSize: 30, fontWeight: 950, letterSpacing: 7 }}>{info.league} · {info.score}</div>
      <h2 style={{ margin: 0, color: "#fff", fontSize: 74, fontWeight: 950, lineHeight: 1.08, textWrap: "balance" }}>
        {data.finalTakeaway || `${info.winner} 下一輪還能這樣打嗎？`}
      </h2>
      <div style={{ maxWidth: 780, color: "rgba(240,230,210,0.78)", fontSize: 32, fontWeight: 850, lineHeight: 1.3 }}>
        {data.cta || "留言選你的系列賽 MVP：Keria、Oner，還是整隊節奏差距？"}
      </div>
    </div>
  );
};

const EsportsDailyTemplate = ({ data, mode }) => {
  const frame = useCurrentFrame();
  const theme = getPipelineTheme(data.dataType);
  const isRadar = mode === "radar";
  const storyboard = buildDailyStoryboard(data, isRadar ? "MATCHUPS" : "RECAP_POINTS");
  const timeline = buildTimeline(storyboard, 30);
  const active = getActiveTimelineScene(timeline, frame);
  const tag = active.scene?.tag || "HOOK";

  const renderScene = () => {
    if (tag === "MATCHUPS") return <MatchupRows data={data} theme={theme} localFrame={active.localFrame} />;
    if (tag === "RECAP_POINTS") return <RecapRows data={data} theme={theme} localFrame={active.localFrame} scene={active.scene} />;
    if (!isRadar && (tag === "CONCLUSION_CTA" || tag === "OUTRO")) return <RecapCtaScene data={data} theme={theme} localFrame={active.localFrame} />;
    if (tag === "CONCLUSION_CTA" || tag === "OUTRO") return <CtaScene data={data} theme={theme} localFrame={active.localFrame} />;
    if (!isRadar) return <RecapHookScene data={data} theme={theme} localFrame={active.localFrame} />;
    return <HookScene data={data} theme={theme} localFrame={active.localFrame} badge={isRadar ? "H2H RADAR" : "MATCH RECAP"} />;
  };

  return (
    <AbsoluteFill style={{ backgroundColor: "#050A0E", color: "#fff", fontFamily: "'Outfit', 'Noto Sans TC', sans-serif", overflow: "hidden" }}>
      <HextechBackground tactical />
      <PipelineChrome theme={theme} left={isRadar ? "HEAD-TO-HEAD RADAR" : "MATCH RECAP"} right="ESPORTS DAILY" />
      <BgmLayer bgmFile={data.bgmFile} />
      <SafeStage>{renderScene()}</SafeStage>
      <SubtitleCaption
        scene={active.scene}
        activeStart={active.start}
        accent={!isRadar ? (data.winnerColor || teamColor(getMatchInfo(data).winner, theme.accent)) : theme.accent}
        variant={!isRadar ? "lowerThird" : "card"}
        bottom={!isRadar ? 168 : 340}
      />
    </AbsoluteFill>
  );
};

export const Template_EsportsHeadToHeadRadar = ({ data }) => <EsportsDailyTemplate data={data} mode="radar" />;

export const Template_EsportsMatchRecap = ({ data }) => <EsportsDailyTemplate data={data} mode="recap" />;
