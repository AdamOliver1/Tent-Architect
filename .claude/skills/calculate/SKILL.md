---
name: calculate
description: Calculate floor layout for given tent dimensions (debugging)
argument-hint: "[length] [width]"
---

# Calculate Skill

Manually calculate a floor layout for debugging purposes.

## Usage
- `/calculate 20 10` — Calculate layout for 20m × 10m tent
- `/calculate 15.5 8.2` — Supports decimal dimensions

## Process
1. Parse tent dimensions from arguments
2. Load default inventory (or use custom if specified)
3. Run the calculation algorithm
4. Display detailed step-by-step output:
   - Column type generation (pure + mixed)
   - DP state transitions with brace inventory tracking
   - Open-end setback sweep (Step 2.5)
   - Setback/gap filtering
   - Named scenario selection
   - Final scenarios (up to 20)

## Algorithm Constants
- `RAIL_THICKNESS = 0.05m`
- `PRECISION = 0.01m` (1cm discretization)
- `MAX_SCENARIOS = 20`

## User-Configurable Constraints (defaults)
- `minSetback = 0.08m`, `maxSetback = 0.25m`
- `maxColumnGap = 0.39m`
- Passed via optional `constraints` field in the request body

## Debug Output
Shows intermediate algorithm state:
- All generated column types (pure + mixed) with widths, gaps, brace counts
- Mixed column details: which brace types combined, knapsack result
- Dominated pure types that were pruned by mixed columns
- DP table entries (condensed for large tents)
- Brace inventory usage per solution
- Open-end optimization: best usable_length found per solution
- Setback validation (each side within [0.08m, 0.25m])
- Gap filter results (columns with gap > 0.39m discarded)
- Named scenario selection: which category each scenario was picked for

## Named Scenario Categories
The algorithm selects scenarios in this order (deduplicated by object reference):

1. **Best Width Fit** — min setback excess
2. **Least Brace Kinds** — fewest distinct brace sizes
3. **Minimum Gaps / 2 / 3** — lowest total gap (up to 3 variants)
4. **Least Rails / 2 / 3** — fewest columns (= fewest rails)
5. **Least Braces / 2** — fewest total brace count
6. **Biggest Braces / 2 / 3** — max coverage by largest brace
7. **Balanced** — knee-point on normalized setback×gap plane
8. **Balanced 2, 3, ...** — diverse fill from remaining pool
9. **Option N** — fill to minimum 6 scenarios

## Dual Orientation
Both orientations are tried for non-square tents:
- Orientation 1: length as rail direction, width as column span
- Orientation 2: width as rail direction, length as column span
Results from both are pooled before scenario selection.

## Example
```
> /calculate 12 8

Tent: 12.0m × 8.0m
Usable area (after 0.08m min setback): 11.84m × 7.84m
Setback range per side: 0.08m–0.25m

Trying Orientation 1: 12m rails × 8m columns
Trying Orientation 2: 8m rails × 12m columns

Generated 10 column types (8 pure + 2 mixed):
  [1] 1.00m wide, 0.04m gap (2×1 brace × 5, pure)
  [2] 2.00m wide, 0.04m gap (2×1 brace rotated × 5, pure)
  [3] 2.00m wide, 0.01m gap (mixed: 5×1.0m + 2×0.4m)
  ...

Running DP optimization...
Found 24 Pareto-optimal terminal solutions

Open-end sweep: optimized usable_length for each solution
  Solution 1: usable_length 11.72m → total gap 0.04m (setbacks: 0.14m / 0.14m)
  Solution 2: usable_length 11.84m → total gap 0.12m (setbacks: 0.08m / 0.08m)
  ...

Filtered: discarded 2 solutions (setback out of [0.08, 0.25] range)
Filtered: discarded 1 solution (column gap > 0.39m)

Top 8 Scenarios:
  [Best Width Fit]    Setback: 0.12m, Total Gap: 0.18m², Brace kinds: 2
  [Least Brace Kinds] Setback: 0.18m, Total Gap: 0.10m², Brace kinds: 1
  [Minimum Gaps]      Setback: 0.22m, Total Gap: 0.02m², Brace kinds: 3
  [Minimum Gaps 2]    Setback: 0.20m, Total Gap: 0.04m², Brace kinds: 2
  [Least Rails]       Setback: 0.15m, Total Gap: 0.08m², Brace kinds: 2
  [Biggest Braces]    Setback: 0.14m, Total Gap: 0.12m², Brace kinds: 2
  [Balanced]          Setback: 0.16m, Total Gap: 0.08m², Brace kinds: 2
  [Balanced 2]        Setback: 0.19m, Total Gap: 0.05m², Brace kinds: 2
```
