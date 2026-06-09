import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EquipmentProfilesEditor from '../EquipmentProfilesEditor';
import { ToastProvider } from '@/lib/pulse/toast';

vi.mock('@/context/PulseContext', () => ({ usePulse: vi.fn() }));
import { usePulse } from '@/context/PulseContext';

const home = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    name: 'Home',
    equipment: ['dumbbells'],
    created_at: '2026-06-09T00:00:00Z',
};

const create = vi.fn().mockResolvedValue({ ...home, id: 'new', name: 'Gym' });
const update = vi.fn().mockResolvedValue(undefined);
const del = vi.fn().mockResolvedValue(undefined);
const setActive = vi.fn().mockResolvedValue(undefined);

function setContext(over: Record<string, unknown> = {}) {
    vi.mocked(usePulse).mockReturnValue({
        equipmentProfiles: [home],
        profile: { active_equipment_profile_id: null },
        createEquipmentProfile: create,
        updateEquipmentProfile: update,
        deleteEquipmentProfile: del,
        setActiveEquipmentProfile: setActive,
        ...over,
    } as unknown as ReturnType<typeof usePulse>);
}

function renderEditor() {
    return render(
        <ToastProvider>
            <EquipmentProfilesEditor />
        </ToastProvider>,
    );
}

beforeEach(() => {
    create.mockClear();
    update.mockClear();
    del.mockClear();
    setActive.mockClear();
    setContext();
});

describe('EquipmentProfilesEditor', () => {
    it('lists saved profiles with an equipment summary', () => {
        renderEditor();
        expect(screen.getByText('Home')).toBeInTheDocument();
        expect(screen.getByText(/Dumbbells/)).toBeInTheDocument();
    });

    it('opens the create form and requires a name and at least one equipment item', async () => {
        renderEditor();
        await userEvent.click(screen.getByRole('button', { name: /New profile/i }));
        const save = screen.getByRole('button', { name: /^Save$/ });
        expect(save).toBeDisabled();
        await userEvent.type(screen.getByPlaceholderText(/profile name/i), 'Gym');
        expect(save).toBeDisabled();
        await userEvent.click(screen.getByRole('button', { name: /Barbell/ }));
        expect(save).toBeEnabled();
        await userEvent.click(save);
        expect(create).toHaveBeenCalledWith('Gym', ['barbell']);
    });

    it('a suggested-name chip fills the name field', async () => {
        renderEditor();
        await userEvent.click(screen.getByRole('button', { name: /New profile/i }));
        await userEvent.click(screen.getByRole('button', { name: /^Gym$/ }));
        expect(screen.getByPlaceholderText(/profile name/i)).toHaveValue('Gym');
    });

    it('tap-to-activate calls setActive', async () => {
        renderEditor();
        await userEvent.click(screen.getByRole('button', { name: /Set active/i }));
        expect(setActive).toHaveBeenCalledWith(home.id);
    });

    it('marks the active profile and offers no activate button for it', () => {
        setContext({ profile: { active_equipment_profile_id: home.id } });
        renderEditor();
        expect(screen.getByText(/Active/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Set active/i })).not.toBeInTheDocument();
    });

    it('delete calls deleteEquipmentProfile', async () => {
        renderEditor();
        await userEvent.click(screen.getByRole('button', { name: /Delete Home/i }));
        expect(del).toHaveBeenCalledWith(home.id);
    });

    it('edit opens a prefilled atomic form and saves name + equipment together', async () => {
        renderEditor();
        await userEvent.click(screen.getByRole('button', { name: /^Edit$/ }));
        const nameInput = screen.getByPlaceholderText(/profile name/i);
        expect(nameInput).toHaveValue('Home');
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'Home Gym');
        await userEvent.click(screen.getByRole('button', { name: /Bench/ }));
        await userEvent.click(screen.getByRole('button', { name: /^Save$/ }));
        expect(update).toHaveBeenCalledWith(home.id, 'Home Gym', ['dumbbells', 'bench']);
    });

    it('shows an inline error when the create action rejects', async () => {
        create.mockRejectedValueOnce(new Error('You already have a profile called Gym'));
        renderEditor();
        await userEvent.click(screen.getByRole('button', { name: /New profile/i }));
        await userEvent.type(screen.getByPlaceholderText(/profile name/i), 'Gym');
        await userEvent.click(screen.getByRole('button', { name: /Barbell/ }));
        await userEvent.click(screen.getByRole('button', { name: /^Save$/ }));
        expect(await screen.findByText(/already have a profile called Gym/i)).toBeInTheDocument();
    });
});
