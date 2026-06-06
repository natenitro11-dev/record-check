# THE RECORD CHECK — Master Scratch File
**Last Updated:** June 6, 2026  
**Purpose:** Context preservation document. If this conversation compresses or ends, paste this into a new Claude session and development continues with zero lost ground.

---

## 1. WHAT THIS APP IS

**The Record Check** (`@therecordcheck`) is a political content creator dashboard that compares what federal bills actually say against how the media covers them. Built for a content creator who publishes political commentary on YouTube, TikTok, X, and Substack.

**Tagline:** *What the bill says. What they told you. The gap.*

**Core concept:** Every bill search returns the actual statutory language side-by-side with media coverage analysis, polling data, and AI-powered insights — giving the creator proprietary data to build content around.

---

## 2. CURRENT DEPLOYMENT STATUS

| Item | Status | Location |
|------|--------|----------|
| Live URL | ✅ LIVE | `recordchec.netlify.app` |
| GitHub repo | ✅ LIVE | `github.com/natenitro11-dev/record-check` |
| Congress API | ✅ Wired | Key injected server-side via Netlify |
| Anthropic API | ✅ Works | Native in browser (polling, buried lede, officials) |
| GDELT / Archive / CommonCrawl | ⚠️ Wired but CORS-limited | Works on Cloudflare with server functions |
| PWA install | ✅ Ready | Add to Home Screen from Chrome |

**Netlify env vars set:**
- `CONGRESS_API_KEY` = Congress.gov key (set in Netlify dashboard)

---

## 3. FILE STRUCTURE

```
record-check/
├── src/
│   ├── App.jsx          ← MAIN APP — all 8 tabs, 2128 lines
│   ├── main.jsx         ← React entry point
│   └── index.css        ← Global styles + PWA viewport
├── functions/
│   └── api/congress/[[path]].js  ← Netlify/Cloudflare proxy (injects API key)
├── netlify/
│   └── functions/congress.js     ← Netlify serverless function
├── public/
│   └── favicon.svg
├── .env                 ← LOCAL ONLY — never commit (in .gitignore)
├── .env.example         ← Template: CONGRESS_API_KEY=your_key_here
├── .gitignore
├── index.html
├── netlify.toml         ← Netlify build config
├── package.json
├── vite.config.js       ← Dev proxy + PWA config
└── README.md
```

---

## 4. THE 8 TABS

| # | Tab | Color | What It Does |
|---|-----|-------|-------------|
| 01 | Bill Brief | Red `#B22234` | Summary, key provisions, divergence score |
| 02 | Media Analysis | Blue `#3C5FA3` | 4 outlet cards, bill language, lean dial, coverage score |
| 03 | Bill Language | Amber `#C8960C` | Full statutory text with keyword highlights, outlet switcher |
| 04 | Commentary Studio | Teal `#4A8FA8` | Content angles, script pad, spin card preview, talking points |
| 05 | Coverage Timeline | Purple `#7B5EA7` | Bar chart + event log, populated from live bill actions |
| 06 | Reader Pulse | Green `#2E8B57` | AI polling fetch — real data or labeled estimate |
| 07 | Buried Lede | Orange `#CC5500` | Two-card layout: "What They Led With" vs "The Real News" + AI grade |
| 08 | Officials DB | Teal `#0E7490` | Federal lawmaker search, platform stances synthesized by Claude |

---

## 5. API INTEGRATIONS

### Congress.gov
- **Key:** Stored in Netlify env var `CONGRESS_API_KEY` (never in client code)
- **Proxy:** `/api/congress/*` → Netlify function injects key → `api.congress.gov/v3`
- **Used for:** Bill search (autocomplete), bill detail, summaries, actions, member lookup, sponsored legislation

### Anthropic Claude API
- **Auth:** Handled natively by Claude.ai environment in artifact; needs `ANTHROPIC_API_KEY` env var in production for non-Claude.ai deployments
- **Used for:**
  - Reader Pulse: polling synthesis per bill
  - Buried Lede: AI verdict (what_they_led_with, real_news, grade, verdict)
  - Officials DB: platform stance synthesis from voting record
  - Archival synthesis: normalizing GDELT/Archive/CommonCrawl data into outlet cards

### GDELT / Internet Archive / CommonCrawl
- **Status:** Fetch functions written, source selector UI built
- **CORS issue:** These APIs block browser requests — need Cloudflare/Netlify server functions to work in production
- **What they populate:** Media Analysis outlet cards, Coverage Timeline, archive highlights

---

## 6. KEY DESIGN DECISIONS

### Palette: Federal Americana
```
Background:    #0a0f1e  (deep navy)
Header:        #080c18
Panel:         #101c3a
Panel Hi:      #152247
Navy:          #1b2d5c
Border:        #1f3468
Red:           #B22234  (flag red)
Gold:          #F0D060  (parchment gold)
Blue:          #3C5FA3  (congressional blue)
Cream:         #F5EDD8
Muted:         #7a8fa8
Dim:           #2a3d6e
```

### Partisan Color System
```
DEM:  #2563EB  (Democrat blue)
REP:  #DC2626  (Republican red)
IND:  #6B7280  (Independent grey)
```
Applied to: lean dials, party bars, search results, outlet cards, officials DB

### Typography
- Headlines: Bebas Neue (Google Fonts)
- Labels/code: JetBrains Mono
- Body/quotes: Georgia serif

