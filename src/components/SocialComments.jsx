import React from "react";
import { AbsoluteFill, Sequence, useVideoConfig, useCurrentFrame, interpolate, spring } from "remotion";

export const SocialComments = ({ buzzArray, sceneStart, sceneDuration }) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();

  if (!buzzArray || buzzArray.length === 0) return null;

  return (
    <AbsoluteFill style={{ zIndex: 50, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 30 }}>
      {buzzArray.map((buzz, i) => {
        // 進場彈性動畫
        const popIn = spring({ frame: Math.max(0, frame - sceneStart - (i * 20)), fps, config: { stiffness: 120, damping: 14 }});
        
        // 基底浮動頻率 (利用不同的 Math.sin() 頻率)
        const floatY = Math.sin((frame - sceneStart) * (0.05 + i * 0.01)) * 15;
        
        // 來源圖示與讚數邏輯
        const isReddit = buzz.source === "Reddit";
        const themeColor = isReddit ? "#FF4500" : "#2E8B57"; // Reddit Orange vs PTT Green(or Red)
        const upvoteIcon = isReddit ? "⬆️" : "推";
        
        return (
          <div key={i} style={{
            transform: `scale(${interpolate(popIn, [0, 1], [0, 1])}) translateY(${floatY}px)`,
            opacity: interpolate(popIn, [0, 1], [0, 1]),
            width: "80%",
            background: "rgba(10, 20, 30, 0.85)",
            border: `2px solid ${themeColor}`,
            boxShadow: `0 10px 30px rgba(0,0,0,0.8), inset 0 0 15px ${themeColor}40`,
            borderRadius: 20,
            padding: 25,
            display: "flex",
            flexDirection: "column",
            gap: 15,
            position: "relative"
          }}>
            {/* 角落來源區塊 */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 24, fontWeight: "bold" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ 
                  background: themeColor, color: "#fff", padding: "4px 15px", 
                  borderRadius: 20, fontSize: 20, textShadow: "0 2px 4px rgba(0,0,0,0.5)" 
                }}>
                  {buzz.source}
                </span>
                <span style={{ color: "#aaa" }}>{buzz.tag}</span>
              </div>
              <div style={{ color: themeColor }}>
                {upvoteIcon} {(buzz.upvotes || 0).toLocaleString()}
              </div>
            </div>

            {/* 翻譯內文 */}
            <div style={{ fontSize: 35, color: "#fff", lineHeight: 1.4, fontWeight: 600, textShadow: "0 2px 10px #000" }}>
              "{buzz.translatedText}"
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
