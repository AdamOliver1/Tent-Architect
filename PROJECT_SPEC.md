# Tent Floor Planner - Project Specification

## 1. Project Overview

**Tent Floor Planner** is a web-based application that optimizes floor panel layouts for temporary tent structures. The system calculates the most efficient arrangement of floor braces (panels) within tent dimensions, minimizing waste and maximizing coverage while respecting construction constraints.

### Purpose
Help tent installation teams:
- Quickly plan floor layouts for tents of any size
- Minimize material waste (gaps and excess setback)
- Compare multiple layout scenarios
- Visualize the complete floor plan with measurements

### Target Users
- Tent installation professionals
- Event planning companies
- Construction teams working with modular flooring systems

---

## 2. Architecture

### 2.1 System Architecture
**Type:** Monorepo with separate frontend and backend applications

**Structure:**
```
tent-floor-planner/
├── apps/
│   ├── frontend/          # React + Vite web application
│   └── backend/           # NestJS calculation API
├── package.json           # Root workspace configuration
└── CLAUDE.md             # Development guidelines
```

### 2.2 Communication Pattern
- **Frontend → Backend:** REST API calls
- **Single Endpoint:** `POST /calculate`
- **Data Format:** JSON request/response
- **Error Handling:** Standard HTTP status codes with descriptive messages

---

## 3. Domain Model & Terminology

### 3.1 Physical Components

#### Brace (Floor Panel)
- Rectangular floor panel that covers tent floor area
- **Properties:**
  - `length`: Panel length in meters
  - `width`: Panel width in meters
  - `quantity`: Number available in inventory
- **Standard Sizes:**
  - 2.45m × 1.22m (8ft × 4ft)
  - 2.0m × 1.0m
  - 0.5m × 2.0m
  - 0.6m × 2.44m
- **Placement:** Can be rotated 90° for optimal fit

#### Rail
- 5cm thick structural beam running parallel to tent length
- **Properties:**
  - `length`: Rail length in meters
  - `quantity`: Number available in inventory
- **Standard Lengths:** 1m, 5m, 7.36m
- **Usage:** Two rails required (one on each side), joined end-to-end to span tent length

#### Column
- Vertical "strip" of floor space between two rails
- Filled with braces placed end-to-end along tent length
- **Properties:**
  - `columnWidth`: Width perpendicular to tent length
  - `position`: Distance from tent edge
  - `braceCount`: Number of braces in the column
  - `gap`: Unfilled space along tent length (covered by bins)

#### Bin (Filler Piece)
- Small filler panel covering gaps within columns
- Used only on "open ends" (perpendicular to rails)
- Calculated as total gap area, not placed individually

#### Setback
- Empty space around floor perimeter
- **Minimum:** 0.15m (15cm) from all tent edges
- **Purpose:** Safety clearance and structural requirements
- **Optimization:** System minimizes additional setback beyond minimum

### 3.2 Geometric Concepts

#### Usable Area
- Floor area available after accounting for setback
- Formula: `usableLength = tentLength - 2 × setback`
- Formula: `usableWidth = tentWidth - 2 × setback`

#### Axis Definitions
- **Rail Ends (Length Axis):** Parallel to rails
  - Rule: Symmetric layout, NO bins allowed
  - Excess space → increase setback uniformly
- **Open Ends (Width Axis):** Perpendicular to rails
  - Rule: Bins allowed to fill gaps within columns

#### Column Type
- Template defining how a specific brace size fills a column
- **Properties:**
  - Original brace dimensions
  - `rotated`: Whether brace is turned 90°
  - `columnWidth`: Width of column this creates
  - `fillLength`: Length each brace covers along tent
  - `braceCount`: How many braces needed per column
  - `gap`: Remaining space after braces (covered by bins)

---

## 4. Features & Functionality

### 4.1 Input Management
1. **Tent Dimensions**
   - Length and width in meters
   - Validation: Must exceed minimum (2 × 0.15m = 0.30m)
   - Validation: Must be positive numbers

