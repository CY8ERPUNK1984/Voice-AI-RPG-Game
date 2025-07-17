# Project Structure & Organization

## Monorepo Layout
```
├── frontend/          # React application
├── backend/           # Node.js server
├── .kiro/specs/       # Project specifications
└── package.json       # Root dependencies (MCP tools)
```

## Frontend Structure (`frontend/`)
```
src/
├── components/        # React components with co-located tests
│   ├── __tests__/    # Component test files
│   └── *.tsx         # Component implementations
├── services/         # API clients and external service integrations
├── stores/           # Zustand state management stores
├── types/            # TypeScript interface definitions
├── data/             # Static data files (stories.json)
├── App.tsx           # Main application component
├── main.tsx          # React entry point
└── index.css         # Global styles with Tailwind
```

## Backend Structure (`backend/`)
```
src/
├── controllers/      # Express route handlers
├── services/         # Business logic and AI service integrations
│   └── __tests__/   # Service test files
├── types/            # TypeScript interface definitions
├── data/             # Static data files (stories.json)
└── index.ts          # Server entry point
```

## Code Organization Patterns

### TypeScript Configuration
- Strict typing enabled across both frontend and backend
- Path aliases configured: `@/*` maps to `src/*`
- Shared type definitions between frontend/backend (kept in sync manually)

### Testing Structure
- Tests co-located with source files in `__tests__/` directories
- Vitest used for both frontend and backend testing
- Frontend tests use jsdom environment for React component testing

### File Naming Conventions
- Components: PascalCase (e.g., `ChatInterface.tsx`)
- Services: PascalCase (e.g., `StoryService.ts`)
- Types: `index.ts` files for centralized exports
- Tests: `*.test.ts` or `*.test.tsx`

### Import/Export Patterns
- Use path aliases (`@/types`, `@/components`, etc.)
- Centralized type exports from `types/index.ts`
- Service classes follow singleton or factory patterns

### Data Management
- Static story data in JSON files (synchronized between frontend/backend)
- Real-time state managed through WebSocket events
- Frontend state managed with Zustand stores