# THE RECORD CHECK — Content Pipeline & Discovery Architecture
**Started:** June 13, 2026
**Status:** COMMITTED DIRECTION (not just an idea). This is what Commentary Studio is becoming. Design contract — describes how it will work, not yet fully built. Governed by ACCURACY_ARCHITECTURE.md.

---

## THE CORE FRAMING: TWO JOBS

Commentary Studio is really TWO distinct jobs. Separating them is the key insight.

- **JOB 1 — DISCOVERY:** "What should I talk about today?" (the up-to-the-minute curated feed)
- **JOB 2 — PRODUCTION:** "Now help me make it, fast and repeatably." (script + pipeline)

The hardest part of a repeatable content operation isn't writing — it's DECIDING what to cover every day without burning out. Solve discovery and production gets easy. Build both; discovery feeds production.

---

## JOB 1 — THE DAILY DISCOVERY FEED

Goal: open the app in the morning, see "what's moving in legislation-land today, ranked by how much it fits MY angle." NOT a generic news feed (those are useless) — a feed filtered for "bills where there's a GAP worth exposing."

### Data sources feeding it (most plumbing already exists)
- **Congress.gov activity** — bills with action TODAY (introduced, voted, marked up, passed). Free, already wired. The "what's happening in the Chamber" signal.
- **GDELT volume spikes** — which bills/topics suddenly getting media heat. Already integrated. Sudden spike = something happening culturally.
- **Google Trends** — what people are actually searching. Free. The "cultural heat" signal.

### THE GAP SCORE (what makes the feed YOURS, not generic)
Rank the day's items by the DIVERGENCE between attention and substance:
- High media heat + low actual substance = "everyone's talking, nobody read it" (bread and butter).
- High substance + low attention = "the bill nobody's covering that actually matters."
The feed sorts by OPPORTUNITY FOR YOUR COMMENTARY, not raw popularity. A feed nobody else has.

### THE THREE ZONES
1. **HOT — "cover this now."** Big movement today, high heat, high gap. Time-sensitive. TAKES PRECEDENCE. Ride the wave.
2. **THE PIN BOARD — "bank for later."** Great gap, no urgency (ignored-but-important bills, phantom legislation, hidden consensus). SAVE these. Pull when Hot is dry. Enables batch-producing evergreen content in busy moments to release during slow ones. This is what makes it a PIPELINE not a treadmill — always have inventory.
3. **BREWING — "watch this."** Gaining heat but not there yet. Early warning so you can be FIRST when it breaks instead of chasing it.

### "Up to the minute" — honest scope
True real-time (second-by-second) is unnecessary and adds big complexity. "Fresh as of this morning" is the right target — refresh when you sit down to work. Congress moves in days, media in hours. A morning pull is plenty and far simpler to build.

---

## JOB 2 — THE PRODUCTION PIPELINE

Once you pick an item from the feed, Studio carries it through a REPEATABLE path. Consistency comes from the same skeleton every time.

### The flow
1. **Auto-brief (dossier)** — the moment you pick a bill, Studio pre-loads: the facts (Tier 1), the divergence, the buried lede, the discourse spread. Start from a dossier, never a blank page.
2. **Angle selection** — pick the framing (the "gap," "phantom bill," "hidden consensus" — formats from IDEAS file). Each angle is a template.
3. **Multi-format output** — same research base spun into the four formats: TikTok short, YouTube long, X thread, Substack newsletter. Format buttons already exist. One research base -> four scripts, each shaped for its platform's rhythm.
4. **Hook bank** — AI drafts hooks + structure GROUNDED in the real divergence (per accuracy rules), you approve/edit. It never invents; it packages what's verified.

### THE KEY PRINCIPLE: NO COLD STARTS
The slowness in solo content isn't any single task — it's the cold-start and the hand-offs. Deciding, then researching from scratch, then staring at a blank page — each transition is a fresh start.
**Fix: each step OUTPUTS the next step's INPUT.**
- Deciding -> the ranked feed decides for you (narrows to ~3 good options). Pick from a shortlist.
- Researching -> pick triggers the dossier auto-assembling, all sourced. Never research from zero.
- Writing -> AI drafts the skeleton FROM that dossier in your format templates. Edit and add voice instead of generating from nothing.
Feed -> dossier -> script. No cold starts, no hand-off friction. THAT is what "streamlined" means — you never stop and restart.

### THE CRITICAL CAUTION: AUTOMATE SCAFFOLDING, PROTECT VOICE
Risk of over-automation: all content starts sounding the same (same skeleton, AI-flavored). Nate's VOICE and JUDGMENT are the product; the pipeline removes grunt work, not the person.
- AI assembles the dossier and proposes structure.
- The actual take, hook, and personality stay Nate's.
- Design so the fast path still FORCES a human creative decision at the point that matters — the angle and the voice.
- Otherwise you produce a lot of forgettable content very efficiently. Protect the voice.

---

## ACCURACY GOVERNANCE
Everything here obeys ACCURACY_ARCHITECTURE.md:
- Discovery feed surfaces REAL Congressional actions + REAL measured heat, with sources.
- Production drafts from VERIFIED material only.
- Fast, but every fact traces to a primary source.

---

## BUILD NOTES (when we start)
- Discovery feed = new tab or a mode in Commentary Studio. Undecided.
- Congress "today's actions" endpoint + GDELT spike detection + Trends = the three feeds to wire.
- Gap Score = a ranking function combining heat signals vs. a substance proxy (bill length/scope/impact). Needs design.
- Pin Board = persisted list (localStorage first, or a small saved-items store).
- This depends on the AI wiring (Anthropic proxy) for the dossier drafting step — see SCRATCH sec 7b.