2. **Inventory Configuration**
   - Custom brace types (length, width, quantity)
   - Custom rail types (length, quantity)
   - Default inventory if none provided (unlimited quantities)
   - Validation: Positive dimensions and quantities

### 4.2 Calculation Engine
**Algorithm:** Dynamic Programming with Pareto Optimization

**Objectives (minimize both):**
1. Setback excess (wasted perimeter space)
2. Total gap area (bins needed)

**Constraints:**
- Minimum 0.15m setback from all edges
- Respect brace inventory quantities
- Symmetric layout along rail axis
- Rails joined to span full length

**Output:** 3 Pareto-optimal scenarios
1. **Best Width Fit** - Minimizes setback
2. **Minimum Gaps** - Minimizes bin area
3. **Balanced** - Optimal trade-off (knee point)

### 4.3 Visualization
- **Canvas-Based Rendering:** HTML5 Canvas API
- **Components Displayed:**
  - Rails (dark gray)
  - Braces/Columns (blue)
  - Bins/Gaps (light yellow)
  - Measurements and labels
- **Features:**
  - Zoom and pan for large tents
  - Legend for colors
  - Selectable scenarios

### 4.4 Results Comparison
- Side-by-side scenario cards
- Metrics displayed per scenario:
  - Setback distance
  - Total gap area
  - Number of columns
  - Usable dimensions
  - Material usage
- Click to view detailed visualization

### 4.5 Export (if implemented)
- Export floor plan as image
- Export material list as CSV/JSON
- Print-friendly layout

---

## 5. Algorithm Details

### 5.1 Column Type Generation
```
For each brace in inventory:
  1. Normal orientation: width = column width, length fills along tent
     - braceCount = floor(usableLength / brace.length)
     - gap = usableLength - (braceCount × brace.length)
  
  2. Rotated orientation: length = column width, width fills along tent
     - braceCount = floor(usableLength / brace.width)
     - gap = usableLength - (braceCount × brace.width)
```

### 5.2 Dynamic Programming Search

**State Space:**
- State key: Current total width covered (in centimeters for precision)
- State value: Pareto set of solutions at this width

**Transition:**
```
For each state at width W:
  For each column type CT:
    newWidth = W + CT.columnWidth + railThickness (5cm)
    If newWidth ≤ targetWidth AND inventory allows:
      Create new solution: 
        - columns = previous.columns + [CT]
        - totalGap = previous.totalGap + CT.gap
        - braceUsage updated
      Add to Pareto set at newWidth
```

**Discretization:**
- 1cm precision (0.01m)
- Converts floating-point to integer math
- Prevents accumulation of rounding errors

**Pareto Pruning:**
- Keep only non-dominated solutions at each state
- Domination: Solution A dominates B if:
  - A.totalGap ≤ B.totalGap AND
  - A.columnCount ≤ B.columnCount AND
  - At least one inequality is strict
- Limit Pareto set to 50 solutions per state (memory control)

**Inventory Tracking:**
- Map: `braceKey → usedQuantity`
- Key format: `"length×width"` (e.g., "2.45x1.22")
- Reject transitions exceeding available quantity

### 5.3 Terminal State Selection
```
acceptableWidthRange = [targetWidth - 1.0m, targetWidth]

For each state in acceptableWidthRange:
  setbackExcess = (targetWidth - stateWidth) / 2
  Add to terminal solutions
```

### 5.4 Pareto Front Selection (3 Scenarios)
```
1. Best Width Fit: min(setbackExcess)
2. Minimum Gaps: min(totalGap)
3. Balanced: min normalized distance from origin
   - Normalize both objectives to [0, 1]
   - Distance = sqrt(normSetback² + normGap²)
   - Select solution closest to ideal (0, 0)
```

### 5.5 Rail Construction
**Greedy Algorithm:**
```
For each of 2 rails:
  remainingLength = usableLength
  position = 0
  While remainingLength > 1cm:
    1. Find longest available rail ≤ remainingLength
    2. If none fit, use longest available rail
    3. Place rail segment at current position
    4. Update: position += segmentLength
    5. Update: remainingLength -= segmentLength
    6. Decrement rail inventory
```

---

## 6. API Specification