### Scroll Banner Tabs
- Horizontal tab row across the top
- Each tab has a top roller bar + parchment body that unfurls downward when active
- Minimizable: collapses to 32px slim bar with quick-jump dots
- Auto-collapses when tab is selected
- Tabs scroll horizontally (tab-row class, scrollbar hidden)

---

## 7. SMART API ROUTING (HOW CORS IS HANDLED)

```javascript
const IS_LOCAL    = HOST === "localhost" || HOST === "127.0.0.1"
const IS_DEPLOYED = netlify / cloudflare / vercel domain

// Deployed or local: hits /api/congress → server injects real key
// Artifact preview:  tries public CORS proxies (may be blocked by sandbox)
```

The `proxied(url)` function auto-detects environment and routes accordingly. No manual switching needed.

---

## 8. BURIED LEDE ALGORITHM

Scores each paragraph by information density:
- `+4` for specific data points (20% of world supply, $X/gallon)
- `+3` for confirmed facts, humanitarian impact
- `+2` for percentages, billion/million figures
- `-2` for reaction/framing language (said, told reporters, characterized)
- `+0.5` per numeric token

Highest-scoring paragraph = buried lede. AI then synthesizes:
- `what_they_led_with`: the editor's framing choice
- `real_news`: the actual most newsworthy fact  
- `grade`: A–F
- `verdict`: one sentence on the gap

---

## 9. OFFICIALS DATABASE

- **Search modes:** By Name, By State, By Issue, By Status
- **Data source:** Congress.gov `/member` endpoint (current federal members)
- **State legislatures:** OpenStates API hook built, needs free API key
- **Stance synthesis:** Claude receives name + party + state + sponsored bills → returns ideology score, summary, per-issue stances with Documented/Inferred confidence badges
- **Two views:** Summary (elevator pitch) | Detailed (issue-by-issue)

---

## 10. PREEMPTIVE SEARCH / TRENDING BILLS

Search box shows trending bills on focus (before typing):
```javascript
const TRENDING_BILLS = [
  { id: "HR 1",    title: "One Big Beautiful Bill Act",     party: "R" },
  { id: "S 4638",  title: "Kids Online Safety Act",         party: "D" },
  { id: "HR 7521", title: "Protecting Americans from...",   party: "B" },
  { id: "HR 4346", title: "CHIPS and Science Act",          party: "B" },
  { id: "HR 5376", title: "Inflation Reduction Act",        party: "D" },
  { id: "S 686",   title: "RESTRICT Act",                   party: "B" },
  { id: "HR 3684", title: "Infrastructure Investment...",   party: "B" },
]
```
Live search fires after 2 characters with 280ms debounce. Results show party color strip (DEM/REP/BIPARTISAN), bill ID, congress number, status.

---

## 11. KNOWN ISSUES / NEXT UP

### Active Issues
- `HR 7521` search returns "not found" — bill is 118th Congress, search starts at 119. Fix: start fetchBill at 119 and step down to 116, or pre-map known bills to their congress.
- GDELT/Archive/CommonCrawl: CORS blocked in browser — need Cloudflare server functions for data source selector to fully work
- Polling tab: Anthropic API call works in Claude.ai environment but needs `ANTHROPIC_API_KEY` env var + proxy function for standalone Netlify deployment

### Hardening TODO
- [ ] Error boundaries — wrap each tab in React ErrorBoundary so one crash doesn't blank the screen
- [ ] Input sanitization on bill search
- [ ] Rate limit protection on Congress API key
- [ ] Remove `build-app.cjs` and `push-app.cjs` from GitHub repo (not needed in production)
- [ ] Rotate Congress API key (was exposed in conversation)
- [ ] Add Anthropic API proxy function for production polling/lede/officials features
- [ ] OpenStates API key for state legislature search

### Features Planned
- [ ] Real news article fetching (Guardian API free, NYT Article Search free)
- [ ] Shareable "Spin Cards" as images for social media
- [ ] Bill comparison (side-by-side two bills)
- [ ] User saved bills / bookmarks
- [ ] Push notifications for bill status changes

---

## 12. DEPLOY WORKFLOW (ONGOING)

```bash
# Make changes in Termux
cd ~/projects/record-check

# Test locally
npm run dev
# → opens localhost:5173

# Push to GitHub (auto-deploys to Netlify)
git add .
git commit -m "description of change"
git push origin main
# → Netlify auto-deploys in ~60 seconds
```

---

## 13. CONTENT BRAND CONTEXT

- Creator: Nate Taylor (@natenitro11-dev)
- Platforms: YouTube, TikTok, X, Substack
- Angle: Political media analysis — "I read the bill so you don't have to"
- Content formats built into Studio tab: Short (TikTok), Long (YouTube), Thread (X), Newsletter (Substack)
- App gives proprietary data moat: divergence scores, buried lede analysis, real polling estimates — none of this is available anywhere else in this format

---

## 14. HOW TO RESUME IN A NEW SESSION

Paste this entire document into a new Claude conversation and say:

*"This is my scratch file for The Record Check app. I need to continue development. The live app is at recordchec.netlify.app and the repo is github.com/natenitro11-dev/record-check. Pick up where we left off."*

Claude will have full context and can continue without any lost ground.

---

## 15. DEVICE / ENVIRONMENT

- Device: Android phone
- Terminal: Termux (F-Droid install)
- Node: v26.2.0
- npm: 11.16.0
- Project path: `~/projects/record-check`
- Other projects: `~/projects/legislation-dashboard`, `~/projects/straight-line-media`
- GitHub: github.com/natenitro11-dev
- Netlify: connected to GitHub, auto-deploy on push
