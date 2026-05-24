import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LogView from '../views/LogView';

const defaultProps = {
    activeWeek: 1,
    onSelectWeek: () => {},
    activeTab: 'push' as const,
    setActiveTab: () => {},
    logs: {},
    unit: 'kg' as const,
    updateLog: () => {},
    deleteLog: () => {},
    timerTrigger: 0,
};

describe('LogView', () => {
    it('shows an empty state hint when no sets are logged for the current week', () => {
        render(<LogView {...defaultProps} />);
        expect(screen.getByText(/tap an exercise/i)).toBeInTheDocument();
    });

    it('hides the empty state hint when at least one set is logged', () => {
        const logs = { '1-push-0-0': { kg: 60, reps: 10, rir: 3, saved: true } };
        render(<LogView {...defaultProps} logs={logs} />);
        expect(screen.queryByText(/tap an exercise/i)).not.toBeInTheDocument();
    });
});
