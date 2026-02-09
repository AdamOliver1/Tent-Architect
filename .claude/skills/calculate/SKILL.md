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
   - Column type generation
   - DP state transitions
   - Open-end setback sweep (Step 2.5)
   - Pareto front construction
   - Final 3–6 scenarios

## Debug Output
Shows intermediate algorithm state:
- All generated column types with widths and gaps
- DP table entries (condensed for large tents)
- Open-end optimization: best usable_length found per solution
- Dominated solutions that were pruned
- Why each Pareto solution was selected
- Setback validation (each side within [0.08m, 0.25m])

## Example
```
> /calculate 12 8

Tent: 12.0m × 8.0m
Usable area (after 0.08m min setback): 11.84m × 7.84m
Setback range per side: 0.08m–0.25m (preferred 0.10m–0.20m)

Trying Orientation 1: 12m rails × 8m columns
Trying Orientation 2: 8m rails × 12m columns

Generated 8 column types:
  [1] 2.45m wide, 0.00m gap (2.45×1.22 brace × 5)
  [2] 1.22m wide, 0.04m gap (2.45×1.22 brace rotated × 4)
  ...

Running DP optimization...
Found 18 Pareto-optimal solutions

Open-end sweep: optimized usable_length for each solution
  Solution 1: usable_length 11.72m → total gap 0.04m (setbacks: 0.14m / 0.14m)
  Solution 2: usable_length 11.84m → total gap 0.12m (setbacks: 0.08m / 0.08m)
  ...

Filtered: discarded 2 solutions (setback out of [0.08, 0.25] range)

Top 6 Scenarios:
  [Best Width Fit]    Setback: 0.12m, Total Gap: 0.18m, Brace kinds: 2
  [Minimum Gaps]      Setback: 0.22m, Total Gap: 0.02m, Brace kinds: 3
  [Least Brace Kinds] Setback: 0.18m, Total Gap: 0.10m, Brace kinds: 1
  [Balanced]          Setback: 0.16m, Total Gap: 0.08m, Brace kinds: 2
  [Balanced 2]        Setback: 0.14m, Total Gap: 0.12m, Brace kinds: 2
  [Balanced 3]        Setback: 0.19m, Total Gap: 0.05m, Brace kinds: 2
```
