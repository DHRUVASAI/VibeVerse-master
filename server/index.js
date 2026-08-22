const express = require('express');
const fetch = require('node-fetch');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const cache = new NodeCache({ stdTTL: 60 * 60 });

// Optional Redis
let redisClient = null;
try {
  const REDIS_URL = process.env.REDIS_URL || null;
  const REDIS_HOST = process.env.REDIS_HOST || null;
  if (REDIS_URL || REDIS_HOST) {
    const IORedis = require('ioredis');
    redisClient = REDIS_URL ? new IORedis(REDIS_URL) : new IORedis({ host: REDIS_HOST, port: process.env.REDIS_PORT || 6379 });
    redisClient.on('error', (e) => console.warn('Redis error', e.message));
    console.log('Redis cache active');
  }
} catch (err) {
  console.warn('Redis not available:', err && err.message);
}

const PORT = process.env.PORT || 5000;

try {
  const cors = require('cors');
  app.use(cors());
} catch (e) {
  console.warn('cors not installed');
}

const limiter = rateLimit({ windowMs: 60 * 1000, max: 120 });
app.use(limiter);
app.use(express.json());
app.use(express.static('public'));

// ─────────────────────────────────────────────────────────────────────────────
// MOOD RELEVANCE SCORING ENGINE
// This is the core recommendation logic that was previously missing.
//
// Each mood has:
//   primaryGenres   — genre IDs that MUST appear (highest weight)
//   bonusGenres     — genre IDs that add bonus relevance score
//   excludeGenres   — genre IDs that reduce score (wrong vibe)
//   keywordBoosts   — words in the title/overview that boost score
//   minRating       — floor rating for this mood
//   preferRecent    — whether newer movies score higher
// ─────────────────────────────────────────────────────────────────────────────
const MOOD_SCORING = {
  Happy: {
    primaryGenres: [35, 10751],          // Comedy, Family
    bonusGenres:   [10749, 16],          // Romance, Animation
    excludeGenres: [27, 53, 9648],       // Horror, Thriller, Mystery
    keywordBoosts: ['fun', 'joy', 'laugh', 'cheerful', 'upbeat', 'comedy', 'family', 'feel-good'],
    minRating: 5.5,
    preferRecent: true,
  },
  Romantic: {
    primaryGenres: [10749, 18],          // Romance, Drama
    bonusGenres:   [35, 10751],          // Comedy, Family
    excludeGenres: [27, 28, 53],         // Horror, Action, Thriller
    keywordBoosts: ['love', 'romance', 'heart', 'passion', 'couple', 'wedding', 'kiss'],
    minRating: 5.5,
    preferRecent: false,
  },
  Sad: {
    primaryGenres: [18, 10749],          // Drama, Romance
    bonusGenres:   [10751, 36],          // Family, History
    excludeGenres: [28, 35, 27],         // Action, Comedy, Horror
    keywordBoosts: ['loss', 'grief', 'tragedy', 'emotional', 'tears', 'heartbreak', 'death'],
    minRating: 6.0,
    preferRecent: false,
  },
  Comedy: {
    primaryGenres: [35],                 // Comedy only
    bonusGenres:   [10751, 10749],       // Family, Romance
    excludeGenres: [27, 53, 9648, 80],   // Horror, Thriller, Mystery, Crime
    keywordBoosts: ['funny', 'humor', 'hilarious', 'laugh', 'comic', 'wit', 'parody'],
    minRating: 5.5,
    preferRecent: true,
  },
  Action: {
    primaryGenres: [28, 12],             // Action, Adventure
    bonusGenres:   [878, 53],            // Sci-Fi, Thriller
    excludeGenres: [10749, 35, 10751],   // Romance, Comedy, Family
    keywordBoosts: ['battle', 'fight', 'explosive', 'war', 'combat', 'hero', 'mission', 'chase'],
    minRating: 6.0,
    preferRecent: true,
  },
  Thriller: {
    primaryGenres: [53, 80, 9648],       // Thriller, Crime, Mystery
    bonusGenres:   [18, 28],             // Drama, Action
    excludeGenres: [35, 10751, 16],      // Comedy, Family, Animation
    keywordBoosts: ['suspense', 'twist', 'killer', 'detective', 'conspiracy', 'spy', 'heist'],
    minRating: 6.0,
    preferRecent: false,
  },
  Horror: {
    primaryGenres: [27],                 // Horror only
    bonusGenres:   [9648, 53],           // Mystery, Thriller
    excludeGenres: [10749, 35, 10751],   // Romance, Comedy, Family
    keywordBoosts: ['ghost', 'demon', 'haunted', 'monster', 'supernatural', 'fear', 'curse'],
    minRating: 5.5,
    preferRecent: true,
  },
  'Sci-Fi': {
    primaryGenres: [878, 12],            // Sci-Fi, Adventure
    bonusGenres:   [28, 9648],           // Action, Mystery
    excludeGenres: [10749, 35, 10751],   // Romance, Comedy, Family
    keywordBoosts: ['space', 'alien', 'robot', 'future', 'technology', 'galaxy', 'time travel'],
    minRating: 6.0,
    preferRecent: true,
  },
  Adventure: {
    primaryGenres: [12, 14],             // Adventure, Fantasy
    bonusGenres:   [28, 878],            // Action, Sci-Fi
    excludeGenres: [27, 10749],          // Horror, Romance
    keywordBoosts: ['journey', 'quest', 'explore', 'discover', 'magic', 'dragon', 'treasure'],
    minRating: 6.0,
    preferRecent: false,
  },
  Mystery: {
    primaryGenres: [9648, 53, 80],       // Mystery, Thriller, Crime
    bonusGenres:   [18, 14],             // Drama, Fantasy
    excludeGenres: [28, 35, 10751],      // Action, Comedy, Family
    keywordBoosts: ['clue', 'secret', 'hidden', 'detective', 'whodunit', 'puzzle', 'reveal'],
    minRating: 6.0,
    preferRecent: false,
  },
  Chill: {
    primaryGenres: [10749, 35, 10751, 18], // Romance, Comedy, Family, Drama
    bonusGenres:   [16, 14],               // Animation, Fantasy
    excludeGenres: [27, 53, 28],           // Horror, Thriller, Action
    keywordBoosts: ['cozy', 'heartwarming', 'peaceful', 'gentle', 'comfort', 'relax'],
    minRating: 5.5,
    preferRecent: false,
  },
  Inspiring: {
    primaryGenres: [18, 36, 10751],      // Drama, History, Family
    bonusGenres:   [99, 12],             // Documentary, Adventure
    excludeGenres: [27, 53],             // Horror, Thriller
    keywordBoosts: ['overcome', 'triumph', 'courage', 'dream', 'hope', 'hero', 'true story', 'inspire'],
    minRating: 6.5,
    preferRecent: false,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Score a single movie/show against a mood
// Returns 0–100 score
// ─────────────────────────────────────────────────────────────────────────────
function scoreMoodRelevance(item, mood) {
  const scoring = MOOD_SCORING[mood];
  if (!scoring) return 50; // Unknown mood: neutral score

  const genreIds = item.genre_ids || [];
  const text = `${(item.title || item.name || '')} ${item.overview || ''}`.toLowerCase();
  const rating = item.vote_average || 0;
  const votes = item.vote_count || 0;
  const popularity = item.popularity || 0;
  const releaseYear = parseInt(
    (item.release_date || item.first_air_date || '1970').substring(0, 4)
  );

  let score = 0;

  // 1. Primary genre match (0–35 pts)
  const primaryMatches = genreIds.filter(g => scoring.primaryGenres.includes(g)).length;
  score += (primaryMatches / Math.max(scoring.primaryGenres.length, 1)) * 35;

  // 2. Bonus genre match (0–15 pts)
  const bonusMatches = genreIds.filter(g => scoring.bonusGenres.includes(g)).length;
  score += Math.min(bonusMatches * 5, 15);

  // 3. Genre exclusion penalty (-20 pts max)
  const excludeMatches = genreIds.filter(g => scoring.excludeGenres.includes(g)).length;
  score -= excludeMatches * 10;

  // 4. Keyword boost in title/overview (0–15 pts)
  let keywordHits = 0;
  for (const kw of scoring.keywordBoosts) {
    if (text.includes(kw)) keywordHits++;
  }
  score += Math.min(keywordHits * 3, 15);

  // 5. Rating quality (0–15 pts)
  if (rating >= scoring.minRating) {
    score += ((rating - scoring.minRating) / (10 - scoring.minRating)) * 15;
  } else {
    score -= (scoring.minRating - rating) * 3; // penalty for below-floor rating
  }

  // 6. Vote reliability (0–10 pts)
  score += Math.min((votes / 1000) * 5, 10);

  // 7. Recency bonus (0–10 pts) — only for moods that prefer recent content
  if (scoring.preferRecent) {
    const age = new Date().getFullYear() - releaseYear;
    score += Math.max(0, 10 - age * 0.5);
  }

  // Clamp 0–100
  return Math.max(0, Math.min(100, score));
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: cached fetch
// ─────────────────────────────────────────────────────────────────────────────
async function cachedFetch(key, url, options = {}, ttl = 3600) {
  if (redisClient) {
    try {
      const raw = await redisClient.get(key);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* skip */ }
  }

  const cached = cache.get(key);
  if (cached) return cached;

  const res = await fetch(url, options);
  if (!res.ok) {
    const err = new Error(`Upstream HTTP ${res.status} for ${url}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();

  if (redisClient) {
    try { await redisClient.set(key, JSON.stringify(data), 'EX', Math.max(60, ttl)); } catch (e) { /* skip */ }
  }
  cache.set(key, data, ttl);
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => res.json({ ok: true, tmdb: !!process.env.TMDB_API_KEY, youtube: !!process.env.YOUTUBE_API_KEY }));

// ── TMDB: single discover page ───────────────────────────────────────────────
app.get('/api/tmdb/discover', async (req, res) => {
  try {
    const params = Object.assign({}, req.query, { api_key: process.env.TMDB_API_KEY });
    const qs = new URLSearchParams(Object.keys(params).sort().reduce((o, k) => { o[k] = params[k]; return o; }, {}));
    const url = `https://api.themoviedb.org/3/discover/movie?${qs}`;
    const data = await cachedFetch(`tmdb:discover:${qs}`, url, {}, 1800);
    res.json(data);
  } catch (err) {
    console.error('TMDB discover error', err.message);
    res.status(err.status || 500).json({ error: 'tmdb_error' });
  }
});

// ── TMDB: movie details / videos / providers ─────────────────────────────────
app.get('/api/tmdb/movie/:id/watch/providers', async (req, res) => {
  try {
    const url = `https://api.themoviedb.org/3/movie/${req.params.id}/watch/providers?api_key=${process.env.TMDB_API_KEY}`;
    const data = await cachedFetch(`tmdb:movie:${req.params.id}:watch-providers`, url, {}, 86400);
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: 'tmdb_providers_error' });
  }
});

app.get('/api/tmdb/movie/:id/:sub?', async (req, res) => {
  try {
    const { id, sub } = req.params;
    const path = sub ? `/${sub}` : '';
    const url = `https://api.themoviedb.org/3/movie/${id}${path}?api_key=${process.env.TMDB_API_KEY}`;
    const data = await cachedFetch(`tmdb:movie:${id}:${sub || 'detail'}`, url, {}, 3600);
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: 'tmdb_error' });
  }
});

