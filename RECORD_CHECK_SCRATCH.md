# THE RECORD CHECK — Master Scratch File
**Last Updated:** June 12, 2026
**Purpose:** Context preservation document. If this conversation compresses or ends, paste this into a new Claude session and development continues with zero lost ground.

> WARNING: June 12 update. Trust this file over all older notes. This session: added drop-shadows to rounded panels, rebuilt Coverage Timeline event rows as expandable article accordions, established COMMIT-AFTER-EACH-STEP discipline after losing work to file overwrites. All work committed AND pushed to GitHub main. Next: Commentary Studio modular canvas.

> HARD LESSON: Lost timeline+shadow work once because it was never committed and `cp App.jsx.bak App.jsx` overwrote it. RULE: commit after every working change, push regularly. Never restore a .bak without grepping it for today's work first.

---

## 1. WHAT THIS APP IS

**The Record Check** (@therecordcheck) is a political content creator dashboard that compares what federal bills actually say against how the media covers them. For a creator publishing political commentary on YouTube, TikTok, X, Substack.

**Tagline:** What the bill says. What they told you. The gap.

**Core concept:** Every bill search returns actual statutory language side-by-side with media coverage analysis, polling data, and AI-powered insights.

---

## 2. CURRENT STATUS (June 12)

| Item | Status | Notes |
|------|--------|-------|
| Local dev server | WORKING | localhost:5173 via Termux. ONE server only. |
| Congress API (local) | WORKING | Proxy fixed. Real bill JSON confirmed. |
| Bill search + click | FIXED | fetchBill takes object or string. |
| Coverage Timeline UI | DONE (June 12) | Rounded rows + shadows + expandable article accordion. |
| Drop-shadows | DONE (June 12) | On Bill Brief, Commentary Studio, Coverage Timeline panels. |
| Commentary Studio canvas | NEXT | Modular columns/zoom/collapse - not yet built. |
| Compare tab | INTEGRATED | Tab #10. Mock data. src/CompareTimeline.jsx. |
| Anthropic API | NOT WIRED | No proxy, no key. Blocks Buried Lede + Commentary AI + Reader Pulse. |
| Live deploy (Netlify) | ON HOLD | Build ok but blank site. All work LOCAL. Now also pushed to GitHub main. |

**Local .env:** CONGRESS_API_KEY (real, WORKING, MUST ROTATE - exposed in chat); ANTHROPIC_API_KEY NOT SET.

---

## 3. HOW THE LOCAL PROXY WORKS

vite.config.js proxy is the SINGLE source of truth:

    proxy: {
      '/api/congress': {
        target: 'https://api.congress.gov/v3',
        changeOrigin: true,
        rewrite: (path) => {
          const u = new URL('http://x' + path.replace(/^\/api\/congress/, ''))
          u.searchParams.delete('api_key')
          u.searchParams.set('api_key', env.CONGRESS_API_KEY || '')
          return u.pathname + u.search
        }
      }
    }

- App builds URLs as CONGRESS_BASE + "...?api_key=" + CONGRESS_KEY; proxied() rewrites to /api/congress; proxy re-injects key server-side.
- Key read via loadEnv(mode, process.cwd(), '') -> CONGRESS_API_KEY (NO VITE_ prefix).
- Config changes need FULL restart: pkill -9 -f vite; pkill -9 -f node; sleep 3; nohup npm run dev > ~/vite.log 2>&1 &
- DO NOT set hmr port - same-port HMR crashes the server.
- NEEDED NEXT: parallel /api/anthropic proxy (inject x-api-key, anthropic-version: 2023-06-01, content-type).

---

## 4. THE TABS — REAL DATA STATUS

10 tabs (Officials removed, Compare added).

| # | Tab | Component | Data | TRUTH |
|---|-----|-----------|------|-------|
| 01 | Bill Brief | BillBrief | live bill | Real. Has drop-shadow now. |
| 02 | Media Analysis | MediaAnalysis | archivalData (GDELT) | Shows nothing until source picked. |
| 03 | Bill Language | BillLanguage | live bill | Reads bill; full text may need /text endpoint. |
| 04 | Commentary Studio | CommentaryStudio | hardcoded CONTENT_IDEAS | MOCK. Modular canvas redesign is NEXT. |
| 05 | Coverage Timeline | CoverageTimeline | archivalData + TIMELINE | UI DONE: rounded rows, shadows, expandable article accordion. Data still mock. |
| 06 | Reader Pulse | ReaderPulse | fetchPolling (Anthropic) | Needs Anthropic; mock fallback. |
| 07 | Buried Lede | BuriedLede | OUTLETS + getLedeVerdict | MOCK; AI verdict CORS-fails. |
| 09 | Cards | CardGenerator | stub | Placeholder. Def MUST exist or blank-page crash. |
| 10 | Compare | CompareView | mock POLITICIANS/BILLS | Renders, mock. |