### 6.1 Endpoint: Calculate Floor Plan

**URL:** `POST /calculate`

**Request Body:**
```json
{
  "tent": {
    "length": 20.0,    // meters
    "width": 10.0      // meters
  },
  "inventory": {      // Optional, uses defaults if omitted
    "braces": [
      {
        "length": 2.45,
        "width": 1.22,
        "quantity": 100
      },
      // ... more braces
    ],
    "rails": [
      {
        "length": 7.36,
        "quantity": 20
      },
      // ... more rails
    ]
  }
}
```

**Response (200 OK):**
```json
{
  "scenarios": [
    {
      "name": "Best Width Fit",
      "setback": 0.175,
      "totalGap": 2.5,
      "usableWidth": 9.65,
      "usableLength": 19.65,
      "columns": [
        {
          "position": 0.175,
          "columnType": {
            "braceLength": 2.45,
            "braceWidth": 1.22,
            "rotated": false,
            "columnWidth": 1.22,
            "fillLength": 2.45,
            "braceCount": 8,
            "gap": 0.05
          }
        },
        // ... more columns
      ],
      "rails": [
        // Rail 1 segments
        [
          { "length": 7.36, "position": 0 },
          { "length": 7.36, "position": 7.36 },
          { "length": 4.93, "position": 14.72 }
        ],
        // Rail 2 segments (same as Rail 1)
        [
          { "length": 7.36, "position": 0 },
          { "length": 7.36, "position": 7.36 },
          { "length": 4.93, "position": 14.72 }
        ]
      ]
    },
    // ... 2 more scenarios
  ],
  "tent": {
    "length": 20.0,
    "width": 10.0
  }
}
```

**Error Responses:**

- **400 Bad Request** - Invalid input
  ```json
  {
    "statusCode": 400,
    "message": "Tent dimensions must be positive",
    "error": "Bad Request"
  }
  ```

- **400 Bad Request** - No solution found
  ```json
  {
    "statusCode": 400,
    "message": "No valid floor plan found. The tent may be too narrow for available braces.",
    "error": "Bad Request"
  }
  ```

### 6.2 Default Inventory

**Default Braces (unlimited quantity):**
- 2.45m × 1.22m
- 2.0m × 1.0m
- 0.5m × 2.0m
- 0.6m × 2.44m

**Default Rails (unlimited quantity):**
- 1.0m
- 5.0m
- 7.36m

---

## 7. Frontend Structure

### 7.1 Technology Stack
- **Framework:** React 18.3 with TypeScript
- **Build Tool:** Vite 5.4
- **Routing:** React Router v6
- **Styling:** CSS Modules with SCSS
- **State:** Context API (CalculationContext)
- **HTTP Client:** Fetch API
- **Canvas:** HTML5 Canvas API
- **i18n:** i18next (internationalization support)

### 7.2 Page Structure

#### Dashboard Page (`/`)
**Purpose:** Input tent dimensions and inventory

**Components:**
- `TentInput` - Length and width fields
- `InventoryEditor` - Add/edit braces and rails
- `Button` - "Generate Floor Plan" trigger

**User Flow:**
1. Enter tent dimensions (defaulted to 20m × 10m)
2. Edit inventory or use defaults
3. Click "Generate Floor Plan"
4. Navigate to Results page

#### Results Page (`/results`)
**Purpose:** Display and compare calculated scenarios

**Components:**
- `ScenarioCard` (×3) - Metrics for each scenario
- `FloorPlanCanvas` - Visual floor plan
- `ZoomControls` - Canvas zoom/pan controls
- `ExportModal` - Export options (if implemented)
- `Button` - "Back to Dashboard"

**User Flow:**
1. View 3 scenario cards side-by-side
2. Click scenario to view detailed visualization
3. Zoom/pan to explore layout
4. Compare metrics
5. Return to dashboard or export

### 7.3 Component Breakdown

#### TentInput
- **Props:** None (uses context)
- **State:** Local form state
- **Validation:** Positive numbers, minimum size
- **Updates:** Context on change

