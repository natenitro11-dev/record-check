# THE RECORD CHECK — Ideas & Vision Backlog
**Started:** June 13, 2026
**Purpose:** Captures brainstormed features, directions, and strategic thinking NOT yet in the build queue. The scratch file = "where we are." The spec = "what it is." This file = "where it could go." Pull it next session to keep ideas alive.

> Rule: ideas here are NOT commitments. They're a menu. Promote an idea to the scratch file's build queue only when we decide to actually build it.

---

## STRATEGIC DIRECTION (decided June 13)

**The app is Nate's competitive MOAT as a content creator, not a standalone product to sell.**
- One-time $5 paid app is the WRONG model: per-use AI (Anthropic) costs money on every analysis, so one-time pricing breaks (heavy user costs more than they paid).
- Content creation is the better use of time. The app's value = it makes Nate a faster, more credible political commentator than anyone in the niche.
- If monetized later: freemium (subscription covers API costs) or free audience-funnel, NOT one-time paid.
- Nate's distribution (YouTube/TikTok/X/Substack) IS the edge most app devs lack. Monetize the audience, not the app.
- Path if desired: deploy live -> instantly an installable PWA -> wrap w/ Capacitor for stores only if worth it. Skip React Native rewrite unless it becomes a real business.

---

## BIG IDEA: THE CULTURAL COMMENTARY LAYER

**The gap the app currently misses.** Current app measures bill text vs. media framing ("what they told you vs. what it says"). Missing: the CULTURAL dimension — how legislation actually LANDS. The vibe, the discourse, the meme-ification, the gap between elite debate and what filters down to feeds and feelings.

**Key distinction:** existing app = truth vs. framing. New layer = DISCOURSE vs. REALITY (how a thing is talked about vs. what it actually is/does). Different axis, culturally richer, nobody's mapping it.

### The "Three Rooms" Model
Any bill lives in three rooms that barely talk to each other:
- **The Chamber** — what the bill literally does. (HAVE IT)
- **The Newsroom** — how outlets frame it. (HAVE IT)
- **The Feed** — how it circulates culturally: memes, outrage cycles, TikToks, vibe. (MISSING = the new layer)
Content gold is usually "the Feed is furious about a thing the Chamber never actually did."

### Sub-ideas under the cultural layer
- **Discourse Temperature** — is online conversation hotter/colder than the bill's actual stakes warrant? Some consequential bills pass in silence; some nothing-burgers dominate 3 news cycles. Cultural heat vs. actual impact = recurring content format.
- **Phantom Legislation tracker** — huge amounts of discourse are about legislation that DOESN'T EXIST yet (proposed, rumored, feared, "they're going to ban X"). Track the gap between what people THINK is being legislated vs. what's actually filed. Could be its own killer feature.
- **Three-way split** — what the LEFT thinks it does vs. what the RIGHT thinks it does vs. what it ACTUALLY does. Often two imagined bills, neither matching the text.

---

## BIG IDEA: THE ECHO CHAMBER MAP (evolved from the cultural layer)

**The reframe that makes it bulletproof:** don't measure PUBLIC OPINION (impossible to do honestly from social data). Measure the SHAPE OF THE CONVERSATION — where the heat is, how siloed it is, whether people are even arguing about the same thing. Observable, sourceable, defensible.

**Core insight:** most sentiment tools blend everything into one mush number ("62% oppose") — that's a LIE because it hides that different communities are at opposite ends AND aren't even discussing the same aspect. This tool REFUSES to blend. Shows how a bill is metabolized in each "room" and how little overlap there is. The gap between chambers IS the story.

### What it reveals (the content gold)
- **Divergence of concern** — not just "left mad, right mad" but they're mad about COMPLETELY DIFFERENT things in the same bill. Echo chamber made visible: same text, two different imagined bills.
- **Manufactured vs. organic heat** — when every community spikes on the same talking point in near-identical language = signal of a coordinated narrative push, not organic reaction.
- **Hidden consensus** — rarely, the chambers actually agree and nobody notices because media frames it as contentious. Finding accidental cross-partisan agreement = phenomenal segment.

