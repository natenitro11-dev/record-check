import "./index.css";
import { useState, useEffect, useRef, Component } from "react";
import CompareView from "./CompareTimeline.jsx";

// ── DEPLOYMENT NOTE ────────────────────────────────────────────
// MODE: Artifact / Browser preview  →  uses public CORS proxies
// MODE: Local dev (npm run dev)     →  Vite proxy handles it
// MODE: Netlify / Cloudflare        →  server-side proxy injects key
// ─────────────────────────────────────────────────────────────

// ── Congress.gov API ───────────────────────────────────────────
const CONGRESS_KEY = "CLIENT"; // real key injected server-side by /api/congress proxy

const IS_BROWSER = typeof window !== "undefined";
const HOST = IS_BROWSER ? window.location.hostname : "";
const IS_LOCAL = HOST === "localhost" || HOST === "127.0.0.1";
const IS_DEPLOYED = IS_BROWSER && !IS_LOCAL && (
  HOST.includes("pages.dev") || HOST.includes("netlify") ||
  HOST.includes("vercel") || !HOST.includes("claude")
);

const PROXIES = [
  u => "https://api.codetabs.com/v1/proxy/?quest=" + encodeURIComponent(u),
  u => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u),
  u => "https://corsproxy.io/?url=" + encodeURIComponent(u),
];

async function proxied(url) {
  if (IS_DEPLOYED || IS_LOCAL) {
    return fetch(url.replace("https://api.congress.gov/v3", "/api/congress"));
  }
  let lastErr = null;
  for (const wrap of PROXIES) {
    try {
      const r = await fetch(wrap(url), { headers: { Accept: "application/json" } });
      if (r.ok) return r;
      lastErr = "HTTP " + r.status;
    } catch (e) { lastErr = e.message; }
  }
  throw new Error("Deploy to Netlify for reliable access. (" + lastErr + ")");
}
const CONGRESS_BASE = "https://api.congress.gov/v3";

// ── Input sanitization ─────────────────────────────────────────
function sanitizeQuery(raw) {
  if (!raw || typeof raw !== "string") return "";
  // Strip anything that isn't alphanumeric, spaces, dots, or hyphens
  return raw.replace(/[^a-zA-Z0-9\s\.\-]/g, "").trim().slice(0, 50);
}

// ── Rate limiter — max 10 API calls per 60 seconds ────────────
const rateLimiter = (() => {
  const calls = [];
  const MAX = 10, WINDOW = 60000;
  return {
    check() {
      const now = Date.now();
      while (calls.length && now - calls[0] > WINDOW) calls.shift();
      if (calls.length >= MAX) {
        const readyAt = calls[0] + WINDOW;
        const wait = Math.ceil((readyAt - now) / 1000);
        const err = new Error("Too many requests. Wait " + wait + "s and try again.");
        err.retryAfter = readyAt;
        throw err;
      }
      calls.push(now);
    },
    cooldownRemaining() {
      const now = Date.now();
      while (calls.length && now - calls[0] > WINDOW) calls.shift();
      if (calls.length < MAX) return 0;
      return Math.max(0, Math.ceil((calls[0] + WINDOW - now) / 1000));
    }
  };
})();

// ── Error Boundary — catches tab crashes, shows friendly message ──
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e.message || "Something went wrong." }; }
  componentDidCatch(e, info) { console.error("Tab error:", e, info); }
  render() {
    if (this.state.error) {
      const color = this.props.color || "#B22234";
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60%", gap: "1rem", padding: "2rem" }}>
          <div style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: "1.4rem", color, letterSpacing: "0.1em", textAlign: "center" }}>
            Something went wrong
          </div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.48rem", color: "#7a8fa8", textAlign: "center", maxWidth: 400, lineHeight: 1.6 }}>
            {this.state.error}
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: "0.8rem", letterSpacing: "0.12em", color: "#0a0a0c", background: color, border: "none", padding: "0.5rem 1.25rem", cursor: "pointer" }}
          >
            TRY AGAIN
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Parse user query into congress number + bill type + number
// e.g. "S. 4638", "HR 1", "H.R. 7521", "s4638", "hr1"
function parseQuery(q) {
  const clean = q.trim().toUpperCase().replace(/[.\s_-]/g, "");
  const match = clean.match(/^(HR|HJRES|SRES|SJRES|S)(\d+)$/);
  if (!match) return null;
  const typeMap = { HR: "hr", HJRES: "hjres", SRES: "sres", SJRES: "sjres", S: "s" };
  return { type: typeMap[match[1]], number: match[2] };
}

// Fetch bill from Congress.gov — tries recent congresses
async function fetchBill(query, congress = 119) {
  let parsed;
  if (query && typeof query === "object" && query.number) {
    parsed = { type: (query.type || "").toLowerCase(), number: String(query.number) };
    if (query.congress) congress = query.congress;
  } else {
    parsed = parseQuery(query);
  }
  if (!parsed) throw new Error("Could not parse bill number. Try formats like 'S 4638' or 'HR 1'.");
  rateLimiter.check();
  const url = CONGRESS_BASE + "/bill/" + congress + "/" + parsed.type + "/" + parsed.number + "?api_key=" + CONGRESS_KEY;
  let res;
  try {
    res = await proxied(url);
  } catch (e) {
    throw new Error("Connection failed. " + e.message);
  }
  if (!res.ok) {
    if (congress > 117) return fetchBill(query, congress - 1);
    throw new Error("Bill " + query + " not found in recent congresses.");
  }
  const data = await res.json();
  if (!data.bill) {
    if (congress > 117) return fetchBill(query, congress - 1);
    throw new Error("Bill " + query + " not found.");
  }
  return data.bill;
}

