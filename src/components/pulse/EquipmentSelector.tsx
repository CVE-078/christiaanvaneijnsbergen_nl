import { EQUIPMENT_KEYS } from '@/lib/pulse/types';
import type { EquipmentKey } from '@/lib/pulse/types';
import { EQUIPMENT_LABELS } from '@/lib/pulse/constants';

interface Props {
    selected: Set<EquipmentKey>;
    onToggle: (key: EquipmentKey) => void;
    disabled?: boolean;
}

// The six-checkbox equipment picker. Shared by the Profile equipment-profile
// manager (Branch A) and the routine setup flow (Branch B) so both render the
// identical control. Stateless: the caller owns the selection.
export default function EquipmentSelector({ selected, onToggle, disabled = false }: Props) {
    return (
        <div className="flex flex-col gap-2">
            {EQUIPMENT_KEYS.map((key) => {
                const active = selected.has(key);
                return (
                    <button
                        key={key}
                        type="button"
                        aria-pressed={active}
                        disabled={disabled}
                        onClick={() => onToggle(key)}
                        className={`flex items-center gap-3 rounded-xl p-3 text-left transition-colors ${
                            active ? 'bg-pulse-accent/10 ring-1 ring-pulse-accent' : 'bg-pulse-surface-2 ring-0'
                        } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}>
                        <div
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 ${active ? 'border-pulse-accent bg-pulse-accent' : 'border-pulse-muted'}`}>
                            {active && <span className="text-[10px] font-bold leading-none text-pulse-bg">✓</span>}
                        </div>
                        <span className="font-pulse-body text-sm text-pulse-text">{EQUIPMENT_LABELS[key]}</span>
                    </button>
                );
            })}
        </div>
    );
}
