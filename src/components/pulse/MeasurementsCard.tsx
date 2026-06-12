'use client';
import { useState } from 'react';
import { toLengthDisplay, toCm } from '@/lib/pulse/utils';
import { usePulse } from '@/context/PulseContext';
import SectionLabel from './SectionLabel';
import { INPUT, BTN_PRIMARY } from './ui';
import { logBodyMeasurement } from '@/app/pulse/actions';
import type { LengthUnit } from '@/lib/pulse/types';

export default function MeasurementsCard() {
    const { profile, bodyMeasurements, refreshMeasurements, updateLengthUnit } = usePulse();
    const { length_unit: lengthUnit } = profile;

    const today = new Date().toISOString().split('T')[0];

    const [showMeasurements, setShowMeasurements] = useState(false);
    const [measurements, setMeasurements] = useState({ waist: '', hips: '', chest: '', arms: '' });
    const [measureDate, setMeasureDate] = useState<string>(today);

    const latestMeasurement = bodyMeasurements[0];

    const waistPoints = bodyMeasurements.filter((m) => m.waist_cm != null);
    const waistTrend =
        waistPoints.length >= 2 ? (waistPoints[0].waist_cm as number) - (waistPoints[1].waist_cm as number) : null;

    function fmtMeasure(value_cm: number | null | undefined): string {
        if (value_cm == null) return '—';
        return `${toLengthDisplay(value_cm, lengthUnit)} ${lengthUnit}`;
    }

    function handleLengthUnitChange(newUnit: LengthUnit) {
        if (newUnit === lengthUnit) return;
        void updateLengthUnit(newUnit);
    }

    return (
        <section className="border-t border-pulse-border pt-4">
            <div className="flex justify-between items-center mb-3 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <SectionLabel>Measurements</SectionLabel>
                    {waistTrend != null && (
                        <span
                            className={`font-pulse text-[0.6875rem] font-medium tabular-nums rounded px-2 py-0.5 bg-pulse-surface-2 shrink-0 ${
                                waistTrend < 0 ? 'text-pulse-success' : 'text-pulse-dim'
                            }`}>
                            {waistTrend < 0 ? '↓' : '↑'} {toLengthDisplay(Math.abs(waistTrend), lengthUnit)}{' '}
                            {lengthUnit} waist
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <div
                        className="inline-flex bg-pulse-surface-2 rounded-lg p-0.5 gap-0.5"
                        role="group"
                        aria-label="Measurement unit">
                        {(['cm', 'in'] as const).map((u) => (
                            <button
                                key={u}
                                onClick={() => handleLengthUnitChange(u)}
                                aria-pressed={lengthUnit === u}
                                className={`font-pulse text-[0.6875rem] font-semibold tracking-[0.04em] uppercase py-1 px-2.5 rounded-md cursor-pointer border-none ${lengthUnit === u ? 'bg-pulse-accent text-pulse-bg' : 'bg-transparent text-pulse-dim'}`}>
                                {u}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => setShowMeasurements(!showMeasurements)}
                        className="font-pulse text-xs text-pulse-accent cursor-pointer bg-transparent border-none">
                        {showMeasurements ? 'Cancel' : '+ Log'}
                    </button>
                </div>
            </div>

            {/* Latest measurement readout */}
            <div className="grid grid-cols-4 gap-2">
                {(['waist', 'hips', 'chest', 'arms'] as const).map((field) => (
                    <div key={field} className="bg-pulse-bg rounded-xl py-2.5 px-1.5 text-center">
                        <div className="font-pulse text-[0.625rem] text-pulse-muted capitalize">{field}</div>
                        <div className="font-pulse text-sm font-medium text-pulse-text mt-0.5 tabular-nums">
                            {fmtMeasure(latestMeasurement?.[`${field}_cm`])}
                        </div>
                    </div>
                ))}
            </div>

            {showMeasurements && (
                <div className="flex flex-col gap-2 mt-2">
                    <input
                        type="date"
                        max={today}
                        value={measureDate}
                        onChange={(e) => setMeasureDate(e.target.value)}
                        className={INPUT}
                    />
                    {(['waist', 'hips', 'chest', 'arms'] as const).map((field) => (
                        <div key={field} className="flex items-center gap-2">
                            <label className="font-pulse text-xs text-pulse-dim w-12 capitalize">{field}</label>
                            <input
                                type="number"
                                step="0.1"
                                placeholder={lengthUnit}
                                aria-label={`${field} in ${lengthUnit}`}
                                value={measurements[field]}
                                onChange={(e) => setMeasurements((prev) => ({ ...prev, [field]: e.target.value }))}
                                className={INPUT + ' flex-1'}
                            />
                        </div>
                    ))}
                    <button
                        onClick={async () => {
                            await logBodyMeasurement({
                                measured_at: measureDate,
                                waist_cm: measurements.waist
                                    ? toCm(Number(measurements.waist), lengthUnit)
                                    : undefined,
                                hips_cm: measurements.hips ? toCm(Number(measurements.hips), lengthUnit) : undefined,
                                chest_cm: measurements.chest
                                    ? toCm(Number(measurements.chest), lengthUnit)
                                    : undefined,
                                arms_cm: measurements.arms ? toCm(Number(measurements.arms), lengthUnit) : undefined,
                            });
                            refreshMeasurements();
                            setShowMeasurements(false);
                            setMeasurements({ waist: '', hips: '', chest: '', arms: '' });
                            setMeasureDate(today);
                        }}
                        className={BTN_PRIMARY}>
                        Save
                    </button>
                </div>
            )}
        </section>
    );
}
