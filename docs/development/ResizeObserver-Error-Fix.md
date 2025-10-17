# ResizeObserver Loop Error Fix

## Problem

Hydroscope was experiencing occasional `ResizeObserver loop limit exceeded` errors, particularly in the Docusaurus environment when containers were collapsed or expanded. These errors occur when:

1. Container collapse/expand operations trigger rapid DOM changes
2. React Flow components resize during layout calculations
3. Multiple ResizeObserver instances compete for layout updates
4. The browser's ResizeObserver loop limit (typically 1000 iterations) is exceeded

## Root Cause

The errors were caused by:

- **Rapid-fire layout changes**: Container operations triggered immediate DOM updates
- **Cascading resize events**: React Flow's internal ResizeObserver triggered additional layout calculations
- **Unthrottled updates**: No debouncing mechanism to prevent rapid successive operations
- **Error propagation**: ResizeObserver errors bubbled up as uncaught exceptions

## Solution

Implemented a comprehensive multi-layer ResizeObserver error suppression system:

### 1. Global Error Suppression (`ResizeObserverErrorSuppression.ts`)

```typescript
// Automatically suppresses ResizeObserver errors while preserving other errors
enableResizeObserverErrorSuppression();
```

**Features:**
- Pattern-based error detection for ResizeObserver-specific errors
- Global error handler that intercepts and suppresses only ResizeObserver errors
- Development vs production logging (debug logs in dev, silent in production)
- Automatic cleanup on component unmount

### 2. Debounced Operations

```typescript
const debouncedOperationManager = new DebouncedOperationManager(150);
const debouncedCollapseAll = debouncedOperationManager.debounce('collapseAll', operation, 200);
```

**Features:**
- Prevents rapid-fire container operations
- Configurable debounce delays (150ms default, 200ms for bulk operations)
- Per-operation keying to allow different operations to run concurrently
- Automatic cleanup and cancellation

### 3. Safe Operation Wrappers

```typescript
// Synchronous operations
const safeOperation = withResizeObserverErrorSuppression(operation);

// Asynchronous operations  
const safeAsyncOperation = withAsyncResizeObserverErrorSuppression(asyncOperation);
```

**Features:**
- Function-level error suppression for critical operations
- Preserves operation return values and error handling for non-ResizeObserver errors
- Works with both sync and async functions

### 4. Component Integration

**Hydroscope Component:**
- Enables error suppression on mount
- Uses debounced operation manager for collapse/expand operations
- Automatic cleanup on unmount

**HydroscopeCore Component:**
- Wraps all container operations with error suppression
- Maintains existing error handling for non-ResizeObserver errors
- Preserves all callback functionality

**Docusaurus Integration:**
- Enables error suppression in browser-only environment
- Proper cleanup when navigating away from page

## Implementation Details

### Error Pattern Detection

The system detects and suppresses these specific error patterns:
- `ResizeObserver loop limit exceeded`
- `ResizeObserver loop completed with undelivered notifications`
- `Non-Error promise rejection captured` (related promise rejections)

### Throttling Strategy

- **Individual operations**: 150ms debounce
- **Bulk operations**: 200ms debounce  
- **ReactFlow updates**: 50ms throttle (existing)
- **FitView operations**: 500ms cooldown + 150ms debounce

### Development Experience

- **Development mode**: Debug logs show suppressed errors for troubleshooting
- **Production mode**: Silent suppression for clean user experience
- **Error boundaries**: Non-ResizeObserver errors still propagate normally
- **Testing**: Comprehensive test suite validates suppression behavior

## Usage

### Automatic (Recommended)

The error suppression is automatically enabled when using Hydroscope components:

```tsx
import { Hydroscope } from '@hydro-project/hydroscope';

// Error suppression is automatically enabled
<Hydroscope data={data} />
```

### Manual Control

For advanced use cases, you can manually control error suppression:

```tsx
import { 
  enableResizeObserverErrorSuppression,
  disableResizeObserverErrorSuppression 
} from '@hydro-project/hydroscope';

// Enable suppression
enableResizeObserverErrorSuppression();

// Your code here...

// Disable suppression (automatic cleanup)
disableResizeObserverErrorSuppression();
```

### Custom Debouncing

```tsx
import { DebouncedOperationManager } from '@hydro-project/hydroscope';

const manager = new DebouncedOperationManager(100);
const debouncedFn = manager.debounce('myOperation', myFunction, 200);

// Cleanup when done
manager.destroy();
```

## Testing

The fix includes comprehensive tests covering:
- Error suppression activation/deactivation
- Pattern-based error detection
- Debounced operation management
- Wrapper function behavior
- Cleanup and memory management

Run tests with:
```bash
npm run test:file ResizeObserverErrorSuppression.test.ts
```

## Browser Compatibility

- **Modern browsers**: Full support with native ResizeObserver
- **Legacy browsers**: Graceful degradation (errors may still appear but won't break functionality)
- **Node.js/SSR**: Safe handling when `window` is undefined

## Performance Impact

- **Minimal overhead**: Error suppression only activates when errors occur
- **Efficient debouncing**: Operations are batched to reduce layout thrashing
- **Memory management**: Automatic cleanup prevents memory leaks
- **No functional changes**: All existing functionality preserved

## Migration

No breaking changes - the fix is automatically applied to existing Hydroscope usage. The error suppression system is:

- **Backward compatible**: Existing code works unchanged
- **Opt-in advanced features**: Manual control available for power users
- **Zero configuration**: Works out of the box with sensible defaults

## Monitoring

In development mode, suppressed errors are logged as debug messages:

```
[Hydroscope] Suppressed ResizeObserver error: ResizeObserver loop limit exceeded
```

This allows developers to:
- Monitor suppression frequency
- Identify potential performance issues
- Debug layout-related problems
- Verify the fix is working correctly