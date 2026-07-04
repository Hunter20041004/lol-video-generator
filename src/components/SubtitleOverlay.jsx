import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { calculatePacing } from '../Composition';

export const SubtitleOverlay = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const storyboard = data?.storyboard;
  const dataType = data?.dataType || "PATCH";

  if (!storyboard || storyboard.length === 0) return null;

  let activeText = null;
  let activeStartFrame = 0;

  const pacing = calculatePacing(storyboard, fps);
  let currentStart = pacing.narrationStart;

  for (let i = 0; i < storyboard.length; i++) {
    const dur = pacing.sceneDurations[i];
    if (frame >= currentStart && frame < currentStart + dur) {
      activeText = storyboard[i].text;
      activeStartFrame = currentStart;
      break;
    }
    currentStart += dur;
  }

  if (!activeText) return null;

  // ===== 孤行標點 sanitize =====
  // AI 偶爾在標點前插 \n（例：「還能玩嗎\n？」），結合 whiteSpace: pre-line 會讓「？」單獨掉到第二行。
  // 把「換行 + 連續空白 + CJK/ASCII 標點」的組合 collapse 回緊貼前字。
  const cleanedText = String(activeText)
    .replace(/\s*\n\s*([？。，！?!,.；：、）」』])/g, '$1')   // \n 在標點前 → 黏回前字
    .replace(/^\s*\n+/, '')                                    // 開頭多餘 \n
    .replace(/\n{3,}/g, '\n\n');                               // 連續 3+ 個 \n 收斂為 2

  const pop = spring({
    frame: frame - activeStartFrame,
    fps,
    config: { stiffness: 300, damping: 15 }
  });

  // ===== Shorts SAFE ZONE 定錨 =====
  // 1080×1920 直式 9:16 在短影音平台上的「安全可讀區」：
  //   · 底部 0~140 px：平台 UI（頻道名 / 字幕條 / handle）— 嚴禁放重要文字
  //   · 底部 140~280 px：右側 like/comment/share 按鈕欄會浮層 — 短文字勉強可放
  //   · 底部 280~600 px：⭐ SAFE ZONE，眼動最舒服、無 UI 遮擋 — 字幕主場
  //   · 中間 600~1300 px：給 splash + stat 模組
  //   · 頂部 0~280 px：給版本號徽章 + 英雄名 hero label
  // 字幕貼底（過去 80 px）會被平台 UI 蓋掉一半，且觀眾低頭看手機底部會眼睛酸。
  // 改 bottom: 420 px（約 22%，落在 SAFE ZONE 中段）— 視線居中、無遮擋、與上方 stat 模組仍保留 ~11% gap。
  // maxHeight 從 30% → 22%（≈ 422 px）：對齊「最多 2 行字幕」的 prompt rule，多出來會 clip 不會穿幫。
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 1000 }}>
      <div style={{
        position: 'absolute',
        left: '5%',
        right: '5%',
        bottom: 420,                 // ⬆️ 從 80 → 420 px（≈22%），進入 Shorts safe zone
        maxHeight: '16%',            // 對齊 Plan 2 prompt rule：最多 2 行字幕 ≈ 200px；16% = 307px 給 padding 與 spring overshoot 餘裕，
                                      // 同時當 AI 偶爾噴 3+ 行時 clip 在 307px 內，與 stat 模組（top 18% 底邊 ~57%）保留 ~5% gap
        overflow: 'hidden',
        textAlign: 'center',
        padding: '20px 40px',
        background: 'none',
        transform: `scale(${interpolate(pop, [0, 1], [0.9, 1])}) translateY(${interpolate(pop, [0, 1], [20, 0])}px)`,
        transformOrigin: 'center bottom',
        opacity: interpolate(pop, [0, 1], [0, 1])
      }}>
        <h2 style={{
          fontSize: 60,
          fontFamily: "'Outfit', 'Noto Sans TC', sans-serif",
          fontWeight: 900,
          color: '#ffffff',
          textShadow: '0 4px 10px rgba(0,0,0,1), 0 8px 30px rgba(0,0,0,0.8), 3px 3px 0 #000, -3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000',
          WebkitTextStroke: '2px black',
          margin: 0,
          lineHeight: 1.3,           // 緊湊行距，多行也不會佔太多垂直空間
          letterSpacing: 2,
          // 排版規則：
          //   - whiteSpace: pre-line  保留 AI 寫的 \n 硬斷行，但不保留多餘空白
          //   - 移除 textWrap: balance — 它會把 4 行字進一步亂分配；現在只信任 AI 的 \n
          //   - wordBreak: keep-all   保護中文專有名詞 / CJK 不從詞中斷開
          //   - overflowWrap: anywhere 給超長英文字 fallback
          whiteSpace: 'pre-line',
          wordBreak: 'keep-all',
          overflowWrap: 'anywhere',
        }}>
          {/* Highlight numbers or specific keywords */}
          {cleanedText.split(/(T1|[0-9.]+%?|強攻|勝率)/).map((part, i) => {
            if (part.match(/(T1|[0-9.]+%?|強攻|勝率)/)) {
              return <span key={i} style={{ color: '#F0E6D2', textShadow: '0 0 20px rgba(200,170,110,0.8)' }}>{part}</span>;
            }
            return part;
          })}
        </h2>
      </div>
    </AbsoluteFill>
  );
};
