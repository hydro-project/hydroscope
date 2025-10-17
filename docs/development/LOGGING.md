# Logging in Hydroscope

## Overview

Hydroscope uses a category-based logging system to keep production builds clean and quiet while allowing developers to enable specific diagnostic logging when needed.

## For Users

By default, all debug logs are suppressed. You'll only see critical errors and warnings. The console remains clean during normal operation.

## For Developers

### Using the Logger

Instead of `console.log()`, use `hscopeLogger`:

```typescript
import { hscopeLogger } from '@/utils/logger';

// Debug logging (suppressed by default in production)
hscopeLogger.log('coordinator', 'Processing operation', { id, status });
hscopeLogger.info('bridge', 'Layout complete', metrics);

// Errors and warnings (always visible - use console directly)
console.error('[MyComponent] Critical error:', error);
console.warn('[MyComponent] Unexpected state:', state);
```

### Enabling Debug Logs

**In the Browser:**
```javascript
// Open browser console and set:
(window).__HYDRO_LOGS = 'coordinator,bridge,op';

// Then refresh the page or trigger the operation
```

**In Node.js / Build:**
```bash
HYDRO_LOGS=coordinator,bridge,op npm start
```

**In Tests:**
```bash
ENABLE_TEST_LOGS=true npm test
```

### Available Categories

| Category | Description |
|----------|-------------|
| `coordinator` | AsyncCoordinator operations and queue management |
| `bridge` | ReactFlow and ELK bridge operations |
| `op` | General operations (VisualizationState, containers, etc.) |
| `layout` | Layout calculations and positioning |
| `interaction` | User interactions (clicks, drags, etc.) |
| `validation` | State validation and invariant checks |
| `performance` | Performance profiling and metrics |
| `debug` | General debugging output |
| `toggle`, `fit`, `retry`, `lock`, `pack`, `ro`, `panel`, `search`, `container`, `style` | Specialized categories |

### ESLint Rules

The codebase enforces clean console usage:

- ❌ `console.log()` and `console.debug()` - Use `hscopeLogger` instead
- ✅ `console.error()` and `console.warn()` - Allowed for critical messages
- ✅ Tests and examples - All console methods allowed

### Migration Examples

**Before:**
```typescript
console.log("Starting operation", data);
console.debug("State:", state);
```

**After:**
```typescript
hscopeLogger.log('op', 'Starting operation', data);
hscopeLogger.log('debug', 'State:', state);
```

## Architecture

- **Production**: All debug logs suppressed by default → Clean, quiet UX
- **Development**: Selective category enablement → Focused debugging
- **Tests**: Controlled via `ENABLE_TEST_LOGS` → Clean test output by default

This approach follows TypeScript ecosystem best practices for logging and ensures a production-ready, professional user experience.
