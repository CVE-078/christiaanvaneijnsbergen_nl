'use client';
import { useMemo, useState } from 'react';
import { computePlates, toDisplay } from '@/lib/pulse/utils';
import { BARBELL_KG, DUMBBELL_HANDLE_KG } from '@/lib/pulse/constants';
import type { PlateEquipment } from '@/lib/pulse/utils';
import type { Unit } from '@/lib/pulse/types';

interface Props {
    targetKg: number;
    unit: Unit;
}

const EQUIPMENT: ReadonlyArray<{ value: PlateEquipment; label: string }> = [
    { value: 'barbell', label: 'Barbell' },
    { value: 'dumbbell', label: 'Dumbbell' },
];

export default function PlateCalculator({ targetKg, unit }: Props) {
    const [equipment, setEquipment] = useState<PlateEquipment>('barbell');
    const result = useMemo(() => computePlates(targetKg, equipment), [targetKg, equipment]);
    const baseKg = equipment === 'barbell' ? BARBELL_KG : DUMBBELL_HANDLE_KG;
    const baseLabel = equipment === 'barbell' ? 'bar' : 'handle';

    return (
        <div className="mt-1 flex flex-col gap-2.5 rounded-[11px] bg-pulse-surface-2 px-3.5 py-3">
            <div className="flex items-center gap-1" role="group" aria-label="Equipment">
                {EQUIPMENT.map(({ value, label }) => {
                    const active = equipment === value;
                    return (
                        <button
                            key={value}
                            type="button"
                            aria-pressed={active}
                            onClick={() => setEquipment(value)}
                            className={`font-pulse text-[0.6875rem] font-semibold tracking-[0.06em] uppercase rounded-md px-2.5 py-1 cursor-pointer border-none transition-colors ${
                                active
                                    ? 'bg-pulse-accent text-pulse-bg'
                                    : 'bg-transparent text-pulse-dim shadow-[inset_0_0_0_1px_var(--color-pulse-border)]'
                            }`}>
                            {label}
                        </button>
                    );
                })}
            </div>

            {result.perSide.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                    <span className="font-pulse text-[0.625rem] tracking-[0.1em] uppercase text-pulse-muted">
                        Per side
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                        {result.perSide.map((plate, i) => (
                            <span
                                key={`${plate}-${i}`}
                                className="font-pulse text-[0.75rem] text-pulse-dim rounded-md px-2 py-1 tracking-[0.03em] shadow-[inset_0_0_0_1px_var(--color-pulse-border)]">
                                {toDisplay(plate, unit)} {unit}
                            </span>
                        ))}
                    </div>
                </div>
            ) : (
                <span className="font-pulse text-[0.75rem] text-pulse-dim">
                    Below the empty {baseLabel} ({toDisplay(baseKg, unit)} {unit}).
                </span>
            )}

            {result.perSide.length > 0 && !result.achievable && (
                <span className="font-pulse text-[0.6875rem] text-pulse-muted">
                    + {toDisplay(result.remainderKg, unit)} {unit} per side not loadable
                </span>
            )}
        </div>
    );
}
