const DAY_MS = 86400000;

function parseDateRange(startDate, endDate) {
  const times = [startDate, endDate].map((date) => {
    const time = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? Date.parse(`${date}T00:00:00Z`) : NaN;
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === date ? time : NaN;
  });
  if (times.some((time) => !Number.isFinite(time)) || times[1] < times[0] || (times[1] - times[0]) / DAY_MS >= 31) {
    throw Object.assign(new Error("請選擇有效的開始與結束日期；結束日不得早於開始日，區間最多 31 天（包含首尾日）。"), { code: "ESPORTS_DATE_RANGE_INVALID" });
  }
  const dates = [];
  for (let time = times[0]; time <= times[1]; time += DAY_MS) {
    dates.push(new Date(time).toISOString().slice(0, 10));
  }
  return { startDate, endDate, dates };
}

module.exports = { parseDateRange };