// ── TMDB: TV details / videos / providers ────────────────────────────────────
app.get('/api/tmdb/tv/:id/watch/providers', async (req, res) => {
  try {
    const url = `https://api.themoviedb.org/3/tv/${req.params.id}/watch/providers?api_key=${process.env.TMDB_API_KEY}`;
    const data = await cachedFetch(`tmdb:tv:${req.params.id}:watch-providers`, url, {}, 86400);
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: 'tmdb_providers_error' });
  }
});

app.get('/api/tmdb/tv/:id/:sub?', async (req, res) => {
  try {
    const { id, sub } = req.params;
    const path = sub ? `/${sub}` : '';
    const url = `https://api.themoviedb.org/3/tv/${id}${path}?api_key=${process.env.TMDB_API_KEY}`;
    const data = await cachedFetch(`tmdb:tv:${id}:${sub || 'detail'}`, url, {}, 3600);
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: 'tmdb_error' });
  }
});

// ── TMDB: aggregate discover MOVIES with mood scoring ────────────────────────
// Key difference from old version: results are scored and sorted by mood relevance,
// not just genre tags.
app.get('/api/tmdb/aggregate-discover', async (req, res) => {
  try {
    const pages = Math.min(parseInt(req.query.pages || '10', 10), 20);
    const mood  = req.query.mood || null; // NEW: accept mood param for scoring
    const queryParams = Object.assign({}, req.query);
    delete queryParams.pages;
    delete queryParams.mood;

    const combined = [];
    const seen = new Set();

    for (let p = 1; p <= pages; p++) {
      const params = Object.assign({}, queryParams, { page: p, api_key: process.env.TMDB_API_KEY });
      const qs = new URLSearchParams(Object.keys(params).sort().reduce((o, k) => { o[k] = params[k]; return o; }, {}));
      const url = `https://api.themoviedb.org/3/discover/movie?${qs}`;
      try {
        const data = await cachedFetch(`tmdb:discover:${qs}`, url, {}, 1800);
        if (data && Array.isArray(data.results)) {
          for (const m of data.results) {
            if (!m || !m.id || seen.has(m.id)) continue;
            seen.add(m.id);

            // ── MOOD RELEVANCE SCORING ──
            if (mood && MOOD_SCORING[mood]) {
              m._moodScore = scoreMoodRelevance(m, mood);
            } else {
              // Fallback: basic quality score
              m._moodScore = Math.min(
                (m.vote_average / 10) * 50 + Math.min(m.vote_count / 200, 30) + Math.min(m.popularity / 50, 20),
                100
              );
            }

            combined.push(m);
          }
        }
      } catch (e) {
        console.warn(`aggregate-discover page ${p} failed:`, e.message);
      }
    }

    // Sort by mood relevance score (highest first)
    combined.sort((a, b) => (b._moodScore || 0) - (a._moodScore || 0));

    // Filter out items with negative or very low mood score (poor genre match)
    const filtered = combined.filter(m => (m._moodScore || 0) >= 10);

    res.json({ results: filtered, count: filtered.length });
  } catch (err) {
    console.error('aggregate-discover error', err.message);
    res.status(500).json({ error: 'tmdb_aggregate_error' });
  }
});

