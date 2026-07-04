const axios = require('axios');

async function getVisualAsset(championName, skillLetter) {
    console.log(`🕵️‍♂️ [系統] Asset Hub 啟動：尋找 ${championName} 的素材...`);
    
    try {
        const vRes = await axios.get('https://ddragon.leagueoflegends.com/api/versions.json');
        const latestVersion = vRes.data[0];
        
        const cRes = await axios.get(`https://ddragon.leagueoflegends.com/cdn/${latestVersion}/data/en_US/champion.json`);
        const champs = cRes.data.data;
        
        let targetId = null;
        let targetKey = null;
        
        for (let id in champs) {
             if (champs[id].name === championName) {
                 targetId = id; 
                 targetKey = champs[id].key; 
                 break;
             }
        }

        if (!targetId) return { url: "", type: "error" };

        // 英雄頭像 (Square Icon) 網址
        const heroIconUrl = `https://ddragon.leagueoflegends.com/cdn/${latestVersion}/img/champion/${targetId}.png`;
        const splashUrl = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${targetId}_0.jpg`;
        
        const padKey = targetKey.padStart(4, '0');
        const skillKey = skillLetter.toUpperCase();
        const videoUrlWebm = `https://d28xe8vt774jo5.cloudfront.net/champion-abilities/${padKey}/ability_${padKey}_${skillKey}1.webm`;
        const videoUrlMp4 = `https://d28xe8vt774jo5.cloudfront.net/champion-abilities/${padKey}/ability_${padKey}_${skillKey}1.mp4`;

        let finalVideoUrl = "";
        try {
            await axios.head(videoUrlWebm);
            finalVideoUrl = videoUrlWebm;
        } catch (e) {
            try {
                await axios.head(videoUrlMp4);
                finalVideoUrl = videoUrlMp4;
            } catch (e2) {
                finalVideoUrl = splashUrl;
            }
        }

        // ===== 完整 skillIcons map：Q / W / E / R / P + BASE_xxx =====
        // 每個 SKILL_SHOWCASE 分鏡可能在講不同技能（Q 增強 + E 削弱），
        // 回傳完整 map 後 Template 端就能依 storyboard scene 的 skillKey 逐幀切換正確 icon，
        // 不再永遠顯示同一張 icon。
        // BASE_xxx 走 ddragon 經典基礎裝備 icon（Long Sword、Cloth Armor 等），讓 BASE 數值
        // 改動的分鏡不會用到技能圖。
        const itemIcon = (id) => `https://ddragon.leagueoflegends.com/cdn/${latestVersion}/img/item/${id}.png`;
        const skillIcons = {
            BASE: itemIcon('1037'),         // Long Sword — 通用基礎攻擊
            BASE_AD: itemIcon('1037'),      // Long Sword
            BASE_DAMAGE: itemIcon('1037'),  // alias for BASE_AD
            BASE_AP: itemIcon('1052'),      // Amplifying Tome
            BASE_ARMOR: itemIcon('1029'),   // Cloth Armor
            BASE_MR: itemIcon('1033'),      // Null-Magic Mantle
            BASE_HP: itemIcon('1028'),      // Ruby Crystal
            BASE_HEALTH: itemIcon('1028'),  // alias for BASE_HP
            BASE_AS: itemIcon('1042'),      // Dagger
            BASE_MANA: itemIcon('1004'),    // Faerie Charm
            BASE_MS: itemIcon('1001'),      // Boots
        };
        let skillIconUrl = "";
        try {
            const detailRes = await axios.get(`https://ddragon.leagueoflegends.com/cdn/${latestVersion}/data/en_US/champion/${targetId}.json`);
            const champData = detailRes.data.data[targetId];

            // P：被動
            if (champData.passive && champData.passive.image && champData.passive.image.full) {
                skillIcons.P = `https://ddragon.leagueoflegends.com/cdn/${latestVersion}/img/passive/${champData.passive.image.full}`;
            }
            // Q/W/E/R：四個主動技能
            if (Array.isArray(champData.spells)) {
                ["Q", "W", "E", "R"].forEach((k, idx) => {
                    const sp = champData.spells[idx];
                    if (sp && sp.image && sp.image.full) {
                        skillIcons[k] = `https://ddragon.leagueoflegends.com/cdn/${latestVersion}/img/spell/${sp.image.full}`;
                    }
                });
            }

            // 沿用回傳：選定 skillLetter 對應的 icon 仍存到 skillIconUrl，避免破壞既有 caller
            const requested = (skillLetter || "").toUpperCase();
            skillIconUrl = skillIcons[requested] || skillIcons.Q || "";
        } catch (e) {
            console.error("❌ 無法取得技能圖示:", e.message);
        }

        return {
            videoUrl: finalVideoUrl,
            heroImageUrl: heroIconUrl,
            splashUrl: splashUrl,
            skillIconUrl: skillIconUrl,
            skillIcons: skillIcons,        // 新：完整 map，給多分鏡 per-scene 切 icon 用
        };
    } catch (error) {
        console.error("❌ [Asset Hub 錯誤]:", error.message);
        return { videoUrl: "", heroImageUrl: "", skillIconUrl: "", skillIcons: {}, type: "error" };
    }
}

module.exports = { getVisualAsset };
