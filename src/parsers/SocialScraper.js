async function fetchCommunityComments(championName) {
  console.log(`📡 [SocialScraper] 嘗試讀取 ${championName} 社群討論資料...`);

  if (process.env.ALLOW_MOCK_DATA === "true") {
    return [
      { source: "Mock", originalText: `${championName} 的改動正在引發討論。`, upvotes: 0, mock: true },
    ];
  }

  console.warn("⚠️ [SocialScraper] 尚未設定真實社群資料源，回傳空陣列。");
  return [];
}

module.exports = { fetchCommunityComments };
