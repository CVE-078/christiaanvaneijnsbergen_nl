import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ExerciseFilterControl from '../ExerciseFilterControl';
import type { GroupBy } from '@/lib/pulse/library';

// Force the mobile (non-desktop) path in all tests so we test the ModalSheet panel,
// which is fully in the DOM and simpler to assert against.
vi.mock('@/hooks/pulse/useMediaQuery', () => ({
    useMediaQuery: () => false,
}));

const defaultValue = {
    favorites: false,
    fitsGear: false,
    respectsRestrictions: false,
    showHidden: false,
};

const activeValue = {
    favorites: true,
    fitsGear: true,
    respectsRestrictions: false,
    showHidden: false,
};

function renderControl(overrides: {
    value?: typeof defaultValue;
    activeProfileName?: string | null;
    onChange?: ReturnType<typeof vi.fn>;
    groupBy?: GroupBy;
    onGroupByChange?: ReturnType<typeof vi.fn>;
} = {}) {
    const {
        value = defaultValue,
        activeProfileName = null,
        onChange = vi.fn(),
        groupBy = 'muscle' as GroupBy,
        onGroupByChange = vi.fn(),
    } = overrides;
    return render(
        <ExerciseFilterControl
            value={value}
            activeProfileName={activeProfileName}
            onChange={onChange}
            groupBy={groupBy}
            onGroupByChange={onGroupByChange}
        />,
    );
}

describe('ExerciseFilterControl', () => {
    describe('trigger badge', () => {
        it('shows no badge when all filters are off', () => {
            renderControl();
            // No badge element should be visible when count is 0.
            expect(screen.queryByTestId('filter-badge')).not.toBeInTheDocument();
        });

        it('shows an active-count badge equal to the number of true flags (group-by is not a filter)', () => {
            renderControl({ value: activeValue });
            const badge = screen.getByTestId('filter-badge');
            expect(badge).toBeInTheDocument();
            expect(badge.textContent).toBe('2');
        });

        it('badge has aria-live="polite"', () => {
            renderControl({ value: activeValue });
            expect(screen.getByTestId('filter-badge')).toHaveAttribute('aria-live', 'polite');
        });
    });

    describe('panel toggles', () => {
        beforeEach(() => {
            renderControl();
            // Open the panel.
            fireEvent.click(screen.getByTestId('filter-trigger'));
        });

        it('shows four toggles with role="switch"', () => {
            const switches = screen.getAllByRole('switch');
            expect(switches).toHaveLength(4);
        });

        it('shows "Favorites" toggle', () => {
            expect(screen.getByRole('switch', { name: /favorites/i })).toBeInTheDocument();
        });

        it('shows "Fits my gear" toggle', () => {
            expect(screen.getByRole('switch', { name: /fits my gear/i })).toBeInTheDocument();
        });

        it('shows "Respects my restrictions" toggle (not "Safe")', () => {
            expect(screen.getByRole('switch', { name: /respects my restrictions/i })).toBeInTheDocument();
            expect(screen.queryByRole('switch', { name: /safe/i })).not.toBeInTheDocument();
        });

        it('shows "Show hidden" toggle', () => {
            expect(screen.getByRole('switch', { name: /show hidden/i })).toBeInTheDocument();
        });

        it('toggles reflect aria-checked from value prop', () => {
            // All are false in defaultValue.
            const switches = screen.getAllByRole('switch');
            switches.forEach((sw) => {
                expect(sw).toHaveAttribute('aria-checked', 'false');
            });
        });
    });

    describe('group-by section', () => {
        it('renders Muscle / Equipment / Type options in the panel', () => {
            renderControl();
            fireEvent.click(screen.getByTestId('filter-trigger'));
            expect(screen.getByRole('radio', { name: /muscle/i })).toBeInTheDocument();
            expect(screen.getByRole('radio', { name: /equipment/i })).toBeInTheDocument();
            expect(screen.getByRole('radio', { name: /type/i })).toBeInTheDocument();
        });

        it('active groupBy is reflected as aria-checked="true"', () => {
            renderControl({ groupBy: 'equipment' });
            fireEvent.click(screen.getByTestId('filter-trigger'));
            expect(screen.getByRole('radio', { name: /equipment/i })).toHaveAttribute('aria-checked', 'true');
            expect(screen.getByRole('radio', { name: /muscle/i })).toHaveAttribute('aria-checked', 'false');
        });

        it('clicking a group-by option calls onGroupByChange', () => {
            const onGroupByChange = vi.fn();
            renderControl({ onGroupByChange });
            fireEvent.click(screen.getByTestId('filter-trigger'));
            fireEvent.click(screen.getByRole('radio', { name: /type/i }));
            expect(onGroupByChange).toHaveBeenCalledWith('type');
        });
    });

    describe('onChange', () => {
        it('toggling "Fits my gear" calls onChange with that flag flipped', () => {
            const onChange = vi.fn();
            renderControl({ onChange });
            fireEvent.click(screen.getByTestId('filter-trigger'));
            fireEvent.click(screen.getByRole('switch', { name: /fits my gear/i }));
            expect(onChange).toHaveBeenCalledWith({
                ...defaultValue,
                fitsGear: true,
            });
        });
    });

    describe('profile name', () => {
        it('appends the profile name to "Fits my gear" when activeProfileName is set', () => {
            renderControl({ activeProfileName: 'Home' });
            fireEvent.click(screen.getByTestId('filter-trigger'));
            expect(screen.getByRole('switch', { name: /fits my gear: home/i })).toBeInTheDocument();
        });

        it('shows plain "Fits my gear" when activeProfileName is null', () => {
            renderControl({ activeProfileName: null });
            fireEvent.click(screen.getByTestId('filter-trigger'));
            const sw = screen.getByRole('switch', { name: /fits my gear/i });
            expect(sw.getAttribute('aria-label') ?? sw.textContent).not.toMatch(/:/);
        });
    });
});
