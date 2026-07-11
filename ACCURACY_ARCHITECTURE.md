# THE RECORD CHECK — Accuracy & Verification Architecture
**Version:** 1.0 (June 13, 2026)
**Status:** DESIGN STANDARD. Every AI feature must be built against this. Non-negotiable.

---

## 0. THE CORE PRINCIPLE

**AI is never the source of a factual claim. Facts come from primary sources. AI only interprets what is already verified, and always shows its work.**

You CANNOT make an LLM 100% accurate. LLMs generate plausible text, not verified truth — they hallucinate confidently. For an app whose credibility rests on "I read the bill so you don't have to," an AI inventing a provision is an existential risk.

The solution is architectural, not a better prompt: build the app so AI is structurally prevented from being the origin of a fact. If a statement is factual, it traces to a primary source with a clickable link. If AI can't ground it, it doesn't render.

---

## 1. THE THREE-TIER TRUTH MODEL

Every piece of information falls into exactly one tier. The tier determines how it's sourced and displayed.

### TIER 1 — HARD FACTS (never AI-generated)
Bill text, sponsor, cosponsors, vote counts, dates, status, committee, amendments.
- Source: Congress.gov ONLY.
- Real polling: cited pollster ONLY (Pew, Gallup, etc. with date + link).
- AI never generates, summarizes-as-fact, or paraphrases these.
- Display rule: every Tier 1 fact carries a source link. No link = does not render.

### TIER 2 — GROUNDED INTERPRETATION (AI allowed, must cite)
Framing analysis, buried-lede detection, divergence scoring, tone classification.
- AI operates ONLY on real text it was given (real bill text + real article text).
- AI MUST quote the actual source spans it's reasoning from.
- Both the bill quote AND the article quote are shown to the user, side by side.
- The user can verify the AI's claim against the sources in one glance.

### TIER 3 — LABELED ESTIMATE (AI allowed, must be stamped)
Bill-specific polling where no real poll exists; projected support; comparative guesses.
- Stamped "AI ESTIMATE" with a confidence level (HIGH/MED/LOW).
- Never styled to look like a Tier 1 fact.
- Reader Pulse already does this correctly — the model for all Tier 3.

---

## 2. THE FIVE GUARDRAILS (in build priority order)

### G1 — RETRIEVAL GROUNDING (most important)
AI is only ever given the real primary text and told to work strictly within it.
- Buried Lede: feed the real article text + real bill text. Prompt: "Quote only from the text provided. If the text does not support a claim, say so."
- Never ask AI to recall a bill from memory. Always pass the fetched text.
- This alone eliminates most hallucination — AI can't invent a provision when forced to quote from the source in front of it.

### G2 — QUOTE VERIFICATION (code, not prompt)
Before displaying any AI claim that includes a quote, verify the quote actually exists in the source.
- After the AI returns a quote, string-search the source text for it (normalized: lowercase, collapse whitespace).
- If the quote is NOT found -> reject the whole AI response, show "Could not verify — try again" instead.
- This is a hard gate in code. A hallucinated quote never reaches the screen.
- Pseudocode:

    function verifyQuote(quote, sourceText) {
      const norm = s => s.toLowerCase().replace(/\s+/g, ' ').trim();
      return norm(sourceText).includes(norm(quote));
    }
    // reject AI output if any cited quote fails verifyQuote()

### G3 — SOURCE ATTRIBUTION ON EVERYTHING
Every factual statement links to its primary source.
- Bill facts -> Congress.gov bill URL.
- Article claims -> the article URL.
- Polling -> the pollster's report URL.
- Rule: if it can't be sourced, it doesn't render. No orphan facts.

### G4 — CONFIDENCE & TIER LABELING (visual)
The user always knows which tier they're looking at.
- Tier 1 fact: plain, with source link.
- Tier 2 interpretation: marked "ANALYSIS" with the quotes shown.
- Tier 3 estimate: marked "AI ESTIMATE" + confidence badge.
- Three visually distinct treatments. Never blur the line.

### G5 — HUMAN IN THE LOOP
The app is a research tool, not an autopilot.
- Nate reviews before publishing any content.
- The app surfaces evidence; the human makes the final editorial call.
- No auto-posting of AI conclusions as fact.

---

## 3. EDITORIAL STANCE (a strength, not a weakness)

The app presents evidence and lets the viewer judge — it does not declare verdicts as objective truth.

"Here's the bill. Here's the coverage. You decide." is MORE defensible than "the AI determined X."

- Divergence scores are framed as "how far coverage strayed from bill text," with both shown — not as an objective truth score.
- Tone/framing labels are interpretive and presented as such.
- Even a real quote can be cherry-picked, so the app shows enough context for the viewer to judge.

This stance protects the brand: you can never be accused of the exact thing you critique (misleading framing) if you always show the primary source next to the interpretation.

---

## 4. PER-TAB APPLICATION

| Tab | Tier | Guardrails |
|-----|------|-----------|
| Bill Brief | T1 | Facts from Congress.gov, source-linked (G3). |
| Bill Language | T1 | Raw statutory text, verbatim. |
| Media Analysis | T2 | Real article text; framing is interpretation with quotes shown (G1,G2,G4). |
| Coverage Timeline | T1/T2 | Real events + article links (G3); tone labels are T2. |
| Reader Pulse | T1 or T3 | Real poll (T1, cited) OR labeled estimate (T3). Never blur. |
| Buried Lede | T2 | Grounded in real article + bill text; quotes verified (G1,G2). Strictest gate. |
| Commentary Studio | T2 | AI angles reference verifiable divergences, not invented claims. |
| Compare | T1 | Voting records from Congress + FEC, source-linked. |

---

## 5. IMPLEMENTATION CHECKLIST (when wiring AI)

- [ ] Every Anthropic prompt includes the real source text + instruction to quote only from it.
- [ ] Every prompt forbids unsupported claims ("if unsupported, say 'not stated'").
- [ ] verifyQuote() gate implemented; AI output rejected if any quote fails.
- [ ] Every rendered fact has a source URL or it does not render.
- [ ] Tier 1/2/3 have three distinct visual treatments.
- [ ] AI ESTIMATE badge + confidence on all Tier 3.
- [ ] No auto-publish; human review preserved.

---

## 6. ONE-LINE SUMMARY (for any contributor or Gemini)

"AI never states a fact. It only interprets real, fetched primary-source text, quotes that text, and every quote is verified against the source before display. Facts come from Congress.gov and cited pollsters with clickable links. Estimates are stamped. The human reviews before publishing."