**KEY INSIGHT:** "Everything shows KOSA" is NOT a bug - OUTLETS, CONTENT_IDEAS, TIMELINE, POLLING are hardcoded KOSA sample constants. Making tabs real = replacing constants with live data (GDELT + Anthropic).

---

## 5. CODE MAP (App.jsx — grep -n to confirm line numbers, they drift)

- proxied(url) (~27): CORS-safe fetch, rewrites congress URL -> /api/congress.
- CONGRESS_BASE (~41); rateLimiter (~51): 10 req/60s.
- ErrorBoundary class (~68); wrap(id, el) = error boundary only, does NOT draw panels. Each component draws its own panels.
- parseQuery (~98); fetchBill(query, congress=119) (~107) - walks 119->117; takes OBJECT or STRING.
- fetchSummaries / fetchActions; normaliseBill; fetchGDELT(billName) -> {outlets, timeline, rawArticles}.
- C palette (~622) black/charcoal. SHADOW helper with .card/.tone/.bias/.pill/.glow. TEAL const = crimson #c1272d.
- NAV (~627, 10 entries incl compare). Shape {id, num, label, sub, color}.
- BillBrief (~979); MediaAnalysis (~1053); BillLanguage (~1084); CommentaryStudio (~1245); CoverageTimeline (~1297); BuriedLede (~1644); CardGenerator (present).
- CoverageTimeline now has: openEvent state, eventArticles map (mock articles per event), leanColor helper, expandable accordion rows.
- App() state (~2123): tab, mounted, bill, loading, error, tabsOpen, cooldown, pendingQuery, activeSource, archivalData, sourceLoading, sourceError.
- content = {} tab map: brief/media/language/studio/timeline/pulse/lede/cards/compare.
- CompareTimeline.jsx (separate, ~352 lines): own palette U, mock POLITICIANS/BILLS, default export CompareView.

---

## 6. getLedeVerdict / Anthropic call (currently broken)

Calls api.anthropic.com/v1/messages DIRECTLY from browser. Problems:
1. No x-api-key -> 401.  2. No anthropic-version -> rejected.  3. Direct browser origin -> CORS.  4. Model claude-sonnet-4-20250514 STALE -> use claude-sonnet-4-6.

Fix: route through /api/anthropic/v1/messages (proxy injects key + headers), update model string.

---

## 7. BUILD SEQUENCE

### 7a. ACTIVE — design/feature work (June 12)
1. DONE - Design overhaul (palette, rounding, pill search bars, Compare, Officials removal).
2. DONE (June 12) - Drop-shadows on Bill Brief, Commentary Studio, Coverage Timeline. Regex sweep: inline styles with borderRadius: 14 and no boxShadow get ", boxShadow: SHADOW.card". 3 -> 6 uses. Commit af1fed0.
3. DONE (June 12) - Coverage Timeline event rows = expandable article accordion. Each row: rounded-14 + SHADOW.card + clickable (openEvent state, one open at a time). Subtitle: "Tone: X - N articles v". Tap slides down news-article cards: bias-colored left border + dot (blue=left/gold=center/red=right), outlet, headline (Georgia), link out. Mock data in eventArticles map keyed by event name. Real GDELT wires here later. Commit 4916f59. JSX GOTCHA: map return needs fragment-wrap (<div key={i}> around row + accordion) or "Unexpected token".
4. NEXT - Commentary Studio modular canvas. Column-count buttons (1/2/3) + zoom slider (CSS transform scale, native scroll pans past viewport) + collapsible section tiles. NOT two-finger pinch (janky on Termux). Sections = array of tiles in grid-template-columns: repeat(cols,...) inside overflow-auto with scale() transform. Build as ONE single heredoc (chunked appends corrupted the file once). Commit immediately.
5. TODO - Bill Language: full-width, larger, below other elements, scrollable scroll-box with page nav (go-to-page + page number at bottom).

### 7b. DEFERRED — wiring AI tabs
1. Get Anthropic key (console.anthropic.com; key sk-ant-). Do NOT paste in chat; write to .env with printf.
2. Add /api/anthropic proxy to vite.config.js (x-api-key, anthropic-version: 2023-06-01, content-type). Full restart.
3. Repoint getLedeVerdict -> /api/anthropic/v1/messages; fix model string.
4. Buried Lede -> live GDELT (throttle 1 req/5s) mapped to OUTLET shape.
5. Commentary Studio -> live angles via generateAngles(bill) Claude call.
6. Compare -> live data (Congress reuse, FEC new key, GDELT) replacing mock.

---

## 8. BURIED LEDE ALGORITHM

