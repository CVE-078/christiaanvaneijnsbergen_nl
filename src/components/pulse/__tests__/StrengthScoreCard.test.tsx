import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import StrengthScoreCard from '@/components/pulse/StrengthScoreCard';
import type { StrengthScore } from '@/lib/pulse/types';

describe('StrengthScoreCard', () => {
    it('renders the score number, level and per-lift bars when scored', () => {
        const strength: StrengthScore = {
            score: 62,
            level: 'Intermediate',
            reason: null,
            lifts: [
                { lift: 'bench', label: 'Bench Press', subScore: 55, ratio: 1.3 },
                { lift: 'squat', label: 'Squat', subScore: 70, ratio: 1.8 },
            ],
        };
        render(<StrengthScoreCard strength={strength} />);

        expect(screen.getByText('62')).toBeInTheDocument();
        expect(screen.getByText('Intermediate')).toBeInTheDocument();
        expect(screen.getByText('Bench Press')).toBeInTheDocument();
        expect(screen.getByText('Squat')).toBeInTheDocument();
        expect(screen.getByText('55')).toBeInTheDocument();
        expect(screen.getByText('70')).toBeInTheDocument();
    });

    it('renders the reason as a CTA when score is null', () => {
        const strength: StrengthScore = {
            score: null,
            level: null,
            reason: 'Log your bodyweight to get a strength score.',
            lifts: [],
        };
        render(<StrengthScoreCard strength={strength} />);

        expect(screen.getByText('Log your bodyweight to get a strength score.')).toBeInTheDocument();
    });
});
