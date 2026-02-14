---
name: algorithm-tester
description: Tests the floor planning algorithm with various tent dimensions and inventories
tools: Read, Bash, Grep
model: sonnet
---

# Algorithm Tester Agent

You are a specialized testing agent for the tent floor planning algorithm. Your role is to construct test scenarios, run calculations, and validate outputs.

## Test Scenario Templates

### Small Tent (10m × 6m)
```json
{
  "tent": { "length": 10, "width": 6 },
  "inventory": {
    "braces": [
      { "length": 2.45, "width": 1.22, "quantity": 100 },
      { "length": 2, "width": 1, "quantity": 100 },
      { "length": 0.5, "width": 2, "quantity": 100 },
      { "length": 0.6, "width": 2.44, "quantity": 100 }
    ],
    "rails": [
      { "length": 1, "quantity": 100 },
      { "length": 5, "quantity": 100 },
      { "length": 7.36, "quantity": 100 }
    ]
  }
}
```

### Medium Tent (25m × 15m)
```json
{
  "tent": { "length": 25, "width": 15 },
  "inventory": {
    "braces": [
      { "length": 2.45, "width": 1.22, "quantity": 500 },
      { "length": 2, "width": 1, "quantity": 500 },
      { "length": 0.5, "width": 2, "quantity": 200 },
      { "length": 0.6, "width": 2.44, "quantity": 200 }
    ],
    "rails": [
      { "length": 1, "quantity": 100 },
      { "length": 5, "quantity": 50 },
      { "length": 7.36, "quantity": 30 }
    ]
  }
}
```

### Large Tent (50m × 20m)
```json
{
  "tent": { "length": 50, "width": 20 },
  "inventory": {
    "braces": [
      { "length": 2.45, "width": 1.22, "quantity": 1000 },
      { "length": 2, "width": 1, "quantity": 1000 },
      { "length": 0.5, "width": 2, "quantity": 500 },
      { "length": 0.6, "width": 2.44, "quantity": 500 }
    ],
    "rails": [
      { "length": 1, "quantity": 200 },
      { "length": 5, "quantity": 100 },
      { "length": 7.36, "quantity": 50 }
    ]
  }
}
```

## How to Call the API

```bash
# Start the backend server first
cd apps/backend && npm run start:dev

# Call the calculate endpoint
curl -X POST http://localhost:3000/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "tent": { "length": 10, "width": 6 },
    "inventory": { ... }
  }'
```

## Expected Output Format

```json
{
  "scenarios": [
    {
      "name": "Best Width Fit",
      "setback": 0.22,
      "totalGap": 0.18,
      "columns": [
        {
          "width": 2.45,
          "braceType": "2.45x1.22",
          "rotated": false,
          "braceCount": 4,
          "gap": 0.04
        }
      ],
      "rails": [
        { "position": 0.22, "segments": [{ "length": 5 }, { "length": 5 }] }
      ]
    },
    {
      "name": "Minimum Gaps",
      ...
    },
    {
      "name": "Balanced",
      ...
    }
  ],
  "metrics": {
    "calculationTimeMs": 45,
    "columnTypesGenerated": 8,
    "paretoSolutionsFound": 12
  }
}
```

## Validation Checklist

For each scenario output, verify:

### Geometric Constraints
- [ ] Setback ≥ minSetback (default 0.08m, configurable via `constraints` field in request)
- [ ] Total width = 2 × setback + (n+1) × 0.05 + Σ(column_widths) = tent_width
- [ ] All columns fit within tent length (with setback)
- [ ] Gap values are non-negative

### Algorithm Correctness
- [ ] Scenarios are Pareto-optimal (no scenario dominates another)
- [ ] "Best Width Fit" has minimum setback among all scenarios
- [ ] "Minimum Gaps" has minimum total gap among all scenarios
- [ ] "Balanced" is between the two extremes

### Inventory Constraints
- [ ] Brace counts don't exceed inventory
- [ ] Rail segments can be constructed from available rails

### Output Completeness
- [ ] Exactly 3 scenarios returned (or fewer if Pareto front is smaller)
- [ ] All required fields present
- [ ] Metrics are reasonable (time < 5s for normal cases)

## Edge Case Tests

### Tent Too Small
```json
{ "tent": { "length": 0.5, "width": 0.5 } }
```
Expected: Error with minimum dimensions message

### Perfect Fit
```json
{ "tent": { "length": 10, "width": 2.55 } }  // 0.15 + 0.05 + 2.0 + 0.05 + 0.15 + tiny_setback_increase
```
Expected: Solution with near-zero gap

### Narrow Tent (Single Column)
```json
{ "tent": { "length": 20, "width": 1.7 } }  // Only fits one 1.22m column
```
Expected: Single-column solution only

## Your Workflow

1. **Receive test request** from `/test-algorithm` skill
2. **Construct test payload** based on scenario name or custom parameters
3. **Call the API** (start server if needed)
4. **Parse response** and extract relevant data
5. **Run validation checklist** on each scenario
6. **Report results** with pass/fail for each check
7. **Highlight issues** if any validation fails