Scores each paragraph: +4 specific data points; +3 confirmed facts; +2 percentages/big figures; -2 reaction/framing; +0.5 per numeric token. Highest = buried lede. AI returns what_they_led_with, real_news, grade (A-F), verdict.

---

## 9. DESIGN — overhaul DONE

**Palette (C object, ~line 622):**

    bg: #000000, header: #0a0a0c, panel: #16161a, panelHi: #1f1f24,
    navy: #1b2d5c (partisan only), border: #2a2a30,
    red: #c1272d (crimson primary), gold: #c8a14b, blue: #3C5FA3,
    cream: #ece6da, muted: #8a8a96, dim: #5a5a64, dimmer: #2a2a30

- TEAL const = crimson #c1272d (was cyan).
- Rounding: all borderRadius bumped to 14 app-wide.
- SHADOW.card now applied to rounded panels (June 12).
- Both search bars: #1f1f24 fill, borderRadius 999 pill, crimson focus.
- Compare tab uses palette U in CompareTimeline.jsx (near-identical look).
- Type: Bebas Neue (headlines), JetBrains Mono (labels), Georgia (body).

---

## 10. HOUSEKEEPING / DEBT

- [ ] ROTATE Congress key - exposed in chat.
- [ ] Confirm .env gitignored.
- [ ] main.jsx debug window error-handlers (harmless, could remove).
- [ ] Dead code: OfficialsDB function still defined (tab removed).
- [ ] Stress-test rate-limit countdown pill.
- [ ] Verify Bill Language full statutory text (may need /text endpoint).
- [ ] Resolve live-deploy host decision.
- [x] Stray .bak/main files removed (June 12).

---

## 11. TERMUX / ENVIRONMENT GOTCHAS

- Run detached: nohup npm run dev > ~/vite.log 2>&1 & (use ~/, NOT /tmp).
- Full-kill before restart: pkill -9 -f vite; pkill -9 -f node; sleep 3, then ONE start.
- Config edits need full restart. DO NOT set hmr port.
- COMMIT DISCIPLINE (June 12): commit after EVERY working change. Push to GitHub regularly. Before restoring a .bak, grep it for today's markers (eventArticles, SHADOW.card count, function CardGenerator) - a blind cp .bak wiped a session once.
- EDIT METHOD: write python3 ~/fix.py single heredoc, exact-string .replace(), print OK/MISS, run. One heredoc = one terminator = safe. Chained cat >> appends corrupted the file (dropped PYEOF wrote shell text into App.jsx).
- Unicode in JSX text: use HTML entities (&larr; &#8599; &middot;), not literal chars or \u escapes.
- CardGenerator def MUST exist if <CardGenerator/> referenced, or blank-page crash.
- NEVER paste raw JS at bash prompt - executes line-by-line.
- Run commands one at a time, wait for $ prompt (pasted commands can merge on lost newline).
- Device: Android, Termux + keyboard + Samsung DeX. Path ~/projects/record-check. User says "D" for done.
- Browser download from Claude app is UNRELIABLE on this device - files may not reach /sdcard/Download or arrive stale. Use chunked heredoc writes or git pull instead.

---

## 12. DEPLOY WORKFLOW

    cd ~/projects/record-check
    pkill -9 -f vite; pkill -9 -f node; sleep 3; nohup npm run dev > ~/vite.log 2>&1 &
    git add -A
    git commit -m "msg"
    git push origin main

Live deploy ON HOLD; choosing new host. Any host must set CONGRESS_API_KEY AND ANTHROPIC_API_KEY env vars + serverless proxy functions for both.

---

## 13. BRAND CONTEXT

- Creator: Nate (@natenitro11-dev / @therecordcheck). Platforms: YouTube, TikTok, X, Substack.
- Angle: "I read the bill so you don't have to." Studio formats: Short (TikTok), Long (YouTube), Thread (X), Newsletter (Substack).
- Data moat: divergence scores, buried-lede analysis, real polling estimates, coverage history.

---

## 14. HOW TO RESUME IN A NEW SESSION

Pull the latest from git: cd ~/projects/record-check && git pull origin main && cat RECORD_CHECK_SCRATCH.md

Then paste this file into a new Claude conversation and say:

"This is my up-to-date scratch file for The Record Check (June 12 - trust over all older notes). Work is LOCAL on Termux (localhost:5173), all committed + pushed to GitHub main, live deploy on hold. Pick up at sec 7a step 4: build the Commentary Studio modular canvas (column buttons 1/2/3 + zoom slider + collapsible sections). Do it as ONE single heredoc, commit immediately after it works."

### Git state (June 12)
- Branch: main (also ui-redesign branch from earlier experiment).
- All work committed AND pushed to origin/main. Key commits: af1fed0 (shadows), 4916f59 (timeline accordion).
- git checkout src/App.jsx restores last commit anytime.
- Repo clean of stray .bak/main files.
