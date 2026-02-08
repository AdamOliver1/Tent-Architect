---
name: test-algorithm
description: Test the floor planning algorithm with sample scenarios
argument-hint: "[scenario-name]"
context: fork
agent: algorithm-tester
---

# Test Algorithm Skill

This skill runs the floor planning algorithm with predefined or custom test scenarios.

## Usage
- `/test-algorithm` — Run all default test scenarios
- `/test-algorithm small` — Test with a small tent (10×6m)
- `/test-algorithm large` — Test with a large tent (50×20m)
- `/test-algorithm edge` — Run edge case scenarios

## Test Scenarios

### Default Scenarios
1. **Small tent**: 10m × 6m — Basic functionality test
2. **Medium tent**: 25m × 15m — Standard event tent
3. **Large tent**: 50m × 20m — Performance test
4. **Narrow tent**: 30m × 5m — Single column edge case

### Edge Cases
- Perfect fit (no gaps needed)
- Only one brace type fits
- Maximum setback reached

## Output
For each scenario, displays:
- Input dimensions and inventory
- 3 Pareto-optimal solutions
- Visualization of each layout
- Performance metrics (time, memory)
