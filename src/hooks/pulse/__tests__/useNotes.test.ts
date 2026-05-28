import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('swr', () => ({ default: vi.fn() }));
vi.mock('@/app/pulse/actions', () => ({
    saveNote: vi.fn().mockResolvedValue(undefined),
    deleteNote: vi.fn().mockResolvedValue(undefined),
}));

import useSWR from 'swr';
import { saveNote as mockSaveNote, deleteNote as mockDeleteNote } from '@/app/pulse/actions';
import { useNotes } from '../useNotes';
import type { Notes } from '@/lib/pulse/types';

const mockMutate = vi.fn();
const UUID = 'aaaaaaaa-0000-4000-8000-000000000001';

beforeEach(() => {
    vi.mocked(useSWR).mockReturnValue({ data: {}, mutate: mockMutate } as unknown as ReturnType<typeof useSWR>);
    mockMutate.mockClear();
    vi.mocked(mockSaveNote).mockClear();
    vi.mocked(mockDeleteNote).mockClear();
});

describe('useNotes', () => {
    it('returns notes from SWR data', () => {
        const notes: Notes = { [`3-${UUID}`]: 'tight shoulder' };
        vi.mocked(useSWR).mockReturnValue({ data: notes, mutate: mockMutate } as unknown as ReturnType<typeof useSWR>);
        const { result } = renderHook(() => useNotes({}));
        expect(result.current.notes).toEqual(notes);
    });

    it('falls back to initialNotes when SWR data is undefined', () => {
        vi.mocked(useSWR).mockReturnValue({ data: undefined, mutate: mockMutate } as unknown as ReturnType<typeof useSWR>);
        const initialNotes: Notes = { [`1-${UUID}`]: 'felt good' };
        const { result } = renderHook(() => useNotes(initialNotes));
        expect(result.current.notes).toEqual(initialNotes);
    });

    it('saveNote calls mutate optimistically then calls server action', async () => {
        const { result } = renderHook(() => useNotes({}));
        await act(async () => {
            await result.current.saveNote(3, UUID, 'tight shoulder');
        });
        expect(mockMutate).toHaveBeenCalledWith({ [`3-${UUID}`]: 'tight shoulder' }, false);
        expect(mockSaveNote).toHaveBeenCalledWith(3, UUID, 'tight shoulder');
    });

    it('deleteNote removes the key optimistically then calls server action', async () => {
        const notes: Notes = { [`3-${UUID}`]: 'tight shoulder' };
        vi.mocked(useSWR).mockReturnValue({ data: notes, mutate: mockMutate } as unknown as ReturnType<typeof useSWR>);
        const { result } = renderHook(() => useNotes(notes));
        await act(async () => {
            await result.current.deleteNote(3, UUID);
        });
        expect(mockMutate).toHaveBeenCalledWith({}, false);
        expect(mockDeleteNote).toHaveBeenCalledWith(3, UUID);
    });
});
