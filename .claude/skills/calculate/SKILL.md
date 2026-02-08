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
   - Pareto front construction
   - Final 3 scenarios

## Debug Output
Shows intermediate algorithm state:
- All generated column types with widths and gaps
- DP table entries (condensed for large tents)
- Dominated solutions that were pruned
- Why each Pareto solution was selected

## Example
```
> /calculate 12 8

Tent: 12.0m × 8.0m
Usable area (after 0.15m setback): 11.7m × 7.7m

Generated 8 column types:
  [1] 2.45m wide, 0.00m gap (2.45×1.22 brace × 5)
  [2] 1.22m wide, 0.04m gap (2.45×1.22 brace rotated × 4)
  ...

Running DP optimization...
Found 12 Pareto-optimal solutions

Top 3 Scenarios:
  [Best Width Fit] Setback: 0.22m, Total Gap: 0.18m²
  [Minimum Gaps]   Setback: 0.35m, Total Gap: 0.04m²
  [Balanced]       Setback: 0.28m, Total Gap: 0.09m²
```
