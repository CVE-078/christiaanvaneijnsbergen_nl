import TabButton from '@/components/pulse/TabButton';

interface SegmentedTabsProps {
    tabs: { id: string; label: string }[];
    active: string;
    onChange: (id: string) => void;
    ariaLabel: string;
    variant?: 'soft' | 'solid';
}

export default function SegmentedTabs({ tabs, active, onChange, ariaLabel, variant = 'soft' }: SegmentedTabsProps) {
    return (
        <div
            role="tablist"
            aria-label={ariaLabel}
            className="flex gap-1 bg-pulse-surface rounded-xl p-1">
            {tabs.map((tab) => (
                <TabButton
                    key={tab.id}
                    id={`tab-${tab.id}`}
                    controls={`panel-${tab.id}`}
                    active={tab.id === active}
                    onClick={() => onChange(tab.id)}
                    variant={variant}
                    className="flex-1 justify-center rounded-[9px] py-2 text-xs font-medium lg:text-sm">
                    {tab.label}
                </TabButton>
            ))}
        </div>
    );
}
