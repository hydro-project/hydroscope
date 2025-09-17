/**
 * @fileoverview Test search highlight color functionality
 */

import { describe, it, expect } from 'vitest';
import { getSearchHighlightColors } from '../shared/colorUtils';

describe('Search Highlight Colors', () => {
  it('should provide consistent search highlight colors', () => {
    const colors = getSearchHighlightColors();

    // Test that colors are defined
    expect(colors.match).toBeDefined();
    expect(colors.current).toBeDefined();

    // Test match colors (updated for better visibility)
    expect(colors.match.background).toBe('#fbbf24'); // amber-400 - brighter for better visibility
    expect(colors.match.border).toBe('#f59e0b'); // amber-500 - contrasting border
    expect(colors.match.text).toBe('#000000'); // black for contrast

    // Test current/strong colors (updated for better visibility)
    expect(colors.current.background).toBe('#f97316'); // orange-500 - brighter orange for better visibility
    expect(colors.current.border).toBe('#ea580c'); // orange-600 - darker border for definition
    expect(colors.current.text).toBe('#ffffff'); // white for contrast
  });

  it('should provide colors that contrast well with common palettes', () => {
    const colors = getSearchHighlightColors();

    // The colors should be bright and distinct from typical palette colors
    // Amber and orange are chosen to contrast well with:
    // - Blues (Set2, Set3 blues)
    // - Greens (Set2, Set3 greens)
    // - Purples (Set3, Pastel1 purples)
    // - Grays (Set3 grays)

    // Test that match color is bright enough
    expect(colors.match.background).toMatch(/^#[9-f]/); // Should start with bright hex values
    expect(colors.current.background).toMatch(/^#[9-f]/); // Should start with bright hex values
  });
});
