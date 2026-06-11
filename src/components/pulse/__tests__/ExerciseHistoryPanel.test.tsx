import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ExerciseHistoryPanel from '../ExerciseHistoryPanel';
import type { ExerciseHistory } from '@/lib/pulse/utils';

const base: ExerciseHistory = {
    lastSession: { kg: 100, reps: 5, setCount: 3 },
    best: { kg: 105, reps: 5, e1rm: 122.5 },
    trend: 'up',
    e1rmDeltaPct: 4.7,
    previousNote: 'moved better',
};

describe('ExerciseHistoryPanel', () => {
    it('renders the best set, rounded estimated 1RM, an up-trend with delta, and the previous note', () => {
        render(<ExerciseHistoryPanel history={base} unit="kg" />);
        expect(screen.getByText(/Best 105 kg × 5/)).toBeInTheDocument();
        expect(screen.getByText(/~123 kg 1RM/)).toBeInTheDocument(); // 122.5 rounded
        expect(screen.getByLabelText('trending up')).toHaveTextContent('+5%'); // 4.7 rounded
        expect(screen.getByText(/Last note: moved better/)).toBeInTheDocument();
    });

    it('omits the trend chip when the trend is none', () => {
        render(<ExerciseHistoryPanel history={{ ...base, trend: 'none', e1rmDeltaPct: null }} unit="kg" />);
        expect(screen.queryByLabelText(/trending/)).not.toBeInTheDocument();
        expect(screen.getByText(/Best 105 kg/)).toBeInTheDocument();
    });

    it('renders nothing for a brand-new lift (no best set, no previous note)', () => {
        const { container } = render(
            <ExerciseHistoryPanel
                history={{ lastSession: null, best: null, trend: 'none', e1rmDeltaPct: null, previousNote: null }}
                unit="kg"
            />,
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('shows the previous note even when there is no best set', () => {
        render(
            <ExerciseHistoryPanel
                history={{ lastSession: null, best: null, trend: 'none', e1rmDeltaPct: null, previousNote: 'tweaked grip' }}
                unit="kg"
            />,
        );
        expect(screen.getByText(/Last note: tweaked grip/)).toBeInTheDocument();
    });
});