// ── TMDB: aggregate discover TV with mood scoring ─────────────────────────────
app.get('/api/tmdb/aggregate-discover-tv', async (req, res) => {
  try {
    const pages = Math.min(parseInt(req.query.pages || '10', 10), 20);
    const mood  = req.query.mood || null;
    const queryParams = Object.assign({}, req.query);
    delete queryParams.pages;
    delete queryParams.mood;

    const combined = [];
    const seen = new Set();

    for (let p = 1; p <= pages; p++) {
      const params = Object.assign({}, queryParams, { page: p, api_key: process.env.TMDB_API_KEY });
      const qs = new URLSearchParams(Object.keys(params).sort().reduce((o, k) => { o[k] = params[k]; return o; }, {}));
      const url = `https://api.themoviedb.org/3/discover/tv?${qs}`;
      try {
        const data = await cachedFetch(`tmdb:discover-tv:${qs}`, url, {}, 1800);
        if (data && Array.isArray(data.results)) {
          for (const s of data.results) {
            if (!s || !s.id || seen.has(s.id)) continue;
            seen.add(s.id);

            if (mood && MOOD_SCORING[mood]) {
              s._moodScore = scoreMoodRelevance(s, mood);
            } else {
              s._moodScore = Math.min(
                (s.vote_average / 10) * 50 + Math.min(s.vote_count / 100, 30) + Math.min(s.popularity / 30, 20),
                100
              );
            }

            combined.push(s);
          }
        }
      } catch (e) {
        console.warn(`aggregate-discover-tv page ${p} failed:`, e.message);
      }
    }

    combined.sort((a, b) => (b._moodScore || 0) - (a._moodScore || 0));
    const filtered = combined.filter(s => (s._moodScore || 0) >= 10);

    res.json({ results: filtered, count: filtered.length });
  } catch (err) {
    console.error('aggregate-discover-tv error', err.message);
    res.status(500).json({ error: 'tmdb_tv_aggregate_error' });
  }
});

