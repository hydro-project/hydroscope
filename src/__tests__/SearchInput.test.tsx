/**
 * SearchInput Component Tests
 * Tests for search input component with real-time feedback
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchInput, type SearchInputProps } from '../components/SearchInput.js';
import type { SearchResult } from '../types/core.js';

describe('SearchInput Component', () => {
  const mockSearchResults: SearchResult[] = [
    {
      id: 'node1',
      label: 'Test Node',
      type: 'node',
      matchIndices: [[0, 4]]
    },
    {
      id: 'container1', 
      label: 'Test Container',
      type: 'container',
      matchIndices: [[0, 4]]
    }
  ];

  const defaultProps: SearchInputProps = {
    onSearch: vi.fn(),
    onClear: vi.fn(),
    onNavigateNext: vi.fn(),
    onNavigatePrevious: vi.fn(),
    searchResults: [],
    currentResultIndex: -1,
    isSearching: false
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render search input field', () => {
      render(<SearchInput {...defaultProps} />);
      
      const input = screen.getByRole('textbox', { name: /search/i });
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('placeholder', 'Search nodes and containers...');
    });

    it('should render search button', () => {
      render(<SearchInput {...defaultProps} />);
      
      const searchButton = screen.getByRole('button', { name: /search/i });
      expect(searchButton).toBeInTheDocument();
    });

    it('should render clear button when there is a query', () => {
      render(<SearchInput {...defaultProps} query="test" />);
      
      const clearButton = screen.getByRole('button', { name: /clear/i });
      expect(clearButton).toBeInTheDocument();
    });

    it('should not render clear button when query is empty', () => {
      render(<SearchInput {...defaultProps} />);
      
      const clearButton = screen.queryByRole('button', { name: /clear/i });
      expect(clearButton).not.toBeInTheDocument();
    });
  });

  describe('Search Input Interaction', () => {
    it('should call onSearch when typing in input', async () => {
      const onSearch = vi.fn();
      render(<SearchInput {...defaultProps} onSearch={onSearch} />);
      
      const input = screen.getByRole('textbox', { name: /search/i });
      fireEvent.change(input, { target: { value: 'test' } });
      
      await waitFor(() => {
        expect(onSearch).toHaveBeenCalledWith('test');
      });
    });

    it('should debounce search calls', async () => {
      const onSearch = vi.fn();
      render(<SearchInput {...defaultProps} onSearch={onSearch} />);
      
      const input = screen.getByRole('textbox', { name: /search/i });
      
      // Type multiple characters quickly
      fireEvent.change(input, { target: { value: 't' } });
      fireEvent.change(input, { target: { value: 'te' } });
      fireEvent.change(input, { target: { value: 'tes' } });
      fireEvent.change(input, { target: { value: 'test' } });
      
      // Should only call onSearch once after debounce delay
      await waitFor(() => {
        expect(onSearch).toHaveBeenCalledTimes(1);
        expect(onSearch).toHaveBeenCalledWith('test');
      });
    });

    it('should call onClear when clear button is clicked', () => {
      const onClear = vi.fn();
      render(<SearchInput {...defaultProps} onClear={onClear} query="test" />);
      
      const clearButton = screen.getByRole('button', { name: /clear/i });
      fireEvent.click(clearButton);
      
      expect(onClear).toHaveBeenCalled();
    });

    it('should trigger search on Enter key press', () => {
      const onSearch = vi.fn();
      render(<SearchInput {...defaultProps} onSearch={onSearch} />);
      
      const input = screen.getByRole('textbox', { name: /search/i });
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      
      expect(onSearch).toHaveBeenCalledWith('test');
    });
  });

  describe('Search Results Display', () => {
    it('should display result count when there are results', () => {
      render(<SearchInput {...defaultProps} searchResults={mockSearchResults} />);
      
      expect(screen.getByText('2 results')).toBeInTheDocument();
    });

    it('should display "No results" when search returns empty', () => {
      render(<SearchInput {...defaultProps} searchResults={[]} query="nonexistent" />);
      
      expect(screen.getByText('No results')).toBeInTheDocument();
    });

    it('should not display result count when no search is active', () => {
      render(<SearchInput {...defaultProps} />);
      
      expect(screen.queryByText(/results/)).not.toBeInTheDocument();
    });
  });

  describe('Navigation Controls', () => {
    const propsWithResults = {
      ...defaultProps,
      searchResults: mockSearchResults,
      currentResultIndex: 0
    };

    it('should render navigation buttons when there are results', () => {
      render(<SearchInput {...propsWithResults} />);
      
      expect(screen.getByRole('button', { name: /previous result/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /next result/i })).toBeInTheDocument();
    });

    it('should call onNavigatePrevious when previous button is clicked', () => {
      const onNavigatePrevious = vi.fn();
      render(<SearchInput {...propsWithResults} onNavigatePrevious={onNavigatePrevious} currentResultIndex={1} />);
      
      const prevButton = screen.getByRole('button', { name: /previous result/i });
      fireEvent.click(prevButton);
      
      expect(onNavigatePrevious).toHaveBeenCalled();
    });

    it('should call onNavigateNext when next button is clicked', () => {
      const onNavigateNext = vi.fn();
      render(<SearchInput {...propsWithResults} onNavigateNext={onNavigateNext} />);
      
      const nextButton = screen.getByRole('button', { name: /next result/i });
      fireEvent.click(nextButton);
      
      expect(onNavigateNext).toHaveBeenCalled();
    });

    it('should disable previous button when at first result', () => {
      render(<SearchInput {...propsWithResults} currentResultIndex={0} />);
      
      const prevButton = screen.getByRole('button', { name: /previous result/i });
      expect(prevButton).toBeDisabled();
    });

    it('should disable next button when at last result', () => {
      render(<SearchInput {...propsWithResults} currentResultIndex={1} />);
      
      const nextButton = screen.getByRole('button', { name: /next result/i });
      expect(nextButton).toBeDisabled();
    });

    it('should display current result position', () => {
      render(<SearchInput {...propsWithResults} currentResultIndex={0} />);
      
      expect(screen.getByText('1 of 2')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should show loading indicator when searching', () => {
      render(<SearchInput {...defaultProps} isSearching={true} />);
      
      expect(screen.getByText(/searching/i)).toBeInTheDocument();
    });

    it('should disable input when searching', () => {
      render(<SearchInput {...defaultProps} isSearching={true} />);
      
      const input = screen.getByRole('textbox', { name: /search/i });
      expect(input).toBeDisabled();
    });
  });

  describe('Keyboard Navigation', () => {
    const propsWithResults = {
      ...defaultProps,
      searchResults: mockSearchResults,
      currentResultIndex: 0
    };

    it('should navigate to next result on ArrowDown', () => {
      const onNavigateNext = vi.fn();
      render(<SearchInput {...propsWithResults} onNavigateNext={onNavigateNext} />);
      
      const input = screen.getByRole('textbox', { name: /search/i });
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      
      expect(onNavigateNext).toHaveBeenCalled();
    });

    it('should navigate to previous result on ArrowUp', () => {
      const onNavigatePrevious = vi.fn();
      render(<SearchInput {...propsWithResults} onNavigatePrevious={onNavigatePrevious} />);
      
      const input = screen.getByRole('textbox', { name: /search/i });
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      
      expect(onNavigatePrevious).toHaveBeenCalled();
    });

    it('should clear search on Escape', () => {
      const onClear = vi.fn();
      render(<SearchInput {...defaultProps} onClear={onClear} query="test" />);
      
      const input = screen.getByRole('textbox', { name: /search/i });
      fireEvent.keyDown(input, { key: 'Escape' });
      
      expect(onClear).toHaveBeenCalled();
    });
  });
});