#### InventoryEditor
- **Props:** None (uses context)
- **Features:**
  - Add new brace/rail types
  - Edit existing items
  - Delete items
  - Reset to defaults
- **State:** Local editing state
- **Updates:** Context on save

#### ScenarioCard
- **Props:** `scenario: Scenario`, `selected: boolean`, `onClick: () => void`
- **Display:**
  - Scenario name
  - Setback value
  - Total gap area
  - Number of columns
  - Usable dimensions
- **Interaction:** Clickable to select

#### FloorPlanCanvas
- **Props:** `scenario: Scenario | null`, `tentDimensions: TentDimensions`
- **Features:**
  - Draw rails, columns, bins
  - Show measurements
  - Zoom/pan support
  - Legend
- **State:** Canvas transform, zoom level
- **Rendering:** RequestAnimationFrame loop

#### Header
- **Display:** App title, language selector
- **Navigation:** None (single-page flow)

#### Button
- **Props:** `onClick`, `disabled`, `variant`, `children`
- **Variants:** primary, secondary, danger
- **Reusable:** Used throughout app

### 7.4 State Management

#### CalculationContext
**State:**
- `tent: TentDimensions` - Current tent input
- `inventory: Inventory | null` - Current inventory
- `results: Scenario[] | null` - Calculation results
- `isLoading: boolean` - API request state
- `error: string | null` - Error messages

**Actions:**
- `setTent(tent)` - Update tent dimensions
- `setInventory(inventory)` - Update inventory
- `calculate()` - Trigger calculation API call
- `clearResults()` - Reset results
- `clearError()` - Dismiss error

**Provider:** Wraps entire app in `App.tsx`

**Hook:** `useCalculation()` - Access state and actions

### 7.5 Styling Approach

**CSS Modules:** Component-scoped styles (`.module.scss` files)

**Global Styles:** `styles/global.scss` - Resets, base styles

**CSS Variables:** `styles/variables.scss`
```scss
--color-primary: #2563eb;
--color-success: #10b981;
--color-warning: #f59e0b;
--color-error: #ef4444;
--spacing-sm: 0.5rem;
--spacing-md: 1rem;
--spacing-lg: 1.5rem;
--spacing-xl: 2rem;
```

**Responsive:** Mobile-first, breakpoints at 768px, 1024px

**Layout:** Flexbox and Grid (no UI library)

---

## 8. Data Flow

### 8.1 User Input → Calculation → Results

```
1. User enters tent dimensions
   ↓
2. User edits inventory (optional)
   ↓
3. User clicks "Generate Floor Plan"
   ↓
4. Frontend calls POST /calculate
   ↓
5. Backend validates input
   ↓
6. Backend runs DP algorithm
   ↓
7. Backend selects 3 Pareto scenarios
   ↓
8. Backend constructs full scenarios
   ↓
9. Backend returns JSON response
   ↓
10. Frontend stores results in context
   ↓
11. Frontend navigates to Results page
   ↓
12. User views and compares scenarios
```

### 8.2 Error Handling Flow

```
Input Validation Error:
  - Backend returns 400 with message
  - Frontend displays error banner
  - User corrects input

Calculation Error (no solution):
  - Backend returns 400 with explanation
  - Frontend displays error banner
  - User adjusts dimensions or inventory

Network Error:
  - Frontend catches fetch exception
  - Frontend displays generic error
  - User retries
```

---

## 9. Technical Stack

### 9.1 Backend (NestJS)

**Core:**
- Node.js ≥ 20.0.0
- NestJS 10.3
- TypeScript 5.3
- Express

**Validation:**
- class-validator
- class-transformer

**Testing:**
- Jest 29.7
- ts-jest

**Development:**
- nest-cli
- ts-node
- nodemon (via nest start --watch)

### 9.2 Frontend (React)

**Core:**
- React 18.3
- React DOM 18.3
- TypeScript 5.5
- Vite 5.4

**Routing:**
- react-router-dom 6.22

**Internationalization:**
- i18next 25.8
- react-i18next 16.5
- i18next-browser-languagedetector 8.2

**Styling:**
- SCSS/Sass 1.71
- CSS Modules (built into Vite)