// ── TMDB: single TV discover page ─────────────────────────────────────────────
app.get('/api/tmdb/discover-tv', async (req, res) => {
  try {
    const params = Object.assign({}, req.query, { api_key: process.env.TMDB_API_KEY });
    const qs = new URLSearchParams(Object.keys(params).sort().reduce((o, k) => { o[k] = params[k]; return o; }, {}));
    const url = `https://api.themoviedb.org/3/discover/tv?${qs}`;
    const data = await cachedFetch(`tmdb:discover-tv:${qs}`, url, {}, 1800);
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: 'tmdb_tv_error' });
  }
});

// ── YouTube: search proxy ─────────────────────────────────────────────────────
app.get('/api/youtube/search', async (req, res) => {
  try {
    const params = Object.assign({}, req.query, {
      part: req.query.part || 'snippet',
      type: req.query.type || 'video',
      maxResults: req.query.maxResults || '25',
      key: process.env.YOUTUBE_API_KEY,
    });
    const qs = new URLSearchParams(Object.keys(params).sort().reduce((o, k) => { o[k] = params[k]; return o; }, {}));
    const url = `https://www.googleapis.com/youtube/v3/search?${qs}`;
    const cacheKey = `yt:search:${qs}`;
    const data = await cachedFetch(cacheKey, url, {}, 3600);

    // Filter for official/quality content
    if (data && Array.isArray(data.items) && data.items.length > 0) {
      const officialRe = [/official/i, /vevo/i, /topic/i, /audio/i, /lyrics?/i];
      const filtered = data.items.filter(item => {
        const t = item.snippet?.title || '';
        const c = item.snippet?.channelTitle || '';
        return officialRe.some(re => re.test(t) || re.test(c));
      });
      data.items = filtered.length > 0 ? filtered : data.items;

      // Enrich with view stats for ranking
      const ids = data.items.map(i => i.id?.videoId).filter(Boolean).join(',');
      if (ids) {
        try {
          const statsQs = new URLSearchParams({ part: 'statistics', id: ids, key: process.env.YOUTUBE_API_KEY });
          const statsData = await cachedFetch(`yt:stats:${ids}`, `https://www.googleapis.com/youtube/v3/videos?${statsQs}`, {}, 3600);
          const statsMap = {};
          (statsData.items || []).forEach(v => { statsMap[v.id] = v.statistics || {}; });
          data.items = data.items.map(i => ({
            ...i,
            _yt_stats: statsMap[i.id?.videoId] || {}
          }));
          data.items.sort((a, b) => Number(b._yt_stats.viewCount || 0) - Number(a._yt_stats.viewCount || 0));
        } catch (e) {
          console.warn('Stats enrichment failed:', e.message);
        }
      }
    }

    res.json(data);
  } catch (err) {
    console.error('YouTube search error', err.message);
    if (err.status === 403) {
      return res.status(403).json({ error: 'youtube_quota_exceeded', message: 'YouTube API daily quota reached. Try again tomorrow or rotate API keys.' });
    }
    res.status(err.status || 500).json({ error: 'youtube_error' });
  }
});

