import React from "react";
import { AbsoluteFill } from "remotion";
import { Template_BalanceUpdate } from "./templates/Template_BalanceUpdate";
import { Template_PlayerRadar } from "./templates/Template_PlayerRadar";
import { Template_EsportsHeadToHeadRadar, Template_EsportsMatchRecap } from "./templates/Template_EsportsDaily";
import { Template_ItemUpdateSequence } from "./templates/Template_ItemUpdate";
import { Template_MetaOffmeta } from "./templates/Template_MetaOffmeta";
import { Template_MetaTierRanking } from "./templates/Template_MetaTierRanking";

// ========== 動態節奏運算 (Audio-Driven Pacing) ==========
// 字幕 / 視覺節奏推導：節奏只由 storyboard text 與 tag 決定。
//
// SHORTS 加速：SKILL_SHOWCASE 分鏡的「視覺停留 padding」（不是音訊本身）砍 20%。
// - 字數 fallback 路徑：basePadding 從 1.5s → 0.8s
// 其他標籤（HOOK / OUTRO / CTA / COMMUNITY_BUZZ / TIER_x）維持原節奏，戲劇感不能砍。
export const calculatePacing = (storyboard, fps) => {
  const narrationStart = 35;
  const basePaddingDefault = fps * 1.5;     // 一般分鏡播報完，畫面停留 1.5 秒
  const basePaddingFast = fps * 0.8;        // ← SKILL_SHOWCASE 0.8 秒，快節奏
  const charsPerSec = 5;

  const sceneDurations = storyboard.map(s => {
    if (s.durationInFrames) return s.durationInFrames;
    const isFast = s.tag === "SKILL_SHOWCASE";

    const chars = s.text ? s.text.length : 5;
    let dur = Math.floor((chars / charsPerSec) * fps) + (isFast ? basePaddingFast : basePaddingDefault);
    if (s.tag === "CONCLUSION_CTA") {
      dur += fps * 2.5;
    }
    return dur;
  });

  const totalFrames = narrationStart + sceneDurations.reduce((a, b) => a + b, 0);
  return { narrationStart, sceneDurations, totalFrames };
};

// ========== 主路由組件 ==========
export const PatchVideo = ({ data }) => {
  const dataType = data.dataType || "PATCH";
  const targetType = String(data.targetType || data.entityType || data.category || "").toUpperCase();
  const isItemRuneUpdate =
    dataType === "ITEM_UPDATE" ||
    dataType === "RUNE_UPDATE" ||
    targetType === "ITEM" ||
    targetType === "ITEMS" ||
    targetType === "RUNE" ||
    targetType === "RUNES" ||
    Boolean(data.itemName || data.runeName);

  console.log(`🎬 [Router] 渲染模式: ${dataType}`);

  return (
    <AbsoluteFill style={{ backgroundColor: "#050A0E" }}>
      {isItemRuneUpdate ? (
        <Template_ItemUpdateSequence data={data} />
      ) : dataType === "PLAYER_RADAR" ? (
        <Template_PlayerRadar data={data} />
      ) : dataType === "ESPORTS_H2H_RADAR" ? (
        <Template_EsportsHeadToHeadRadar data={data} />
      ) : dataType === "ESPORTS_MATCH_RECAP" ? (
        <Template_EsportsMatchRecap data={data} />
      ) : dataType === "META_OFFMETA_PICK" ? (
        <Template_MetaOffmeta data={data} />
      ) : dataType === "META_TIER_RANKING" ? (
        <Template_MetaTierRanking data={data} />
      ) : (
        <Template_BalanceUpdate data={data} />
      )}
    </AbsoluteFill>
  );
};
