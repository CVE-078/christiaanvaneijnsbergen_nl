import TabButton from '@/components/pulse/TabButton';

interface SegmentedTabsProps {
    tabs: { id: string; label: string }[];
    active: string;
    onChange: (id: string) => void;
    ariaLabel: string;
}

export default function SegmentedTabs({ tabs, active, onChange, ariaLabel }: SegmentedTabsProps) {
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
                    className="flex-1 justify-center rounded-lg py-2 text-sm font-semibold">
                    {tab.label}
                </TabButton>
            ))}
        </div>
    );
}
