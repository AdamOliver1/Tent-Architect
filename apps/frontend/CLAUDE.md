# Frontend — React App

## Conventions
- CSS Modules: `ComponentName.module.scss`
- Global styles in `styles/` directory
- Functional components with hooks
- TypeScript strict mode
- Pages use `Page` suffix (e.g., `DashboardPage.tsx`)
- Reusable components in `components/` directory
- Barrel exports: Each component/page folder includes `index.ts` for clean imports

## Structure
```
src/
├── pages/
│   ├── DashboardPage/
│   │   ├── DashboardPage.tsx       # Main input page
│   │   └── DashboardPage.module.scss
│   └── ResultsPage/
│       ├── ResultsPage.tsx         # Output/results page
│       └── ResultsPage.module.scss
├── components/
│   ├── TentInput/
│   │   ├── TentInput.tsx           # Tent dimensions form
│   │   └── TentInput.module.scss
│   ├── InventoryEditor/
│   │   ├── InventoryEditor.tsx     # Brace/rail inventory form
│   │   └── InventoryEditor.module.scss
│   ├── ConstraintsEditor/
│   │   ├── ConstraintsEditor.tsx   # Algorithm constraints form (collapsible)
│   │   ├── ConstraintsEditor.module.scss
│   │   └── index.ts
│   ├── FloorPlanCanvas/
│   │   ├── FloorPlanCanvas.tsx     # Canvas visualization
│   │   └── FloorPlanCanvas.module.scss
│   ├── ScenarioCard/
│   │   ├── ScenarioCard.tsx        # Individual scenario display (setback + braces + inventory btn)
│   │   └── ScenarioCard.module.scss
│   ├── ScenarioPanel/
│   │   ├── ScenarioPanel.tsx           # Scenario side-panel: header, sort bar, scenario list, stats footer
│   │   ├── ScenarioPanel.module.scss
│   │   ├── SortBar.tsx                 # Sort select + direction toggle (exports SortOption, SortDirection)
│   │   ├── SortBar.module.scss
│   │   └── index.ts
│   ├── ColumnPopup/
│   │   ├── ColumnPopup.tsx             # Column detail popup dialog (brace size, gap, count)
│   │   ├── ColumnPopup.module.scss
│   │   └── index.ts
│   ├── ScenarioInventoryModal/
│   │   ├── ScenarioInventoryModal.tsx  # Inventory detail modal per scenario
│   │   ├── ScenarioInventoryModal.module.scss
│   │   └── index.ts
│   ├── ExportView/
│   │   ├── ExportView.tsx            # SVG export view (adaptive sizing, scenario dimensions, company title, rails inventory, RTL for he/ar)
│   │   └── ExportView.module.scss
│   ├── Header/
│   │   └── Header.tsx                # Sticky header with logo (t('app.companyName')), language switcher
│   └── Button/
│       ├── Button.tsx              # Reusable button component
│       └── Button.module.scss
├── context/
│   └── CalculationContext.tsx      # App state management (exports useCalculation hook)
├── services/
│   └── api.ts                      # API client for backend
├── utils/
│   └── export.ts                   # PNG export utility (html2canvas)
├── styles/
│   ├── global.scss                 # Global styles, CSS reset
│   └── variables.scss              # Colors, spacing, breakpoints
├── types/
│   ├── tent.ts                     # Tent-related types
│   ├── inventory.ts                # Brace/rail types
│   ├── scenario.ts                 # Scenario output types
│   └── index.ts                    # Barrel exports for all types
├── App.tsx                         # Root component with routing
└── main.tsx                        # App entry point
```

## Page Flow

### Dashboard Page
- **Purpose**: Input tent dimensions and inventory
- **Components**:
  - `TentInput` — Length and width fields
  - `InventoryEditor` — Add/edit braces and rails
  - `ConstraintsEditor` — Algorithm constraints (min/max setback, max column gap)
  - `Button` — "Generate Floor Plan" button
- **State**: Form inputs stored in `CalculationContext`
- **Action**: On submit, call API and navigate to Results page

### Results Page
- **Purpose**: Display up to 6 calculated scenarios
- **Components**:
  - `ScenarioPanel` — Slide-over drawer (mobile) / sidebar (desktop) containing sort bar, scenario list, and stats footer; manages sort state internally
  - `SortBar` — Sort select + direction toggle (co-located in ScenarioPanel folder)
  - `ScenarioCard` (×N) — Show setback + brace count + inventory button
  - `ColumnPopup` — Column detail popup (brace size, count, gap); positioned near click/tap
  - `ScenarioInventoryModal` — Full inventory breakdown per scenario
  - `FloorPlanCanvas` — Visualize selected scenario with brace colors
  - `Button` — Export button
- **State**: Results from `CalculationContext`
- **Features**:
  - Compare scenarios side-by-side
  - Click scenario to view detailed visualization
  - Brace colors from inventory color picker shown on canvas
  - Asymmetric setback visualization (rail-end vs open-end per side)
  - Legend shows brace type colors + sizes
  - Inventory modal shows brace types, setbacks, gaps, and used rails list
  - Scenario names translated on frontend via `scenarioNames` i18n keys
  - **Mobile/tablet**: Panel becomes slide-over drawer; "Choose layout" button opens it; overlay to close; auto-close on scenario selection

