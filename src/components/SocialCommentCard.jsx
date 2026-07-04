import React from "react";
import { useVideoConfig, useCurrentFrame, interpolate, spring } from "remotion";

// ==========================================
// 各平台主題：Reddit / X (Twitter) / PTT
// 由 buzz.source 字串自動推導；找不到就 fallback 到 Reddit 配色
// ==========================================
const SOURCE_THEMES = {
  Reddit: {
    cardBg: "linear-gradient(180deg, #1A1A1B 0%, #161617 100%)",
    border: "#272729",
    accent: "#FF4500",
    avatarBg: "linear-gradient(135deg, #FF4500, #FF7B40)",
    subLine: "r/leagueoflegends",
    handlePrefix: "u/",
    actionIcon: "▲",
    actionLabel: "Upvotes",
    sourceBadgeBg: "#FF4500",
    sourceBadgeText: "REDDIT",
  },
  X: {
    cardBg: "linear-gradient(180deg, #000000 0%, #0A0A0A 100%)",
    border: "#2F3336",
    accent: "#1D9BF0",
    avatarBg: "linear-gradient(135deg, #1D9BF0, #69CCFF)",
    subLine: "",
    handlePrefix: "@",
    actionIcon: "❤",
    actionLabel: "Likes",
    sourceBadgeBg: "#1D9BF0",
    sourceBadgeText: "X",
  },
  Twitter: {
    cardBg: "linear-gradient(180deg, #000000 0%, #0A0A0A 100%)",
    border: "#2F3336",
    accent: "#1D9BF0",
    avatarBg: "linear-gradient(135deg, #1D9BF0, #69CCFF)",
    subLine: "",
    handlePrefix: "@",
    actionIcon: "❤",
    actionLabel: "Likes",
    sourceBadgeBg: "#1D9BF0",
    sourceBadgeText: "X",
  },
  PTT: {
    cardBg: "linear-gradient(180deg, #0D1117 0%, #0A0F14 100%)",
    border: "#2F8B57",
    accent: "#52D273",
    avatarBg: "linear-gradient(135deg, #52D273, #8AE19E)",
    subLine: "◤ Gossiping",
    handlePrefix: "",
    actionIcon: "推",
    actionLabel: "Pushes",
    sourceBadgeBg: "#52D273",
    sourceBadgeText: "PTT",
  },
  System: {
    cardBg: "linear-gradient(180deg, #07111f 0%, #020611 100%)",
    border: "#7dd3fc",
    accent: "#7dd3fc",
    avatarBg: "linear-gradient(135deg, #0AC8B9, #C8AA6E)",
    subLine: "verified-data-status",
    handlePrefix: "",
    actionIcon: "◆",
    actionLabel: "Status",
    sourceBadgeBg: "#7dd3fc",
    sourceBadgeText: "SYSTEM",
  },
};

const resolveTheme = (source) => {
  if (!source) return SOURCE_THEMES.Reddit;
  const key = String(source).trim();
  return SOURCE_THEMES[key] || SOURCE_THEMES.Reddit;
};

// 從 username / source 取首字母作為 avatar 文字 fallback
const getAvatarInitial = (username, source) => {
  const pick = (s) => (typeof s === "string" && s.trim().length > 0 ? s.trim()[0].toUpperCase() : null);
  return pick(username) || pick(source) || "?";
};

// 格式化票數：超過 1000 改用 "1.2k" / "10.5k"，避免長數字撐爆 footer
const formatCount = (n) => {
  const num = Number(n) || 0;
  if (num < 1000) return num.toLocaleString();
  if (num < 10000) return (num / 1000).toFixed(1) + "k";
  if (num < 1_000_000) return Math.round(num / 1000) + "k";
  return (num / 1_000_000).toFixed(1) + "M";
};

