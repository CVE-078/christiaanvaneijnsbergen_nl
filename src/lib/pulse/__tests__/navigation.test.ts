import { describe, it, expect } from 'vitest';
import {
    resolveView,
    progressTabFromPath,
    profileTabFromPath,
    progressTabPath,
    profileTabPath,
    libraryTabFromPath,
    libraryTabPath,
} from '@/lib/pulse/navigation';

describe('resolveView', () => {
    it('maps each base path to its view', () => {
        expect(resolveView('/pulse/train')).toBe('train');
        expect(resolveView('/pulse/plan')).toBe('plan');
        expect(resolveView('/pulse/progress')).toBe('progress');
        expect(resolveView('/pulse/profile')).toBe('profile');
        expect(resolveView('/pulse/library')).toBe('library');
    });

    it('resolves a deep-linked tab to its parent view', () => {
        expect(resolveView('/pulse/progress/lifts')).toBe('progress');
        expect(resolveView('/pulse/progress/body')).toBe('progress');
        expect(resolveView('/pulse/profile/training')).toBe('profile');
    });

    it('falls back to train for unknown / empty paths', () => {
        expect(resolveView('/pulse')).toBe('train');
        expect(resolveView('/pulse/nonsense')).toBe('train');
        expect(resolveView(null)).toBe('train');
        expect(resolveView(undefined)).toBe('train');
    });
});

describe('progress tab path mapping', () => {
    it('reads the tab from the path (bare path = overview)', () => {
        expect(progressTabFromPath('/pulse/progress')).toBe('overview');
        expect(progressTabFromPath('/pulse/progress/lifts')).toBe('lifts');
        expect(progressTabFromPath('/pulse/progress/body')).toBe('body');
        expect(progressTabFromPath('/pulse/progress/nonsense')).toBe('overview');
    });

    it('builds the path from the tab (overview = bare path)', () => {
        expect(progressTabPath('overview')).toBe('/pulse/progress');
        expect(progressTabPath('lifts')).toBe('/pulse/progress/lifts');
        expect(progressTabPath('body')).toBe('/pulse/progress/body');
    });
});

describe('profile tab path mapping', () => {
    it('reads the tab from the path (bare path = you)', () => {
        expect(profileTabFromPath('/pulse/profile')).toBe('you');
        expect(profileTabFromPath('/pulse/profile/training')).toBe('training');
        expect(profileTabFromPath('/pulse/profile/nonsense')).toBe('you');
    });

    it('builds the path from the tab (you = bare path)', () => {
        expect(profileTabPath('you')).toBe('/pulse/profile');
        expect(profileTabPath('training')).toBe('/pulse/profile/training');
    });
});

describe('library tab path mapping', () => {
    it('reads the tab from the path (bare path = exercises)', () => {
        expect(libraryTabFromPath('/pulse/library')).toBe('exercises');
        expect(libraryTabFromPath('/pulse/library/routines')).toBe('routines');
        expect(libraryTabFromPath('/pulse/library/nonsense')).toBe('exercises');
        expect(libraryTabFromPath(null)).toBe('exercises');
    });

    it('builds the path from the tab (exercises = bare path)', () => {
        expect(libraryTabPath('exercises')).toBe('/pulse/library');
        expect(libraryTabPath('routines')).toBe('/pulse/library/routines');
    });

    it('resolves a deep-linked library tab to the library view', () => {
        expect(resolveView('/pulse/library/routines')).toBe('library');
    });
});
