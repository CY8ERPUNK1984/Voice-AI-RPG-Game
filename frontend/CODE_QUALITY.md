# Code Quality Standards

This document outlines the code quality standards and tools used in the Voice AI RPG frontend project.

## Tools and Configuration

### ESLint
- **Configuration**: `.eslintrc.cjs`
- **Purpose**: Static code analysis and style enforcement
- **Rules**: Strict TypeScript rules with React-specific configurations
- **Usage**: 
  - `npm run lint` - Check for issues
  - `npm run lint:fix` - Auto-fix issues

### Prettier
- **Configuration**: `.prettierrc.json`
- **Purpose**: Code formatting
- **Usage**:
  - `npm run format` - Format all files
  - `npm run format:check` - Check formatting

### TypeScript
- **Configuration**: `tsconfig.json`
- **Purpose**: Type checking and compilation
- **Usage**: `npm run type-check`

### Vitest
- **Configuration**: `vite.config.ts` (test section)
- **Purpose**: Unit testing with coverage
- **Coverage Thresholds**:
  - Global: 80% (branches, functions, lines, statements)
  - Components: 70%
  - Services: 85%
  - Utils: 90%

### Husky + lint-staged
- **Purpose**: Pre-commit hooks
- **Configuration**: `.husky/pre-commit` and `lint-staged` in `package.json`
- **Actions**: Runs linting, formatting, and type checking on staged files

## Code Quality Standards

### TypeScript Standards

1. **Strict Type Safety**
   - Use strict TypeScript configuration
   - Avoid `any` type (use `unknown` instead)
   - Use type guards for runtime type checking
   - Prefer `readonly` for immutable data

2. **Error Handling**
   - Use `Result<T, E>` type for operations that can fail
   - Implement consistent async/await error patterns
   - Use proper error boundaries in React components

3. **Naming Conventions**
   - PascalCase for components and types
   - camelCase for variables and functions
   - UPPER_SNAKE_CASE for constants
   - Prefix interfaces with descriptive names (not `I`)

### React Standards

1. **Component Structure**
   - Use functional components with hooks
   - Implement proper prop types with TypeScript
   - Use React.memo for performance optimization when needed
   - Keep components focused and single-responsibility

2. **Hooks Usage**
   - Follow rules of hooks
   - Use custom hooks for reusable logic
   - Implement proper cleanup in useEffect

3. **State Management**
   - Use context for global state
   - Keep local state minimal
   - Use reducers for complex state logic

### Performance Standards

1. **Bundle Size**
   - Monitor bundle size with `npm run build:analyze`
   - Use code splitting for large dependencies
   - Lazy load components when appropriate

2. **Runtime Performance**
   - Use React.memo and useMemo judiciously
   - Avoid unnecessary re-renders
   - Optimize expensive computations

### Testing Standards

1. **Test Coverage**
   - Maintain minimum coverage thresholds
   - Write tests for all public APIs
   - Test error scenarios and edge cases

2. **Test Quality**
   - Use descriptive test names
   - Follow AAA pattern (Arrange, Act, Assert)
   - Mock external dependencies properly

## Scripts

### Development
```bash
npm run dev          # Start development server
npm run type-check   # Run TypeScript compiler
```

### Quality Checks
```bash
npm run quality      # Run all quality checks
npm run quality:fix  # Fix all auto-fixable issues
npm run lint         # ESLint check
npm run lint:fix     # ESLint fix
npm run format       # Format code
npm run format:check # Check formatting
```

### Testing
```bash
npm run test                # Run tests
npm run test:ui            # Run tests with UI
npm run test:coverage      # Run tests with coverage
npm run test:coverage:open # Open coverage report
```

### Build
```bash
npm run build         # Production build
npm run build:analyze # Build with bundle analysis
npm run preview       # Preview production build
```

### Pre-commit
```bash
npm run pre-commit    # Run all pre-commit checks
```

## IDE Configuration

### VS Code Settings
Create `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.suggest.autoImports": true,
  "emmet.includeLanguages": {
    "typescript": "html",
    "typescriptreact": "html"
  }
}
```

### VS Code Extensions
Recommended extensions:
- ESLint
- Prettier - Code formatter
- TypeScript Importer
- Auto Rename Tag
- Bracket Pair Colorizer
- GitLens
- Thunder Client (for API testing)

## Continuous Integration

### GitHub Actions (if using)
The following checks should run on every PR:
- TypeScript compilation
- ESLint checks
- Prettier formatting check
- Unit tests with coverage
- Build verification

### Quality Gates
- All ESLint rules must pass
- Code coverage must meet thresholds
- TypeScript compilation must succeed
- All tests must pass
- Code must be properly formatted

## Best Practices

### Error Handling
```typescript
// Good: Use Result type
const result = await safeAsync(() => apiCall());
if (!result.success) {
  handleError(result.error);
  return;
}
const data = result.data;

// Bad: Unhandled promises
apiCall().then(data => {
  // Handle success
}).catch(error => {
  // Handle error
});
```

### Type Safety
```typescript
// Good: Proper type guards
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

// Good: Strict null checks
function processUser(user: User | null): void {
  if (user === null) {
    return;
  }
  // user is now User type
}

// Bad: Type assertions without checks
const user = data as User;
```

### Component Structure
```typescript
// Good: Well-structured component
interface Props {
  readonly title: string;
  readonly onSubmit: (data: FormData) => Promise<void>;
}

export const MyComponent: React.FC<Props> = ({ title, onSubmit }) => {
  const [loading, setLoading] = useState(false);
  
  const handleSubmit = useCallback(async (data: FormData) => {
    setLoading(true);
    try {
      await onSubmit(data);
    } finally {
      setLoading(false);
    }
  }, [onSubmit]);

  return (
    <div>
      <h1>{title}</h1>
      {/* Component JSX */}
    </div>
  );
};
```

## Troubleshooting

### Common Issues

1. **ESLint errors after updating dependencies**
   - Clear node_modules and reinstall
   - Check for conflicting rule configurations

2. **TypeScript compilation errors**
   - Ensure all dependencies have type definitions
   - Check tsconfig.json paths and includes

3. **Test failures in CI**
   - Ensure tests don't depend on local environment
   - Check for timing issues in async tests

4. **Coverage threshold failures**
   - Add tests for uncovered code
   - Adjust thresholds if necessary (with justification)

### Getting Help

- Check the project's GitHub issues
- Review ESLint and TypeScript documentation
- Ask team members for code review feedback