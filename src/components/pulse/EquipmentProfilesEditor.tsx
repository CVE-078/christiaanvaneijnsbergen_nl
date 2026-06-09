import { useState } from 'react';
import { usePulse } from '@/context/PulseContext';
import { useToast } from '@/lib/pulse/toast';
import { EQUIPMENT_LABELS } from '@/lib/pulse/constants';
import type { EquipmentKey, EquipmentProfile } from '@/lib/pulse/types';
import EquipmentSelector from './EquipmentSelector';

const SUGGESTED_NAMES = ['Home', 'Gym', 'Travel'] as const;

function summary(equipment: EquipmentKey[]): string {
    if (equipment.length === 0) return 'No equipment';
    return equipment.map((e) => EQUIPMENT_LABELS[e]).join(', ');
}

// Standing manager for equipment profiles, rendered in ProfileView's Training
// preferences group. Create / edit (atomic) / delete / set-active. Generation
// does not consume these yet (Branch B).
export default function EquipmentProfilesEditor() {
    const {
        equipmentProfiles,
        profile,
        createEquipmentProfile,
        updateEquipmentProfile,
        deleteEquipmentProfile,
        setActiveEquipmentProfile,
    } = usePulse();
    const toast = useToast();

    // null = closed; 'new' = create form; an id = editing that row.
    const [editing, setEditing] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [equipment, setEquipment] = useState<Set<EquipmentKey>>(new Set());
    const [busy, setBusy] = useState(false);
    // Local inline error so the message is visible in this component's DOM tree
    // without requiring a ToastContainer ancestor.
    const [inlineError, setInlineError] = useState<string | null>(null);

    const activeId = profile.active_equipment_profile_id;

    function openCreate() {
        setEditing('new');
        setName('');
        setEquipment(new Set());
        setInlineError(null);
    }

    function openEdit(p: EquipmentProfile) {
        setEditing(p.id);
        setName(p.name);
        setEquipment(new Set(p.equipment));
        setInlineError(null);
    }

    function close() {
        setEditing(null);
        setName('');
        setEquipment(new Set());
        setInlineError(null);
    }

    function toggle(key: EquipmentKey) {
        setEquipment((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }

    const canSave = name.trim().length > 0 && equipment.size > 0 && !busy;

    async function save() {
        if (!canSave) return;
        setBusy(true);
        setInlineError(null);
        try {
            const list = [...equipment];
            if (editing === 'new') await createEquipmentProfile(name, list);
            else if (editing) await updateEquipmentProfile(editing, name, list);
            close();
        } catch (e) {
            // Save errors (name taken, validation) show inline next to the form,
            // not as a transient toast. activate / remove have no open form, so
            // those still use a toast.
            setInlineError(e instanceof Error ? e.message : 'Could not save profile');
        } finally {
            setBusy(false);
        }
    }

    async function activate(id: string) {
        try {
            await setActiveEquipmentProfile(id);
        } catch {
            toast.show('Could not set active profile');
        }
    }

    async function remove(p: EquipmentProfile) {
        // Close the inline editor if it was open on the row being deleted, so the
        // form never lingers over a row that no longer exists.
        if (editing === p.id) close();
        try {
            await deleteEquipmentProfile(p.id);
        } catch {
            toast.show('Could not delete profile');
        }
    }

    return (
        <div data-testid="equipment-profiles-editor">
            <p className="mb-3 font-pulse text-[0.8125rem] text-pulse-dim">
                Save the gear you train with (Home, Gym, Travel) so you do not re-enter it each time you build a plan.
            </p>

            <div className="flex flex-col gap-2">
                {equipmentProfiles.map((p) => {
                    const isActive = p.id === activeId;
                    return (
                        <div key={p.id} className="rounded-xl bg-pulse-surface-2 p-3">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex min-w-0 flex-col">
                                    <span className="flex items-center gap-2 font-pulse-body text-sm text-pulse-text">
                                        {p.name}
                                        {isActive && (
                                            <span className="rounded-full bg-pulse-accent/15 px-2 py-0.5 font-pulse text-[0.625rem] uppercase tracking-wide text-pulse-accent">
                                                Active
                                            </span>
                                        )}
                                    </span>
                                    <span className="truncate font-pulse text-[0.75rem] text-pulse-dim">
                                        {summary(p.equipment)}
                                    </span>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                    {!isActive && (
                                        <button
                                            type="button"
                                            onClick={() => activate(p.id)}
                                            className="font-pulse text-[0.75rem] text-pulse-accent">
                                            Set active
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => openEdit(p)}
                                        className="font-pulse text-[0.75rem] text-pulse-dim">
                                        Edit
                                    </button>
                                    <button
                                        type="button"
                                        aria-label={`Delete ${p.name}`}
                                        onClick={() => remove(p)}
                                        className="font-pulse text-[0.75rem] text-pulse-dim">
                                        Delete
                                    </button>
                                </div>
                            </div>

                            {editing === p.id && (
                                <EditForm
                                    name={name}
                                    setName={setName}
                                    equipment={equipment}
                                    toggle={toggle}
                                    canSave={canSave}
                                    busy={busy}
                                    inlineError={inlineError}
                                    onSave={save}
                                    onCancel={close}
                                />
                            )}
                        </div>
                    );
                })}
            </div>

            {editing === 'new' ? (
                <div className="mt-2 rounded-xl bg-pulse-surface-2 p-3">
                    <EditForm
                        name={name}
                        setName={setName}
                        equipment={equipment}
                        toggle={toggle}
                        canSave={canSave}
                        busy={busy}
                        inlineError={inlineError}
                        onSave={save}
                        onCancel={close}
                        showSuggestions
                    />
                </div>
            ) : (
                <button
                    type="button"
                    onClick={openCreate}
                    className="mt-2 w-full rounded-xl border border-dashed border-pulse-border p-3 font-pulse-body text-sm text-pulse-dim">
                    New profile
                </button>
            )}
        </div>
    );
}

function EditForm({
    name,
    setName,
    equipment,
    toggle,
    canSave,
    busy,
    inlineError,
    onSave,
    onCancel,
    showSuggestions = false,
}: {
    name: string;
    setName: (v: string) => void;
    equipment: Set<EquipmentKey>;
    toggle: (key: EquipmentKey) => void;
    canSave: boolean;
    busy: boolean;
    inlineError: string | null;
    onSave: () => void;
    onCancel: () => void;
    showSuggestions?: boolean;
}) {
    return (
        <div className="mt-3 flex flex-col gap-3">
            <input
                type="text"
                value={name}
                maxLength={40}
                onChange={(e) => setName(e.target.value)}
                placeholder="Profile name"
                className="rounded-lg bg-pulse-bg px-3 py-2 font-pulse-body text-sm text-pulse-text outline-none ring-1 ring-pulse-border focus:ring-pulse-accent"
            />
            {showSuggestions && (
                <div className="flex flex-wrap gap-2">
                    {SUGGESTED_NAMES.map((s) => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => setName(s)}
                            className="rounded-full bg-pulse-bg px-3 py-1 font-pulse text-[0.75rem] text-pulse-dim ring-1 ring-pulse-border">
                            {s}
                        </button>
                    ))}
                </div>
            )}
            <EquipmentSelector selected={equipment} onToggle={toggle} disabled={busy} />
            {inlineError && (
                <p role="alert" className="font-pulse text-[0.8125rem] text-pulse-error">
                    {inlineError}
                </p>
            )}
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    disabled={!canSave}
                    onClick={onSave}
                    className={`rounded-lg px-4 py-2 font-pulse-body text-sm ${canSave ? 'bg-pulse-accent text-pulse-bg' : 'cursor-not-allowed bg-pulse-surface text-pulse-muted'}`}>
                    Save
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    className="rounded-lg px-4 py-2 font-pulse-body text-sm text-pulse-dim">
                    Cancel
                </button>
            </div>
        </div>
    );
}
