const DEFAULT_ESPORTS_CONFIG = {
  activeMode: process.env.ESPORTS_ACTIVE_MODE || "auto",
  maxDailySeries: 2,
  regularLeagues: ["LCK", "LPL"],
  regularOverrideThreshold: 15,
  scoringWeights: {
    importance: 0.4,
    traffic: 0.35,
    anomaly: 0.25,
  },
  tournamentFilters: {
    regular: ["LCK", "LPL"],
    msi: ["MSI", "Mid-Season Invitational"],
    worlds: ["Worlds", "World Championship"],
  },
  modeWindows: [],
  hotTeams: {},
  hotPlayers: {},
};

const MODE_LEAGUES = {
  regular: ["LCK", "LPL"],
  msi: ["MSI"],
  worlds: ["Worlds"],
};

function normalizeMode(value = "auto") {
  const mode = String(value || "auto").trim().toLowerCase();
  if (mode === "world" || mode === "world championship" || mode === "worlds") return "worlds";
  if (mode === "mid-season invitational") return "msi";
  if (["regular", "msi", "worlds", "auto"].includes(mode)) return mode;
  return "auto";
}

function mergeEsportsConfig(config = {}) {
  return {
    ...DEFAULT_ESPORTS_CONFIG,
    ...config,
    scoringWeights: {
      ...DEFAULT_ESPORTS_CONFIG.scoringWeights,
      ...(config.scoringWeights || {}),
    },
    tournamentFilters: {
      ...DEFAULT_ESPORTS_CONFIG.tournamentFilters,
      ...(config.tournamentFilters || {}),
    },
    hotTeams: {
      ...DEFAULT_ESPORTS_CONFIG.hotTeams,
      ...(config.hotTeams || {}),
    },
    hotPlayers: {
      ...DEFAULT_ESPORTS_CONFIG.hotPlayers,
      ...(config.hotPlayers || {}),
    },
  };
}

function isWithinWindow(now, windowConfig = {}) {
  const start = windowConfig.start ? new Date(windowConfig.start) : null;
  const end = windowConfig.end ? new Date(windowConfig.end) : null;
  if (start && now < start) return false;
  if (end && now > end) return false;
  return Boolean(start || end);
}

function detectAutoMode(config, now) {
  const windows = Array.isArray(config.modeWindows) ? config.modeWindows : [];
  const activeWindow = windows.find((windowConfig) => isWithinWindow(now, windowConfig));
  return normalizeMode(activeWindow?.mode || "regular");
}

function resolveActiveMode(configInput = {}, nowInput = new Date()) {
  const config = mergeEsportsConfig(configInput);
  const now = nowInput instanceof Date ? nowInput : new Date(nowInput);
  const requestedMode = normalizeMode(config.activeMode);
  const mode = requestedMode === "auto" ? detectAutoMode(config, now) : requestedMode;
  const source = requestedMode === "auto" ? "auto" : "manual";
  const leagues = mode === "regular" ? [...(config.regularLeagues || MODE_LEAGUES.regular)] : [...(MODE_LEAGUES[mode] || MODE_LEAGUES.regular)];

  return {
    mode,
    source,
    leagues,
    tournaments: [...(config.tournamentFilters?.[mode] || leagues)],
  };
}

module.exports = {
  DEFAULT_ESPORTS_CONFIG,
  mergeEsportsConfig,
  normalizeMode,
  resolveActiveMode,
};
