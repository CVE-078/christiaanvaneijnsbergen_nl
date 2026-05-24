import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ExerciseCard from '../ExerciseCard';
import { WORKOUTS } from '@/lib/weight-tracker/data';

// WORKOUTS.push.exercises[0] = Dumbbell Bench Press, sets: '3–4' → maxSets = 4
const exercise = WORKOUTS.push.exercises[0];

const defaultProps = {
  exercise,
  exIdx: 0,
  week: 1,
  type: 'push' as const,
  logs: {},
  prMap: {},
  unit: 'kg' as const,
  onSave: () => {},
  onDelete: () => {},
};

describe('ExerciseCard', () => {
  it('does not show completed indicator when no sets are logged', () => {
    render(<ExerciseCard {...defaultProps} />);
    expect(screen.queryAllByLabelText(/all sets done/i)).toHaveLength(0);
  });

  it('shows completed indicator when all sets are logged', () => {
    // Dumbbell Bench Press: sets '3–4' → parseMaxSets returns 4, so sets 0..3
    const logs: Record<string, { kg: number; reps: number; rir: number; saved: boolean }> = {
      '1-push-0-0': { kg: 60, reps: 10, rir: 3, saved: true },
      '1-push-0-1': { kg: 60, reps: 10, rir: 3, saved: true },
      '1-push-0-2': { kg: 60, reps: 10, rir: 3, saved: true },
      '1-push-0-3': { kg: 60, reps: 10, rir: 3, saved: true },
    };
    render(<ExerciseCard {...defaultProps} logs={logs} />);
    expect(screen.getAllByLabelText(/all sets done/i).length).toBeGreaterThan(0);
  });
});
