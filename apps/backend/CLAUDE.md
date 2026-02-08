# Backend — NestJS API

## Conventions
- Use NestJS modules pattern
- One module per domain concept
- DTOs for all request/response types
- Barrel exports (index.ts)

## Structure
```
src/
├── app.module.ts
├── main.ts
├── calculation/           # Core algorithm
│   ├── calculation.module.ts
│   ├── calculation.controller.ts
│   ├── calculation.service.ts
│   └── dto/
├── inventory/             # Brace/rail definitions
│   ├── inventory.module.ts
│   └── inventory.service.ts
└── shared/                # Types, utils
    └── types/
```

## API Endpoints
- `POST /calculate` — Run floor plan calculation
  - Input: tent dimensions, inventory
  - Output: 3 scenarios with placements

## Algorithm Details
1. Generate column types from braces (width, gap per usable length)
2. DP search for column combinations
3. Track Pareto-optimal solutions
4. Return top 3 scenarios

## Commands
- `npm run start:dev` — Dev server with watch
- `npm run test` — Run tests
