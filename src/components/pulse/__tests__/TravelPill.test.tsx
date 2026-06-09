import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TravelPill from '../TravelPill';

vi.mock('@/context/PulseContext', () => ({ usePulse: vi.fn() }));
import { usePulse } from '@/context/PulseContext';
// Stub the generation entry point so the pill test does not pull in the whole flow.
vi.mock('../GenerateRoutineButton', () => ({
    default: ({ label }: { label?: string }) => <button>{label}</button>,
}));

const home = {
    id: 'home',
    name: 'Home',
    equipment: ['barbell'],
    created_at: '2026-06-01T00:00:00Z',
    expires_at: null,
};
const navigate = vi.fn();
const endTravel = vi.fn().mockResolvedValue(undefined);

function setContext(profiles: unknown[]) {
    vi.mocked(usePulse).mockReturnValue({
        equipmentProfiles: profiles,
        profile: { active_equipment_profile_id: home.id, timezone: 'Europe/Amsterdam' },
        endTravel,
        navigate,
    } as unknown as ReturnType<typeof usePulse>);
}

beforeEach(() => {
    navigate.mockClear();
    endTravel.mockClear();
});

describe('TravelPill', () => {
    it('renders nothing without travel', () => {
        setContext([home]);
        const { container } = render(<TravelPill />);
        expect(container).toBeEmptyDOMElement();
    });

    it('shows the active travel state with the revert target', () => {
        const overlay = {
            id: 'hotel',
            name: 'Hotel',
            equipment: ['dumbbells'],
            created_at: '2026-06-08T00:00:00Z',
            expires_at: '2099-01-01T12:00:00Z',
        };
        setContext([overlay, home]);
        render(<TravelPill />);
        expect(screen.getByText(/Travel mode/i)).toBeInTheDocument();
        expect(screen.getByText(/reverts to Home/i)).toBeInTheDocument();
    });

    it('shows the post-expiry nudge with a regenerate action and dismiss', async () => {
        const ended = {
            id: 'hotel',
            name: 'Hotel',
            equipment: ['dumbbells'],
            created_at: '2026-06-08T00:00:00Z',
            // expired ~2 days ago, inside the nudge window
            expires_at: new Date(Date.now() - 2 * 86400000).toISOString(),
        };
        setContext([ended, home]);
        render(<TravelPill />);
        expect(screen.getByText(/Travel ended/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Regenerate/i })).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: /Dismiss/i }));
        expect(endTravel).toHaveBeenCalledTimes(1);
    });
});
