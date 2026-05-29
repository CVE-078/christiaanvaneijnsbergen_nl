import type { WorkoutVariant } from './types';

export function nextVariant(lastVariant: WorkoutVariant | null): WorkoutVariant {
    return lastVariant === 'A' ? 'B' : 'A';
}
