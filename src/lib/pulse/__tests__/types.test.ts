import { describe, it, expect } from 'vitest';
import type { RoutineTemplate } from '../types';
import { defaultWorkoutType, templateMatchesEquipment } from '../types';

describe('defaultWorkoutType', () => {
  it('maps chest → chest', () => expect(defaultWorkoutType('chest')).toBe('chest'));
  it('maps shoulders → shoulders', () => expect(defaultWorkoutType('shoulders')).toBe('shoulders'));
  it('maps triceps → arms', () => expect(defaultWorkoutType('triceps')).toBe('arms'));
  it('maps back → back', () => expect(defaultWorkoutType('back')).toBe('back'));
  it('maps biceps → arms', () => expect(defaultWorkoutType('biceps')).toBe('arms'));
  it('maps legs → legs', () => expect(defaultWorkoutType('legs')).toBe('legs'));
  it('maps glutes → legs', () => expect(defaultWorkoutType('glutes')).toBe('legs'));
  it('maps calves → legs', () => expect(defaultWorkoutType('calves')).toBe('legs'));
  it('maps abs → null', () => expect(defaultWorkoutType('abs')).toBeNull());
  it('maps other → null', () => expect(defaultWorkoutType('other')).toBeNull());
});

describe('templateMatchesEquipment', () => {
  const t = { required_equipment: ['dumbbells', 'barbell'] } satisfies Pick<RoutineTemplate, 'required_equipment'>;
  it('matches when user has all required', () =>
    expect(templateMatchesEquipment(t, new Set(['dumbbells','barbell','bench']))).toBe(true));
  it('rejects when user missing one', () =>
    expect(templateMatchesEquipment(t, new Set(['dumbbells']))).toBe(false));
  it('matches exact set', () =>
    expect(templateMatchesEquipment(t, new Set(['dumbbells','barbell']))).toBe(true));
  it('matches when no equipment required', () =>
    expect(templateMatchesEquipment({ required_equipment: [] }, new Set(['dumbbells']))).toBe(true));
});
