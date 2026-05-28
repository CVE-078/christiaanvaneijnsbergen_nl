import { vi } from 'vitest';

const mockContext = {
    navigate: vi.fn(),
    activeWeek: 3,
    streak: 2,
    handleExport: vi.fn(),
    activeTab: 'push' as const,
    setActiveTab: vi.fn(),
    activeDay: null as number | null,
    setActiveDay: vi.fn(),
    activeSchedule: [],
    setActiveWeek: vi.fn(),
    logs: {},
    profile: { unit: 'kg' as const, display_name: null, active_routine_id: null, onboarding_completed: false, goal_weight_kg: null },
    prMap: {},
    updateLog: vi.fn(),
    deleteLog: vi.fn(),
    timerTrigger: 0,
    fireTrigger: vi.fn(),
    bodyweightLogs: [],
    email: 'test@example.com',
    updateProfile: vi.fn(),
    logBodyWeight: vi.fn(),
    deleteBodyWeight: vi.fn(),
    isLoading: false,
    exercises: [],
    routines: [],
    activeRoutine: null,
    routineExercisesByType: { push: [], pull: [], legs: [], chest: [], back: [], shoulders: [], arms: [] },
    createRoutine: vi.fn(),
    deleteRoutine: vi.fn(),
    setActiveRoutine: vi.fn(),
    addExerciseToRoutine: vi.fn(),
    removeExerciseFromRoutine: vi.fn(),
    updateRoutineExercise: vi.fn(),
    reorderRoutineExercises: vi.fn(),
    cloneTemplate: vi.fn(),
    completeOnboarding: vi.fn(),
    createExercise: vi.fn(),
    updateExercise: vi.fn(),
    deleteExercise: vi.fn(),
    showOnboarding: false,
    triggerOnboarding: vi.fn(),
    dismissOnboarding: vi.fn(),
};

vi.mock('@/context/PulseContext', () => ({
    usePulse: vi.fn(() => ({ ...mockContext })),
}));

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DesktopLayout from '../DesktopLayout';
import type { View } from '@/lib/pulse/types';

const defaultProps = {
    view: 'train' as View,
    navigate: vi.fn(),
    children: <div />,
};

describe('DesktopLayout', () => {
    it('renders the brand name in the sidebar', () => {
        render(<DesktopLayout {...defaultProps} />);
        expect(screen.getByText(/pulse/i)).toBeInTheDocument();
    });

    it('renders all five nav items', () => {
        render(<DesktopLayout {...defaultProps} />);
        expect(screen.getByRole('button', { name: /^train$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^plan$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^progress$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^profile$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^explore$/i })).toBeInTheDocument();
    });

    it('calls navigate when a nav item is clicked', async () => {
        const navigate = vi.fn();
        render(<DesktopLayout {...defaultProps} navigate={navigate} />);
        await userEvent.click(screen.getByRole('button', { name: /^progress$/i }));
        expect(navigate).toHaveBeenCalledWith('progress');
    });

    it('shows the active week padded to 2 digits', () => {
        render(<DesktopLayout {...defaultProps} />);
        expect(screen.getByText('WK 03')).toBeInTheDocument();
    });

    it('shows streak when streak > 0', () => {
        render(<DesktopLayout {...defaultProps} />);
        expect(screen.getByText(/2WK/)).toBeInTheDocument();
    });

    it('does not render a save error banner (errors shown via toast)', () => {
        render(<DesktopLayout {...defaultProps} />);
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('calls handleExport when Export is clicked', async () => {
        const handleExport = vi.fn();
        const { usePulse } = await import('@/context/PulseContext');
        vi.mocked(usePulse).mockReturnValueOnce({ ...mockContext, handleExport });
        render(<DesktopLayout {...defaultProps} />);
        await userEvent.click(screen.getByRole('button', { name: /export/i }));
        expect(handleExport).toHaveBeenCalledTimes(1);
    });
});
