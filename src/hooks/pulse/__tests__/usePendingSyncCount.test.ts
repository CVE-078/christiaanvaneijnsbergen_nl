import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePendingSyncCount } from '../usePendingSyncCount';

describe('usePendingSyncCount', () => {
    it('returns 0 when indexedDB is unavailable (count resolves 0, no throw)', async () => {
        const { result } = renderHook(() => usePendingSyncCount());
        expect(result.current).toBe(0);
        await waitFor(() => expect(result.current).toBe(0));
    });
});
