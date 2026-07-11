# THE RECORD CHECK — Document Index
**This is the front door. Pull this first every session. It maps all other docs.**

## RESUME RITUAL (run at the start of every session)
    cd ~/projects/record-check && git pull origin main && cat README_DOCS.md
Then read the docs below that are relevant, and tell Claude:
"Read README_DOCS.md then RECORD_CHECK_SCRATCH.md — that's the project. Work is LOCAL on Termux (localhost:5173), all committed + pushed to GitHub main."

## THE DOCUMENTS

| File | What it is | When to read |
|------|-----------|--------------|
| README_DOCS.md | This index — the map of all docs. | First, every session. |
| RECORD_CHECK_SCRATCH.md | WHERE WE ARE. Status, build queue, code map, Termux gotchas, commit discipline. | Every session. The main one. |
| RECORD_CHECK_SPEC.md | WHAT IT IS. Technical reference: data contracts, routing, function signatures. (NOTE: may not be in repo yet — see status below.) | When building/wiring anything technical. |
| ACCURACY_ARCHITECTURE.md | The truth guardrails. Every AI feature MUST follow this. Three-tier model, five guardrails, verifyQuote gate. | Before building any AI feature. |
| RECORD_CHECK_IDEAS.md | WHERE IT COULD GO. Idea backlog/menu: cultural layer, echo chamber map, strategy. Not commitments. | When deciding what to build next. |
| RECORD_CHECK_PIPELINE.md | Content pipeline design: discovery feed (Hot/Pinboard/Brewing), Gap Score, no-cold-start production flow. | When building Commentary Studio / the feed. |

## DOC STATUS (keep current)
- SCRATCH: in repo, current as of June 13.
- SPEC: NOT yet in repo (only exists as local/uploaded copy). TODO: commit it so the doc system is complete.
- ACCURACY: in repo (June 13).
- IDEAS: in repo (June 13).
- PIPELINE: in repo (June 13).

## RULE
When you add or rename a doc, update THIS file's table + status, then commit. The index must always reflect reality.