// ==========================================
// 單一卡片（內部用，給 SocialCommentCardStack 迭代使用）
// 進場：spring pop-in（scale + slide-up + opacity）
// 待機：低頻浮動，避免靜止呆板
// ==========================================
const SingleCard = ({ buzz, index, sceneStart }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const theme = resolveTheme(buzz.source);
  const username = buzz.username || `${buzz.source || "user"}_${(1234 + index * 73) % 9999}`;
  const initial = getAvatarInitial(username, buzz.source);
  const displaySub = theme.subLine || `${theme.handlePrefix}${username}`;
  const timestamp = buzz.timestamp || `${index === 0 ? 2 : index === 1 ? 5 : 17}h ago`;

  // 進場：每張卡延遲 12 frame 接力
  const localFrame = frame - sceneStart - index * 12;
  const popIn = spring({
    frame: Math.max(0, localFrame),
    fps,
    config: { stiffness: 130, damping: 18, mass: 0.9 },
  });
  const slideUp = interpolate(popIn, [0, 1], [60, 0]);
  const fadeIn = interpolate(popIn, [0, 0.4, 1], [0, 0.85, 1]);

  // 待機浮動：每張不同頻率
  const idleFloat = Math.sin((frame - sceneStart) * (0.04 + index * 0.012)) * 6;

  return (
    <div
      style={{
        width: "82%",
        maxWidth: 880,
        background: theme.cardBg,
        border: `2px solid ${theme.border}`,
        borderRadius: 22,
        boxShadow: [
          `0 25px 60px rgba(0,0,0,0.75)`,
          `0 0 50px ${theme.accent}28`,
          `inset 0 1px 0 rgba(255,255,255,0.06)`,
        ].join(", "),
        padding: "26px 32px",
        display: "flex",
        flexDirection: "column",
        gap: 18,
        position: "relative",
        opacity: fadeIn,
        transform: `translateY(${slideUp + idleFloat}px) scale(${interpolate(popIn, [0, 1], [0.86, 1])})`,
      }}
    >
      {/* 來源徽章（右上角小章） */}
      <div
        style={{
          position: "absolute",
          top: 14,
          right: 14,
          padding: "4px 12px",
          background: theme.sourceBadgeBg,
          color: "#fff",
          fontSize: 18,
          fontWeight: 900,
          letterSpacing: 3,
          borderRadius: 6,
          boxShadow: `0 4px 14px ${theme.accent}55`,
          textShadow: "0 1px 3px rgba(0,0,0,0.6)",
        }}
      >
        {theme.sourceBadgeText}
      </div>

      {/* Header：Avatar + Username + Sub + Timestamp */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {/* Avatar 圓形 placeholder */}
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: theme.avatarBg,
            border: `2px solid ${theme.accent}`,
            boxShadow: `0 4px 18px ${theme.accent}55`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 32,
            fontWeight: 900,
            color: "#fff",
            fontFamily: "'Outfit', sans-serif",
            textShadow: "0 2px 6px rgba(0,0,0,0.6)",
            flexShrink: 0,
          }}
        >
          {initial}
        </div>

        {/* Username + Sub line */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 30,
              fontWeight: 800,
              color: "#fff",
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: 0.5,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              textShadow: "0 2px 6px rgba(0,0,0,0.6)",
            }}
          >
            {username}
          </div>
          <div
            style={{
              fontSize: 20,
              color: "#9CA3AF",
              fontWeight: 500,
              letterSpacing: 0.5,
              whiteSpace: "nowrap",
            }}
          >
            {displaySub} · {timestamp}
          </div>
        </div>
      </div>

      {/* Body：留言主文 */}
      <div
        style={{
          fontSize: 36,
          color: "#F4F4F5",
          fontWeight: 600,
          lineHeight: 1.45,
          fontFamily: "'Outfit', 'Noto Sans TC', sans-serif",
          textShadow: "0 2px 8px rgba(0,0,0,0.55)",
          padding: "4px 0",
          letterSpacing: 0.3,
        }}
      >
        {buzz.translatedText || buzz.text || ""}
      </div>

      {/* Footer：互動數據 + tag */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 14,
          borderTop: `1px solid ${theme.border}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 22,
              color: theme.accent,
              fontWeight: 900,
              fontFamily: theme.actionIcon === "推" ? "'Noto Sans TC', sans-serif" : "'Outfit', sans-serif",
            }}
          >
            {theme.actionIcon}
          </span>
          <span style={{ fontSize: 22, color: theme.accent, fontWeight: 800 }}>
            {formatCount(buzz.upvotes)}
          </span>
          <span style={{ fontSize: 18, color: "#6B7280", marginLeft: 4, letterSpacing: 1 }}>
            {theme.actionLabel}
          </span>
        </div>

        {buzz.tag && (
          <div
            style={{
              fontSize: 18,
              color: "#A1A1AA",
              fontWeight: 600,
              padding: "4px 12px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 999,
              letterSpacing: 1,
            }}
          >
            {buzz.tag}
          </div>
        )}
      </div>
    </div>
  );
};

// ==========================================
// 空狀態：不再偽造 Reddit/PTT 留言，只標明資料不足
// ==========================================
const EMPTY_STATE_BUZZ = [
  {
    source: "System",
    username: "Hextech Desk",
    upvotes: 0,
    tag: "[資料不足]",
    translatedText: "目前沒有可驗證的社群留言資料，已略過假評論填充。",
  },
];

// ==========================================
// 對外 export：垂直堆疊整批留言卡
// 不負責背景模糊 — 由 Template 的背景層自行降噪，職責切乾淨
// 即便 buzzArray 為 undefined / 空陣列也會顯示明確空狀態，避免假資料污染影片
// z-index: 9000 — 必定在 splash filter blur (zIndex 0) 與 HUD (zIndex 1~) 之上
// ==========================================
export const SocialCommentCard = ({ buzzArray, sceneStart }) => {
  const list = Array.isArray(buzzArray) && buzzArray.length > 0 ? buzzArray : EMPTY_STATE_BUZZ;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 9000,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: 26,
        padding: "60px 0",
      }}
    >
      {list.map((buzz, i) => (
        <SingleCard key={i} buzz={buzz} index={i} sceneStart={sceneStart} />
      ))}
    </div>
  );
};
