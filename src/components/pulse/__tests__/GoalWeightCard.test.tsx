import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/context/PulseContext', () => ({
    usePulse: vi.fn(),
}));

import { usePulse } from '@/context/PulseContext';
import GoalWeightCard from '../GoalWeightCard';

// GoalWeightCard now goes through the optimistic context wrapper, not the raw action.
const updateGoalWeight = vi.fn().mockResolvedValue(undefined);

const defaultContext = {
    profile: {
        unit: 'kg' as const,
        goal_weight_kg: null as number | null,
    },
    bodyweightLogs: [] as Array<{ id: string; logged_at: string; weight_kg: number }>,
    updateGoalWeight,
};

beforeEach(() => {
    vi.mocked(usePulse).mockReturnValue(defaultContext as unknown as ReturnType<typeof usePulse>);
    updateGoalWeight.mockClear();
});

describe('GoalWeightCard', () => {
    it('renders the goal weight input when no goal is set', () => {
        render(<GoalWeightCard />);
        expect(screen.getByPlaceholderText('Goal (kg)')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^set$/i })).toBeInTheDocument();
    });

    it('stores goal weight in rounded kg when unit is lbs', async () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            profile: { unit: 'lbs' as const, goal_weight_kg: null },
        } as unknown as ReturnType<typeof usePulse>);
        render(<GoalWeightCard />);
        const input = screen.getByPlaceholderText('Goal (lbs)');
        await userEvent.type(input, '180');
        await userEvent.click(screen.getByRole('button', { name: /^set$/i }));
        // 180 lbs / 2.20462 = 81.6466..., rounded to 2 decimals by toKg
        expect(vi.mocked(updateGoalWeight)).toHaveBeenCalledWith(81.65);
    });

    it('shows the set goal when goal_weight_kg is present', () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            profile: { unit: 'kg' as const, goal_weight_kg: 75 },
        } as unknown as ReturnType<typeof usePulse>);
        render(<GoalWeightCard />);
        expect(screen.getByText(/75 kg/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^clear$/i })).toBeInTheDocument();
    });

    it('shows kg to go when current bodyweight is above goal', () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            profile: { unit: 'kg' as const, goal_weight_kg: 75 },
            bodyweightLogs: [{ id: 'b1', logged_at: '2026-06-12', weight_kg: 80 }],
        } as unknown as ReturnType<typeof usePulse>);
        render(<GoalWeightCard />);
        expect(screen.getByText(/5\.0 kg to go/)).toBeInTheDocument();
    });

    it('expresses the distance to goal in the user unit when lbs', () => {
        // 5 kg gap shown in lbs (5 * 2.20462 = 11.0), labelled "lbs to go", not kg.
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            profile: { unit: 'lbs' as const, goal_weight_kg: 75 },
            bodyweightLogs: [{ id: 'b1', logged_at: '2026-06-12', weight_kg: 80 }],
        } as unknown as ReturnType<typeof usePulse>);
        render(<GoalWeightCard />);
        expect(screen.getByText(/11\.0 lbs to go/)).toBeInTheDocument();
    });

    it('calls updateGoalWeight(null) when Clear is clicked', async () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            profile: { unit: 'kg' as const, goal_weight_kg: 75 },
        } as unknown as ReturnType<typeof usePulse>);
        render(<GoalWeightCard />);
        await userEvent.click(screen.getByRole('button', { name: /^clear$/i }));
        expect(vi.mocked(updateGoalWeight)).toHaveBeenCalledWith(null);
    });
});
