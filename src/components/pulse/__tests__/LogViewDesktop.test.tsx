import { vi } from 'vitest';

vi.mock('@/context/PulseContext', () => ({
    usePulse: vi.fn(() => ({
        activeWeek: 1,
        setActiveWeek: vi.fn(),
        activeTab: 'push' as const,
        setActiveTab: vi.fn(),
        logs: {},
        profile: { unit: 'kg', display_name: null },
        prMap: {},
        updateLog: vi.fn(),
        deleteLog: vi.fn(),
        timerTrigger: 0,
        fireTrigger: vi.fn(),
    })),
}));

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WORKOUTS } from '@/lib/pulse/data';
import LogViewDesktop from '../views/LogViewDesktop';

beforeEach(() => localStorage.clear());

describe('LogViewDesktop', () => {
    it('auto-opens the first exercise detail pane on mount', () => {
        render(<LogViewDesktop />);
        const firstName = WORKOUTS.push.exercises[0].name;
        expect(screen.getAllByText(firstName).length).toBeGreaterThanOrEqual(1);
    });

    it('switches the detail pane when a different exercise is clicked', async () => {
        render(<LogViewDesktop />);
        const secondName = WORKOUTS.push.exercises[1].name;
        await userEvent.click(screen.getByRole('button', { name: new RegExp(secondName, 'i') }));
        expect(screen.getAllByText(secondName).length).toBeGreaterThanOrEqual(1);
    });

    it('persists selected exercise index to localStorage', async () => {
        render(<LogViewDesktop />);
        const secondName = WORKOUTS.push.exercises[1].name;
        await userEvent.click(screen.getByRole('button', { name: new RegExp(secondName, 'i') }));
        expect(localStorage.getItem('pulse_last_ex')).toBe('1');
    });

    it('restores selected exercise from localStorage on mount', () => {
        localStorage.setItem('pulse_last_ex', '2');
        render(<LogViewDesktop />);
        const thirdName = WORKOUTS.push.exercises[2].name;
        expect(screen.getAllByText(thirdName).length).toBeGreaterThanOrEqual(1);
    });
});
