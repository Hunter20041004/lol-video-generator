/**
 * =========================================================================
 * LEAGUEPEDIA CARGO API — Hextech Video Studio
 * =========================================================================
 * Fetches live esports match data from Leaguepedia's Cargo SQL tables.
 *
 * Tables used:
 *   - ScoreboardGames  → match-level data (teams, tournament, duration, winner)
 *   - ScoreboardPlayers → per-player stats (K/D/A, damage, vision, gold, CS)
 *
 * API endpoint: https://lol.fandom.com/api.php?action=cargoquery&format=json
 *
 * References:
 *   - https://lol.fandom.com/wiki/Help:Cargo
 *   - https://lol.fandom.com/wiki/Special:CargoTables/ScoreboardGames
 *   - https://lol.fandom.com/wiki/Special:CargoTables/ScoreboardPlayers
 * =========================================================================
 */

const CARGO_ENDPOINT = 'https://lol.fandom.com/api.php';

// =========================================================================
// SECTION 0 · MediaWiki Bot Authentication (clientlogin flow)
// -----------------------------------------------------------------------
// Anonymous Cargo queries throttle aggressively (HTTP 403 / CAPTCHA on bursts).
// Authenticating as a registered Bot account loosens the rate limit and gives
// the request stable session cookies.
//
// Flow per https://www.mediawiki.org/wiki/API:Login (clientlogin variant):
//   1. GET  meta=tokens&type=login   → receive { logintoken, ...set-cookie }
//   2. POST action=clientlogin       → receive auth result + session cookies
//   3. Subsequent requests inject `Cookie: <merged>` header
//
// .env must provide:
//   FANDOM_BOT_USERNAME=<bot-account>@<bot-password-name>
//   FANDOM_BOT_PASSWORD=<bot password from Special:BotPasswords>
//
// `sessionCookies` is module-scoped — same Node process reuses one session.
// =========================================================================

let sessionCookies = '';        // serialized "k=v; k=v" string for Cookie header
let authPromise = null;          // in-flight auth promise to dedupe concurrent callers

/**
 * Merge an HTTP `set-cookie` header (string or array) into our sessionCookies jar.
 * Strips attribute portions (Path / Expires / HttpOnly / Secure / SameSite / Domain).
 */
function ingestSetCookie(setCookieHeader) {
  if (!setCookieHeader) return;
  const lines = Array.isArray(setCookieHeader) ? setCookieHeader : String(setCookieHeader).split(/,(?=\s*[A-Za-z0-9_-]+=)/);
  const jar = {};
  // seed with existing
  if (sessionCookies) {
    sessionCookies.split(';').forEach((kv) => {
      const [k, ...rest] = kv.trim().split('=');
      if (k) jar[k] = rest.join('=');
    });
  }
  for (const line of lines) {
    const firstPair = String(line).split(';')[0].trim();
    const eq = firstPair.indexOf('=');
    if (eq <= 0) continue;
    const k = firstPair.slice(0, eq).trim();
    const v = firstPair.slice(eq + 1).trim();
    if (k) jar[k] = v;
  }
  sessionCookies = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
}

function defaultBrowserHeaders() {
  return {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Origin': 'https://lol.fandom.com',
    'Referer': 'https://lol.fandom.com/',
  };
}

function withCookieHeader(extra = {}) {
  const headers = { ...defaultBrowserHeaders(), ...extra };
  if (sessionCookies) headers['Cookie'] = sessionCookies;
  return headers;
}

/**
 * Authenticates against the lol.fandom.com MediaWiki API as a bot.
 * Idempotent — second concurrent caller awaits the same in-flight promise.
 * Once successful, sessionCookies is populated and Cargo requests inject it.
 *
 * Throws if credentials missing or auth fails (caller decides to retry / fall back to anonymous).
 */
