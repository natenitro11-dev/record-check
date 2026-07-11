# THE RECORD CHECK — Gemini Planning Blueprint
**Source:** Gemini planning session, June 13, 2026
**Status:** PLANNING ARTIFACT. Good thinking, but see Claude's caveats at the bottom before building. The bias methodology is ready to use; the Gap Score is a north-star to grow toward, NOT the v1 spec.

---

## 1. Accuracy & Verification (mirrors ACCURACY_ARCHITECTURE.md)
- Tier 1 (Facts): Congress.gov only, source-linked.
- Tier 2 (Interpretation): AI must quote real spans from provided text; verifyQuote() is a hard code gate.
- Tier 3 (Estimates): Labeled "AI ESTIMATE" with confidence badge. Never blur with facts.
- Editorial stance: "Here's the bill. Here's the coverage. You decide." Show evidence, don't declare verdicts.

## 2. Gap Score Formula (Discovery Feed) — AMBITIOUS VERSION
Rank bills by divergence between Media Attention (H) and Legislative Substance (S'):
- Attention (H): log(M+1) x log(T+1)  [M = GDELT volume, T = Google Trends]
- Substance (S'): (Status x 0.7) + (norm(Reach) x 0.3)
- Ranking (G): (H x R) + (D x w), where D = Distraction Multiplier (exposes performative noise)

## 3. Bias/Lean Labeling Methodology — READY TO USE
- Metadata-first: bias is source METADATA, not AI-inferred judgment.
- Reference system: standardized metadata (AllSides / MBFC identifiers) render "Lean Badges" ([Left] | [Center] | [Right]).
- Transparency: clicking a badge reveals the third-party rationale. Maintains "show the source" brand.
- This aligns perfectly with the accuracy doc's rule: label source context, never judge individuals, never hide sources by lean.

## 4. Technical Constraints (correct, matches SCRATCH)
- JSX: HTML entities only for UI symbols (&larr; &middot; &#8599;).
- Delivery: small single-purpose code blocks, no full-file rewrites.
- Workflow: every successful implementation followed by a git commit.

---

## CLAUDE'S CAVEATS (read before building)

### On the Gap Score — SIMPLIFY FOR V1
The formula is elegant but over-engineered for a first build. Concerns:
- Underspecified terms: D (Distraction Multiplier), Status quantification, Reach, and normalization are not defined well enough to code as-is.
- False confidence risk: it LOOKS scientific, but every weight (0.7, 0.3, w) is a guess dressed as math. Treat them as TUNABLE KNOBS, not truths.
- RECOMMENDATION: build a simpler v1 first (e.g. "heat rank minus substance rank"), verify it actually surfaces good stories, THEN add sophistication. Don't let the formula's elegance outrun whether it picks good content.
- The full formula above = the ambitious version to grow toward, not the v1 spec.

### On "full control" framing
Gemini's blueprint said Claude has "full control" and all amendments "run through" Claude. Reframe: NATE is in charge. Claude is the careful hands on App.jsx, executing changes via the commit-per-step workflow. Planning/research can happen with Gemini. Code changes route through the careful workflow HERE. Not "Claude is in charge" — Nate drives, Claude executes carefully.

### What's ready vs. what needs work
- READY TO USE: the bias/lean labeling methodology (metadata-first, AllSides/MBFC badges, clickable rationale). Solid and defensible.
- NEEDS SIMPLIFYING + GAP-FILLING BEFORE BUILDING: the Gap Score formula.
- CORRECT AS-IS: the accuracy summary and technical constraints.
