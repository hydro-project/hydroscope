# Dark Mode Support

Hydroscope now includes comprehensive dark mode support that automatically adapts to the user's system preferences.

## Features

### Automatic Theme Detection
- Detects system dark mode preference using `prefers-color-scheme` media query
- Automatically updates when the user changes their system theme
- No configuration required - works out of the box

### Dark Mode Friendly Color Palettes
Three new ColorBrewer-based palettes optimized for dark backgrounds:

- **Set1Bright**: Brightened version of ColorBrewer's Set1 qualitative palette
- **Accent**: ColorBrewer's Accent palette with soft, distinguishable colors
- **Paired**: ColorBrewer's Paired palette with light/dark color pairs

The existing light palettes (Set3, Set2, Pastel1, Dark2) are still available and work in both modes.

### Theme-Aware UI Components
All UI components automatically adapt to dark mode:

- **StyleTuner Panel**: Dark background, light text, theme-aware controls
- **InfoPanel**: Consistent dark theme with proper contrast
- **FileUpload**: Dark upload area with visible borders and text
- **Buttons and Inputs**: Theme-aware colors for all interactive elements

### Edge Colors
Edge colors are now brighter in dark mode for better visibility:
- Light mode: `#666666` (dark gray)
- Dark mode: `#a0a0a0` (light gray)

### ReactFlow Controls
The built-in ReactFlow control buttons (zoom, fit view, etc.) are now properly styled for dark mode with:
- Dark backgrounds that match the theme
- Light icons for visibility
- Proper hover states

## Usage

### For End Users
Dark mode works automatically based on your system preferences. No configuration needed!

To change your system theme:
- **macOS**: System Preferences → General → Appearance
- **Windows**: Settings → Personalization → Colors → Choose your mode
- **Linux**: Varies by desktop environment

### For Developers

#### Using the Theme Hook
```typescript
import { useTheme } from '@hydro-project/hydroscope';

function MyComponent() {
  const { isDark, colors } = useTheme();
  
  return (
    <div style={{ 
      background: colors.panelBackground,
      color: colors.textPrimary 
    }}>
      {isDark ? 'Dark mode' : 'Light mode'}
    </div>
  );
}
```

#### Available Theme Colors
```typescript
interface ThemeColors {
  // Panel backgrounds
  panelBackground: string;
  panelBorder: string;
  panelShadow: string;

  // Text colors
  textPrimary: string;
  textSecondary: string;
  textMuted: string;

  // Input controls
  inputBackground: string;
  inputBorder: string;
  inputText: string;
  inputPlaceholder: string;

  // Buttons
  buttonBackground: string;
  buttonBorder: string;
  buttonText: string;
  buttonHoverBackground: string;
  buttonHoverBorder: string;

  // File upload
  uploadAreaBackground: string;
  uploadAreaBorder: string;
  uploadAreaHoverBackground: string;
  uploadAreaHoverBorder: string;
  uploadAreaDragBackground: string;
  uploadAreaDragBorder: string;

  // Status messages
  errorBackground: string;
  errorBorder: string;
  errorText: string;
  successBackground: string;
  successBorder: string;
  successText: string;

  // File path display
  filePathBackground: string;
  filePathBorder: string;
  filePathCodeBackground: string;
  filePathCodeBorder: string;
  filePathCodeText: string;

  // Dividers
  dividerColor: string;

  // Collapsible sections
  sectionHeaderBackground: string;
  sectionHeaderHoverBackground: string;
}
```

#### Detecting Dark Mode
```typescript
import { detectDarkMode, onThemeChange } from '@hydro-project/hydroscope';

// Check current theme
const isDark = detectDarkMode();

// Listen for theme changes
const cleanup = onThemeChange((isDark) => {
  console.log('Theme changed:', isDark ? 'dark' : 'light');
});

// Clean up listener when done
cleanup();
```

#### Getting Theme-Aware Edge Colors
```typescript
import { getDefaultEdgeStyle } from '@hydro-project/hydroscope';

const isDark = detectDarkMode();
const edgeStyle = getDefaultEdgeStyle(isDark);

// Use edgeStyle.STROKE_COLOR for default edge color
// Use edgeStyle.DEFAULT_STROKE_COLOR for edges with no properties
```

## Implementation Details

### Architecture
- **Theme Detection**: `src/shared/config/theme.ts` - Core theme detection and color definitions
- **React Hook**: `src/utils/useTheme.ts` - React hook for components
- **Edge Colors**: `src/utils/StyleProcessor.ts` - Theme-aware edge styling
- **Components**: All UI components use the `useTheme()` hook

### Color Palette Selection
The StyleTuner automatically shows appropriate palettes based on the current theme:
- **Light mode**: Shows light-optimized palettes first
- **Dark mode**: Shows dark-optimized palettes first

### Performance
- Theme detection happens once on mount
- Theme changes are handled via efficient media query listeners
- No polling or unnecessary re-renders

## Testing

To test dark mode:
1. Change your system theme to dark mode
2. Reload the Hydroscope visualization
3. Verify that:
   - Panels have dark backgrounds
   - Text is light colored and readable
   - Edges are visible (lighter gray)
   - File upload area is visible
   - All interactive elements are clearly visible

## Future Enhancements

Potential improvements for future versions:
- Manual theme toggle (override system preference)
- Custom theme colors
- Per-palette dark mode variants
- Animated theme transitions
- Theme persistence in localStorage
