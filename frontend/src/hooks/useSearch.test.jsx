import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useSearch } from './useSearch.jsx';

// Mock dell'API
vi.mock('../utils/api', () => ({
  searchAnime: vi.fn(() => Promise.resolve([
    { id: '1', title: 'Naruto', genres: [] }
  ]))
}));

describe('useSearch', () => {
  it('ritorna risultati dopo debounce', async () => {
    const { result } = renderHook(() => useSearch());

    act(() => result.current.setQuery('naruto'));

    // Attendi il debounce (300ms tipicamente)
    await act(() => new Promise(r => setTimeout(r, 400)));

    expect(result.current.results.length).toBeGreaterThan(0);
  });
});