## Routing
Use React Router v6, wrapped in CalculationProvider:
```tsx
// App.tsx
<CalculationProvider>
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/results" element={<ResultsPage />} />
    </Routes>
  </BrowserRouter>
</CalculationProvider>
```

## State Management
- **CalculationContext**: Stores tent inputs, inventory, constraints, and results
- Wraps entire app in `App.tsx` via `CalculationProvider`
- Exports `useCalculation()` hook to access state and trigger API calls
- Persists state during navigation between pages

## Styling Approach
- **Simple and clean** — Focus on usability over aesthetics
- **CSS Modules** for component-scoped styles
- **CSS Variables** in `variables.scss` for consistency:
  ```scss
  --color-primary: #2563eb;
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  ```
- **Responsive** — Mobile-first approach, breakpoints at 768px, 1024px. Results page panel is a slide-over drawer on mobile with "Choose layout" button.
- **Grid/Flexbox** — No UI library needed for simple layouts

## Visualization
- SVG-based floor plan rendering (FloorPlanCanvas)
- Draw rails (dark gray), braces (colored per inventory), gaps (light yellow)
- Braces colored by inventory color picker (`Brace.color` optional field)
- Asymmetric setbacks: `setback` for rail-ends (left/right), `openEndSetbackStart`/`openEndSetbackEnd` for open-ends (top/bottom)
- Setback dimension labels per side (threshold > 0.10m), positioned for visibility on large tents
- Show measurements and labels
- Support zoom/pan for large tents
- Legend shows each brace type (size + color swatch), gaps, rails

## Internationalization (i18n)
- All user-facing text uses `react-i18next` via `t()` — no hardcoded strings
- Supported: English (en), Hebrew (he), Arabic (ar). Export image, modals, aria-labels, zoom controls all translated
- Export image: Company name (`app.companyName`) as title; rails inventory; RTL layout for he/ar

## Best Practices
- **Validation**: Validate inputs before API call (min dimensions, positive numbers)
- **Error Handling**: Show error messages if API fails or invalid inputs
- **Loading States**: Show spinner during calculation
- **Accessibility**: Semantic HTML, ARIA labels, keyboard navigation
- **Code Organization**: One component per file, max 200 lines per file
- **Props**: Define interfaces for all component props

### Engineering Rules (must be followed on every task)

**1. Single Responsibility**
Each component must do exactly one thing. If a component renders distinct UI sections (e.g., a sort bar, a scrollable list, a drawer panel), extract each into its own file under `components/`. Pages are orchestrators — they compose components, they do not define UI inline. When a component exceeds ~100 lines of JSX or contains 2+ unrelated UI concerns, split it.

**2. Mobile-First CSS**
All styles must be written mobile-first. Default styles target the smallest viewport. Use `min-width` media queries to progressively enhance for tablet (`$bp-md: 768px`) and desktop (`$bp-lg: 1024px`). Never use `max-width` as the primary breakpoint direction.

**3. i18n Checklist (after every component)**
Scan the finished component for any hardcoded user-facing strings. Every label, button text, placeholder, tooltip, aria-label, and error message must use `t('key')`. If a key is missing, add it to all three locale files: `en.json`, `he.json`, `ar.json`. No exceptions — the app is trilingual.

**4. Global Variables Checklist (after every `.module.scss` file)**
Verify all colors, spacing values, font sizes, shadows, radii, and transitions use CSS variables from `styles/variables.scss`. No hardcoded hex values, raw `px` spacing, or magic numbers. If a needed token doesn't exist in `variables.scss`, add it there first, then use it.

**5. State Management Rules**
- Use `React.createContext` only for lightweight, localized UI state scoped to a single page or feature (e.g., a panel's open/close flag).
- Use **Zustand** for any state that: crosses multiple pages, requires complex updates, is shared by 3+ unrelated components, or represents persisted/server-derived data.
- Never store ephemeral UI state (hover, focus, animation flags) in global context.

**6. Self-Updating Docs (after every code change)**
After writing or modifying any component, check:
- Does `apps/frontend/CLAUDE.md` need updating? (new component added, new pattern used, structure changed)
- Does `.claude/agents/frontend-expert/SKILL.md` need updating?
If yes, update them in the same session. The docs must always reflect the current state of the codebase.

## Commands
- `npm run dev` — Dev server
- `npm run build` — Production build (includes TypeScript checking)
- `npm run lint` — Run ESLint
- `npm run preview` — Preview production build

## 🧠 The Frontend Trio (Roles)
1.  **@frontend-expert** (The Architect & Engineer)
    *   **GOAL:** Ensure code structure, data flow, state management, and component logic are flawless.
    *   **AUTHORITY:** Owns the *Logic* and *functionality*.
2.  **@frontend-stylist** (The Designer)
    *   **GOAL:** Make the UI "Comfortable," "Engaging," and "Easy to Understand."
    *   **AUTHORITY:** Owns the *CSS/Tailwind* and *Visual UX*.
3.  **@ui-design** (The Auditor)
    *   **GOAL:** Check for WCAG compliance, contrast, and standard best practices.
    *   **AUTHORITY:** Has veto power on *Accessibility* issues.

## ⚡ Workflow for UI Changes
1.  **CONSULT:** Ask `@frontend-expert` to identify the data/props and component structure needed.
2.  **DESIGN:** Ask `@frontend-stylist` to write the component using the Expert's structure but applying the "Comfortable" visual style.
3.  **AUDIT:** Run `@ui-design` to check the final output.