// ── YouTube: aggregate search ─────────────────────────────────────────────────
app.get('/api/youtube/aggregate-search', async (req, res) => {
  try {
    const q       = req.query.q || '';
    const limit   = Math.min(parseInt(req.query.limit || '50', 10), 50);
    const strategies = req.query.strategies
      ? String(req.query.strategies).split(',').map(s => s.trim()).filter(Boolean)
      : [
          `${q} official audio VEVO topic`,
          `${q} official music video`,
          `${q} official lyric video`,
          `${q} official`,
          q,
        ];

    const collected = [];
    const seen = new Set();

    for (const strategy of strategies) {
      if (collected.length >= limit) break;
      const params = {
        q: strategy,
        part: 'snippet',
        type: 'video',
        maxResults: '50',
        key: process.env.YOUTUBE_API_KEY,
      };
      const qs = new URLSearchParams(Object.keys(params).sort().reduce((o, k) => { o[k] = params[k]; return o; }, {}));
      const url = `https://www.googleapis.com/youtube/v3/search?${qs}`;
      try {
        const data = await cachedFetch(`yt:search:${qs}`, url, {}, 3600);
        if (data && Array.isArray(data.items)) {
          for (const item of data.items) {
            const vid = item.id?.videoId || item.id;
            if (!vid || seen.has(vid)) continue;
            seen.add(vid);
            collected.push(item);
            if (collected.length >= limit) break;
          }
        }
      } catch (e) {
        if (e.status === 403) { console.warn('YouTube quota hit during aggregate search'); break; }
        console.warn('Strategy failed:', strategy, e.message);
      }
    }

    // Enrich with stats and sort by views
    const ids = collected.map(i => i.id?.videoId || i.id).filter(Boolean).join(',');
    if (ids) {
      try {
        const statsQs = new URLSearchParams({ part: 'statistics', id: ids, key: process.env.YOUTUBE_API_KEY });
        const statsData = await cachedFetch(`yt:stats:${ids}`, `https://www.googleapis.com/youtube/v3/videos?${statsQs}`, {}, 3600);
        const statsMap = {};
        (statsData.items || []).forEach(v => { statsMap[v.id] = v.statistics || {}; });
        const enriched = collected.map(i => ({
          ...i,
          _yt_stats: statsMap[i.id?.videoId || i.id] || {}
        }));
        enriched.sort((a, b) => Number(b._yt_stats.viewCount || 0) - Number(a._yt_stats.viewCount || 0));
        return res.json({ items: enriched.slice(0, limit), total: enriched.length });
      } catch (e) {
        console.warn('Stats enrichment failed in aggregate:', e.message);
      }
    }

    res.json({ items: collected.slice(0, limit), total: collected.length });
  } catch (err) {
    console.error('YouTube aggregate-search error', err.message);
    if (err.status === 403) {
      return res.status(403).json({ error: 'youtube_quota_exceeded' });
    }
    res.status(500).json({ error: 'youtube_aggregate_error' });
  }
});