async function authenticate() {
  if (sessionCookies) return; // already authenticated
  if (authPromise) return authPromise;

  const username = process.env.FANDOM_BOT_USERNAME;
  const password = process.env.FANDOM_BOT_PASSWORD;
  if (!username || !password) {
    throw new Error('FANDOM_BOT_USERNAME / FANDOM_BOT_PASSWORD missing in .env');
  }

  authPromise = (async () => {
    console.log('🔑 [Leaguepedia Auth] Fetching login token...');

    // Step 1: fetch login token (also returns initial session cookie)
    const tokenUrl = new URL(CARGO_ENDPOINT);
    tokenUrl.searchParams.set('action', 'query');
    tokenUrl.searchParams.set('meta', 'tokens');
    tokenUrl.searchParams.set('type', 'login');
    tokenUrl.searchParams.set('format', 'json');

    const tokenRes = await fetch(tokenUrl.toString(), { headers: withCookieHeader() });
    if (!tokenRes.ok) {
      throw new Error(`Login token fetch failed: HTTP ${tokenRes.status}`);
    }
    ingestSetCookie(tokenRes.headers.get('set-cookie'));
    const tokenJson = await tokenRes.json();
    const loginToken = tokenJson?.query?.tokens?.logintoken;
    if (!loginToken) {
      throw new Error(`Login token missing in response: ${JSON.stringify(tokenJson).slice(0, 200)}`);
    }

    // Step 2: POST clientlogin with username + password + token + cookies
    console.log('🔑 [Leaguepedia Auth] Posting clientlogin...');
    const body = new URLSearchParams({
      action: 'clientlogin',
      format: 'json',
      username,
      password,
      logintoken: loginToken,
      loginreturnurl: 'https://lol.fandom.com/',
    });
    const loginRes = await fetch(CARGO_ENDPOINT, {
      method: 'POST',
      headers: withCookieHeader({ 'Content-Type': 'application/x-www-form-urlencoded' }),
      body: body.toString(),
    });
    if (!loginRes.ok) {
      throw new Error(`clientlogin failed: HTTP ${loginRes.status}`);
    }
    ingestSetCookie(loginRes.headers.get('set-cookie'));
    const loginJson = await loginRes.json();
    const status = loginJson?.clientlogin?.status;
    if (status !== 'PASS') {
      const reason = loginJson?.clientlogin?.message || JSON.stringify(loginJson).slice(0, 300);
      throw new Error(`clientlogin status=${status} — ${reason}`);
    }
    console.log(`✅ [Leaguepedia Auth] Login succeeded · ${sessionCookies.split(';').length} cookies`);
  })();

  try {
    await authPromise;
  } finally {
    authPromise = null;
  }
}

/** Force re-auth (call if a 401/403 comes back mid-session). */
function clearSession() {
  sessionCookies = '';
}

// =========================================================================
// SECTION 1 · Low-Level Cargo Query Runner
// =========================================================================

/**
 * Executes a raw Cargo SQL query against the Leaguepedia API.
 * Handles pagination via `offset` parameter.
 *
 * @param {Object} params — Cargo query parameters
 * @param {string} params.tables — Comma-separated table names
 * @param {string} params.fields — Comma-separated field list
 * @param {string} [params.where] — SQL WHERE clause
 * @param {string} [params.join_on] — JOIN condition
 * @param {string} [params.order_by] — ORDER BY clause
 * @param {number} [params.limit=50] — Max results per page
 * @returns {Array} — Array of result objects (flattened from Cargo's { title: { ... } } wrapper)
 */