// Fetch bill text summaries
async function fetchSummaries(congress, type, number) {
  try {
    const url = CONGRESS_BASE + "/bill/" + congress + "/" + type + "/" + number + "/summaries?api_key=" + CONGRESS_KEY;
    const res = await proxied(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data.summaries || [];
  } catch { return null; }
}

// Fetch bill actions (for timeline)
async function fetchActions(congress, type, number) {
  try {
    const url = CONGRESS_BASE + "/bill/" + congress + "/" + type + "/" + number + "/actions?api_key=" + CONGRESS_KEY + "&limit=10";
    const res = await proxied(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data.actions || [];
  } catch { return null; }
}

// Normalise raw Congress.gov bill into our BILL shape
function normaliseBill(raw, summaries, actions) {
  const sponsor = raw.sponsors?.[0];
  const sponsorName = sponsor
    ? (sponsor.firstName || "") + " " + (sponsor.lastName || "") + " (" + (sponsor.party || "?") + "-" + (sponsor.state || "?") + ")"
    : "Unknown Sponsor";

  const latestAction = raw.latestAction?.text || "No recent action";
  const statusRaw = raw.latestAction?.text || "";
  let status = "Introduced";
  if (/became public law/i.test(statusRaw)) status = "Enacted";
  else if (/passed senate/i.test(statusRaw) || /senate passed/i.test(statusRaw)) status = "Passed Senate";
  else if (/passed house/i.test(statusRaw) || /house passed/i.test(statusRaw)) status = "Passed House";
  else if (/failed/i.test(statusRaw) || /rejected/i.test(statusRaw)) status = "Failed";
  else if (/signed by president/i.test(statusRaw)) status = "Enacted";

  const summary = summaries?.length
    ? summaries[summaries.length - 1].text.replace(/<[^>]+>/g, "").slice(0, 500) + "..."
    : latestAction;

  const congress = raw.congress;
  const typeRaw = raw.type?.toLowerCase() || "s";
  const number = raw.number;

  const typeDisplay = { hr: "H.R.", hjres: "H.J.Res.", s: "S.", sres: "S.Res.", sjres: "S.J.Res." }[typeRaw] || raw.type;

  return {
    id: typeDisplay + " " + number + " (" + congress + "th Cong.)",
    name: raw.title || "Untitled Bill",
    shortName: raw.shortTitle || raw.title?.split(" ").slice(0, 3).join(" ") || "Bill",
    sponsor: sponsorName,
    status,
    introduced: raw.introducedDate || "Unknown",
    cost: "See CBO estimate",
    summary,
    keyProvisions: [
      "Latest Action: " + latestAction,
      "Policy Area: " + (raw.policyArea?.name || "N/A"),
      "Committees: " + (raw.committees?.count || 0) + " referred",
      "Amendments: " + (raw.amendments?.count || 0) + " filed",
      "Co-sponsors: " + (raw.cosponsors?.count || 0) + " total",
    ],
    _congress: congress,
    _type: typeRaw,
    _number: number,
    actions: actions || [],
  };
}

const BRAND = { name: "The Record Check", handle: "@therecordcheck", tagline: "What the bill says. What they told you. The gap." };

// ─────────────────────────────────────────────────────────────
// ARCHIVAL NEWS SOURCES
// Three sources, each populates different tabs when selected
// ─────────────────────────────────────────────────────────────

// ── GDELT ─────────────────────────────────────────────────────
// Populates: Media Analysis (coverage volume, outlet list, timeline)
async function fetchGDELT(billName) {
  try {
    const q = encodeURIComponent('"' + billName.slice(0, 40) + '"');
    const url = "https://api.gdeltproject.org/api/v2/doc/doc?query=" + q +
      "&mode=ArtList&maxrecords=25&sort=DateDesc&format=json";
    const res = await proxied(url);
    if (!res.ok) throw new Error("GDELT fetch failed");
    const data = await res.json();
    const articles = data.articles || [];
    // Group by outlet domain
    const byOutlet = {};
    articles.forEach(a => {
      try {
        const domain = new URL(a.url).hostname.replace("www.", "");
        if (!byOutlet[domain]) byOutlet[domain] = { name: domain, articles: [], tone: "neutral" };
        byOutlet[domain].articles.push(a);
      } catch {}
    });
    return {
      source: "GDELT",
      totalArticles: articles.length,
      outlets: Object.values(byOutlet).slice(0, 8).map(o => ({
        name: o.name,
        count: o.articles.length,
        coverage: Math.min(100, Math.round((o.articles.length / Math.max(1, articles.length)) * 100 * 4)),
        latestHeadline: o.articles[0]?.title || "",
        latestDate: o.articles[0]?.seendate?.slice(0, 8) || "",
        url: o.articles[0]?.url || "",
        lean: leanScore(biasOf(o.name)),
        tone: "neutral",
      })),
      timeline: buildTimeline(articles),
      rawArticles: articles.slice(0, 10),
    };
  } catch (e) {
    return { source: "GDELT", error: e.message, outlets: [], timeline: [], rawArticles: [] };
  }
}

// ── Internet Archive ──────────────────────────────────────────
// Populates: Coverage Timeline (historical snapshots), Bill Language (archived bill text)
async function fetchArchive(billName) {
  try {
    const q = encodeURIComponent(billName.slice(0, 50));
    const url = "https://archive.org/advancedsearch.php?q=" + q +
      "+AND+mediatype:texts&fl=identifier,title,date,description,creator&rows=12&output=json";
    const res = await proxied(url);
    if (!res.ok) throw new Error("Archive fetch failed");
    const data = await res.json();
    const docs = data.response?.docs || [];
    return {
      source: "Internet Archive",
      totalDocs: data.response?.numFound || 0,
      docs: docs.map(d => ({
        id: d.identifier,
        title: d.title,
        date: d.date,
        description: (d.description || "").slice(0, 200),
        creator: d.creator,
        url: "https://archive.org/details/" + d.identifier,
      })),
    };
  } catch (e) {
    return { source: "Internet Archive", error: e.message, docs: [] };
  }
}

// ── CommonCrawl index ─────────────────────────────────────────
// Populates: Media Analysis (deep historical coverage from any outlet)
async function fetchCommonCrawl(billName) {
  try {
    // Use CC index API — returns URLs that mentioned the bill
    const q = encodeURIComponent(billName.slice(0, 40));
    const url = "https://index.commoncrawl.org/CC-MAIN-2024-51-index?url=*.*.com&matchType=host&output=json&limit=10&filter=!status:404&q=" + q;
    // CC index doesn't support keyword search directly — use their CDX API for known news domains
    const cdxUrl = "https://index.commoncrawl.org/CC-MAIN-2024-51-index?url=nytimes.com/*&matchType=prefix&output=json&limit=5&filter=statuscode:200";
    const res = await proxied(cdxUrl);
    const text = await res.text();
    const lines = text.trim().split("\n").filter(Boolean);
    const records = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    return {
      source: "CommonCrawl",
      crawlIndex: "CC-MAIN-2024-51",
      recordCount: records.length,
      records: records.slice(0, 8).map(r => ({
        url: r.url,
        timestamp: r.timestamp,
        status: r.status,
        filename: r.filename,
      })),
    };
  } catch (e) {
    return { source: "CommonCrawl", error: e.message, records: [] };
  }
}

// ── Claude synthesis ──────────────────────────────────────────
// Takes raw archival data and generates structured analysis for each tab
async function synthesizeArchivalData(bill, gdelt, archive, ccrawl, sourceKey) {
  const prompt = `You are a media analyst. Given raw archival news data about a federal bill, synthesize it into structured analysis for a content creator dashboard.

Bill: ${bill.name} (${bill.id})
Summary: ${(bill.summary || "").slice(0, 200)}

GDELT Coverage Data (${gdelt.totalArticles || 0} articles found):
${JSON.stringify((gdelt.outlets || []).slice(0, 5), null, 1)}

Internet Archive Documents (${archive.totalDocs || 0} records):
${JSON.stringify((archive.docs || []).slice(0, 4), null, 1)}

Return ONLY a JSON object, no markdown:
{
  "mediaAnalysis": {
    "totalArticleCount": 0,
    "coverageSummary": "2 sentences on how media covered this bill based on the data",
    "dominantFraming": "One sentence on the dominant narrative found",
    "outlets": [
      {
        "name": "outlet name",
        "headline": "headline or description",
        "date": "date string",
        "coverage": 75,
        "lean": 35,
        "tone": "supportive|neutral|skeptical|negative",
        "angle": "one sentence editorial angle",
        "url": "url if available"
      }
    ]
  },
  "timeline": [
    {"month": "Jan '24", "event": "event description", "coverage": 45, "tone": "neutral"}
  ],
  "archiveHighlights": [
    {"title": "doc title", "date": "date", "description": "description", "url": "url"}
  ],
  "contentAngles": [
    "Content angle 1 based on what the archival data reveals",
    "Content angle 2",
    "Content angle 3"
  ]
}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    const raw = data.content?.find(b => b.type === "text")?.text || "{}";
    return JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch { return null; }
}

function buildTimeline(articles) {
  const byMonth = {};
  articles.forEach(a => {
    const d = a.seendate || "";
    const key = d.slice(0, 6);
    if (!key) return;
    const label = key.slice(4, 6) + " '" + key.slice(2, 4);
    if (!byMonth[key]) byMonth[key] = { month: label, count: 0, tone: "neutral" };
    byMonth[key].count++;
  });
  const max = Math.max(1, ...Object.values(byMonth).map(m => m.count));
  return Object.values(byMonth).slice(-6).map(m => ({
    month: m.month,
    event: m.count + " articles",
    coverage: Math.round((m.count / max) * 100),
    tone: m.tone,
  }));
}

// Default bill shown on load
const DEFAULT_BILL = {
  id: "S. 4638 (118th Cong.)", name: "Kids Online Safety Act", shortName: "KOSA",
  sponsor: "Sen. Richard Blumenthal (D-CT)", status: "Passed Senate",
  introduced: "2023-07-27", cost: "$0 (no direct appropriation)",
  summary: "Requires social media platforms to implement safeguards protecting minors from addictive features, harmful content, and data exploitation.",
  keyProvisions: ["Platforms must act in 'best interests' of minor users", "Default settings must be privacy-protective for minors", "Parental supervision tools required for under-17 accounts", "Annual independent audits of minor safety practices", "FTC enforcement with up to $50K/day in penalties"],
  _congress: 118, _type: "s", _number: "4638", actions: [],
};
// ── Live bill search autocomplete ─────────────────────────────
async function searchBills(query) {
  if (!query || query.trim().length < 2) return [];
  try {
    const url = CONGRESS_BASE + "/bill?api_key=" + CONGRESS_KEY +
      "&query=" + encodeURIComponent(query.trim()) +
      "&limit=8&sort=updateDate+desc";
    const res = await proxied(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.bills || []).map(b => ({
      title: (b.title || "").slice(0, 80),
      id: (b.type || "") + " " + (b.number || ""),
      congress: b.congress,
      type: (b.type || "").toLowerCase(),
      number: b.number,
      status: (b.latestAction?.text || "").slice(0, 60),
    }));
  } catch { return []; }
}

// ── Partisan color system ─────────────────────────────────────
const DEM = "#2563EB";
const REP = "#DC2626";
const IND = "#6B7280";

function leanScore(bias) {
  return { left:12, "lean-left":30, center:50, "lean-right":65, right:88, unrated:50 }[bias] ?? 50;
}
function partisanColor(score) {
  if (score <= 35) return DEM;
  if (score <= 55) return IND;
  return REP;
}
function partisanLabel(score) {
  if (score <= 20) return "Left";
  if (score <= 38) return "Ctr-Left";
  if (score <= 55) return "Center";
  if (score <= 72) return "Ctr-Right";
  return "Right";
}

const TRENDING_BILLS = [
  { id: "HR 1",    title: "One Big Beautiful Bill Act",                                       congress: 119, type: "hr", number: "1",    party: "R", status: "Passed House" },
  { id: "S 4638",  title: "Kids Online Safety Act",                                          congress: 118, type: "s",  number: "4638", party: "D", status: "Passed Senate" },
  { id: "HR 7521", title: "Protecting Americans from Foreign Adversary Controlled Apps Act", congress: 118, type: "hr", number: "7521", party: "B", status: "Enacted" },
  { id: "HR 4346", title: "CHIPS and Science Act",                                           congress: 117, type: "hr", number: "4346", party: "B", status: "Enacted" },
  { id: "HR 5376", title: "Inflation Reduction Act",                                         congress: 117, type: "hr", number: "5376", party: "D", status: "Enacted" },
  { id: "S 686",   title: "RESTRICT Act",                                                    congress: 118, type: "s",  number: "686",  party: "B", status: "Introduced" },
  { id: "HR 3684", title: "Infrastructure Investment and Jobs Act",                           congress: 117, type: "hr", number: "3684", party: "B", status: "Enacted" },
];

function partyColor(p) {
  if (p === "D") return DEM;
  if (p === "R") return REP;
  return IND;
}

function partyLabel(p) {
  if (p === "D") return "DEM";
  if (p === "R") return "REP";
  if (p === "B") return "BIPARTISAN";
  return "—";
}

function BillSearchBox({ onSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1);
  const debounceRef = useRef(null);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  const showTrending = open && query.trim().length === 0;
  const displayResults = showTrending ? TRENDING_BILLS : results;

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length === 0) { setResults([]); return; }
    if (query.trim().length < 2) return;
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const res = await searchBills(query);
      setResults(res.map(r => ({ ...r, party: "B" })));
      setOpen(true);
      setSearching(false);
      setHi(-1);
    }, 280);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  useEffect(() => {
    const h = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const select = item => { setQuery(item.id); setOpen(false); onSelect(item); };

  const handleKey = e => {
    if (!open || displayResults.length === 0) { if (e.key === "Enter") { onSelect(query); setOpen(false); } return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setHi(h => Math.min(h + 1, displayResults.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (hi >= 0) select(displayResults[hi]); else { onSelect(query); setOpen(false); } }
    else if (e.key === "Escape") setOpen(false);
  };

  return (
    <div ref={wrapRef} style={{ flex: 1, maxWidth: 560, position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", background: "#1f1f24", border: "1px solid " + (open ? C.red + "88" : C.border), borderRadius: 999, height: 34, padding: "0 0.65rem", transition: "border-color 0.15s" }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.dim} strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginRight: "0.45rem" }}>
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={handleKey}
          onFocus={() => setOpen(true)}
          placeholder="Search bills — tap to see trending..."
          style={{ flex: 1, background: "none", border: "none", color: C.cream, fontFamily: "'JetBrains Mono', monospace", fontSize: "0.54rem", letterSpacing: "0.03em", outline: "none" }} />
        {searching
          ? <div style={{ width: 11, height: 11, border: "2px solid " + C.navy, borderTop: "2px solid " + C.gold, borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />
          : query ? <button onClick={() => { setQuery(""); setResults([]); inputRef.current?.focus(); }} style={{ fontSize: "0.5rem", color: C.dim, cursor: "pointer", padding: "0 0.1rem" }}>&#10005;</button> : null}
      </div>

      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 2px)", left: 0, right: 0, background: "#0a0a0c", border: "1px solid " + C.navy, borderTop: "2px solid " + C.gold, zIndex: 9999, boxShadow: "0 16px 48px rgba(0,0,0,0.9)", maxHeight: 400, overflowY: "auto" }}>

          {/* Header */}
          <div style={{ padding: "0.3rem 0.75rem", borderBottom: "1px solid " + C.navy, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
              {showTrending
                ? <><span style={{ width: 5, height: 5, borderRadius: "50%", background: C.gold, display: "inline-block", animation: "blink 1.4s ease-in-out infinite" }} />
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.4rem", color: C.gold, letterSpacing: "0.12em" }}>TRENDING BILLS</span></>
                : <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.4rem", color: C.dim, letterSpacing: "0.1em" }}>CONGRESS.GOV · {results.length} results</span>
              }
            </div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              {[[DEM,"DEM"],[IND,"IND"],[REP,"REP"]].map(([col, lbl]) => (
                <div key={lbl} style={{ display: "flex", alignItems: "center", gap: "0.2rem" }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: col }} />
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.34rem", color: col, letterSpacing: "0.06em" }}>{lbl}</span>
                </div>
              ))}
            </div>
          </div>

          {/* No results */}
          {!showTrending && results.length === 0 && !searching && (
            <div style={{ padding: "0.75rem", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.46rem", color: C.dim }}>
              No results for "{query}" — try HR 1 or Kids Online Safety
            </div>
          )}

          {/* List */}
          {displayResults.map((r, i) => {
            const isHi = hi === i;
            const pc = partyColor(r.party || "B");
            return (
              <div key={i} onMouseEnter={() => setHi(i)} onMouseDown={() => select(r)}
                style={{ padding: "0.5rem 0.75rem", background: isHi ? C.panelHi : "transparent", borderLeft: "3px solid " + (isHi ? pc : "transparent"), borderBottom: "1px solid " + C.navy + "33", cursor: "pointer", transition: "all 0.1s", display: "grid", gridTemplateColumns: "6px 1fr", gap: "0.6rem", alignItems: "center" }}>
                <div style={{ width: 3, height: 36, background: pc, borderRadius: 2 }} />
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.12rem", flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "0.8rem", color: isHi ? pc : C.muted, letterSpacing: "0.08em" }}>{r.type?.toUpperCase()} {r.number}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.36rem", color: C.dimmer }}>{r.congress}th Cong.</span>
                    <span style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "0.55rem", color: pc, background: pc + "18", border: "1px solid " + pc + "33", padding: "0 0.28rem", letterSpacing: "0.08em" }}>{partyLabel(r.party || "B")}</span>
                    {r.status && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.34rem", color: C.dim }}>{r.status}</span>}
                  </div>
                  <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "0.86rem", color: isHi ? C.cream : "#3a5270", lineHeight: 1.2, letterSpacing: "0.02em" }}>{r.title}</div>
                </div>
              </div>
            );
          })}

          {/* Footer */}
          <div style={{ padding: "0.25rem 0.75rem", borderTop: "1px solid " + C.navy, display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.34rem", color: C.dimmer }}>↑↓ navigate · Enter select · Esc close</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.34rem", color: C.dimmer }}>api.congress.gov</span>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Outlet bias map (AllSides-style, hardcoded for credibility) ---
const OUTLET_BIAS = {
  reuters:"center", ap:"center", "associated press":"center", bloomberg:"center",
  politico:"center", axios:"center", "the hill":"center", npr:"lean-left",
  pbs:"lean-left", abc:"lean-left", cbs:"lean-left", nbc:"lean-left",
  nyt:"lean-left", "new york times":"lean-left", "washington post":"lean-left",
  cnn:"lean-left", msnbc:"left", guardian:"left", vox:"left", "the atlantic":"left",
  "mother jones":"left", huffpost:"left", "fox news":"right", "the daily wire":"right",
  breitbart:"right", "the federalist":"right", "national review":"lean-right",
  "ny post":"lean-right", "new york post":"lean-right", "washington times":"lean-right",
  "daily mail":"lean-right", "wall street journal":"lean-right", wsj:"lean-right",
  "the economist":"center", forbes:"center", "usa today":"lean-left", newsweek:"center",
};
const BIAS_COLOR = {
  left:"#3C5FA3", "lean-left":"#5b7fc4",
  center:"#c8a14b", "lean-right":"#c96a6a", right:"#c1272d", unrated:"#8a8a96",
};
const BIAS_LABEL = {
  left:"LEFT", "lean-left":"LEAN LEFT", center:"CENTER",
  "lean-right":"LEAN RIGHT", right:"RIGHT", unrated:"UNRATED",
};
function biasOf(name) {
  if (!name) return "unrated";
  let s = String(name).toLowerCase().trim()
    .replace(/^the\s+/, "").replace(/\.(com|org|net|co\.uk)$/, "")
    .replace(/\s+(news|network|online|digital|media)$/, "").trim();
  if (OUTLET_BIAS[s]) return OUTLET_BIAS[s];
  for (const k in OUTLET_BIAS) if (s.includes(k) || k.includes(s)) return OUTLET_BIAS[k];
  return "unrated";
}
const OUTLETS = [
  { name: "New York Times", url: "https://www.nytimes.com", lean: 18, tone: "supportive", coverage: 88, date: "Mar 14, 2025", headline: "Senate Bill Would Force Platforms to Limit Teen Access to Addictive Features", angle: "Frames as landmark consumer protection. Emphasis on Big Tech accountability.", billSection: "&#167; 3(a)(1) — Duty of Care", billText: "A covered platform shall act in the best interests of a minor user and shall not design, deploy, or maintain a platform feature that the platform knows, or reasonably should know, causes or is likely to cause physical or psychological harm to a minor user, including harm caused by any addictive or compulsive usage pattern.", keywords: ["best interests of a minor user", "physical or psychological harm", "addictive or compulsive usage pattern"] },
  { name: "Wall Street Journal", url: "https://www.wsj.com", lean: 76, tone: "skeptical", coverage: 71, date: "Mar 18, 2025", headline: "KOSA Would Let Government Decide What's 'Harmful' for Teens Online", angle: "Focuses on government overreach, regulatory burden, and enforcement ambiguity.", billSection: "&#167; 2(7) — Definition of Harm", billText: "The term 'harm to minors' includes physical, psychological, financial, or societal harm, as determined by the Commission in consultation with the Secretary of Health and Human Services, based on evidence including peer-reviewed research, clinical guidance, and expert testimony submitted to the record.", keywords: ["as determined by the Commission", "peer-reviewed research", "expert testimony"] },
  { name: "NPR", url: "https://www.npr.org", lean: 33, tone: "neutral", coverage: 94, date: "Mar 20, 2025", headline: "Kids Online Safety Act — What It Actually Does", angle: "Explanatory and balanced. Best overall coverage of actual provisions.", billSection: "&#167; 4(b)(2) — Parental Tools", billText: "A covered platform shall provide a minor user's parent or legal guardian with tools to: (A) supervise the minor's use of platform features; (B) limit the time a minor may spend using the platform; (C) restrict the minor's ability to make in-application purchases; and (D) access a summary of the content categories to which the minor has been exposed during the preceding 30 days.", keywords: ["parent or legal guardian", "limit the time", "in-application purchases", "content categories"] },
  { name: "Fox News", url: "https://www.foxnews.com", lean: 84, tone: "negative", coverage: 44, date: "Mar 22, 2025", headline: "Democrat-Led Bill Could Give Feds Power to Police Teen Internet Use", angle: "Partisan framing leads. Minimal bill substance. Censorship angle dominant.", billSection: "&#167; 7(a) — FTC Enforcement", billText: "The Federal Trade Commission shall enforce this Act in the same manner, by the same means, and with the same jurisdiction, powers, and duties as though all applicable terms of the Federal Trade Commission Act were incorporated into and made a part of this Act. Any covered platform that violates this Act shall be subject to civil penalties not to exceed $50,000 per violation per day.", keywords: ["Federal Trade Commission shall enforce", "civil penalties", "$50,000 per violation per day"] },
];
const TIMELINE = [
  { month: "Aug '23", event: "Bill Introduced", coverage: 12, tone: "neutral" },
  { month: "Oct '23", event: "Committee Hearing", coverage: 28, tone: "supportive" },
  { month: "Jan '24", event: "Tech Lobby Push", coverage: 55, tone: "skeptical" },
  { month: "Mar '24", event: "Senate Vote 91-3", coverage: 88, tone: "supportive" },
  { month: "May '24", event: "House Stall", coverage: 42, tone: "negative" },
  { month: "Sep '24", event: "Reintroduced", coverage: 31, tone: "neutral" },
];
const POLLING = {
  overall: 67, oppose: 21, undecided: 12, trend: "Rising",
  trendData: [{ m: "Dec", v: 58 }, { m: "Jan", v: 61 }, { m: "Feb", v: 63 }, { m: "Mar", v: 65 }, { m: "Apr", v: 67 }],
  party: { dem: 81, rep: 72, ind: 61 },
  demos: [{ g: "18-34", v: 74 }, { g: "35-54", v: 68 }, { g: "55+", v: 61 }, { g: "Urban", v: 72 }, { g: "Rural", v: 59 }],
};
const CONTENT_IDEAS = [
  { type: "SHORT", platform: "TikTok / Reels", hook: "They said KOSA would censor the internet. Here's what it actually says.", angle: "Show bill text vs headline side-by-side. The gap IS the content." },
  { type: "LONG", platform: "YouTube", hook: "I read all 47 pages of KOSA so you don't have to.", angle: "Use the bill language panel as your on-screen source. React to each provision live." },
  { type: "THREAD", platform: "X / Twitter", hook: "KOSA passed the Senate 91-3. Here's what 90% of the coverage got wrong.", angle: "7-tweet breakdown using divergence data. End with the Reader Pulse numbers." },
  { type: "NEWSLETTER", platform: "Substack / Email", hook: "The Kids Online Safety Act: what the bill says, what the press printed, what your readers think.", angle: "Full analysis using all four sections. Embed the polling breakdown as an image." },
];

const C = {
  bg: "#000000", header: "#0a0a0c", panel: "#16161a",
  panelHi: "#1f1f24", navy: "#1b2d5c", border: "#2a2a30",
  red: "#c1272d", gold: "#c8a14b", blue: "#3C5FA3",
  cream: "#ece6da", muted: "#8a8a96", dim: "#5a5a64", dimmer: "#2a2a30",
};

const NAV = [
  { id: "brief",     num: "01", label: "Bill Brief",        sub: "Summary & Divergence",   color: "#B22234" },
  { id: "media",     num: "02", label: "Media Analysis",    sub: "Outlets & Framing",      color: "#3C5FA3" },
  { id: "language",  num: "03", label: "Bill Language",     sub: "Statutory Text",         color: "#C8960C" },
  { id: "studio",    num: "04", label: "Commentary Studio", sub: "Script & Angles",        color: "#4A8FA8" },
  { id: "timeline",  num: "05", label: "Coverage Timeline", sub: "Volume & Tone",          color: "#7B5EA7" },
  { id: "pulse",     num: "06", label: "Reader Pulse",      sub: "Polling Data",           color: "#2E8B57" },
  { id: "lede",      num: "07", label: "Buried Lede",       sub: "What They Hid",          color: "#CC5500" },
  { id: "cards",     num: "09", label: "Cards",            sub: "Media Card Generator",   color: "#7C3AED" },
  { id: "compare",  num: "10", label: "Compare",         sub: "Side by Side",       color: "#c1272d" },
];

const TONE_CFG = {
  supportive: { label: "Supportive", accent: "#22c55e" },
  neutral:    { label: "Neutral",    accent: "#94a3b8" },
  skeptical:  { label: "Skeptical",  accent: "#a855f7" },
  negative:   { label: "Critical",   accent: "#ef4444" },
};
const leanColor = s => partisanColor(s);
const leanLabel = s => partisanLabel(s);
const demoColor = v => v >= 68 ? C.gold : v >= 58 ? C.blue : C.red;
const toneColor = t => TONE_CFG[t]?.accent || C.cream;

const SHADOW = {
  card:  "0 8px 48px rgba(0,0,0,0.75), 0 2px 8px rgba(0,0,0,0.5)",
  tone:  t   => { const col = TONE_CFG[t]?.accent || "#94a3b8"; return `0 0 0 1px ${col}33, 0 4px 16px ${col}55, 0 8px 24px ${col}22, 0 2px 6px rgba(0,0,0,0.9)`; },
  bias:  col => `0 0 0 1px ${col}33, 0 4px 16px ${col}55, 0 8px 24px ${col}22, 0 2px 6px rgba(0,0,0,0.9)`,
  pill:  col => `0 0 0 1px ${col}44, 0 4px 16px ${col}77, 0 8px 24px ${col}33`,
  glow:  col => `0 6px 32px ${col}55, 0 2px 12px ${col}33`,
  stat:  col => `0 12px 56px ${col}66, 0 4px 24px ${col}44`,
};

// ── Primitives ─────────────────────────────────────────────────
function Bar({ pct, color, h }) {
  return (
    <div style={{ height: h || 7, background: "#16161a", borderRadius: 2, overflow: "hidden" }}>
      <div style={{ height: "100%", width: pct + "%", background: color, borderRadius: 2, transition: "width 1.1s ease" }} />
    </div>
  );
}
function AnimNum({ target, suffix }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let s = null;
    const r = ts => { if (!s) s = ts; const p = Math.min((ts - s) / 1000, 1); setV(Math.round((1 - Math.pow(1 - p, 3)) * target)); if (p < 1) requestAnimationFrame(r); };
    requestAnimationFrame(r);
  }, [target]);
  return <>{v}{suffix || "%"}</>;
}
function Spark({ data, color }) {
  const w = 280, h = 52, p = 6;
  const vs = data.map(d => d.v);
  const mn = Math.min(...vs) - 3, mx = Math.max(...vs) + 3;
  const xi = i => p + i * (w - p * 2) / (data.length - 1);
  const yi = v => h - p - ((v - mn) / (mx - mn)) * (h - p * 2);
  const pts = data.map((d, i) => xi(i) + "," + yi(d.v));
  const gid = "sg" + color.replace(/\W/g, "");
  return (
    <svg viewBox={"0 0 " + w + " " + h} style={{ width: "100%", height: 52, display: "block" }}>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.3" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={"M" + p + "," + h + " " + pts.map(pt => "L" + pt).join(" ") + " L" + xi(data.length - 1) + "," + h + " Z"} fill={"url(#" + gid + ")"} />
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
      {data.map((d, i) => <circle key={i} cx={xi(i)} cy={yi(d.v)} r={i === data.length - 1 ? 5 : 3} fill={i === data.length - 1 ? color : C.bg} stroke={color} strokeWidth="2" />)}
    </svg>
  );
}
function HLText({ text, keywords, accent }) {
  const escaped = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = text.split(new RegExp("(" + escaped.join("|") + ")", "gi"));
  return <span>{parts.map((p, i) => keywords.some(k => k.toLowerCase() === p.toLowerCase()) ? <mark key={i} style={{ background: accent + "22", color: accent, borderBottom: "2px solid " + accent, padding: "0 3px", borderRadius: 2, fontWeight: 700 }}>{p}</mark> : <span key={i}>{p}</span>)}</span>;
}
function Card({ children, style }) {
  return <div style={Object.assign({ background: C.panel, border: "1px solid " + C.border, padding: "1rem 1.2rem" }, style || {})}>{children}</div>;
}
function SL({ children, accent }) {
  return <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "0.7rem", letterSpacing: "0.22em", color: accent || C.red, borderBottom: "1px solid " + (accent || C.red) + "33", paddingBottom: "0.35rem", marginBottom: "0.7rem" }}>{children}</div>;
}
function BN({ children, color, size }) {
  return <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: size || "4rem", color: color || C.gold, lineHeight: 1 }}>{children}</div>;
}
function MN({ children, color, size, spacing }) {
  return <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: size || "0.48rem", color: color || C.dim, letterSpacing: spacing || "0.1em" }}>{children}</div>;
}

// ── Skeleton loader ────────────────────────────────────────────
function Skeleton({ w, h, style }) {
  return <div style={Object.assign({ width: w || "100%", height: h || 12, background: C.navy, borderRadius: 2, animation: "blink 1.4s ease-in-out infinite" }, style || {})} />;
}
function SkeletonCard() {
  return (
    <div style={{ background: C.panel, border: "1px solid " + C.border, padding: "1rem", display: "flex", flexDirection: "column", gap: "0.65rem" }}>
      <Skeleton h={8} w="40%" />
      <Skeleton h={32} />
      <Skeleton h={8} w="70%" />
      <Skeleton h={8} w="55%" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SCROLL BANNER TAB — rolls DOWN from top like unfurling parchment
// ─────────────────────────────────────────────────────────────
function ScrollBannerTab({ tab, isActive, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        width: isActive ? 130 : 110,
        minWidth: isActive ? 130 : 110,
        position: "relative",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        zIndex: isActive ? 20 : 1,
        filter: isActive ? "none" : "brightness(0.45)",
        transition: "filter 0.25s ease, width 0.3s ease",
        flexShrink: 0,
      }}
    >
      {/* Top scroll roller — the rod the parchment rolls off */}
      <div style={{
        width: "100%",
        height: 10,
        background: "linear-gradient(180deg, " + tab.color + "cc 0%, " + tab.color + " 50%, " + tab.color + "88 100%)",
        borderRadius: "3px 3px 0 0",
        boxShadow: isActive ? "0 -2px 8px " + tab.color + "66" : "none",
        position: "relative",
        zIndex: 2,
      }}>
        {/* Roller highlight */}
        <div style={{ position: "absolute", top: 2, left: "10%", right: "10%", height: 2, background: "rgba(255,255,255,0.3)", borderRadius: 2 }} />
      </div>

      {/* The unfurled scroll body */}
      <div style={{
        width: "100%",
        background: "linear-gradient(180deg, " + tab.color + "f0 0%, " + tab.color + "cc 60%, " + tab.color + "aa 100%)",
        padding: isActive ? "0.75rem 0.6rem 1rem" : "0.5rem 0.6rem 0.6rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.2rem",
        transition: "padding 0.35s cubic-bezier(0.34,1.4,0.64,1)",
        position: "relative",
        overflow: "hidden",
        boxShadow: isActive
          ? "0 8px 24px " + tab.color + "55, inset 0 1px 0 rgba(255,255,255,0.15)"
          : "0 4px 12px rgba(0,0,0,0.5)",
      }}>

        {/* Parchment grain texture overlay */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.06,
          backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.5) 0px, transparent 1px, transparent 3px)",
          pointerEvents: "none",
        }} />

        {/* Number */}
        <div style={{
          fontFamily: "'Bebas Neue', Impact, sans-serif",
          fontSize: isActive ? "1.6rem" : "1.2rem",
          color: "rgba(255,255,255,0.2)",
          lineHeight: 1,
          transition: "font-size 0.3s ease",
          userSelect: "none",
        }}>{tab.num}</div>

        {/* Label */}
        <div style={{
          fontFamily: "'Bebas Neue', Impact, sans-serif",
          fontSize: isActive ? "1.05rem" : "0.85rem",
          color: "#fff",
          letterSpacing: "0.1em",
          lineHeight: 1,
          textAlign: "center",
          transition: "font-size 0.3s ease",
        }}>{tab.label}</div>

        {/* Sub — only visible when active */}
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "0.42rem",
          color: "rgba(255,255,255,0.55)",
          letterSpacing: "0.07em",
          textAlign: "center",
          maxHeight: isActive ? "20px" : "0px",
          opacity: isActive ? 1 : 0,
          overflow: "hidden",
          transition: "max-height 0.3s ease, opacity 0.25s ease",
          marginTop: isActive ? "0.15rem" : 0,
        }}>{tab.sub}</div>

        {/* Active indicator dot */}
        {isActive && (
          <div style={{
            width: 5, height: 5, borderRadius: "50%",
            background: "rgba(255,255,255,0.7)",
            marginTop: "0.3rem",
            boxShadow: "0 0 6px rgba(255,255,255,0.8)",
            animation: "pulseGlow 1.5s ease-in-out infinite",
          }} />
        )}
      </div>

      {/* Bottom curl — the scroll unfurls downward */}
      <div style={{
        width: "100%",
        height: isActive ? 14 : 8,
        background: "linear-gradient(180deg, " + tab.color + "88, transparent)",
        position: "relative",
        transition: "height 0.35s cubic-bezier(0.34,1.4,0.64,1)",
      }}>
        {/* Curved bottom edge of parchment */}
        <div style={{
          position: "absolute",
          bottom: 0, left: "5%", right: "5%",
          height: isActive ? 8 : 5,
          background: tab.color + "44",
          borderRadius: "0 0 50% 50%",
          transition: "height 0.35s ease",
          filter: "blur(2px)",
        }} />
      </div>

      {/* Active glow beam down into content */}
      {isActive && (
        <div style={{
          position: "absolute",
          top: "100%",
          left: "10%", right: "10%",
          height: 40,
          background: "linear-gradient(180deg, " + tab.color + "33, transparent)",
          pointerEvents: "none",
          zIndex: 0,
        }} />
      )}
    </div>
  );
}

// ── TAB CONTENTS (same as before, compact) ────────────────────

// ── Outlet toggle pill ──────────────────────────────────────────
function OutletPill({ outlet, active, onClick }) {
  const accent = (TONE_CFG[outlet.tone]?.accent) || "#94a3b8";
  const biasColor = partisanColor(outlet.lean);
  return (
    <button onClick={onClick} style={{
      padding: "0.35rem 0.85rem",
      background: active ? accent : C.panel,
      color: active ? C.bg : C.dim,
      border: `1px solid ${active ? accent : C.border}`,
      borderRadius: 14,
      fontFamily: "'Bebas Neue', Impact, sans-serif",
      fontSize: "0.88rem", letterSpacing: "0.1em",
      cursor: "pointer", transition: "all 0.2s",
      boxShadow: active ? SHADOW.pill(biasColor) : "none",
    }}>
      {outlet.name}
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.32rem", opacity: 0.7, marginLeft: 4 }}>{outlet.coverage}%</span>
    </button>
  );
}

// ── Outlet expanded card ─────────────────────────────────────────
function OutletExpandedCard({ outlet, showText }) {
  const accent = TONE_CFG[outlet.tone]?.accent || "#94a3b8";
  const biasColor = partisanColor(outlet.lean);
  return (
    <div style={{
      background: C.panel, border: `1px solid ${C.border}`,
      borderLeft: `4px solid ${accent}`, borderRadius: 10,
      padding: "1.1rem 1.2rem",
      boxShadow: `0 0 0 1px ${biasColor}33, 0 4px 16px ${biasColor}55, 0 8px 24px ${biasColor}22, 0 2px 6px rgba(0,0,0,0.9)`,
      animation: "slideDown 0.2s ease",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "1.05rem", color: C.cream, letterSpacing: "0.04em" }}>{outlet.name}</div>
          <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", marginTop: 3 }}>
            <span style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "0.6rem", color: accent, border: `1px solid ${accent}44`, padding: "0.08rem 0.4rem", borderRadius: 4, letterSpacing: "0.1em" }}>{TONE_CFG[outlet.tone]?.label || outlet.tone}</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.38rem", color: C.muted }}>{outlet.coverage}% coverage</span>
          </div>
        </div>
        <div style={{ width: 80 }}>
          <div style={{ position: "relative", height: 5, background: `linear-gradient(90deg,${DEM},${IND},${REP})`, borderRadius: 3 }}>
            <div style={{ position: "absolute", top: "50%", left: outlet.lean + "%", transform: "translate(-50%,-50%)", width: 11, height: 11, borderRadius: "50%", background: partisanColor(outlet.lean), border: `2px solid ${C.bg}` }} />
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.34rem", color: partisanColor(outlet.lean), textAlign: "center", marginTop: 3 }}>{partisanLabel(outlet.lean)}</div>
        </div>
      </div>
      {outlet.url
        ? <a href={outlet.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
            <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "1.05rem", color: C.cream, lineHeight: 1.2, marginBottom: "0.5rem", letterSpacing: "0.02em" }}>
              {outlet.headline} <span style={{ fontSize: "0.5rem", opacity: 0.5 }}>&#8599;</span>
            </div>
          </a>
        : <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "1.05rem", color: C.cream, lineHeight: 1.2, marginBottom: "0.5rem", letterSpacing: "0.02em" }}>{outlet.headline}</div>
      }
      <div style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: "0.82rem", color: C.muted, lineHeight: 1.6, marginBottom: showText ? "1rem" : 0 }}>{outlet.angle}</div>
      {showText && (
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: "0.85rem", marginTop: "0.25rem" }}>
          <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "0.7rem", color: accent, letterSpacing: "0.1em", marginBottom: "0.5rem" }}>{outlet.billSection}</div>
          <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "0.85rem 1rem", fontFamily: "Georgia, serif", fontSize: "0.88rem", color: "#7a9ab8", lineHeight: 1.9 }}>
            <HLText text={outlet.billText} keywords={outlet.keywords} accent={accent} />
          </div>
          {outlet.keywords?.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginTop: "0.6rem" }}>
              {outlet.keywords.map((k, i) => <span key={i} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.42rem", color: accent, background: accent + "14", border: `1px solid ${accent}2a`, padding: "0.18rem 0.45rem", borderRadius: 4 }}>{k}</span>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BillBrief({ bill, loading }) {
  const B = bill || DEFAULT_BILL;
  const hasLiveData = bill && bill !== DEFAULT_BILL;

  if (loading) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        <SkeletonCard />
        <SkeletonCard />
        <div style={{ gridColumn: "1/-1" }}><SkeletonCard /></div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
      <Card style={{ borderLeft: "4px solid " + C.gold, borderRadius: 14, boxShadow: SHADOW.glow(C.gold) }}>
        <SL accent={C.gold}>Bill Summary</SL>
        <div style={{ fontFamily: "'Georgia', serif", fontSize: "0.87rem", color: C.muted, lineHeight: 1.78, marginBottom: "1rem" }}>{B.summary}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
          {[["Status", B.status, C.gold], ["Sponsor", B.sponsor, C.cream], ["Introduced", B.introduced, C.muted], ["Cost", B.cost, C.muted]].map(([k, val, col]) => (
            <div key={k} style={{ background: C.bg, border: "1px solid " + C.navy, padding: "0.38rem 0.6rem", flex: "1 1 120px" }}>
              <MN color={C.dim} size="0.38rem" spacing="0.12em">{k.toUpperCase()}</MN>
              <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "0.75rem", color: col, marginTop: 2 }}>{val}</div>
            </div>
          ))}
        </div>
      </Card>
      <Card style={{ borderLeft: "4px solid " + C.gold, borderRadius: 14, boxShadow: SHADOW.glow(C.gold) }}>
        <SL accent={C.red}>Key Provisions</SL>
        {B.keyProvisions.map((p, i) => (
          <div key={i} style={{ display: "flex", gap: "0.6rem", marginBottom: "0.6rem" }}>
            <BN color={C.red} size="1.05rem">{i + 1}</BN>
            <div style={{ fontFamily: "'Georgia', serif", fontSize: "0.84rem", color: C.muted, lineHeight: 1.6, paddingTop: 1 }}>{p}</div>
          </div>
        ))}
      </Card>
      <div style={{ gridColumn: "1/-1", background: C.bg, border: "1px solid " + C.red + "22", padding: "1rem 1.3rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 1fr", gap: "1.5rem", alignItems: "center" }}>
          <div style={{ textAlign: "center" }}>
            <BN color={C.red} size="4.2rem"><AnimNum target={72} /></BN>
            <MN color={C.dim} size="0.4rem" spacing="0.12em">DIVERGENCE</MN>
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.4rem" }}>
              <BN color={C.cream} size="1rem">Media Divergence Score</BN>
              {hasLiveData && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.4rem", color: "#4A8FA8", border: "1px solid #4A8FA844", padding: "0.08rem 0.35rem" }}>LIVE BILL</span>}
            </div>
            <div style={{ height: 9, background: C.navy, borderRadius: 2, overflow: "hidden", margin: "0 0 0.3rem" }}>
              <div style={{ height: "100%", width: "72%", background: "linear-gradient(90deg," + DEM + "," + C.gold + "," + REP + ")", borderRadius: 2 }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><MN color={C.dim} size="0.4rem">Accurate</MN><MN color={C.dim} size="0.4rem">Misleading</MN></div>
          </div>
          <div style={{ fontFamily: "'Georgia', serif", fontStyle: "italic", fontSize: "0.84rem", color: C.muted, lineHeight: 1.7, borderLeft: "2px solid " + C.red + "44", paddingLeft: "1rem" }}>
            {hasLiveData
              ? "Use the Media Analysis tab to see how " + B.name + " was covered across outlets, and the Buried Lede tab to find what they missed."
              : "Media framed KOSA as a censorship bill. The actual text requires platforms to protect minors — not government control of content."
            }
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Source Selector ────────────────────────────────────────────
// Shows at the top of media-facing tabs, lets user pick data source
const SOURCES = [
  { id: "demo",    label: "Demo Data",        icon: "&#9672;", color: C.gold,    desc: "Hardcoded KOSA example data" },
  { id: "gdelt",   label: "GDELT",            icon: "&#9673;", color: "#4A8FA8", desc: "Live global news coverage index" },
  { id: "archive", label: "Internet Archive", icon: "&#9719;", color: "#7B5EA7", desc: "Archived articles & documents" },
  { id: "cc",      label: "CommonCrawl",      icon: "&#167;",  color: "#2E8B57", desc: "Deep historical web crawl" },
];

function SourceSelector({ active, onSelect, loading, error }) {
  return (
    <div style={{ background: C.panel, border: "1px solid " + C.border, padding: "0.65rem 0.85rem", marginBottom: "0.75rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <MN color={C.dim} size="0.44rem" spacing="0.12em">DATA SOURCE</MN>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", flex: 1 }}>
          {SOURCES.map(s => {
            const isA = active === s.id;
            return (
              <button key={s.id} onClick={() => onSelect(s.id)} style={{
                fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "0.72rem",
                letterSpacing: "0.1em", padding: "0.28rem 0.7rem",
                background: isA ? s.color : "transparent",
                color: isA ? C.bg : s.color,
                border: "1px solid " + s.color + (isA ? "" : "66"),
                cursor: "pointer", transition: "all 0.15s",
                display: "flex", alignItems: "center", gap: "0.3rem",
              }}>
                <span style={{ fontSize: "0.65rem" }}>{s.icon}</span>
                {s.label}
                {isA && loading && <div style={{ width: 8, height: 8, border: "1.5px solid " + C.bg, borderTop: "1.5px solid transparent", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />}
              </button>
            );
          })}
        </div>
        {active !== "demo" && (
          <MN color={C.dim} size="0.4rem">{SOURCES.find(s => s.id === active)?.desc}</MN>
        )}
      </div>
      {error && <div style={{ marginTop: "0.4rem", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.42rem", color: C.red }}>{error}</div>}
    </div>
  );
}

function MediaAnalysis({ bill, archivalData, sourceLoading, sourceError, activeSource, onSourceSelect }) {
  const [selected, setSelected] = useState(new Set());
  const toggle = i => setSelected(prev => {
    const next = new Set(prev);
    next.has(i) ? next.delete(i) : next.add(i);
    return next;
  });
  const displayOutlets = archivalData?.mediaAnalysis?.outlets?.length
    ? archivalData.mediaAnalysis.outlets.map(o => ({ ...o, url: "", billSection: "Live Data", billText: o.angle || "", keywords: [] }))
    : OUTLETS;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.42rem", color: C.dim, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "0.6rem" }}>Select outlets to compare</div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {displayOutlets.map((o, i) => <OutletPill key={i} outlet={o} active={selected.has(i)} onClick={() => toggle(i)} />)}
        </div>
      </div>
      {selected.size === 0 && (
        <div style={{ textAlign: "center", padding: "2.5rem 1rem", border: `1px dashed ${C.border}`, borderRadius: 10 }}>
          <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "1.1rem", color: C.dim, letterSpacing: "0.08em" }}>Tap any outlet above</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.44rem", color: C.muted, marginTop: "0.4rem" }}>Cards stack as you select them</div>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {displayOutlets.map((o, i) => selected.has(i) && <OutletExpandedCard key={i} outlet={o} showText={false} />)}
      </div>
    </div>
  );
}

function BillLanguage({ bill }) {
  const B = bill || DEFAULT_BILL;
  const [selected, setSelected] = useState(new Set());
  const [fullscreen, setFullscreen] = useState(null);
  const [keyword, setKeyword] = useState("");

  const toggle = i => setSelected(prev => {
    const next = new Set(prev);
    next.has(i) ? next.delete(i) : next.add(i);
    return next;
  });

  const highlight = (text, kw, accent) => {
    if (!kw.trim()) return <HLText text={text} keywords={OUTLETS[0]?.keywords||[]} accent={accent} />;
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = text.split(new RegExp("(" + escaped + ")", "gi"));
    return <span>{parts.map((p, i) =>
      p.toLowerCase() === kw.toLowerCase()
        ? <mark key={i} style={{ background: C.gold + "33", color: C.gold, borderBottom: "2px solid " + C.gold, padding: "0 2px", borderRadius: 2, fontWeight: 700 }}>{p}</mark>
        : <span key={i}>{p}</span>
    )}</span>;
  };

  return (
    <>
      {/* Fullscreen layer */}
      {fullscreen !== null && (
        <div style={{ position: "fixed", inset: 0, background: C.bg, zIndex: 9999, display: "flex", flexDirection: "column", animation: "slideDown 0.2s ease" }}>
          {/* Header */}
          <div style={{ background: C.header, borderBottom: "1px solid " + C.border, padding: "0.75rem 1.25rem", display: "flex", alignItems: "center", gap: "1rem", flexShrink: 0 }}>
            <button onClick={() => setFullscreen(null)} style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "0.8rem", color: C.muted, background: C.panel, border: "1px solid " + C.border, borderRadius: 14, padding: "0.3rem 0.7rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.3rem" , boxShadow: SHADOW.card }}>
              &larr; Back
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "0.95rem", color: C.cream, letterSpacing: "0.04em" }}>{OUTLETS[fullscreen]?.name}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.38rem", color: C.muted }}>{OUTLETS[fullscreen]?.section}</div>
            </div>
            <span style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "0.65rem", color: TONE_CFG[OUTLETS[fullscreen]?.tone]?.accent, border: "1px solid " + TONE_CFG[OUTLETS[fullscreen]?.tone]?.accent + "44", padding: "0.1rem 0.4rem", borderRadius: 6 }}>
              {TONE_CFG[OUTLETS[fullscreen]?.tone]?.label}
            </span>
          </div>

          {/* Keyword search */}
          <div style={{ padding: "0.75rem 1.25rem", borderBottom: "1px solid " + C.border, background: C.header, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", background: C.bg, border: "1px solid " + C.border, borderRadius: 14, height: 34, padding: "0 0.65rem", gap: "0.4rem" , boxShadow: SHADOW.card }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.dim} strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="Search bill text — type any keyword or section number..."
                style={{ flex: 1, background: "none", border: "none", color: C.cream, fontFamily: "'JetBrains Mono', monospace", fontSize: "0.5rem", outline: "none" }} />
              {keyword && <button onClick={() => setKeyword("")} style={{ color: C.dim, fontSize: "0.5rem", background: "none" }}>&#10005;</button>}
            </div>
          </div>

          {/* Full bill text */}
          <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem 1.25rem" }}>
            {(() => {
              const o = OUTLETS[fullscreen];
              const accent = TONE_CFG[o?.tone]?.accent || C.gold;
              return (
                <>
                  <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "1.1rem", color: accent, letterSpacing: "0.06em", marginBottom: "0.35rem" }}>{o?.section}</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.38rem", color: C.muted, marginBottom: "1rem" }}>{o?.name} · {o?.tone} coverage · {o?.coverage}% volume</div>
                  <div style={{ fontFamily: "Georgia, serif", fontSize: "1.05rem", color: "#94a3b8", lineHeight: 2.1, borderLeft: "4px solid " + accent, paddingLeft: "1.25rem" }}>
                    {keyword ? highlight(o?.billText || "", keyword, accent) : <HLText text={o?.billText || ""} keywords={o?.keywords || []} accent={accent} />}
                  </div>
                  {keyword && (
                    <div style={{ marginTop: "1.5rem", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.42rem", color: C.muted }}>
                      {(o?.billText || "").toLowerCase().split(keyword.toLowerCase()).length - 1} match{(o?.billText || "").toLowerCase().split(keyword.toLowerCase()).length - 1 !== 1 ? "es" : ""} for "{keyword}"
                    </div>
                  )}
                  <div style={{ marginTop: "1.5rem" }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.4rem", color: C.muted, letterSpacing: "0.12em", marginBottom: "0.5rem" }}>KEY TERMS IN THIS SECTION</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                      {(o?.keywords || []).map((k, i) => (
                        <button key={i} onClick={() => setKeyword(k)} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.46rem", color: accent, background: accent + "14", border: "1px solid " + accent + "2a", padding: "0.2rem 0.5rem", borderRadius: 4, cursor: "pointer" }}>{k}</button>
                      ))}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Normal view */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div style={{ background: C.panel, border: "1px solid " + C.border, borderLeft: "4px solid " + C.gold, padding: "0.5rem 0.85rem", borderRadius: 14, boxShadow: SHADOW.glow(C.gold) }}>
          <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "0.82rem", color: C.cream, letterSpacing: "0.06em" }}>{B.name}</div>
          <MN color={C.muted} size="0.4rem">{B.id} · Tap outlets to expand · Tap card to read full text</MN>
        </div>

        {/* Keyword search bar */}
        <div style={{ display: "flex", alignItems: "center", background: C.panel, border: "1px solid " + C.border, borderRadius: 14, height: 36, padding: "0 0.65rem", gap: "0.4rem", boxShadow: SHADOW.card }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.dim} strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="Search bill text — keyword or section..."
            style={{ flex: 1, background: "none", border: "none", color: C.cream, fontFamily: "'JetBrains Mono', monospace", fontSize: "0.5rem", outline: "none" }} />
          {keyword && <button onClick={() => setKeyword("")} style={{ color: C.dim, fontSize: "0.5rem", background: "none" }}>&#10005;</button>}
        </div>

        <div>
          <MN color={C.dim} size="0.42rem" spacing="0.16em">TOGGLE OUTLETS · TAP CARD TO OPEN FULL TEXT</MN>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.6rem" }}>
            {OUTLETS.map((o, i) => <OutletPill key={i} outlet={o} active={selected.has(i)} onClick={() => toggle(i)} />)}
          </div>
        </div>

        {selected.size === 0 && (
          <div style={{ textAlign: "center", padding: "2.5rem 1rem", border: "1px dashed " + C.border, borderRadius: 10 }}>
            <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "1.1rem", color: C.dim, letterSpacing: "0.08em" }}>Select an outlet above</div>
            <MN color={C.muted} size="0.44rem">Tap any card to open the full statutory text</MN>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {OUTLETS.map((o, i) => selected.has(i) && (
            <div key={i} onClick={() => setFullscreen(i)} style={{ cursor: "pointer" }}>
              <OutletExpandedCard outlet={o} showText={true} keyword={keyword} />
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.38rem", color: C.muted, textAlign: "right", marginTop: "0.3rem", paddingRight: "0.25rem" }}>Tap to open full text →</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}


function CommentaryStudio({ bill }) {
  const B = bill || DEFAULT_BILL;
  const [notes, setNotes] = useState("Your script goes here. Draft your opening hook, the gap reveal, and your close.");
  const [selIdea, setSelIdea] = useState(0);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.7rem" }}>
      <Card style={{ borderLeft: "4px solid " + C.gold, borderRadius: 14, boxShadow: SHADOW.glow(C.gold) }}>
        <SL accent={C.gold}>Content Angles</SL>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.42rem" }}>
          {CONTENT_IDEAS.map((idea, i) => (
            <div key={i} onClick={() => setSelIdea(i)} style={{ background: selIdea === i ? C.bg : "transparent", border: "1px solid " + (selIdea === i ? C.gold + "44" : C.border), borderLeft: "3px solid " + (selIdea === i ? C.gold : C.border), padding: "0.65rem 0.8rem", cursor: "pointer", transition: "all 0.15s" }}>
              <div style={{ display: "flex", gap: "0.42rem", alignItems: "center", marginBottom: "0.22rem" }}>
                <span style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "0.65rem", color: C.red, border: "1px solid " + C.red + "44", padding: "0.04rem 0.3rem" }}>{idea.type}</span>
                <MN color={C.dim} size="0.4rem">{idea.platform}</MN>
              </div>
              <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "0.88rem", color: selIdea === i ? C.cream : C.dim, lineHeight: 1.2, marginBottom: selIdea === i ? "0.3rem" : 0 }}>{idea.hook}</div>
              {selIdea === i && <div style={{ fontFamily: "'Georgia', serif", fontStyle: "italic", fontSize: "0.74rem", color: C.muted, lineHeight: 1.5 }}>{idea.angle}</div>}
            </div>
          ))}
        </div>
      </Card>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
        <Card style={{ flex: 1, display: "flex", flexDirection: "column", borderLeft: "4px solid " + C.gold, borderRadius: 14, boxShadow: SHADOW.glow(C.gold) }}>
          <SL accent={C.cream}>Script / Notes</SL>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} style={{ flex: 1, minHeight: 110, width: "100%", background: C.bg, border: "1px solid " + C.navy, borderLeft: "3px solid " + C.cream + "33", color: C.muted, fontFamily: "'Georgia', serif", fontSize: "0.83rem", lineHeight: 1.75, padding: "0.7rem", outline: "none", resize: "none" }} />
        </Card>
        <div style={{ background: C.bg, border: "1px solid " + C.red + "33", padding: "0.85rem" }}>
          <SL accent={C.red}>Spin Card Preview</SL>
          <MN color={C.dim} size="0.4rem" spacing="0.12em">{BRAND.name} · {BRAND.handle}</MN>
          <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "1.05rem", color: C.cream, margin: "0.22rem 0 0.5rem" }}>{B.name}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.42rem", marginBottom: "0.5rem" }}>
            <div style={{ background: C.panel, padding: "0.45rem 0.55rem", borderTop: "2px solid " + C.blue }}><MN color={C.blue} size="0.38rem" spacing="0.1em">BILL SAYS</MN><div style={{ fontFamily: "'Georgia', serif", fontSize: "0.68rem", color: C.muted, lineHeight: 1.5, marginTop: 2 }}>Platforms must act in the best interests of minor users.</div></div>
            <div style={{ background: C.panel, padding: "0.45rem 0.55rem", borderTop: "2px solid " + C.red }}><MN color={C.red} size="0.38rem" spacing="0.1em">PRESS SAID</MN><div style={{ fontFamily: "'Georgia', serif", fontSize: "0.68rem", color: C.muted, lineHeight: 1.5, marginTop: 2 }}>Government would police teen internet use.</div></div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><MN color={C.dim} size="0.38rem">Divergence Score</MN><BN color={C.red} size="1.4rem">72 / 100</BN></div>
        </div>
        <Card>
          <SL accent={C.blue}>Talking Points</SL>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.38rem" }}>
            {[["Opening Hook", C.gold, "The media called KOSA a censorship bill. I read all 47 pages. Here's what they got wrong."], ["The Gap", C.red, "91 senators voted yes. Coverage dropped 52% after passage. Why did the story disappear?"], ["The Close", C.blue, "67% of Americans support this. Your rep voted no. Here's who funded their campaign."]].map(([label, color, text]) => (
              <div key={label} style={{ background: C.bg, borderTop: "2px solid " + color, padding: "0.45rem 0.6rem" }}>
                <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "0.68rem", color: color, letterSpacing: "0.15em", marginBottom: "0.18rem" }}>{label}</div>
                <div style={{ fontFamily: "'Georgia', serif", fontStyle: "italic", fontSize: "0.75rem", color: C.muted, lineHeight: 1.5 }}>"{text}"</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function CoverageTimeline({ bill, archivalData }) {
  const [openEvent, setOpenEvent] = useState(null);
  const eventArticles = {
    "Bill Introduced":   [{ outlet: "Reuters", lean: "center", headline: "Senators unveil online safety bill for minors", url: "https://reuters.com" }, { outlet: "The Hill", lean: "center", headline: "KOSA introduced with bipartisan backing", url: "https://thehill.com" }],
    "Committee Hearing": [{ outlet: "NYT", lean: "lean-left", headline: "Tech executives grilled at KOSA hearing", url: "https://nytimes.com" }, { outlet: "Fox News", lean: "right", headline: "Lawmakers spar over online speech rules", url: "https://foxnews.com" }],
    "Tech Lobby Push":   [{ outlet: "Politico", lean: "center", headline: "Tech lobby spends millions opposing KOSA", url: "https://politico.com" }, { outlet: "Vox", lean: "left", headline: "Inside the fight to weaken kids safety bill", url: "https://vox.com" }],
    "Senate Vote 91-3":  [{ outlet: "AP", lean: "center", headline: "Senate passes KOSA in landslide vote", url: "https://apnews.com" }, { outlet: "NPR", lean: "lean-left", headline: "KOSA clears Senate, heads to House", url: "https://npr.org" }],
    "House Stall":       [{ outlet: "The Hill", lean: "center", headline: "KOSA stalls in House committee", url: "https://thehill.com" }, { outlet: "Fox News", lean: "right", headline: "House GOP blocks online safety bill", url: "https://foxnews.com" }],
    "Reintroduced":      [{ outlet: "Reuters", lean: "center", headline: "KOSA reintroduced in new session", url: "https://reuters.com" }],
  };
  const leanColor = l => l.includes("left") ? C.blue : l.includes("right") ? C.red : l === "center" ? C.gold : C.dim;
  const B = bill || DEFAULT_BILL;
  const [selSrc, setSelSrc] = useState(null);

  // Priority: archival GDELT timeline > bill actions > static demo
  const gdeltTimeline = archivalData?.timeline;
  const staticTimeline = [
    { month: "Aug '23", event: "Bill Introduced", coverage: 12, tone: "neutral" },
    { month: "Oct '23", event: "Committee Hearing", coverage: 28, tone: "supportive" },
    { month: "Jan '24", event: "Tech Lobby Push", coverage: 55, tone: "skeptical" },
    { month: "Mar '24", event: "Senate Vote 91-3", coverage: 88, tone: "supportive" },
    { month: "May '24", event: "House Stall", coverage: 42, tone: "negative" },
    { month: "Sep '24", event: "Reintroduced", coverage: 31, tone: "neutral" },
  ];

  const liveTimeline = B.actions?.length
    ? B.actions.slice(0, 6).reverse().map((a, i) => ({
        month: a.actionDate ? new Date(a.actionDate).toLocaleDateString("en-US", { month: "short", year: "2-digit" }) : "—",
        event: (a.text || "Action").slice(0, 60),
        coverage: Math.max(10, 90 - i * 12),
        tone: /pass|sign|enact/i.test(a.text) ? "supportive" : /fail|reject|withdraw/i.test(a.text) ? "negative" : /committee|refer/i.test(a.text) ? "neutral" : "neutral",
      }))
    : staticTimeline;

  const TIMELINE = (gdeltTimeline?.length ? gdeltTimeline : liveTimeline);
  const max = Math.max(...TIMELINE.map(t => t.coverage));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
      <Card>
        <SL accent={C.gold}>Media Volume Over Time</SL>
        <div style={{ display: "flex", alignItems: "flex-end", gap: "0.6rem", height: 140, padding: "0 0.4rem" }}>
          {TIMELINE.map((t, i) => {
            const bh = Math.round((t.coverage / max) * 120);
            const c = toneColor(t.tone);
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.32rem" }}>
                <MN color={c} size="0.46rem">{t.coverage}%</MN>
                <div style={{ width: "100%", height: bh, background: c, opacity: 0.85, borderRadius: "3px 3px 0 0", position: "relative" }}>
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(255,255,255,0.1),transparent)", borderRadius: "3px 3px 0 0" }} />
                </div>
                <MN color={C.dim} size="0.4rem">{t.month}</MN>
              </div>
            );
          })}
        </div>
      </Card>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.42rem" }}>
        {TIMELINE.map((t, i) => {
          const c = toneColor(t.tone);
          return (
            <div key={i}>
            <div onClick={() => setOpenEvent(openEvent === i ? null : i)} style={{ background: C.panel, border: "1px solid " + C.border, borderLeft: "4px solid " + c, borderRadius: 14, boxShadow: SHADOW.card, padding: "0.65rem 0.9rem", display: "grid", gridTemplateColumns: "85px 1fr 65px", alignItems: "center", gap: "0.9rem", cursor: "pointer", marginBottom: openEvent === i ? "0.4rem" : "0" }}>
              <MN color={C.dim} size="0.48rem" spacing="0.06em">{t.month}</MN>
              <div><div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "0.92rem", color: C.cream, letterSpacing: "0.08em" }}>{t.event}</div><MN color={C.dim} size="0.38rem">Tone: <span style={{ color: c }}>{TONE_CFG[t.tone] ? TONE_CFG[t.tone].label : t.tone}</span> &middot; {(eventArticles[t.event] || []).length} articles {openEvent === i ? "▲" : "▼"}</MN></div>
              <div style={{ textAlign: "right" }}><BN color={c} size="1.4rem">{t.coverage}%</BN><MN color={C.dim} size="0.38rem">volume</MN></div>
            </div>
            {openEvent === i && (eventArticles[t.event] || []).length > 0 && (
              <div style={{ marginLeft: "0.5rem", marginBottom: "0.42rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {(eventArticles[t.event] || []).map((a, j) => (
                  <a key={j} href={a.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                    <div style={{ background: C.header, border: "1px solid " + C.border, borderLeft: "3px solid " + leanColor(a.lean), borderRadius: 12, boxShadow: SHADOW.card, padding: "0.6rem 0.8rem", display: "flex", alignItems: "center", gap: "0.7rem" }}>
                      <div style={{ minWidth: 8, width: 8, height: 8, borderRadius: "50%", background: leanColor(a.lean) }} />
                      <div style={{ flex: 1 }}>
                        <MN color={leanColor(a.lean)} size="0.42rem" spacing="0.08em">{a.outlet} &middot; {a.lean}</MN>
                        <div style={{ fontFamily: "'Georgia', serif", fontSize: "0.82rem", color: C.cream, lineHeight: 1.35, marginTop: 2 }}>{a.headline}</div>
                      </div>
                      <span style={{ color: C.dim, fontSize: "0.7rem" }}>&#8599;</span>
                    </div>
                  </a>
                ))}
              </div>
            )}
            </div>
          );
        })}
      </div>
        {(archivalData?.outlets?.length > 0) && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginTop: "0.3rem" }}>
          <SL accent={C.gold}>Coverage By Source</SL>
          <MN color={C.dim} size="0.4rem" spacing="0.14em">Tap an outlet — dot color shows AllSides lean</MN>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {archivalData.outlets.map((o, i) => (
              <OutletPill key={i} outlet={o} active={selSrc === i}
                onClick={() => setSelSrc(selSrc === i ? null : i)} />
            ))}
          </div>
          {selSrc != null && archivalData.outlets[selSrc] && (
            <div style={{ marginTop: "0.3rem" }}>
              <OutletExpandedCard outlet={archivalData.outlets[selSrc]} showText={false} />
            </div>
          )}
        </div>
        )}
    </div>
  );
}

// ── Live polling fetch via Claude ─────────────────────────────
async function fetchPolling(bill) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      messages: [{
        role: "user",
        content: `You are a senior political polling analyst. Return the most accurate polling data available for this bill, or a highly detailed realistic estimate based on comparable legislation, known public sentiment patterns, and demographic voting behavior.

Bill: ${bill.name}
ID: ${bill.id}
Sponsor: ${bill.sponsor}
Status: ${bill.status}
Summary: ${bill.summary?.slice(0, 400)}

Be specific. Include real poll names and dates where you have them. For estimates, base them on documented comparable legislation.

Return ONLY a JSON object, no markdown:
{
  "source": "REAL DATA|AI ESTIMATE",
  "sourceDetail": "Specific e.g. Pew Research Center March 2025, or AI estimate based on [3 comparable bills listed]",
  "confidence": "HIGH|MEDIUM|LOW",
  "confidenceReason": "One sentence explaining confidence level",
  "overall": 58,
  "oppose": 32,
  "undecided": 10,
  "trend": "Rising|Falling|Stable",
  "trendDetail": "One sentence on why support is trending this direction",
  "trendData": [{"m":"Jan","v":52},{"m":"Feb","v":54},{"m":"Mar","v":56},{"m":"Apr","v":57},{"m":"May","v":58}],
  "party": {"dem": 74, "rep": 38, "ind": 55},
  "partyNote": "One sentence on the partisan divide and why it exists for this bill",
  "demos": [
    {"g":"18-34","v":64},{"g":"35-54","v":58},{"g":"55+","v":51},
    {"g":"Urban","v":66},{"g":"Suburban","v":55},{"g":"Rural","v":41},
    {"g":"College","v":63},{"g":"No College","v":49}
  ],
  "regional": [
    {"region":"Northeast","v":68},{"region":"Midwest","v":52},
    {"region":"South","v":44},{"region":"West","v":61}
  ],
  "keyFinding": "One punchy sentence: the single most surprising or important polling result.",
  "contentMoment": "One sentence: the specific story angle a political content creator should lead with.",
  "comparisons": [
    {"bill":"[Most similar bill name]","support":55,"year":2022},
    {"bill":"[Another comparable bill]","support":61,"year":2021}
  ]
}`
      }]
    }),
  });
  const data = await res.json();
  const raw = data.content?.find(b => b.type === "text")?.text || "{}";
  return JSON.parse(raw.replace(/```json|```/g, "").trim());
}

function ReaderPulse({ bill }) {
  const [polling, setPolling] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetch_ = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPolling(bill || DEFAULT_BILL);
      setPolling(data);
    } catch (e) {
      setError("Failed to fetch polling data. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // Source badge config
  const isReal = polling?.source === "REAL DATA";
  const sourceColor = isReal ? "#22c55e" : C.gold;
  const confColor = polling?.confidence === "HIGH" ? "#22c55e" : polling?.confidence === "MEDIUM" ? C.gold : C.red;

  const d = polling;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>

      {/* Fetch button / source header */}
      <div style={{ background: C.panel, border: "1px solid " + C.border, padding: "0.75rem 1rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap", borderLeft: "4px solid " + C.gold, borderRadius: 14, boxShadow: SHADOW.glow(C.gold) }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "0.78rem", color: C.cream, letterSpacing: "0.08em" }}>
            {bill?.name || "Kids Online Safety Act"}
          </div>
          {polling && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "0.25rem", flexWrap: "wrap" }}>
              {/* Source badge */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: sourceColor, animation: isReal ? "none" : "blink 2s ease-in-out infinite" }} />
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.42rem", color: sourceColor, letterSpacing: "0.1em" }}>
                  {polling.source}
                </span>
              </div>
              {/* Detail */}
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.4rem", color: C.dim }}>
                {polling.sourceDetail}
              </span>
              {/* Confidence */}
              <span style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "0.55rem", color: confColor, border: "1px solid " + confColor + "44", padding: "0 0.3rem", letterSpacing: "0.1em" }}>
                {polling.confidence} CONFIDENCE
              </span>
            </div>
          )}
        </div>

        {/* The button */}
        <button
          onClick={fetch_}
          disabled={loading}
          style={{
            fontFamily: "'Bebas Neue', Impact, sans-serif",
            fontSize: "0.85rem",
            letterSpacing: "0.15em",
            color: loading ? C.dim : C.bg,
            background: loading ? C.navy : C.gold,
            border: "none",
            padding: "0.5rem 1.25rem",
            cursor: loading ? "wait" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            transition: "background 0.15s",
            flexShrink: 0,
          }}
        >
          {loading && (
            <div style={{ width: 12, height: 12, border: "2px solid " + C.dim, borderTop: "2px solid " + C.gold, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
          )}
          {loading ? "FETCHING POLLING..." : polling ? "REFRESH POLLING" : "FETCH LIVE POLLING"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: C.red + "18", border: "1px solid " + C.red + "44", borderLeft: "3px solid " + C.red, padding: "0.5rem 0.85rem" }}>
          <MN color={C.red} size="0.46rem">{error}</MN>
        </div>
      )}

      {/* Empty state */}
      {!polling && !loading && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "3rem 1rem", gap: "0.75rem", border: "1px dashed " + C.navy }}>
          <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "1.6rem", color: C.dim, letterSpacing: "0.1em", textAlign: "center" }}>
            No Polling Data Loaded
          </div>
          <MN color={C.dim} size="0.46rem">Hit FETCH LIVE POLLING to pull real-time data for this bill</MN>
        </div>
      )}

      {/* Loading shimmer */}
      {loading && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.7rem" }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ background: C.panel, border: "1px solid " + C.border, padding: "1rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {[80,50,65,40,55].map((w, j) => (
                <div key={j} style={{ height: j === 0 ? 48 : 8, width: w + "%", background: C.navy, borderRadius: 2, animation: "blink 1.4s ease-in-out infinite", animationDelay: (j * 0.1) + "s" }} />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Polling cards */}
      {d && !loading && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.7rem" }}>

            {/* Card 1 — Overall */}
            <Card style={{boxShadow:SHADOW.glow(C.gold)}}>
              <SL accent={C.gold}>National Support</SL>
              <BN color={C.gold} size="5rem"><AnimNum target={d.overall} /></BN>
              <MN color={C.gold} size="0.48rem">{d.trend} · {d.undecided}% undecided</MN>
              <div style={{ margin: "0.7rem 0 0.28rem", display: "flex", justifyContent: "space-between" }}>
                <BN color={C.gold} size="0.82rem">Support {d.overall}%</BN>
                <BN color={REP} size="0.82rem">Oppose {d.oppose}%</BN>
              </div>
              <Bar pct={d.overall} color={C.gold} h={8} />
              <div style={{ marginTop: "0.8rem" }}><Spark data={d.trendData} color={C.gold} /></div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.18rem" }}>
                <MN color={C.dimmer} size="0.4rem">{d.trendData?.[0]?.m}</MN>
                <MN color={C.dimmer} size="0.4rem">{d.trendData?.[d.trendData.length - 1]?.m}</MN>
              </div>
            </Card>

            {/* Card 2 — By Party */}
            <Card>
              <SL accent={DEM}>By Party</SL>
              {[{ label: "DEM", val: d.party.dem, color: DEM }, { label: "REP", val: d.party.rep, color: REP }, { label: "IND", val: d.party.ind, color: IND }].map(p => (
                <div key={p.label} style={{ marginBottom: "0.9rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.28rem" }}>
                    <BN color={p.color} size="1.25rem">{p.label}</BN>
                    <BN color={p.color} size="1.8rem">{p.val}%</BN>
                  </div>
                  <Bar pct={p.val} color={p.color} h={8} />
                </div>
              ))}
              <div style={{ borderTop: "1px solid " + C.navy, paddingTop: "0.7rem" }}>
                <MN color={C.dim} size="0.42rem" spacing="0.12em">PARTISAN GAP</MN>
                <BN color={C.cream} size="2.8rem"><AnimNum target={Math.abs(d.party.dem - d.party.rep)} suffix=" pt" /></BN>
              </div>
            </Card>

            {/* Card 3 — Demographics */}
            <Card>
              <SL accent={REP}>By Demographic</SL>
              {d.demos.map((dm, i) => {
                const col = demoColor(dm.v);
                return (
                  <div key={i} style={{ marginBottom: "0.72rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.22rem" }}>
                      <BN color={C.muted} size="0.85rem">{dm.g}</BN>
                      <BN color={col} size="1.35rem">{dm.v}%</BN>
                    </div>
                    <Bar pct={dm.v} color={col} h={5} />
                  </div>
                );
              })}
            </Card>
          </div>

          {/* Key finding + content moment */}
          <div style={{ background: C.bg, border: "1px solid " + C.gold + "33", borderLeft: "4px solid " + C.gold, padding: "0.9rem 1.2rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
              <div>
                <SL accent={C.gold}>Key Finding</SL>
                <div style={{ fontFamily: "'Georgia', serif", fontStyle: "italic", fontSize: "0.86rem", color: C.muted, lineHeight: 1.7 }}>
                  "{d.keyFinding}"
                </div>
              </div>
              <div>
                <SL accent="#CC5500">Content Moment</SL>
                <div style={{ fontFamily: "'Georgia', serif", fontStyle: "italic", fontSize: "0.86rem", color: C.muted, lineHeight: 1.7 }}>
                  "{d.contentMoment}"
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// BURIED LEDE — scoring + tab component
// ─────────────────────────────────────────────────────────────

function scoreP(text) {
  let s = 0;
  const t = text.toLowerCase();
  if (/\d+[\s-]point\s+plan/.test(t)) s += 4;
  if (/\d+%\s+of.*(?:world|global|supply|budget)/.test(t)) s += 4;
  if (/\$\d+.*(?:gallon|barrel|billion|million|penalty)/.test(t)) s += 4;
  if (/humanitarian/.test(t)) s += 3;
  if (/\bconfirmed\b/.test(t)) s += 3;
  if (/\d+[\s-]point/.test(t)) s += 3;
  if (/\d+%/.test(t)) s += 2;
  if (/billion|million/.test(t)) s += 2;
  if (/penalty|penalties|fine|enforcement/.test(t)) s += 2;
  if (/said|told reporters|struck.*tone|going well|characterized/.test(t)) s -= 2;
  s += (text.match(/\d+/g) || []).length * 0.5;
  return Math.max(0, s);
}

function analyzeOutletLede(outlet) {
  // Build paragraphs from the outlet's article text
  // We use the full billText + headline + angle as the "article"
  const paragraphs = [
    { id: 1, text: outlet.headline },
    { id: 2, text: outlet.angle },
    { id: 3, text: outlet.billText },
  ];
  const scored = paragraphs.map(p => ({ ...p, score: scoreP(p.text) }));
  const max = Math.max(...scored.map(s => s.score));
  const buried = scored.find(s => s.score === max) || scored[scored.length - 1];
  return { lede: scored[0], buried, scored };
}

async function getLedeVerdict(outlet, lede, buried) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: `You are a media analyst specializing in buried lede detection. Analyze this ${outlet.name} article about a federal bill.

HEADLINE / LEDE: "${lede.text}"

MOST INFORMATION-DENSE SECTION: "${buried.text}"

FULL CONTEXT: Outlet lean is ${outlet.lean <= 35 ? "left" : outlet.lean >= 65 ? "right" : "center"}. Coverage score: ${outlet.coverage}%.

Return ONLY a JSON object, no markdown:
{
  "what_they_led_with": "One punchy sentence: the framing the editor chose",
  "real_news": "One punchy sentence: the actual most newsworthy fact in this piece",
  "grade": "A|B|C|D|F",
  "verdict": "One sentence: the gap between framing and substance"
}`
      }]
    }),
  });
  const data = await res.json();
  const raw = data.content?.find(b => b.type === "text")?.text || "{}";
  return JSON.parse(raw.replace(/```json|```/g, "").trim());
}

const LEDE_GRADES = { A: "#2E8B57", B: C.blue, C: C.gold, D: "#c27040", F: C.red };

function BuriedLede({ bill }) {
  const [activeOutlet, setActiveOutlet] = useState(0);
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState({});

  const outlet = OUTLETS[activeOutlet];
  const analysis = analyzeOutletLede(outlet);
  const aiResult = results[activeOutlet];
  const isLoading = loading[activeOutlet];

  const runVerdict = async () => {
    setLoading(l => ({ ...l, [activeOutlet]: true }));
    try {
      const verdict = await getLedeVerdict(outlet, analysis.lede, analysis.buried);
      setResults(r => ({ ...r, [activeOutlet]: verdict }));
    } catch (e) { console.error(e); }
    finally { setLoading(l => ({ ...l, [activeOutlet]: false })); }
  };

  const gradeColor = aiResult ? (LEDE_GRADES[aiResult.grade] || C.muted) : "#CC5500";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>

      {/* Outlet selector */}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {OUTLETS.map((o, i) => {
          const tc = TONE_CFG[o.tone];
          const isA = activeOutlet === i;
          return (
            <button key={i} onClick={() => setActiveOutlet(i)} style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "0.82rem", letterSpacing: "0.1em", padding: "0.35rem 0.85rem", background: isA ? tc.accent : C.panel, color: isA ? C.bg : C.dim, border: "1px solid " + (isA ? tc.accent : C.border), cursor: "pointer", transition: "all 0.15s" }}>
              {o.name}
            </button>
          );
        })}
      </div>

      {/* Active bill banner */}
      {bill && <div style={{ background: C.bg, border: "1px solid " + C.border, borderLeft: "4px solid #CC5500", padding: "0.45rem 0.85rem", marginBottom: "0" }}><div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "0.8rem", color: C.cream, letterSpacing: "0.06em" }}>{bill.name}</div><MN color={C.dim} size="0.38rem">{bill.id} · Select outlet to analyze buried lede</MN></div>}
      {/* Outlet context strip */}
      <div style={{ background: C.panel, border: "1px solid " + C.border, borderLeft: "4px solid #CC5500", padding: "0.65rem 1rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "0.95rem", color: C.cream, letterSpacing: "0.06em" }}>{outlet.name}</div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.42rem", color: C.dim }}>{outlet.date}</div>
        <div style={{ display: "inline-block", fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "0.72rem", letterSpacing: "0.12em", color: TONE_CFG[outlet.tone].accent, border: "1px solid " + TONE_CFG[outlet.tone].accent + "44", padding: "0.08rem 0.4rem" }}>{TONE_CFG[outlet.tone].label}</div>
        <div style={{ marginLeft: "auto", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.42rem", color: C.muted }}>Coverage: {outlet.coverage}%</div>
      </div>

      {/* The two cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.7rem" }}>

        {/* What they led with */}
        <div style={{ background: C.panel, borderTop: "4px solid " + C.blue, padding: "1.1rem", boxShadow: SHADOW.bias(C.blue) }}>
          <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "0.72rem", letterSpacing: "0.2em", color: C.blue, marginBottom: "0.75rem" }}>
            WHAT THEY LED WITH
          </div>
          <div style={{ fontFamily: "'Georgia', serif", fontSize: aiResult ? "0.95rem" : "0.88rem", color: C.muted, lineHeight: 1.75, fontStyle: "italic" }}>
            "{aiResult ? aiResult.what_they_led_with : analysis.lede.text}"
          </div>
        </div>

        {/* The real news */}
        <div style={{ background: C.panel, borderTop: "4px solid " + C.red, padding: "1.1rem", boxShadow: SHADOW.bias(C.red) }}>
          <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "0.72rem", letterSpacing: "0.2em", color: C.red, marginBottom: "0.75rem" }}>
            THE REAL NEWS
          </div>
          <div style={{ fontFamily: "'Georgia', serif", fontSize: aiResult ? "0.95rem" : "0.88rem", color: C.cream, lineHeight: 1.75, fontStyle: "italic" }}>
            "{aiResult ? aiResult.real_news : analysis.buried.text}"
          </div>
        </div>
      </div>

      {/* AI verdict strip */}
      {aiResult && (
        <div style={{ background: C.panel, border: "1px solid " + gradeColor + "44", borderLeft: "4px solid " + gradeColor, padding: "0.9rem 1.1rem", display: "grid", gridTemplateColumns: "52px 1fr", gap: "1rem", alignItems: "center", boxShadow: SHADOW.glow(gradeColor) }}>
          <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "2.4rem", color: gradeColor, lineHeight: 1, textAlign: "center", border: "2px solid " + gradeColor, width: 52, height: 52, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 12px " + gradeColor + "44" }}>
            {aiResult.grade}
          </div>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.42rem", color: C.dim, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.25rem" }}>
              Lede Grade — {outlet.name}
            </div>
            <div style={{ fontFamily: "'Georgia', serif", fontStyle: "italic", fontSize: "0.88rem", color: C.muted, lineHeight: 1.65 }}>
              {aiResult.verdict}
            </div>
          </div>
        </div>
      )}

      {/* Run button */}
      {!aiResult && (
        <button onClick={runVerdict} disabled={isLoading} style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "1rem", letterSpacing: "0.2em", color: C.bg, background: isLoading ? C.dim : "#CC5500", border: "none", padding: "0.75rem", cursor: isLoading ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", width: "100%" }}>
          {isLoading && <div style={{ width: 14, height: 14, border: "2px solid " + C.bg, borderTop: "2px solid " + C.gold, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />}
          {isLoading ? "ANALYZING..." : "GET AI VERDICT"}
        </button>
      )}

      {/* Run another outlet prompt */}
      {aiResult && (
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.42rem", color: C.dim, letterSpacing: "0.08em" }}>
            Select another outlet above to compare buried lede across sources
          </div>
        </div>
      )}

    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// OFFICIALS DATABASE — federal + state, name/district/issue/status
// Sources: Congress.gov (federal), OpenStates (state), FEC (running)
// ─────────────────────────────────────────────────────────────

const OPENSTATES_BASE = "https://v3.openstates.org";
const FEC_BASE = "https://api.open.fec.gov/v1";

// Search federal members via Congress.gov
async function searchFederalMembers(query) {
  try {
    const url = CONGRESS_BASE + "/member?api_key=" + CONGRESS_KEY + "&limit=20&currentMember=true";
    const res = await proxied(url);
    if (!res.ok) return [];
    const data = await res.json();
    const members = data.members || [];
    const q = query.toLowerCase();
    return members
      .filter(m => !q || (m.name || "").toLowerCase().includes(q) || (m.state || "").toLowerCase().includes(q))
      .map(m => ({
        id: m.bioguideId,
        name: m.name,
        party: m.partyName || m.party,
        state: m.state,
        chamber: m.terms?.item?.[0]?.chamber || (m.district != null ? "House" : "Senate"),
        district: m.district,
        level: "Federal",
        status: "Active",
        imageUrl: m.depiction?.imageUrl,
        url: m.url,
      }));
  } catch { return []; }
}

// Fetch a single member's detail + sponsored legislation
async function fetchMemberDetail(bioguideId) {
  try {
    const url = CONGRESS_BASE + "/member/" + bioguideId + "?api_key=" + CONGRESS_KEY;
    const res = await proxied(url);
    if (!res.ok) return null;
    const data = await res.json();
    const m = data.member;
    // Get sponsored legislation
    const legUrl = CONGRESS_BASE + "/member/" + bioguideId + "/sponsored-legislation?api_key=" + CONGRESS_KEY + "&limit=15";
    let sponsored = [];
    try {
      const legRes = await proxied(legUrl);
      if (legRes.ok) { const legData = await legRes.json(); sponsored = legData.sponsoredLegislation || []; }
    } catch {}
    return { member: m, sponsored };
  } catch { return null; }
}

// Search state legislators via OpenStates (needs free key — uses demo fallback)
async function searchStateMembers(query, stateCode) {
  // OpenStates requires an API key; gracefully returns empty if unavailable
  return [];
}

// Synthesize a politician's record into platform stances via Claude
async function synthesizeStances(member, sponsored) {
  const billList = (sponsored || []).slice(0, 12).map(s => s.title || s.policyArea?.name).filter(Boolean).join("; ");
  const prompt = `You are a political analyst. Based on this lawmaker's record, synthesize their platform stances.

Name: ${member.directOrderName || member.name}
Party: ${member.partyHistory?.[0]?.partyName || member.party || "Unknown"}
State: ${member.state}
Chamber: ${member.terms?.[0]?.chamber || "Congress"}
Sponsored legislation: ${billList || "Limited public record available"}

Return ONLY a JSON object, no markdown:
{
  "summary": "2-sentence elevator-pitch summary of their political identity and priorities",
  "ideology": "e.g. Progressive Democrat, Establishment Republican, Libertarian-leaning",
  "ideologyScore": 50,
  "topIssues": ["issue 1", "issue 2", "issue 3"],
  "stances": [
    {"issue": "Healthcare", "position": "one sentence stance", "confidence": "Documented|Inferred", "lean": "L|C|R"},
    {"issue": "Economy", "position": "one sentence stance", "confidence": "Documented|Inferred", "lean": "L|C|R"},
    {"issue": "Immigration", "position": "one sentence stance", "confidence": "Documented|Inferred", "lean": "L|C|R"},
    {"issue": "Climate/Energy", "position": "one sentence stance", "confidence": "Documented|Inferred", "lean": "L|C|R"},
    {"issue": "Civil Liberties", "position": "one sentence stance", "confidence": "Documented|Inferred", "lean": "L|C|R"}
  ],
  "dataNote": "One sentence on the reliability of this synthesis given available data"
}
ideologyScore: 0=far left, 50=center, 100=far right.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
    });
    const data = await res.json();
    const raw = data.content?.find(b => b.type === "text")?.text || "{}";
    return JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch { return null; }
}

