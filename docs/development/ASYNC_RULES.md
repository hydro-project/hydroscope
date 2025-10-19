# Async/Timer Rules for Hydroscope

## Rule: No timer-based or async logic outside components

**Enforced by ESLint** in `.eslintrc.js`

### Banned outside `src/components/`:
- `setTimeout()` - Use event-driven logic instead
- `setInterval()` - Use event-driven logic instead  
- `.then()` chains - Use async/await instead

### Allowed exceptions:
- `setTimeout` wrapped in an awaited Promise (for timeouts)
- Explicit `eslint-disable` comments with justification

### Rationale:
- **Deterministic execution**: Timer-based logic is non-deterministic and causes race conditions
- **Sequential processing**: AsyncCoordinator must process operations sequentially
- **Event-driven**: Wait for actual events (like `notifyViewportAnimationComplete`), not durations

### Example violations:
```typescript
// ❌ BAD: Timer-based waiting
await new Promise(resolve => setTimeout(resolve, 300));

// ❌ BAD: Fire-and-forget
someAsyncMethod().then(() => console.log('done'));

// ✅ GOOD: Event-driven waiting
await this.waitForViewportAnimationComplete();

// ✅ GOOD: Properly awaited
await someAsyncMethod();
```

### To bypass (use sparingly):
```typescript
// eslint-disable-next-line no-restricted-syntax -- Justification here
setTimeout(() => { /* ... */ }, 100);
```