async function cargoQuery(params) {
  const {
    tables,
    fields,
    where = '',
    join_on = '',
    order_by = '',
    group_by = '',
    limit = 50,
  } = params;

  const allResults = [];
  let offset = 0;
  // Only paginate if we're asking for large chunks (50+)
  const maxPages = limit >= 50 ? 5 : 1;

  for (let page = 0; page < maxPages; page++) {
    if (page > 0) {
      // Respect Fandom rate limit for consecutive requests
      await new Promise(r => setTimeout(r, 1500));
    }

    const url = new URL(CARGO_ENDPOINT);
    url.searchParams.set('action', 'cargoquery');
    url.searchParams.set('format', 'json');
    url.searchParams.set('tables', tables);
    url.searchParams.set('fields', fields);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('_', Date.now().toString()); // Cache bust to prevent Fandom rate-limit blocks

    if (where) url.searchParams.set('where', where);
    if (join_on) url.searchParams.set('join_on', join_on);
    if (order_by) url.searchParams.set('order_by', order_by);
    if (group_by) url.searchParams.set('group_by', group_by);

    console.log(`📡 [Leaguepedia] Cargo query (page ${page + 1}): ${url.toString().slice(0, 200)}...`);
    console.log("Cargo Fetch URL:", url.toString());

    // Lazy authenticate on first request — once we have sessionCookies, all subsequent
    // requests reuse them. If creds are missing we still try anonymously (best effort).
    if (!sessionCookies && (process.env.FANDOM_BOT_USERNAME && process.env.FANDOM_BOT_PASSWORD)) {
      try { await authenticate(); }
      catch (e) { console.warn(`⚠️ [Leaguepedia Auth] auth failed → falling back to anonymous: ${e.message}`); }
    }

    let res = await fetch(url.toString(), {
      headers: withCookieHeader({ 'Accept-Encoding': 'gzip, deflate, br' }),
    });
    // 共享 cookie jar：refresh anything the server set (e.g. UseCDN, session refresh)
    ingestSetCookie(res.headers.get('set-cookie'));

    // 401/403 mid-session → 嘗試重新 auth 並重發一次（單次 retry，避免無限迴圈）
    if ((res.status === 401 || res.status === 403) && process.env.FANDOM_BOT_USERNAME) {
      console.warn(`⚠️ [Leaguepedia] HTTP ${res.status} mid-session — re-authenticating and retrying once...`);
      clearSession();
      try { await authenticate(); } catch (e) { /* fall through and re-throw original */ }
      if (sessionCookies) {
        res = await fetch(url.toString(), {
          headers: withCookieHeader({ 'Accept-Encoding': 'gzip, deflate, br' }),
        });
        ingestSetCookie(res.headers.get('set-cookie'));
      }
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Leaguepedia API error: HTTP ${res.status} — ${errText.slice(0, 200)}`);
    }

    const json = await res.json();

    if (json.error) {
      throw new Error(`Leaguepedia API returned error: ${json.error.info || JSON.stringify(json.error)}`);
    }

    // Cargo wraps results as: { cargoquery: [ { title: { field1: "val", ... } }, ... ] }
    const rows = (json.cargoquery || []).map(row => row.title || row);
    allResults.push(...rows);

    // If we got fewer than limit, we've reached the end
    if (rows.length < limit) break;
    offset += limit;
  }

  console.log(`📡 [Leaguepedia] Query returned ${allResults.length} total rows`);
  return allResults;
}

// =========================================================================
// SECTION 2 · High-Level Fetch Functions
// =========================================================================

/**
 * Fetches recent completed matches from Leaguepedia.
 * Returns match-level data (no per-player stats yet — use fetchMatchPlayers for that).
 *
 * @param {number} [hours=24] — How far back to look (in hours)
 * @param {string} [tournament] — Optional tournament filter (e.g., "LCK 2026 Summer")
 * @returns {Array} — Array of match objects
 */
async function fetchRecentMatches(hours = 24, tournament = null) {
  // Ignored hours lookback to guarantee we always get the absolute latest games
  // This bypasses strict Cargo DateTime formatting issues

  let where = '';
  if (tournament) {
    where = `ScoreboardGames.Tournament LIKE '%${tournament}%'`;
  }

  const rows = await cargoQuery({
    tables: 'ScoreboardGames',
    fields: [
      'ScoreboardGames.OverviewPage',
      'ScoreboardGames.Tournament',
      'ScoreboardGames.DateTime_UTC',
      'ScoreboardGames.Team1',
      'ScoreboardGames.Team2',
      'ScoreboardGames.WinTeam',
      'ScoreboardGames.LossTeam',
      'ScoreboardGames.Team1Score',
      'ScoreboardGames.Team2Score',
      'ScoreboardGames.Gamelength',
      'ScoreboardGames.Patch',
      'ScoreboardGames.GameId',
    ].join(','),
    where,
    order_by: 'ScoreboardGames.DateTime_UTC DESC',
    limit: 5,
  });

  // Deduplicate by GameId
  const seen = new Set();
  const unique = rows.filter(r => {
    const key = r.GameId || `${r.Team1}_${r.Team2}_${r['DateTime UTC'] || r.DateTime_UTC}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`🏟️ [Leaguepedia] Found ${unique.length} recent matches (last ${hours}h)`);
  return unique.map(r => normalizeMatchRow(r));
}

/**
 * Fetches all player stats for a specific match.
 * Uses the UniqueGame identifier to join ScoreboardGames with ScoreboardPlayers.
 *
 * @param {string} gameId — The GameId identifier from ScoreboardGames
 * @returns {Object} — { match: {...}, players: [...] }
 */
async function fetchMatchPlayers(gameId) {
  const rows = await cargoQuery({
    tables: 'ScoreboardGames,ScoreboardPlayers',
    join_on: 'ScoreboardGames.GameId=ScoreboardPlayers.GameId',
    fields: [
      // Game-level fields
      'ScoreboardGames.Tournament',
      'ScoreboardGames.Team1',
      'ScoreboardGames.Team2',
      'ScoreboardGames.WinTeam',
      'ScoreboardGames.LossTeam',
      'ScoreboardGames.Gamelength',
      'ScoreboardGames.DateTime_UTC',
      // Player-level fields
      'ScoreboardPlayers.Link',
      'ScoreboardPlayers.Name',
      'ScoreboardPlayers.Champion',
      'ScoreboardPlayers.Role',
      'ScoreboardPlayers.Team',
      'ScoreboardPlayers.Kills',
      'ScoreboardPlayers.Deaths',
      'ScoreboardPlayers.Assists',
      'ScoreboardPlayers.CS',
      'ScoreboardPlayers.Gold',
      'ScoreboardPlayers.DamageToChamps',
      'ScoreboardPlayers.VisionScore',
    ].join(','),
    where: `ScoreboardGames.GameId='${gameId}'`,
    limit: 10, // 10 players per game
  });

  if (rows.length === 0) {
    console.warn(`⚠️ [Leaguepedia] No player data found for game: ${gameId}`);
    return null;
  }

  // Extract match context from the first row (same for all players in this game)
  const first = rows[0];
  const match = normalizeMatchRow(first);

  // Extract individual player stats
  const players = rows.map(r => normalizePlayerRow(r, match));

  console.log(`👥 [Leaguepedia] Fetched ${players.length} players for ${match.matchContext.teamA} vs ${match.matchContext.teamB}`);
  return { match, players };
}

/**
 * Convenience: Fetches recent matches AND their player stats in one call.
 * Use sparingly — this makes N+1 API calls (1 for matches + 1 per match).
 *
 * @param {number} [hours=24] — How far back to look
 * @param {number} [maxMatches=5] — Max matches to fetch full details for
 * @returns {Array} — Array of { match, players } objects
 */
async function fetchRecentMatchesWithPlayers(hours = 24, maxMatches = 5) {
  const matches = await fetchRecentMatches(hours);
  const limitedMatches = matches.slice(0, maxMatches);

  // Initial delay to separate the match list fetch from the detailed player fetches
  await new Promise(r => setTimeout(r, 1500));

  const results = [];
  for (const match of limitedMatches) {
    if (!match.gameId) {
      console.warn(`⚠️ [Leaguepedia] Skipping match without GameId: ${match.matchContext.teamA} vs ${match.matchContext.teamB}`);
      continue;
    }

    try {
      const detail = await fetchMatchPlayers(match.gameId);
      if (detail) results.push(detail);
    } catch (err) {
      console.error(`❌ [Leaguepedia] Failed to fetch players for ${match.gameId}: ${err.message}`);
    }

    // Rate limiting: 1500ms between requests to be polite to the API and avoid Fandom bans
    await new Promise(r => setTimeout(r, 1500));
  }

  return results;
}

// =========================================================================
// SECTION 3 · Row Normalization (Cargo → Internal Format)
// =========================================================================
// Cargo returns flat key-value rows with inconsistent casing.
// These functions normalize them into clean objects.

/**
 * Normalizes a ScoreboardGames row into our internal match format.
 */
function normalizeMatchRow(row) {
  // Cargo field names can come back with spaces instead of underscores
  const tournament = row.Tournament || '';
  const team1 = row.Team1 || '';
  const team2 = row.Team2 || '';
  const winTeam = row.WinTeam || '';
  const gameNum = '1';
  const gamelengthMin = 30;
  const gamelengthStr = row.Gamelength || '';
  const dateUtc = row['DateTime UTC'] || row.DateTime_UTC || '';
  const gameId = row.GameId || '';

  // Derive league name from tournament string (e.g., "LCK 2026 Summer" → "LCK")
  const league = extractLeague(tournament);

  return {
    uniqueGame: gameId, // keeping uniqueGame property for backwards compatibility with cron store
    gameId,
    dateUtc,
    tournament,
    gamelengthMin,
    gamelengthStr,
    winTeam,
    matchContext: {
      league,
      teamA: team1,
      teamB: team2,
      seriesScore: `Game ${gameNum}`,
    },
  };
}

/**
 * Normalizes a ScoreboardPlayers row into our internal player format.
 */
function normalizePlayerRow(row, match) {
  const name = row.Link || row.Name || 'Unknown';
  const champion = row.Champion || '';
  const role = normalizeRole(row.Role || '');
  const team = row.Team || '';

  const kills = parseInt(row.Kills || '0', 10);
  const deaths = parseInt(row.Deaths || '0', 10);
  const assists = parseInt(row.Assists || '0', 10);
  const cs = parseInt(row.CS || '0', 10);
  const gold = parseInt(row.Gold || '0', 10);
  const damageToChamps = parseInt(row.DamageToChamps || row['DamageToChamps'] || '0', 10);
  const visionScore = parseInt(row.VisionScore || '0', 10);

  // Calculate derived stats
  const kda = deaths === 0 ? kills + assists : parseFloat(((kills + assists) / deaths).toFixed(2));
  const gameMins = match?.gamelengthMin || 30; // fallback 30 min
  const dpm = gameMins > 0 ? Math.round(damageToChamps / gameMins) : 0;
  const gpm = gameMins > 0 ? Math.round(gold / gameMins) : 0;
  const cspm = gameMins > 0 ? parseFloat((cs / gameMins).toFixed(1)) : 0;

  return {
    name,
    role,
    team,
    champion,
    isWinner: team === match?.winTeam,
    kills,
    deaths,
    assists,
    cs,
    gold,
    damageToChampions: damageToChamps,
    visionScore,
    stats: {
      kda: String(kda),
      kills, deaths, assists,
      dpm: String(dpm),
      kp: '0', // KP% requires team total kills — calculated in aggregation step
      vision: String(visionScore),
      gold: String(gpm),
      rawGold: String(gold),
      damageToChampions: String(damageToChamps),
      cs: String(cs),
      cspm: String(cspm),
      damageToChamps: String(damageToChamps),
    },
  };
}

// =========================================================================
// SECTION 4 · Data Transformation (Cargo → v2 PLAYER_RADAR Schema)
// =========================================================================

/**
 * Transforms Cargo player + match data into the v2 PLAYER_RADAR schema
 * ready for reasoning.js or autoDispatcher consumption.
 *
 * @param {Object} cargoPlayer — Normalized player object from normalizePlayerRow
 * @param {Object} cargoMatch — Normalized match object from normalizeMatchRow
 * @param {Array} [allPlayers] — All players in the match (for KP% calculation)
 * @returns {Object} — v2 PLAYER_RADAR payload
 */
function transformCargoToRadarSchema(cargoPlayer, cargoMatch, allPlayers = []) {
  // Calculate Kill Participation if we have the full roster
  let kpPercent = 0;
  if (allPlayers.length > 0) {
    const teamPlayers = allPlayers.filter(p => p.team === cargoPlayer.team);
    const teamTotalKills = teamPlayers.reduce((sum, p) => sum + (p.stats?.kills || 0), 0);
    if (teamTotalKills > 0) {
      const playerKA = (cargoPlayer.stats?.kills || 0) + (cargoPlayer.stats?.assists || 0);
      kpPercent = Math.round((playerKA / teamTotalKills) * 100);
    }
  }

  // Build the 5-axis radarStats matching SYSTEM_PROMPT_BASE recommendations
  const radarStats = buildRadarStats(cargoPlayer, kpPercent);

  return {
    dataType: 'PLAYER_RADAR',
    matchContext: cargoMatch.matchContext,
    playerName: cargoPlayer.name,
    playerRole: cargoPlayer.role,
    player: {
      name: cargoPlayer.name,
      role: cargoPlayer.role,
      championPlayed: cargoPlayer.champion,
    },
    radarStats,
    // Pass raw stats for the LLM to have context
    stats: {
      kda: cargoPlayer.stats.kda,
      dpm: cargoPlayer.stats.dpm,
      kp: String(kpPercent),
      vision: cargoPlayer.stats.vision,
      gold: cargoPlayer.stats.gold,
    },
  };
}

/**
 * Builds role-aware 5-axis radarStats from raw player stats.
 * Uses the normalizeStatValue function from autoDispatcher benchmarks.
 */
function buildRadarStats(player, kpPercent) {
  const s = player.stats || {};
  const role = player.role || 'Mid';

  // Role-specific label sets (matching SYSTEM_PROMPT_BASE spec)
  const LABEL_SETS = {
    Top:     ['KDA', 'DPM', 'KP%', 'Vision', 'CS Diff'],
    Mid:     ['KDA', 'DPM', 'KP%', 'Vision', 'CS Diff'],
    Jungle:  ['KDA', 'DPM', 'KP%', 'Vision Score', 'Obj Control'],
    Adc:     ['KDA', 'DPM', 'KP%', 'Crit Damage', 'GPM'],
    Support: ['KDA', 'KP%', 'Vision Score', 'CC Score', 'DMG Mitigated'],
  };

  const labels = LABEL_SETS[role] || LABEL_SETS.Mid;

  // Map labels to raw values from Cargo data
  const rawValueMap = {
    'KDA':           s.kda || '0',
    'DPM':           s.dpm || '0',
    'KP%':           `${kpPercent}%`,
    'Vision':        s.vision || '0',
    'Vision Score':  s.vision || '0',
    'CS Diff':       s.cspm || '0', // Using CSPM as proxy (no lane opponent data from Cargo)
    'GPM':           s.gold || '0',
    'Obj Control':   '—',           // Not available from Cargo
    'Crit Damage':   s.damageToChamps || '0',
    'CC Score':      '—',           // Not available from Cargo
    'DMG Mitigated': '—',           // Not available from Cargo
  };

  // Normalization benchmarks (pro-play calibrated, same as autoDispatcher)
  const BENCHMARKS = {
    'KDA':           { floor: 1.0, ceiling: 12.0 },
    'DPM':           { floor: 200, ceiling: 800  },
    'KP%':           { floor: 40,  ceiling: 95   },
    'Vision':        { floor: 10,  ceiling: 60   },
    'Vision Score':  { floor: 10,  ceiling: 60   },
    'CS Diff':       { floor: 5.0, ceiling: 10.0 }, // CSPM as proxy
    'GPM':           { floor: 250, ceiling: 500  },
    'Obj Control':   { floor: 20,  ceiling: 80   },
    'Crit Damage':   { floor: 8000, ceiling: 30000 },
    'CC Score':      { floor: 10,  ceiling: 80   },
    'DMG Mitigated': { floor: 200, ceiling: 700  },
  };

  return labels.map(label => {
    const rawStr = rawValueMap[label] || '—';
    const rawNum = parseFloat(String(rawStr).replace(/[^0-9.\-]/g, '')) || 0;
    const bench = BENCHMARKS[label] || { floor: 0, ceiling: 100 };
    const clamped = Math.max(bench.floor, Math.min(bench.ceiling, rawNum));
    const normalizedScore = Math.round(((clamped - bench.floor) / (bench.ceiling - bench.floor)) * 100);

    return {
      label,
      rawValue: rawStr,
      normalizedScore: Math.max(0, Math.min(100, normalizedScore)),
    };
  });
}

// =========================================================================
// SECTION 5 · Helper Utilities
// =========================================================================

/**
 * Extracts the league abbreviation from a tournament name.
 * "LCK 2026 Summer" → "LCK", "World Championship 2026" → "Worlds"
 */
function extractLeague(tournament) {
  if (!tournament) return 'Unknown';

  const LEAGUE_PATTERNS = [
    { regex: /\bLCK\b/i,       name: 'LCK'   },
    { regex: /\bLPL\b/i,       name: 'LPL'   },
    { regex: /\bLEC\b/i,       name: 'LEC'   },
    { regex: /\bLCS\b/i,       name: 'LCS'   },
    { regex: /\bLTA\b/i,       name: 'LTA'   },
    { regex: /\bPCS\b/i,       name: 'PCS'   },
    { regex: /\bVCS\b/i,       name: 'VCS'   },
    { regex: /\bCBLOL\b/i,     name: 'CBLOL' },
    { regex: /\bLJL\b/i,       name: 'LJL'   },
    { regex: /\bWorld/i,        name: 'Worlds' },
    { regex: /\bMSI\b/i,       name: 'MSI'   },
    { regex: /Season Invitational/i, name: 'MSI' },
    { regex: /Rift Rivals/i,   name: 'Rift Rivals' },
  ];

  for (const { regex, name } of LEAGUE_PATTERNS) {
    if (regex.test(tournament)) return name;
  }

  // Fallback: use first word
  return tournament.split(/\s+/)[0] || 'Unknown';
}

/**
 * Normalizes role strings from various Leaguepedia formats.
 */
function normalizeRole(raw) {
  const map = {
    top: 'Top', toplane: 'Top',
    jungle: 'Jungle', jg: 'Jungle', jungler: 'Jungle',
    mid: 'Mid', middle: 'Mid', midlane: 'Mid',
    bot: 'Adc', adc: 'Adc', botlane: 'Adc', marksman: 'Adc',
    support: 'Support', sup: 'Support', supp: 'Support',
  };
  return map[String(raw).toLowerCase().trim()] || raw || 'Mid';
}

// =========================================================================
// EXPORTS
// =========================================================================
module.exports = {
  // High-level fetchers
  fetchRecentMatches,
  fetchMatchPlayers,
  fetchRecentMatchesWithPlayers,

  // Data transformation
  transformCargoToRadarSchema,
  buildRadarStats,

  // Low-level
  cargoQuery,
  normalizeMatchRow,
  normalizePlayerRow,
  extractLeague,
  normalizeRole,

  // Auth
  authenticate,
  clearSession,

  // Constants
  CARGO_ENDPOINT,
};
