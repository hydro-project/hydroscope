/**
 * SearchUtilities - Helper functions for search operations
 */

export class SearchUtilities {
  /**
   * Find matches in text for a query
   * Returns match information including indices and whether it's an exact match
   */
  static findMatches(
    text: string,
    query: string,
  ): {
    matches: boolean;
    indices: number[][];
    isExact: boolean;
  } {
    const textLower = text.toLowerCase();
    const queryLower = query.toLowerCase();
    const indices: number[][] = [];
    
    // Exact substring match
    let startIndex = 0;
    while (true) {
      const index = textLower.indexOf(queryLower, startIndex);
      if (index === -1) break;
      indices.push([index, index + queryLower.length]);
      startIndex = index + 1;
    }
    
    if (indices.length > 0) {
      return { matches: true, indices, isExact: true };
    }
    
    // Only do fuzzy matching for queries longer than 3 characters
    if (queryLower.length <= 3) {
      return { matches: false, indices: [], isExact: false };
    }
    
    // Fuzzy matching - check if all characters of query appear in order
    let queryIndex = 0;
    const fuzzyIndices: number[] = [];
    for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
      if (textLower[i] === queryLower[queryIndex]) {
        fuzzyIndices.push(i);
        queryIndex++;
      }
    }
    
    if (queryIndex === queryLower.length) {
      // All characters found - create match indices for individual characters
      const charIndices: number[][] = fuzzyIndices.map((i) => [i, i + 1]);
      return { matches: true, indices: charIndices, isExact: false };
    }
    
    return { matches: false, indices: [], isExact: false };
  }

  /**
   * Calculate search confidence score
   */
  static calculateSearchConfidence(
    label: string,
    query: string,
    isExact: boolean,
  ): number {
    if (isExact) {
      // Exact matches get higher scores
      if (label.toLowerCase() === query.toLowerCase()) {
        return 1.0; // Perfect match
      }
      return 0.8; // Substring match
    }
    
    // Fuzzy matches get lower scores
    return 0.5;
  }

  /**
   * Extract search words from a label for indexing
   */
  static extractSearchWords(label: string): string[] {
    return label
      .toLowerCase()
      .split(/[\s_\-,.;:!?()[\]{}]+/)
      .filter((word) => word.length > 0);
  }

  /**
   * Build search index from entities
   */
  static buildSearchIndex<T extends { id: string; label: string }>(
    entities: Iterable<T>,
  ): Map<string, Set<string>> {
    const index = new Map<string, Set<string>>();
    
    for (const entity of entities) {
      const words = SearchUtilities.extractSearchWords(entity.label);
      for (const word of words) {
        if (!index.has(word)) {
          index.set(word, new Set());
        }
        index.get(word)!.add(entity.id);
      }
    }
    
    return index;
  }
}