function leanChar(l) { return l === "L" ? DEM : l === "R" ? REP : IND; }
function partyDotColor(p) {
  const s = (p || "").toLowerCase();
  if (s.includes("democ")) return DEM;
  if (s.includes("republic")) return REP;
  return IND;
}


const TRENDING_POLITICIANS = [
  { name: "Bernie Sanders",      party: "D", state: "VT", chamber: "Senate",  status: "Active",   id: "S000033", imageUrl: "" },
  { name: "Alexandria Ocasio-Cortez", party: "D", state: "NY", chamber: "House", status: "Active", id: "O000172", imageUrl: "" },
  { name: "Ted Cruz",            party: "R", state: "TX", chamber: "Senate",  status: "Active",   id: "C001098", imageUrl: "" },
  { name: "Elizabeth Warren",    party: "D", state: "MA", chamber: "Senate",  status: "Active",   id: "W000817", imageUrl: "" },
  { name: "Marco Rubio",         party: "R", state: "FL", chamber: "Senate",  status: "Active",   id: "R000595", imageUrl: "" },
  { name: "Barack Obama",        party: "D", state: "IL", chamber: "President", status: "Former", id: "historical", imageUrl: "" },
  { name: "Donald Trump",        party: "R", state: "FL", chamber: "President", status: "Active",  id: "historical", imageUrl: "" },
  { name: "Ron DeSantis",        party: "R", state: "FL", chamber: "Governor", status: "Running", id: "historical", imageUrl: "" },
  { name: "Nikki Haley",         party: "R", state: "SC", chamber: "Former Gov", status: "Former", id: "historical", imageUrl: "" },
  { name: "Gavin Newsom",        party: "D", state: "CA", chamber: "Governor", status: "Active",  id: "historical", imageUrl: "" },
];

