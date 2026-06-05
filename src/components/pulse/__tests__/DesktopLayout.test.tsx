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
    resolveTabForEntry: vi.fn(),
    setActiveWeek: vi.fn(),
    logs: {},
    profile: {
        unit: 'kg' as const,
        length_unit: 'cm' as const,
        display_name: null,
        active_routine_id: null,
        onboarding_completed: false,
        goal_weight_kg: null,
        gender: null,
    },
    prMap: {},
    updateLog: vi.fn(),
    deleteLog: vi.fn(),
    timerTrigger: 0,
    timerDuration: null,
    fireTrigger: vi.fn(),
    bodyweightLogs: [],
    bodyMeasurements: [],
    refreshMeasurements: vi.fn(),
    email: 'test@example.com',
    updateProfile: vi.fn(),
    updateGender: vi.fn(),
    updateLengthUnit: vi.fn(),
    logBodyWeight: vi.fn(),
    deleteBodyWeight: vi.fn(),
    isLoading: false,
    exercises: [],
    routines: [],
    activeRoutine: null,
    routineExercisesByTabKey: {},
    createRoutine: vi.fn(),
    renameRoutine: vi.fn(),
    deleteRoutine: vi.fn(),
    setActiveRoutine: vi.fn(),
    addExerciseToRoutine: vi.fn(),
    removeExerciseFromRoutine: vi.fn(),
    updateRoutineExercise: vi.fn(),
    reorderRoutineExercises: vi.fn(),
    cloneTemplate: vi.fn(),
    generateRoutine: vi.fn(),
    completeOnboarding: vi.fn(),
    createExercise: vi.fn(),
    updateExercise: vi.fn(),
    deleteExercise: vi.fn(),
    showOnboarding: false,
    triggerOnboarding: vi.fn(),
    dismissOnboarding: vi.fn(),
    autoAdvance: false,
    setAutoAdvance: vi.fn(),
    workoutModeOpen: false,
    setWorkoutModeOpen: vi.fn(),
    notes: {},
    saveNote: vi.fn().mockResolvedValue(undefined),
    deleteNote: vi.fn().mockResolvedValue(undefined),
    swaps: {},
    setSwap: vi.fn().mockResolvedValue(undefined),
    clearSwap: vi.fn().mockResolvedValue(undefined),
    hiddenExerciseIds: new Set<string>(),
    toggleHideExercise: vi.fn().mockResolvedValue(undefined),
    loading: { profile: false, bodyweight: false, logs: false, routines: false, exercises: false, notes: false },
    errors: { profile: false, bodyweight: false, logs: false, routines: false, exercises: false, notes: false },
    retry: vi.fn(),
};

vi.mock('@/context/PulseContext', () => ({
    usePulse: vi.fn(() => ({ ...mockContext })),
}));

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DesktopLayout from '../DesktopLayout';
import type { View } from '@/lib/pulse/types';
import { usePulse } from '@/context/PulseContext';

const defaultProps = {
    view: 'train' as View,
    navigate: vi.fn(),
    children: <div />,
};

describe('DesktopLayout', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear(); // keep the persisted sidebar state from leaking across tests
        vi.mocked(usePulse).mockReturnValue({ ...mockContext });
    });

    it('renders the brand mark in the icon rail', () => {
        render(<DesktopLayout {...defaultProps} />);
        expect(screen.getByText('P')).toBeInTheDocument();
    });

    it('expands the sidebar, revealing nav labels and swapping P for the Pulse wordmark', async () => {
        render(<DesktopLayout {...defaultProps} />);
        // Collapsed by default: "P" badge, nav labels are aria-only (no visible text node).
        expect(screen.getByText('P')).toBeInTheDocument();
        expect(screen.queryByText('Train')).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: /expand sidebar/i }));
        // Expanded: visible labels appear and the "P" badge is replaced by the wordmark.
        expect(screen.getByText('Train')).toBeInTheDocument();
        expect(screen.queryByText('P')).not.toBeInTheDocument();
        // Toggle flips to a collapse control.
        expect(screen.getByRole('button', { name: /collapse sidebar/i })).toBeInTheDocument();
    });

    it('renders all five nav items', () => {
        render(<DesktopLayout {...defaultProps} />);
        expect(screen.getByRole('button', { name: /^train$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^plan$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^progress$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^profile$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^library$/i })).toBeInTheDocument();
    });

    it('calls navigate when a nav item is clicked', async () => {
        const navigate = vi.fn();
        render(<DesktopLayout {...defaultProps} navigate={navigate} />);
        await userEvent.click(screen.getByRole('button', { name: /^progress$/i }));
        expect(navigate).toHaveBeenCalledWith('progress');
    });

    it('marks the active nav item with aria-current', () => {
        render(<DesktopLayout {...defaultProps} view="train" />);
        expect(screen.getByRole('button', { name: /^train$/i })).toHaveAttribute('aria-current', 'page');
        expect(screen.getByRole('button', { name: /^plan$/i })).not.toHaveAttribute('aria-current');
    });

    it('renders the context-rail Today set count and total', () => {
        render(<DesktopLayout {...defaultProps} />);
        expect(screen.getByText('Today')).toBeInTheDocument();
        // With empty logs/routine the count is 0 and total is 0.
        expect(screen.getByText(/\/ 0 sets/)).toBeInTheDocument();
        expect(screen.getByText(/session in progress/i)).toBeInTheDocument();
    });

    it('renders the context-rail stat blocks', () => {
        render(<DesktopLayout {...defaultProps} />);
        expect(screen.getByText('Streak')).toBeInTheDocument();
        expect(screen.getByText('Session volume')).toBeInTheDocument();
        expect(screen.getByText('Target intensity')).toBeInTheDocument();
    });

    it('shows the target RIR for the active week', () => {
        render(<DesktopLayout {...defaultProps} />);
        // Week 3 is Phase 1 with target RIR 2.
        expect(screen.getByText(/RIR 2/)).toBeInTheDocument();
    });

    it('shows the streak value', () => {
        render(<DesktopLayout {...defaultProps} />);
        expect(screen.getByText('2')).toBeInTheDocument();
        expect(screen.getByText(/weeks/)).toBeInTheDocument();
    });

    it('shows the active week in the phase context line', () => {
        render(<DesktopLayout {...defaultProps} />);
        expect(screen.getByText(/Week 03/)).toBeInTheDocument();
    });

    it('does not render a save error banner (errors shown via toast)', () => {
        render(<DesktopLayout {...defaultProps} />);
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('does not render an Export button', () => {
        render(<DesktopLayout {...defaultProps} />);
        expect(screen.queryByRole('button', { name: /export/i })).not.toBeInTheDocument();
    });

    it('renders a sign out button', () => {
        render(<DesktopLayout {...defaultProps} />);
        expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
    });

    it('renders the pinned rest timer when a rest is running and guided mode is closed', () => {
        vi.mocked(usePulse).mockReturnValue({ ...mockContext, timerTrigger: 1, workoutModeOpen: false });
        render(<DesktopLayout {...defaultProps} />);
        expect(screen.getByText(/rest before next set/i)).toBeInTheDocument();
    });

    it('does not render the pinned rest timer while guided mode is open', () => {
        vi.mocked(usePulse).mockReturnValue({ ...mockContext, timerTrigger: 1, workoutModeOpen: true });
        render(<DesktopLayout {...defaultProps} />);
        expect(screen.queryByText(/rest before next set/i)).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /skip rest timer/i })).not.toBeInTheDocument();
    });
});
