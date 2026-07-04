const { scrapePatchData } = require('./src/parsers/PatchDataParser');

/**
 * 為了向下相容而保留的代理文件 (Compatibility Proxy)
 * 將原本的 scrapeAllChanges 映射到新的 scrapePatchData
 */
async function scrapeAllChanges() {
  console.log("🔄 [相容層] 正在將舊版 scrapeAllChanges 請求轉發至新版 PatchDataParser...");
  return await scrapePatchData();
}

module.exports = { scrapeAllChanges };
