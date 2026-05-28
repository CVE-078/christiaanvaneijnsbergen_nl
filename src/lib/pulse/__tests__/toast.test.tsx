import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ToastProvider, useToast } from '../toast';

const wrapper = ({ children }: { children: ReactNode }) => (
    <ToastProvider>{children}</ToastProvider>
);

describe('useToast', () => {
    it('starts with no toasts', () => {
        const { result } = renderHook(() => useToast(), { wrapper });
        expect(result.current.toasts).toEqual([]);
    });

    it('show() adds a toast with the given message', () => {
        const { result } = renderHook(() => useToast(), { wrapper });
        act(() => { result.current.show('Hello world'); });
        expect(result.current.toasts).toHaveLength(1);
        expect(result.current.toasts[0].message).toBe('Hello world');
    });

    it('show() defaults variant to info', () => {
        const { result } = renderHook(() => useToast(), { wrapper });
        act(() => { result.current.show('Info toast'); });
        expect(result.current.toasts[0].variant).toBe('info');
    });

    it('show() respects explicit variant', () => {
        const { result } = renderHook(() => useToast(), { wrapper });
        act(() => { result.current.show('Boom', 'error'); });
        expect(result.current.toasts[0].variant).toBe('error');
    });

    it('dismiss() removes a toast by id', () => {
        const { result } = renderHook(() => useToast(), { wrapper });
        act(() => {
            result.current.show('A');
            result.current.show('B');
        });
        const id = result.current.toasts[0].id;
        act(() => { result.current.dismiss(id); });
        expect(result.current.toasts).toHaveLength(1);
        expect(result.current.toasts[0].message).toBe('B');
    });

    it('caps at 3 toasts, dropping the oldest', () => {
        const { result } = renderHook(() => useToast(), { wrapper });
        act(() => {
            result.current.show('1');
            result.current.show('2');
            result.current.show('3');
            result.current.show('4');
        });
        expect(result.current.toasts).toHaveLength(3);
        expect(result.current.toasts[0].message).toBe('2');
        expect(result.current.toasts[2].message).toBe('4');
    });

    it('each toast has a unique id', () => {
        const { result } = renderHook(() => useToast(), { wrapper });
        act(() => {
            result.current.show('X');
            result.current.show('Y');
        });
        const ids = result.current.toasts.map((t) => t.id);
        expect(new Set(ids).size).toBe(2);
    });
});
