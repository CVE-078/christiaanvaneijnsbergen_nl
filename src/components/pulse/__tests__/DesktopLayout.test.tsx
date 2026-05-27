import { vi } from 'vitest';

const mockContext = {
    view: 'log' as const,
    navigate: vi.fn(),
    activeWeek: 3,
    streak: 2,
    saveError: null as string | null,
    handleExport: vi.fn(),
    activeTab: 'push' as const,
    setActiveTab: vi.fn(),
    setActiveWeek: vi.fn(),
    logs: {},
    profile: { unit: 'kg' as const, display_name: null, active_routine_id: null, onboarding_completed: false },
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
    createExercise: vi.fn(),
    updateExercise: vi.fn(),
    deleteExercise: vi.fn(),
};

vi.mock('@/context/PulseContext', () => ({
    usePulse: vi.fn(() => ({ ...mockContext })),
}));

vi.mock('../views/LogView', () => ({
    default: () => <div data-testid="log-view">LogView</div>,
}));

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DesktopLayout from '../DesktopLayout';

describe('DesktopLayout', () => {
    it('renders the brand name in the sidebar', () => {
        render(<DesktopLayout />);
        expect(screen.getByText(/pulse/i)).toBeInTheDocument();
    });

    it('renders all four nav items', () => {
        render(<DesktopLayout />);
        expect(screen.getByRole('button', { name: /^log$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^program$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^history$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^profile$/i })).toBeInTheDocument();
    });

    it('calls navigate when a nav item is clicked', async () => {
        const navigate = vi.fn();
        const { usePulse } = await import('@/context/PulseContext');
        vi.mocked(usePulse).mockReturnValueOnce({ ...mockContext, navigate });
        render(<DesktopLayout />);
        await userEvent.click(screen.getByRole('button', { name: /^history$/i }));
        expect(navigate).toHaveBeenCalledWith('history');
    });

    it('shows the active week padded to 2 digits', () => {
        render(<DesktopLayout />);
        expect(screen.getByText('WK 03')).toBeInTheDocument();
    });

    it('shows streak when streak > 0', () => {
        render(<DesktopLayout />);
        expect(screen.getByText(/2WK/)).toBeInTheDocument();
    });

    it('renders the save error bar when saveError is set', async () => {
        const { usePulse } = await import('@/context/PulseContext');
        vi.mocked(usePulse).mockReturnValueOnce({ ...mockContext, saveError: 'Failed to save.' });
        render(<DesktopLayout />);
        expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('calls handleExport when Export is clicked', async () => {
        const handleExport = vi.fn();
        const { usePulse } = await import('@/context/PulseContext');
        vi.mocked(usePulse).mockReturnValueOnce({ ...mockContext, handleExport });
        render(<DesktopLayout />);
        await userEvent.click(screen.getByRole('button', { name: /export/i }));
        expect(handleExport).toHaveBeenCalledTimes(1);
    });
});
