import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MetricHistoryModal from '@/components/pulse/MetricHistoryModal';

describe('MetricHistoryModal', () => {
    it('renders title and month-grouped entries when open', () => {
        render(
            <MetricHistoryModal
                open
                title="Body weight"
                unit="kg"
                onClose={() => {}}
                entries={[
                    { date: '2026-06-11', value: 80.2 },
                    { date: '2026-05-04', value: 82.0 },
                ]}
            />,
        );
        expect(screen.getByText('Body weight')).toBeInTheDocument();
        expect(screen.getByText('June 2026')).toBeInTheDocument();
        expect(screen.getByText('May 2026')).toBeInTheDocument();
    });

    it('renders nothing when closed', () => {
        const { container } = render(
            <MetricHistoryModal open={false} title="x" unit="kg" entries={[]} onClose={() => {}} />,
        );
        expect(container).toBeEmptyDOMElement();
    });
});