**Development:**
- ESLint 9.9
- Vite dev server with HMR

### 9.3 Monorepo

**Package Manager:** npm with workspaces
- Root `package.json` defines workspace
- Shared scripts run across apps
- Independent `package.json` per app

---

## 10. Development Commands

### 10.1 Root Level (Monorepo)

```bash
# Start both frontend and backend in development mode
npm run dev

# Start only backend
npm run dev:backend

# Start only frontend
npm run dev:frontend

# Build both apps for production
npm run build

# Run all tests
npm run test

# Run only backend tests (algorithm tests)
npm run test:algorithm

# Lint all code
npm run lint
```

### 10.2 Backend (`apps/backend/`)

```bash
# Development server with watch mode
npm run start:dev

# Production build
npm run build

# Run tests
npm run test

# Run tests with coverage
npm run test:cov

# Run tests in watch mode
npm run test:watch

# Lint and fix
npm run lint
```

**Default Port:** 3000

### 10.3 Frontend (`apps/frontend/`)

```bash
# Development server
npm run dev

# Production build (includes type checking)
npm run build

# Preview production build
npm run preview

# Lint
npm run lint
```

**Default Port:** 5173
**API Proxy:** Configured in `vite.config.ts` to proxy `/api/*` to backend

---

## 11. Configuration Files

### 11.1 Backend Configuration

**`tsconfig.json`** - TypeScript compiler settings
- Target: ES2021
- Module: CommonJS
- Strict mode enabled
- Decorator support

**`nest-cli.json`** - NestJS CLI configuration
- Source root: `src`
- Compiler: `tsc`
- Delete out dir on build

**`jest.config`** (in `package.json`)
- Test environment: node
- Transform: ts-jest
- Test regex: `*.spec.ts`
- Coverage directory: `coverage/`

### 11.2 Frontend Configuration

**`tsconfig.json`** - TypeScript compiler settings
- Target: ES2020
- Module: ESNext
- JSX: react-jsx
- Strict mode enabled

**`vite.config.ts`** - Vite build configuration
- React plugin
- Server proxy for API calls
- Build output: `dist/`

**`eslint.config.js`** - ESLint configuration
- React plugin
- TypeScript support
- React hooks rules

---

## 12. Testing Strategy

### 12.1 Backend Testing

**Unit Tests:**
- `calculation.service.spec.ts` - Algorithm logic
  - Column type generation
  - DP search correctness
  - Pareto front selection
  - Rail construction
  - Edge cases (tiny tents, large tents, insufficient inventory)

**Test Framework:** Jest with ts-jest

**Coverage Goals:**
- Calculation service: 90%+
- Inventory service: 80%+
- Overall: 80%+

**Key Test Cases:**
- Various tent sizes (small, medium, large)
- Different brace combinations
- Limited vs unlimited inventory
- Edge cases (minimum size, odd dimensions)
- Error conditions

### 12.2 Frontend Testing

**Current State:** No tests implemented

**Recommended Tests:**
- Component rendering tests (React Testing Library)
- Context state management tests
- API service mocking
- Canvas rendering validation
- Form validation tests

---

## 13. Performance Considerations

### 13.1 Algorithm Performance

**Time Complexity:**
- State space: O(W/precision) where W = tent width
- Transitions per state: O(columnTypes × paretoSize)
- Overall: O((W/0.01) × braceCount² × 50)

**Typical Performance:**
- Small tent (10m × 5m): < 100ms
- Medium tent (20m × 10m): < 500ms
- Large tent (50m × 20m): < 2 seconds

**Memory:**
- Pareto set limited to 50 per state
- Total states: ~1000-2000 for typical tents
- Peak memory: < 100MB

**Optimization Techniques:**
- Discretization to 1cm reduces state space
- Pareto pruning eliminates dominated solutions
- Early termination if perfect fit found
- Inventory tracking prevents impossible states

### 13.2 Frontend Performance

**Canvas Rendering:**
- RequestAnimationFrame for smooth animation
- Avoid re-rendering on every pan/zoom
- Cache measurements and text