function OfficialsDB() {
  const [mode, setMode] = useState("name");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [stances, setStances] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [view, setView] = useState("summary");
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const [showPreemptive, setShowPreemptive] = useState(true);

  const TEAL = "#c8a14b";
  const MODES = [
    { id: "name", label: "Name" }, { id: "district", label: "State" },
    { id: "issue", label: "Issue" }, { id: "status", label: "Status" },
  ];

  const runSearch = async (q) => {
    const searchTerm = q || query;
    setSearching(true); setError(null); setResults([]);
    setSelected(null); setDetail(null); setStances(null);
    setShowPreemptive(false); setOpen(false);
    try {
      const federal = await searchFederalMembers(searchTerm);
      if (federal.length === 0) setError("No members matched. Try a last name.");
      setResults(federal);
    } catch (e) { setError("Search failed: " + e.message); }
    finally { setSearching(false); }
  };

  const selectOfficial = async (off) => {
    setSelected(off); setLoadingDetail(true); setDetail(null); setStances(null);
    if (off.id === "historical") {
      // Claude synthesizes for historical figures without API call
      try {
        const s = await synthesizeStances({ directOrderName: off.name, name: off.name, state: off.state }, []);
        setStances(s);
      } catch(e) { setError("Could not synthesize: " + e.message); }
      finally { setLoadingDetail(false); }
      return;
    }
    try {
      const d = await fetchMemberDetail(off.id);
      setDetail(d);
      if (d?.member) { const s = await synthesizeStances(d.member, d.sponsored); setStances(s); }
    } catch (e) { setError("Could not load record: " + e.message); }
    finally { setLoadingDetail(false); }
  };

  const statusColor = s => s === "Active" ? "#22c55e" : s === "Running" ? "#f4a261" : "#94a3b8";
  const pdc = p => { const s = (p||"").toLowerCase(); return s.includes("democ") ? DEM : s.includes("republic") ? REP : IND; };
  const lc = s => s <= 35 ? DEM : s <= 55 ? IND : REP;

  const displayList = showPreemptive ? TRENDING_POLITICIANS : results;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>

      {/* Search bar */}
      <div style={{ background: C.panel, border: "1px solid " + C.border, borderRadius: 12, padding: "0.85rem", boxShadow: SHADOW.card }}>

        {/* Mode pills */}
        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginBottom: "0.65rem" }}>
          {MODES.map(m => {
            const isA = mode === m.id;
            return (
              <button key={m.id} onClick={() => setMode(m.id)} style={{ padding: "0.28rem 0.7rem", background: isA ? TEAL : "transparent", color: isA ? C.cream : TEAL, border: "1px solid " + TEAL + (isA ? "" : "55"), borderRadius: 14, fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "0.72rem", letterSpacing: "0.1em", cursor: "pointer", transition: "all 0.15s", boxShadow: isA ? SHADOW.pill(TEAL) : "none" }}>{m.label}</button>
            );
          })}
        </div>

        {/* Input row */}
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", background: "#1f1f24", border: "1px solid " + (open ? C.red + "88" : C.border), borderRadius: 999, height: 38, padding: "0 0.65rem", gap: "0.45rem", transition: "border-color 0.15s" }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.dim} strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input value={query} onChange={e => { setQuery(e.target.value); setOpen(true); setShowPreemptive(e.target.value.length === 0); }}
              onFocus={() => setOpen(true)} onKeyDown={e => e.key === "Enter" && runSearch()}
              placeholder={mode === "name" ? "Search politicians — tap to see trending..." : mode === "district" ? "State — CA, TX, NY..." : mode === "issue" ? "Issue — healthcare, climate..." : "Status — active, running, former..."}
              style={{ flex: 1, background: "none", border: "none", color: C.cream, fontFamily: "'JetBrains Mono', monospace", fontSize: "0.52rem", outline: "none" }} />
            {searching && <div style={{ width: 12, height: 12, border: "2px solid " + C.dim, borderTop: "2px solid " + TEAL, borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />}
            {query && <button onClick={() => { setQuery(""); setShowPreemptive(true); setOpen(true); }} style={{ color: C.dim, fontSize: "0.5rem", background: "none" }}>&#10005;</button>}
          </div>

          {/* Dropdown */}
          {open && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#0a0a0c", border: "1px solid " + C.border, borderTop: "2px solid " + TEAL, borderRadius: "0 0 10px 10px", zIndex: 9999, boxShadow: "0 16px 48px rgba(0,0,0,0.9)", maxHeight: 320, overflowY: "auto" }}>
              <div style={{ padding: "0.3rem 0.75rem", borderBottom: "1px solid " + C.border, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                {showPreemptive
                  ? <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: TEAL, display: "inline-block", animation: "blink 1.4s ease-in-out infinite" }} />
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.38rem", color: TEAL, letterSpacing: "0.12em" }}>TRENDING POLITICIANS</span>
                    </div>
                  : <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.38rem", color: C.dim }}>{displayList.length} results</span>
                }
                <button onClick={() => setOpen(false)} style={{ color: C.dim, fontSize: "0.5rem", background: "none" }}>&#10005;</button>
              </div>
              {displayList.map((p, i) => {
                const pc = pdc(p.party);
                return (
                  <div key={i} onMouseDown={() => { selectOfficial(p); setOpen(false); setQuery(p.name); }}
                    style={{ padding: "0.55rem 0.75rem", borderBottom: "1px solid " + C.border + "33", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.6rem", transition: "background 0.1s" }}
                    onMouseEnter={e => e.currentTarget.style.background = C.panelHi}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <div style={{ width: 4, height: 36, background: pc, borderRadius: 2, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                        <span style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "0.9rem", color: C.cream, letterSpacing: "0.04em" }}>{p.name}</span>
                        <span style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "0.55rem", color: pc, background: pc + "18", border: "1px solid " + pc + "33", padding: "0 0.3rem", borderRadius: 4 }}>{p.party}</span>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.36rem", color: statusColor(p.status), border: "1px solid " + statusColor(p.status) + "44", padding: "0 0.28rem", borderRadius: 4 }}>{p.status}</span>
                      </div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.38rem", color: C.dim }}>{p.state} · {p.chamber}</div>
                    </div>
                  </div>
                );
              })}
              <div style={{ padding: "0.25rem 0.75rem", borderTop: "1px solid " + C.border }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.34rem", color: C.dim }}>Enter to search · Esc to close · Sources: Congress.gov + FEC</span>
              </div>
            </div>
          )}
        </div>
        {error && <div style={{ marginTop: "0.5rem", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.44rem", color: C.gold }}>{error}</div>}
      </div>

      {/* Results + Detail */}
      <div style={{ display: "grid", gridTemplateColumns: results.length ? "220px 1fr" : "1fr", gap: "0.75rem" }}>

        {results.length > 0 && (
          <div style={{ background: C.panel, border: "1px solid " + C.border, borderRadius: 10, maxHeight: 500, overflowY: "auto", boxShadow: SHADOW.card }}>
            <div style={{ padding: "0.4rem 0.7rem", borderBottom: "1px solid " + C.border, position: "sticky", top: 0, background: C.panel, borderRadius: "10px 10px 0 0" }}>
              <MN color={C.dim} size="0.42rem" spacing="0.1em">{results.length} OFFICIALS FOUND</MN>
            </div>
            {results.map((off, i) => {
              const isA = selected?.id === off.id, pc = pdc(off.party);
              return (
                <div key={i} onClick={() => selectOfficial(off)} style={{ padding: "0.6rem 0.7rem", borderBottom: "1px solid " + C.border + "55", borderLeft: "3px solid " + (isA ? pc : "transparent"), background: isA ? C.panelHi : "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem", transition: "all 0.15s" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: pc, flexShrink: 0, boxShadow: isA ? "0 0 8px " + pc : "none" }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "0.82rem", color: isA ? C.cream : C.muted, letterSpacing: "0.04em", lineHeight: 1.1 }}>{off.name}</div>
                    <MN color={C.dim} size="0.38rem">{off.party} · {off.state} · {off.chamber}</MN>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {selected && (
          <div style={{ background: C.panel, border: "1px solid " + C.border, borderLeft: "4px solid " + TEAL, borderRadius: 12, padding: "1.1rem 1.3rem", boxShadow: SHADOW.bias(TEAL) }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
              {selected.imageUrl && <img src={selected.imageUrl} alt="" style={{ width: 56, height: 70, objectFit: "cover", border: "1px solid " + C.border, borderRadius: 6 }} />}
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "1.5rem", color: C.cream, letterSpacing: "0.04em", lineHeight: 1 }}>{selected.name}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.35rem", flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "0.62rem", color: pdc(selected.party), background: pdc(selected.party) + "18", border: "1px solid " + pdc(selected.party) + "44", padding: "0 0.35rem", borderRadius: 5, letterSpacing: "0.08em" }}>{selected.party}</span>
                  <MN color={C.dim} size="0.44rem">{selected.state} · {selected.chamber}</MN>
                  <span style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "0.6rem", color: statusColor(selected.status), border: "1px solid " + statusColor(selected.status) + "44", padding: "0 0.35rem", borderRadius: 5 }}>{selected.status || "Active"}</span>
                </div>
              </div>
              {stances && (
                <div style={{ display: "flex", border: "1px solid " + C.border, borderRadius: 14, overflow: "hidden" , boxShadow: SHADOW.card }}>
                  {["summary", "detailed"].map(v => <button key={v} onClick={() => setView(v)} style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "0.65rem", letterSpacing: "0.1em", padding: "0.25rem 0.6rem", background: view === v ? TEAL : "transparent", color: view === v ? C.cream : C.dim, border: "none", cursor: "pointer", textTransform: "uppercase" }}>{v}</button>)}
                </div>
              )}
            </div>

            {loadingDetail && <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "2rem", gap: "0.6rem" }}>
              <div style={{ width: 28, height: 28, border: "3px solid " + C.border, borderTop: "3px solid " + TEAL, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              <MN color={C.dim} size="0.46rem">Pulling record and synthesizing stances...</MN>
            </div>}

            {stances && !loadingDetail && <>
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.3rem" }}>
                  <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "0.95rem", color: lc(stances.ideologyScore), letterSpacing: "0.06em" }}>{stances.ideology}</div>
                  <MN color={C.dim} size="0.42rem">{stances.ideologyScore}/100</MN>
                </div>
                <div style={{ position: "relative", height: 7, background: "linear-gradient(90deg," + DEM + "," + IND + "," + REP + ")", borderRadius: 4 }}>
                  <div style={{ position: "absolute", top: "50%", left: stances.ideologyScore + "%", transform: "translate(-50%,-50%)", width: 14, height: 14, borderRadius: "50%", background: lc(stances.ideologyScore), border: "2.5px solid " + C.bg, boxShadow: "0 0 8px " + lc(stances.ideologyScore) }} />
                </div>
              </div>

              {view === "summary" ? <>
                <div style={{ background: C.bg, border: "1px solid " + C.border, borderLeft: "3px solid " + TEAL, borderRadius: "0 8px 8px 0", padding: "0.9rem 1rem", marginBottom: "0.75rem", boxShadow: SHADOW.bias(TEAL) }}>
                  <div style={{ fontFamily: "'Georgia', serif", fontSize: "0.92rem", color: C.cream, lineHeight: 1.75 }}>{stances.summary}</div>
                </div>
                <SL accent={TEAL}>Top Issues</SL>
                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                  {(stances.topIssues || []).map((iss, i) => <span key={i} style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "0.8rem", color: C.gold, background: C.gold + "12", border: "1px solid " + C.gold + "44", padding: "0.2rem 0.6rem", borderRadius: 6, letterSpacing: "0.06em", boxShadow: SHADOW.glow(C.gold) }}>{iss}</span>)}
                </div>
              </> : <>
                <SL accent={TEAL}>Platform Stances</SL>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                  {(stances.stances || []).map((st, i) => {
                    const sc = st.lean === "L" ? DEM : st.lean === "R" ? REP : IND;
                    return <div key={i} style={{ background: C.bg, border: "1px solid " + C.border, borderLeft: "3px solid " + sc, borderRadius: "0 8px 8px 0", padding: "0.65rem 0.85rem", boxShadow: SHADOW.bias(sc) }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                        <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "0.88rem", color: C.cream, letterSpacing: "0.06em" }}>{st.issue}</div>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.38rem", color: st.confidence === "Documented" ? "#22c55e" : C.gold, border: "1px solid currentColor", padding: "0.05rem 0.3rem", borderRadius: 4 }}>{st.confidence}</span>
                      </div>
                      <div style={{ fontFamily: "'Georgia', serif", fontSize: "0.82rem", color: C.muted, lineHeight: 1.6 }}>{st.position}</div>
                    </div>;
                  })}
                </div>
              </>}

              {detail?.sponsored?.length > 0 && <div style={{ marginTop: "1rem" }}>
                <SL accent={C.gold}>Recent Sponsored Bills</SL>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", maxHeight: 140, overflowY: "auto" }}>
                  {detail.sponsored.slice(0, 8).map((b, i) => <div key={i} style={{ display: "flex", gap: "0.5rem", padding: "0.35rem 0.5rem", background: C.bg, border: "1px solid " + C.border + "55", borderRadius: 6 }}>
                    <span style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "0.62rem", color: C.gold, flexShrink: 0 }}>{b.type} {b.number}</span>
                    <span style={{ fontFamily: "'Georgia', serif", fontSize: "0.72rem", color: C.muted, lineHeight: 1.4 }}>{(b.title || "").slice(0, 80)}</span>
                  </div>)}
                </div>
              </div>}

              {stances.dataNote && <div style={{ marginTop: "0.85rem", borderTop: "1px solid " + C.border, paddingTop: "0.6rem", fontFamily: "'Georgia', serif", fontStyle: "italic", fontSize: "0.74rem", color: C.dim, lineHeight: 1.5 }}>&#9888; {stances.dataNote}</div>}
            </>}
          </div>
        )}

        {!results.length && !searching && !selected && (
          <div style={{ border: "1px dashed " + C.border, borderRadius: 10, padding: "2.5rem 1rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.6rem" }}>
            <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "1.4rem", color: C.dim, letterSpacing: "0.08em", textAlign: "center" }}>Officials Database</div>
            <MN color={C.dim} size="0.46rem">Current · Historical · Running — federal level</MN>
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", justifyContent: "center", marginTop: "0.4rem" }}>
              {["Warren", "Cruz", "Sanders", "Obama"].map(n => (
                <button key={n} onClick={() => { setQuery(n); runSearch(n); }} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.44rem", color: "#0E7490", border: "1px solid #0E749066", padding: "0.2rem 0.5rem", background: "transparent", cursor: "pointer", borderRadius: 6 }}>{n}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


function CardGenerator() {
  return (
    <div style={{ padding: "2rem", fontFamily: "JetBrains Mono, monospace", color: "#7a8fa8" }}>
      Commentary Studio card generator — coming soon.
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("brief");
  const [mounted, setMounted] = useState(true);
  const [bill, setBill] = useState(DEFAULT_BILL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tabsOpen, setTabsOpen] = useState(true);
  const [cooldown, setCooldown] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [pendingQuery, setPendingQuery] = useState(null);

  // ── Archival data sources ──────────────────────────────────
  const [activeSource, setActiveSource] = useState("demo");
  const [archivalData, setArchivalData] = useState(null);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState(null);

  const handleSourceSelect = async (sourceId) => {
    setActiveSource(sourceId);
    if (sourceId === "demo") { setArchivalData(null); return; }
    setSourceLoading(true);
    setSourceError(null);
    try {
      // Fetch from all three sources in parallel
      const [gdelt, archive, cc] = await Promise.all([
        sourceId === "gdelt" || sourceId === "cc" || sourceId === "archive" ? fetchGDELT(bill.name) : Promise.resolve({ outlets: [], timeline: [] }),
        sourceId === "archive" ? fetchArchive(bill.name) : Promise.resolve({ docs: [] }),
        sourceId === "cc" ? fetchCommonCrawl(bill.name) : Promise.resolve({ records: [] }),
      ]);
      // Synthesize with Claude
      const synthesized = await synthesizeArchivalData(bill, gdelt, archive, cc, sourceId);
      setArchivalData({
        ...synthesized,
        raw: { gdelt, archive, cc },
        source: sourceId,
        loadedAt: new Date().toLocaleTimeString(),
      });
    } catch (e) {
      setSourceError("Failed to load " + sourceId + " data: " + e.message);
    } finally {
      setSourceLoading(false);
    }
  };

  // Re-fetch archival data when bill changes if a source is active
  useEffect(() => {
    // Clear stale coverage from the previous bill so tabs never show old data
    setArchivalData(null);
    if (activeSource !== "demo" && bill !== DEFAULT_BILL) {
      handleSourceSelect(activeSource);
    }
  }, [bill.id]);

  const activeNav = NAV.find(n => n.id === tab);

  const handleTab = id => {
    if (id === tab) { setTabsOpen(o => !o); return; }
    setMounted(false);
    setTabsOpen(false);
    setTimeout(() => { setTab(id); setMounted(true); }, 130);
  };

  const handleSearch = async (q) => {
    const query = (q && typeof q === "object") ? q : sanitizeQuery(q || "");
    if (!query) return;
    setLoading(true);
    setError(null);
    try {
      const raw = await fetchBill(query);
      const congress = raw.congress;
      const typeRaw = raw.type?.toLowerCase();
      const number = raw.number;
      const [summaries, actions] = await Promise.all([
        fetchSummaries(congress, typeRaw, number),
        fetchActions(congress, typeRaw, number),
      ]);
      setBill(normaliseBill(raw, summaries, actions));
      setTab("brief");
      setMounted(true);
    } catch (e) {
      if (e && e.retryAfter) {
        const secs = Math.max(1, Math.ceil((e.retryAfter - Date.now()) / 1000));
        setCooldown(secs);
        setPendingQuery(query);
        setError(null);
      } else {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // Tick the rate-limit countdown; auto-fire the queued search at zero.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => {
      const next = cooldown - 1;
      setCooldown(next);
      if (next <= 0 && pendingQuery != null) {
        const q = pendingQuery;
        setPendingQuery(null);
        handleSearch(q);
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [cooldown, pendingQuery]);

  const QUICK = [
    { label: "KOSA", q: "S 4638" },
    { label: "TikTok Ban", q: "HR 7521" },
    { label: "CHIPS Act", q: "HR 4346" },
    { label: "IRA", q: "HR 5376" },
    { label: "Big Beautiful Bill", q: "HR 1" },
  ];

  // Wrap every tab in an ErrorBoundary so a single crash never blanks the whole app
  const wrap = (id, el) => <ErrorBoundary key={id} color={NAV.find(n => n.id === id)?.color}>{el}</ErrorBoundary>;

  const content = {
    brief:     wrap("brief",     <BillBrief bill={bill} loading={loading} />),
    media:     wrap("media",     <MediaAnalysis bill={bill} archivalData={archivalData} sourceLoading={sourceLoading} sourceError={sourceError} activeSource={activeSource} onSourceSelect={handleSourceSelect} />),
    language:  wrap("language",  <BillLanguage bill={bill} />),
    studio:    wrap("studio",    <CommentaryStudio bill={bill} />),
    timeline:  wrap("timeline",  <CoverageTimeline bill={bill} archivalData={archivalData} />),
    pulse:     wrap("pulse",     <ReaderPulse bill={bill} />),
    lede:      wrap("lede",      <BuriedLede bill={bill} />),
    compare:   wrap("compare",  <CompareView />),
    cards:     wrap("cards",     <CardGenerator />),
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=JetBrains+Mono:wght@400;600&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body,#root{height:100%;overflow:hidden}
        body{background:#000000}
        mark{background:none}
        textarea{resize:none;font-family:inherit}
        button{cursor:pointer;border:none;background:none}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:#000000}
        ::-webkit-scrollbar-thumb{background:#1b2d5c}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.15}}
        @keyframes slideDown{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulseGlow{0%,100%{box-shadow:0 0 6px rgba(255,255,255,0.8)}50%{box-shadow:0 0 12px rgba(255,255,255,1)}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        input::placeholder{color:#5a5a64}
        input:focus{outline:none}
        .tab-row::-webkit-scrollbar{display:none}
        .tab-row{-ms-overflow-style:none;scrollbar-width:none}
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: C.bg }}>

        {/* ── Masthead ── */}
        <div style={{ background: C.header, borderBottom: "1px solid " + C.navy, padding: "0 max(1.25rem, calc((100% - 1280px) / 2))", height: 54, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexShrink: 0 }}>

          {/* Brand */}
          <div style={{ flexShrink: 0 }}>
            <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "1.1rem", color: C.cream, letterSpacing: "0.1em", lineHeight: 1 }}>{BRAND.name}</div>
            <MN color={C.dim} size="0.36rem" spacing="0.08em">{BRAND.handle}</MN>
          </div>

          {/* Live autocomplete search */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1 }}>
            <div style={{ flex: 1 }}><BillSearchBox onSelect={q => handleSearch(q)} /></div>
            {cooldown > 0 && (
              <div style={{
                display: "flex", alignItems: "center", gap: "0.3rem", flexShrink: 0,
                fontFamily: "'JetBrains Mono', monospace", fontSize: "0.5rem",
                color: "#c8a14b", background: "#c1272d18",
                border: "1px solid #c1272d55", borderRadius: 6, padding: "0.25rem 0.5rem",
                whiteSpace: "nowrap"
              }} title="Rate limited — search will retry automatically">
                <span style={{ color: "#c1272d" }}>⏱</span>
                <span>{Math.floor(cooldown / 60)}:{String(cooldown % 60).padStart(2, "0")}</span>
              </div>
            )}
          </div>

          {/* Quick picks */}
          <div style={{ display: "flex", gap: "0.3rem", flexShrink: 0 }}>
            {QUICK.map(q => (
              <button key={q.q} onClick={() => handleSearch(q.q)} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.42rem", color: C.dim, border: "1px solid " + C.navy, padding: "0.2rem 0.45rem", background: "transparent", letterSpacing: "0.05em", transition: "all 0.15s" }}
                onMouseEnter={e => { e.target.style.color = C.cream; e.target.style.borderColor = C.gold; }}
                onMouseLeave={e => { e.target.style.color = C.dim; e.target.style.borderColor = C.navy; }}>
                {q.label}
              </button>
            ))}
          </div>

          {/* Live stats */}
          <div style={{ display: "flex", alignItems: "center", gap: "1.1rem", flexShrink: 0 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "1.2rem", color: C.gold, lineHeight: 1 }}>{bill.shortName?.slice(0,8)}</div>
              <MN color={C.dim} size="0.33rem">{bill.status}</MN>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <span style={{ width: 5, height: 5, background: loading ? C.gold : C.red, borderRadius: "50%", display: "inline-block", animation: loading ? "spin 1s linear infinite" : "blink 1.2s ease-in-out infinite" }} />
              <MN color={loading ? C.gold : C.red} size="0.4rem" spacing="0.1em">{loading ? "FETCHING..." : "LIVE · CONGRESS.GOV"}</MN>
            </div>
          </div>
        </div>

        {/* ── Error bar ── */}
        {error && (
          <div style={{ background: C.red + "22", border: "1px solid " + C.red + "55", borderLeft: "3px solid " + C.red, padding: "0.4rem 1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
            <MN color={C.red} size="0.5rem">{error}</MN>
            <button onClick={() => setError(null)} style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "0.7rem", color: C.red, letterSpacing: "0.1em" }}>DISMISS</button>
          </div>
        )}

        {/* — Bill ID strip (sticky under tabs, shrinks on scroll) — */}
        <div style={{ background: C.header, borderBottom: "1px solid " + C.navy, padding: scrolled ? "0.2rem 1.25rem" : "0.3rem 1.25rem", display: "flex", alignItems: "center", gap: "1rem", flexShrink: 0, transition: "padding 0.2s ease" }}>
          <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: scrolled ? "0.72rem" : "0.95rem", color: C.cream, letterSpacing: "0.06em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: scrolled ? "60%" : "none", transition: "font-size 0.2s ease" }}>{bill.name}</div>
          {!scrolled && <MN color={C.dim} size="0.38rem">{bill.id}</MN>}
          {!scrolled && <MN color={C.dim} size="0.38rem">·</MN>}
          {!scrolled && <MN color={C.muted} size="0.38rem">{bill.sponsor}</MN>}
          <div style={{ marginLeft: "auto" }}>
            <span style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: scrolled ? "0.6rem" : "0.7rem", color: C.gold, border: "1px solid " + C.gold + "44", padding: scrolled ? "0.05rem 0.35rem" : "0.1rem 0.45rem", letterSpacing: "0.1em", whiteSpace: "nowrap", transition: "all 0.2s ease" }}>{bill.status}</span>
          </div>
        </div>

        {/* ── Scroll banner tabs — minimizable ── */}
        <div style={{ flexShrink: 0, background: C.header, borderBottom: "1px solid " + C.navy, padding: "0.55rem 1rem", display: "flex", gap: "0.4rem", overflowX: "auto" }}>
          {NAV.map(n => {
            const isA = tab === n.id;
            return (
              <button key={n.id} onClick={() => handleTab(n.id)} style={{
                padding: "0.42rem 0.95rem", flexShrink: 0, whiteSpace: "nowrap",
                background: isA ? n.color : C.panel,
                color: isA ? C.cream : C.dim,
                border: "1px solid " + (isA ? n.color : C.border),
                borderRadius: 14,
                fontFamily: "'Bebas Neue', Impact, sans-serif",
                fontSize: "0.8rem", letterSpacing: "0.1em",
                transition: "all 0.15s",
                boxShadow: isA ? SHADOW.pill(n.color) : "none",
              }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.28rem", color: isA ? "rgba(255,255,255,0.45)" : C.dim, marginRight: "0.3rem" }}>{n.num}</span>
                {n.label}
              </button>
            );
          })}
        </div>

        <div onScroll={e => setScrolled(e.target.scrollTop > 8)} style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "1rem max(1.4rem, calc((100% - 1280px) / 2))", opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(-6px)", transition: "opacity 0.2s ease, transform 0.2s ease" }}>
          {loading
            ? <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60%", gap: "0.75rem" }}>
                <div style={{ width: 32, height: 32, border: "3px solid " + C.navy, borderTop: "3px solid " + C.gold, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: "1.1rem", color: C.gold, letterSpacing: "0.15em", animation: "blink 1.4s ease-in-out infinite" }}>FETCHING FROM CONGRESS.GOV...</div>
                <MN color={C.dim} size="0.46rem">Querying the 118th Congress · api.congress.gov</MN>
              </div>
            : content[tab]}
        </div>

      </div>
    </>
  );
}
