# Tent Floor Planner

## user prompting
for each prompt i (the user) gives you, your first step is to rewrite the prompt to be more detailed and specific for ai model, and then ask the user if the new prompt fits him, give him more options, and final option to continue with the original prompt


## Project Structure
Monorepo with two apps:
- `apps/backend/` — NestJS API (calculation engine)
- `apps/frontend/` — React app (UI + visualization)

## Domain Terminology
- **Rail**: 5cm thick beam, lengths: 1m, 5m, 7.36m. Joined to span tent length.
- **Brace**: Floor panel. Sizes: 2.45×1.22m, 2×1m, 0.5×2m, 0.6×2.44m. Can rotate.
- **Column**: Space between two rails, filled with braces end-to-end.
- **Bin**: Filler piece covering gaps inside columns.
- **Setback**: Configurable min/max distance from tent edges (defaults: min 0.08m, max 0.25m). Asymmetric: rail-end setback (left/right, symmetric) and open-end setbacks (start/end, can differ).
- **Constraints**: User-configurable algorithm parameters: minSetback, maxSetback, maxColumnGap (default 0.39m).

## Axis Rules
- **Rail Ends** (parallel to rails): Symmetric, NO bins. Excess → increase setback.
- **Open Ends** (perpendicular): Bins allowed inside columns to cover gaps.

## Commands
- `npm run dev` — Start both apps
- `npm run test` — Run all tests
- `npm run build` — Build for production



## Algorithm Overview
DP-based optimization finding column combinations that minimize:
1. Setback increase (Rail End waste)
2. Total gap/bin area (Open End waste)

Outputs up to 6 scenarios on Pareto front.


## 🔄 Post-Edit Protocol (The Hook)
**TRIGGER:** Immediately after you finish writing or refactoring any code.

**ACTION:**
1.  **Scan Changes:** Briefly review the code you just wrote.
2.  **Check Documentation:** Compare your new code patterns against the current rules in `CLAUDE.md`.
3.  **Self-Correction:**
    *   *If you introduced a new pattern* (e.g., switched from CSS to Tailwind, added a new folder structure): **Explicitly propose an update** to the `Tech Stack` or `Workflow` section of `CLAUDE.md`.
    *   *If you violated a rule* (e.g., Stylist ignored the Auditor): **Flag it** to the user.
    
**OUTPUT:**
If updates are needed, end your response with:
> "📝 **Doc Update Required:** I noticed we changed [X]. Shall I update `CLAUDE.md` to reflect this?"
