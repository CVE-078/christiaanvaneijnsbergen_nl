import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { ToastProvider, useToast } from '@/lib/pulse/toast';
import ToastContainer from '../ToastContainer';

// Helper that exposes show() so tests can push toasts and trigger re-renders.
let showRef: (message: string, variant?: 'error' | 'success' | 'info') => void;

function Harness() {
    const { show } = useToast();
    showRef = show;
    return <ToastContainer />;
}

function renderHarness() {
    return render(
        <ToastProvider>
            <Harness />
        </ToastProvider>,
    );
}

describe('ToastContainer', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('auto-dismisses a toast after 4s', () => {
        renderHarness();
        act(() => showRef('hello'));
        expect(screen.getByText('hello')).toBeInTheDocument();

        act(() => vi.advanceTimersByTime(4000));
        expect(screen.queryByText('hello')).not.toBeInTheDocument();
    });

    it('does not reset the timer when the parent re-renders mid-countdown', () => {
        renderHarness();
        act(() => showRef('first'));

        // Advance most of the way, then cause a parent re-render by adding a
        // second toast. If the timer were keyed on the inline closure identity
        // it would tear down and restart, and "first" would survive past 4s.
        act(() => vi.advanceTimersByTime(3500));
        act(() => showRef('second'));
        expect(screen.getByText('first')).toBeInTheDocument();

        // 500ms more reaches the original 4s deadline for "first".
        act(() => vi.advanceTimersByTime(500));
        expect(screen.queryByText('first')).not.toBeInTheDocument();
        expect(screen.getByText('second')).toBeInTheDocument();
    });

    it('pauses auto-dismiss while hovering', () => {
        renderHarness();
        act(() => showRef('sticky'));
        const toast = screen.getByText('sticky').closest('[role]') as HTMLElement;

        fireEvent.mouseEnter(toast);
        act(() => vi.advanceTimersByTime(10000));
        expect(screen.getByText('sticky')).toBeInTheDocument();

        fireEvent.mouseLeave(toast);
        act(() => vi.advanceTimersByTime(4000));
        expect(screen.queryByText('sticky')).not.toBeInTheDocument();
    });

    it('dismisses on the close button click', () => {
        renderHarness();
        act(() => showRef('byebye'));

        fireEvent.click(screen.getByRole('button', { name: /dismiss notification/i }));
        expect(screen.queryByText('byebye')).not.toBeInTheDocument();
    });

    it('keeps at most 3 toasts', () => {
        renderHarness();
        act(() => {
            showRef('a');
            showRef('b');
            showRef('c');
            showRef('d');
        });

        expect(screen.queryByText('a')).not.toBeInTheDocument();
        expect(screen.getByText('b')).toBeInTheDocument();
        expect(screen.getByText('c')).toBeInTheDocument();
        expect(screen.getByText('d')).toBeInTheDocument();
    });
});