// ── iTunes fallback (no quota) ────────────────────────────────────────────────
app.get('/api/itunes/search', async (req, res) => {
  try {
    const query  = req.query.q || req.query.term || '';
    const limit  = Math.min(parseInt(req.query.limit || '25', 10), 200);
    const qs     = new URLSearchParams({ term: query, media: 'music', entity: 'song', limit });
    const url    = `https://itunes.apple.com/search?${qs}`;
    const data   = await cachedFetch(`itunes:${query}:${limit}`, url, {}, 3600);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'itunes_error' });
  }
});

// ── Deezer fallback (no quota) ────────────────────────────────────────────────
app.get('/api/deezer/search', async (req, res) => {
  try {
    const query = req.query.q || '';
    const limit = Math.min(parseInt(req.query.limit || '25', 10), 100);
    const url   = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=${limit}`;
    const data  = await cachedFetch(`deezer:${query}:${limit}`, url, {}, 3600);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'deezer_error' });
  }
});

// ── Unified music search: YouTube → iTunes → Deezer ──────────────────────────
app.get('/api/music/search', async (req, res) => {
  try {
    const query = req.query.q || '';
    const limit = Math.min(parseInt(req.query.limit || '25', 10), 50);

    // 1. Try YouTube
    try {
      const qs = new URLSearchParams({ q: `${query} official audio`, part: 'snippet', type: 'video', maxResults: limit, key: process.env.YOUTUBE_API_KEY });
      const data = await cachedFetch(`yt:music:${query}:${limit}`, `https://www.googleapis.com/youtube/v3/search?${qs}`, {}, 3600);
      if (data?.items?.length > 0) return res.json({ source: 'youtube', ...data });
    } catch (e) {
      if (e.status === 403) console.warn('YouTube quota exceeded, falling back to iTunes');
      else console.warn('YouTube failed:', e.message);
    }

    // 2. Fallback: iTunes
    try {
      const data = await cachedFetch(`itunes:music:${query}`, `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=${limit}`, {}, 3600);
      if (data?.results?.length > 0) {
        const items = data.results.map(t => ({
          id: { videoId: String(t.trackId) },
          snippet: {
            title: `${t.trackName} - ${t.artistName}`,
            channelTitle: t.artistName,
            thumbnails: { high: { url: t.artworkUrl100 } },
          },
          _itunes: { previewUrl: t.previewUrl, trackViewUrl: t.trackViewUrl },
        }));
        return res.json({ source: 'itunes', items });
      }
    } catch (e) { console.warn('iTunes failed:', e.message); }

    // 3. Fallback: Deezer
    const data = await cachedFetch(`deezer:music:${query}`, `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=${limit}`, {}, 3600);
    if (data?.data?.length > 0) {
      const items = data.data.map(t => ({
        id: { videoId: String(t.id) },
        snippet: {
          title: `${t.title} - ${t.artist.name}`,
          channelTitle: t.artist.name,
          thumbnails: { high: { url: t.album.cover_big } },
        },
        _deezer: { previewUrl: t.preview, link: t.link },
      }));
      return res.json({ source: 'deezer', items });
    }

    res.json({ source: 'none', items: [], error: 'All music APIs exhausted' });
  } catch (err) {
    console.error('Unified music search error', err.message);
    res.status(500).json({ error: 'music_search_error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PERSISTENT DATABASE & DYNAMIC VIBE TWIN ENGINE
// ─────────────────────────────────────────────────────────────────────────────
const fs = require('fs');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PROFILES_FILE = path.join(DATA_DIR, 'vibe_profiles.json');
const FUSIONS_FILE = path.join(DATA_DIR, 'fusions.json');

function readJSON(filePath, defaultValue = []) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
      return defaultValue;
    }
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.warn(`Error reading ${filePath}:`, err.message);
    return defaultValue;
  }
}

function writeJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err.message);
  }
}

