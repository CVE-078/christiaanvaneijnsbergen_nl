'use client';
import { useState } from 'react';
import { toDisplay, toKg } from '@/lib/pulse/utils';
import { usePulse } from '@/context/PulseContext';
import SectionLabel from './SectionLabel';
import { INPUT, BTN_PRIMARY } from './ui';

export default function GoalWeightCard() {
    const { profile, bodyweightLogs, updateGoalWeight } = usePulse();
    const { unit } = profile;

    const [goalWeightInput, setGoalWeightInput] = useState('');

    return (
        <section className="border-t border-pulse-border pt-4">
            <SectionLabel className="mb-2">Goal Weight</SectionLabel>
            {profile.goal_weight_kg ? (
                <div className="flex items-center gap-3">
                    <span className="font-pulse text-lg font-medium text-pulse-text tracking-[-0.005em]">
                        {unit === 'lbs'
                            ? `${toDisplay(profile.goal_weight_kg, 'lbs').toFixed(1)} lbs`
                            : `${profile.goal_weight_kg} kg`}
                    </span>
                    {bodyweightLogs[0] && (
                        <span
                            className={`font-pulse text-xs ${
                                bodyweightLogs[0].weight_kg <= profile.goal_weight_kg
                                    ? 'text-pulse-success'
                                    : 'text-pulse-dim'
                            }`}>
                            {toDisplay(Math.abs(bodyweightLogs[0].weight_kg - profile.goal_weight_kg), unit).toFixed(1)}{' '}
                            {unit} to go
                        </span>
                    )}
                    <button
                        onClick={() => void updateGoalWeight(null)}
                        className="font-pulse text-xs text-pulse-dim cursor-pointer bg-transparent border-none">
                        Clear
                    </button>
                </div>
            ) : (
                <div className="flex gap-2">
                    <input
                        type="number"
                        placeholder={`Goal (${unit})`}
                        value={goalWeightInput}
                        onChange={(e) => setGoalWeightInput(e.target.value)}
                        className={INPUT}
                        step="0.1"
                    />
                    <button
                        onClick={() => {
                            const val = parseFloat(goalWeightInput);
                            if (!isNaN(val)) void updateGoalWeight(toKg(val, unit));
                        }}
                        className={BTN_PRIMARY}>
                        Set
                    </button>
                </div>
            )}
        </section>
    );
}