**State Updates:**
- React Context with useCallback to prevent re-renders
- Memoize expensive calculations
- Debounce input changes

---

## 14. Deployment

### 14.1 Backend Deployment

**Production Build:**
```bash
cd apps/backend
npm run build
```

**Start Production Server:**
```bash
npm run start:prod
```

**Environment Variables:**
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (production)

**Requirements:**
- Node.js ≥ 20.0.0
- No database required
- Stateless (no persistent storage)

### 14.2 Frontend Deployment

**Production Build:**
```bash
cd apps/frontend
npm run build
```

**Output:** `dist/` directory containing static files

**Hosting Options:**
- Static hosting (Netlify, Vercel, AWS S3)
- CDN for global distribution
- Nginx for self-hosted

**Environment Variables:**
- `VITE_API_URL` - Backend API base URL

---

## 15. Future Enhancements

### 15.1 Features
- [ ] 3D visualization of tent with floor
- [ ] Multiple floor level support (multi-story tents)
- [ ] Material cost calculation and optimization
- [ ] Save/load floor plans
- [ ] Team collaboration features
- [ ] Mobile app (React Native)
- [ ] Offline mode with local storage
- [ ] Export to CAD formats (DXF, DWG)
- [ ] PDF reports with materials list
- [ ] Interactive editing of layouts

### 15.2 Algorithm Improvements
- [ ] Support for non-rectangular tents
- [ ] Irregular column widths (varying rail spacing)
- [ ] Multi-objective optimization UI (adjust weights)
- [ ] Incremental calculation (real-time updates)
- [ ] Machine learning for pattern prediction
- [ ] Support for angled braces
- [ ] Custom bin sizes and placement

### 15.3 Technical Improvements
- [ ] GraphQL API for more flexible queries
- [ ] WebSocket for real-time collaboration
- [ ] Redis caching for common calculations
- [ ] Database for saved projects
- [ ] User authentication and authorization
- [ ] Comprehensive test coverage (frontend)
- [ ] E2E tests with Playwright
- [ ] Performance monitoring
- [ ] Error tracking (Sentry)
- [ ] Analytics integration

---

## 16. Known Limitations

### 16.1 Current Limitations
1. **Rails always parallel:** Cannot handle angled or curved layouts
2. **Rectangular tents only:** No support for irregular shapes
3. **Single floor level:** No multi-story support
4. **No manual editing:** Cannot adjust algorithm results
5. **Limited to 3 scenarios:** May miss other interesting solutions
6. **Greedy rail construction:** May not be optimal for rail usage
7. **No cost optimization:** Doesn't consider material costs

### 16.2 Validation Constraints
1. **Minimum tent size:** 0.30m × 0.30m (2 × 0.15m setback)
2. **Maximum setback increase:** 1.0m beyond minimum
3. **Precision:** 1cm discretization may introduce small errors
4. **Integer quantities:** Cannot handle fractional braces

---

## 17. Glossary

| Term | Definition |
|------|------------|
| **Brace** | Floor panel/board used to cover tent floor |
| **Rail** | Structural beam running along tent length |
| **Column** | Vertical strip of braces between two rails |
| **Bin** | Small filler piece covering gaps in columns |
| **Setback** | Empty space between floor and tent edges |
| **Usable Area** | Floor area available after setback |
| **Column Type** | Template defining brace arrangement in column |
| **Pareto Optimal** | Solution not dominated by any other solution |
| **DP** | Dynamic Programming optimization technique |
| **Rail End** | Direction parallel to rails (tent length) |
| **Open End** | Direction perpendicular to rails (tent width) |
| **Gap** | Unfilled space within column (covered by bins) |

---

## 18. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-09 | Initial | Complete specification based on codebase analysis |

---

## 19. Contact & Support

**Project Type:** Internal Tool / Open Source Project

**Documentation:**
- `CLAUDE.md` - Development guidelines
- `apps/frontend/CLAUDE.md` - Frontend conventions
- `apps/backend/CLAUDE.md` - Backend conventions

**Code Structure:**
- Monorepo with npm workspaces
- TypeScript throughout
- Modular architecture
- Self-documenting code with JSDoc comments