const VIBE_DNA_DIMENSIONS = [
  'Energy',
  'Exploration',
  'Nostalgia',
  'Complexity',
  'Mainstream',
  'Intensity',
  'Diversity',
  'Discovery'
];

function computeCosineSimilarity(dnaA, dnaB) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const dim of VIBE_DNA_DIMENSIONS) {
    const valA = Number(dnaA[dim] || 50);
    const valB = Number(dnaB[dim] || 50);
    dot += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }
  if (normA === 0 || normB === 0) return 0.8;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ── Auth: Register ────────────────────────────────────────────────────────────
app.post('/api/auth/register', (req, res) => {
  try {
    const { email, password, name, avatar, walletAddress } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const users = readJSON(USERS_FILE, []);
    const normalizedEmail = email.toLowerCase().trim();

    if (users.some(u => u.email === normalizedEmail)) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
    const newUser = {
      id: 'usr_' + crypto.randomBytes(8).toString('hex'),
      email: normalizedEmail,
      name: name || email.split('@')[0],
      avatar: avatar || '👤',
      passwordHash,
      walletAddress: walletAddress ? walletAddress.toLowerCase() : null,
      createdAt: Date.now()
    };

    users.push(newUser);
    writeJSON(USERS_FILE, users);

    const userPayload = { ...newUser };
    delete userPayload.passwordHash;
    res.json({ success: true, user: userPayload });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// ── Auth: Login ───────────────────────────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const users = readJSON(USERS_FILE, []);
    const normalizedEmail = email.toLowerCase().trim();
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

    const user = users.find(u => u.email === normalizedEmail && u.passwordHash === passwordHash);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const userPayload = { ...user };
    delete userPayload.passwordHash;
    res.json({ success: true, user: userPayload });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── Auth: Web3 Wallet Connect / Register ──────────────────────────────────────
app.post('/api/auth/web3', (req, res) => {
  try {
    const { walletAddress, name, chainId, network } = req.body;
    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address required' });
    }

    const users = readJSON(USERS_FILE, []);
    const normalizedAddr = walletAddress.toLowerCase();

    let user = users.find(u => u.walletAddress === normalizedAddr);
    if (!user) {
      user = {
        id: 'usr_' + crypto.randomBytes(8).toString('hex'),
        email: null,
        name: name || `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
        avatar: '🦊',
        walletAddress: normalizedAddr,
        chainId,
        network,
        createdAt: Date.now()
      };
      users.push(user);
      writeJSON(USERS_FILE, users);
    } else {
      user.chainId = chainId || user.chainId;
      user.network = network || user.network;
      writeJSON(USERS_FILE, users);
    }

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: 'Web3 auth failed' });
  }
});

// ── Vibe DNA Profile: Save / Sync ────────────────────────────────────────────
app.post('/api/vibe/profile', (req, res) => {
  try {
    const { userId, walletAddress, name, archetype, vibeDNA, vibeSignature } = req.body;
    if (!vibeDNA) {
      return res.status(400).json({ error: 'vibeDNA required' });
    }

    const profiles = readJSON(PROFILES_FILE, []);
    const identifier = (walletAddress ? walletAddress.toLowerCase() : null) || userId;

    let profileIdx = profiles.findIndex(p => 
      (p.walletAddress && walletAddress && p.walletAddress === walletAddress.toLowerCase()) || 
      (p.userId && userId && p.userId === userId)
    );

    const updatedProfile = {
      userId: userId || null,
      walletAddress: walletAddress ? walletAddress.toLowerCase() : null,
      name: name || 'Explorer',
      archetype: archetype || { name: 'Night Explorer', emoji: '🌌' },
      vibeDNA,
      vibeSignature: vibeSignature || '0x0',
      updatedAt: Date.now()
    };

    if (profileIdx >= 0) {
      profiles[profileIdx] = { ...profiles[profileIdx], ...updatedProfile };
    } else {
      profiles.push(updatedProfile);
    }

    writeJSON(PROFILES_FILE, profiles);
    res.json({ success: true, profile: updatedProfile });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save vibe profile' });
  }
});

// ── Dynamic Vibe Twin Discovery (Real DB Query & Cosine Similarity) ───────────
app.get('/api/vibe/twins', (req, res) => {
  try {
    const requesterAddress = req.query.address ? req.query.address.toLowerCase() : null;
    const requesterUserId = req.query.userId || null;

    const profiles = readJSON(PROFILES_FILE, []);

    // Find requester profile
    const requesterProfile = profiles.find(p => 
      (requesterAddress && p.walletAddress === requesterAddress) ||
      (requesterUserId && p.userId === requesterUserId)
    );

    const userDNA = requesterProfile?.vibeDNA || {
      Energy: 75,
      Exploration: 85,
      Nostalgia: 55,
      Complexity: 78,
      Mainstream: 40,
      Intensity: 70,
      Diversity: 80,
      Discovery: 88
    };

    // Filter out the requester themselves
    const candidateProfiles = profiles.filter(p => {
      if (requesterAddress && p.walletAddress === requesterAddress) return false;
      if (requesterUserId && p.userId === requesterUserId) return false;
      return true;
    });

    if (candidateProfiles.length === 0) {
      return res.json({
        totalUsers: profiles.length,
        twins: [],
        message: 'You are one of the pioneer vibes on VibeVerse! Invite friends to join and discover your Vibe Twins.'
      });
    }

    const twins = candidateProfiles.map(candidate => {
      const candidateDNA = candidate.vibeDNA || {};
      const similarity = computeCosineSimilarity(userDNA, candidateDNA);
      const matchPercent = Math.min(99, Math.max(60, Math.round(similarity * 100)));

      // Calculate aligned & complementary traits
      const dimDifferences = VIBE_DNA_DIMENSIONS.map(dim => {
        const valUser = Number(userDNA[dim] || 50);
        const valCandidate = Number(candidateDNA[dim] || 50);
        const diff = Math.abs(valUser - valCandidate);
        return { dim, diff, valUser, valCandidate };
      });

      dimDifferences.sort((a, b) => a.diff - b.diff);
      const topAligned = dimDifferences.slice(0, 3);
      const contrasting = dimDifferences[dimDifferences.length - 1];

      const whyWeMatch = {
        topTraits: topAligned.map(t => `${t.dim} (${Math.round(100 - t.diff)}%)`),
        rationale: `Shared ${topAligned.map(t => t.dim).join(', ')}. You favor balanced exploration while ${candidate.name} brings high ${contrasting.dim}, creating a dynamic fusion.`
      };

      return {
        id: candidate.userId || candidate.walletAddress,
        name: candidate.name || 'Vibe Explorer',
        address: candidate.walletAddress || '0x0000...0000',
        avatar: candidate.archetype?.emoji || '🌌',
        archetype: candidate.archetype || { name: 'Night Explorer', emoji: '🌌' },
        matchPercent,
        whyWeMatch
      };
    }).sort((a, b) => b.matchPercent - a.matchPercent);

    res.json({
      totalUsers: profiles.length,
      twins
    });
  } catch (err) {
    console.error('Vibe twins query error:', err);
    res.status(500).json({ error: 'Failed to fetch vibe twins' });
  }
});

// ── Vibe Fusion: Save / Log ──────────────────────────────────────────────────
app.post('/api/vibe/fuse', (req, res) => {
  try {
    const { userA, userB, compatibilityScore, sharedVibe, fusionSignature, txHash } = req.body;
    const fusions = readJSON(FUSIONS_FILE, []);

    const newFusion = {
      id: 'fus_' + crypto.randomBytes(8).toString('hex'),
      userA: (userA || '').toLowerCase(),
      userB: (userB || '').toLowerCase(),
      compatibilityScore,
      sharedVibe,
      fusionSignature,
      txHash: txHash || null,
      createdAt: Date.now()
    };

    fusions.push(newFusion);
    writeJSON(FUSIONS_FILE, fusions);

    res.json({ success: true, fusion: newFusion });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record fusion' });
  }
});

app.listen(PORT, () => console.log(`VibeVerse proxy & DB API listening on port ${PORT}`));