### On bias & Reddit (important reasoning, June 13)
- DON'T exclude sources because of their lean — that hands critics the exact attack that undermines the "show the source, you decide" brand. A right-leaning viewer trusts you MORE if you include the left-wing source and let its bias be visible.
- DON'T bias-label individuals (subjective, violates the accuracy doc's "AI never declares truth"). Scale the COMMUNITY/SOURCE CONTEXT instead (r/Conservative vs r/politics), which is observable, not a judgment.
- Reddit LEANS LEFT — true, documented. Handle it by making the lean VISIBLE DATA, not a hidden thumb on the scale. Pull from ideologically varied communities, show the spread.
- WEIGHTING/BALANCING turns the weakness into the feature: normalize for volume so a high-volume source doesn't drown others; show each source as its own lane WITH sample size (n=) stated. This reveals echo chambers instead of faking a national number.

### Honest data-sourcing reality
A comprehensive "all of social media" aggregator is NOT realistically buildable solo on a phone budget. Platforms deliberately gated/priced it to kill these tools.
- **X/Twitter:** API ~$200+/mo (was free, closed on purpose). Skip for now.
- **TikTok:** no meaningful public API. Gated.
- **Meta (IG/FB):** locked down. Closed.
- **Reddit:** free-ish API, topic-searchable, text-based. VIABLE workhorse (keep it — see bias reasoning above).
- **YouTube comments:** free API, Nate's home turf. VIABLE.
- **Google Trends:** free, gives "cultural heat" (search interest over time/region). VIABLE.
- **GDELT:** already integrated, carries tone/emotion signal. VIABLE.
Buildable stack = Reddit + YouTube comments + Google Trends + GDELT. Real, gettable, covers a surprising amount.

### Accuracy rules applied (per ACCURACY_ARCHITECTURE.md)
- Show each source as its own lane, normalized, with sample size visible = honest.
- The MAP is the output, not a blended number.
- NEVER claim "Americans think X." Say "these communities are reacting like this."
- AI characterizes each cluster BUT quotes real posts shown to the viewer (G1/G2). Never invents the vibe.
- Searchable: plugs into existing bill-search flow. Search bill -> pull Reddit + YT + Trends about it -> show discourse spread with real quotes + search-heat overlay.

### Two possible builds (not yet decided)
1. **The Echo Chamber Map** — visual/spatial: how far apart are the rooms, what's in each. Striking visual centerpiece.
2. **Divergence-of-Concern tracker** — "everyone's mad, here's the receipt they're mad about different things." Analytical/text feature.
(May be the same thing from two angles. Undecided which to build first.)

### Open question for next session
Lean toward TEMPERATURE/HEAT (quantitative: Trends + volume) or RANGE OF TAKES (qualitative: real quotes clustered)? Changes which source to build against first.

---

## PARKING LOT (raw ideas, unsorted — add freely)

- Mobile app path: PWA now (already installable) -> Capacitor wrap for stores later -> React Native only if it becomes a real business.
- "Show your screen" content strategy: feature the tool IN videos ("I ran this through my tool, here's the gap") to build intrigue + position as the creator who does the work.

---

## HOW TO USE THIS FILE

- Pull it next session: `cd ~/projects/record-check && git pull origin main && cat RECORD_CHECK_IDEAS.md`
- Add ideas anytime with a one-line append:
    printf '\n- new idea here\n' >> RECORD_CHECK_IDEAS.md
    git add RECORD_CHECK_IDEAS.md && git commit -m "idea" && git push origin main
- Promote an idea to the actual build queue by moving it into RECORD_CHECK_SCRATCH.md sec 7a when we commit to building it.
- This file is a MENU, not a mandate. Nothing here is a commitment.
