import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import PendingSyncBadge from '../PendingSyncBadge';

vi.mock('@/hooks/pulse/useOnline', () => ({
    useOnline: vi.fn(),
}));
vi.mock('@/hooks/pulse/usePendingSyncCount', () => ({
    usePendingSyncCount: vi.fn(),
}));

import { useOnline } from '@/hooks/pulse/useOnline';
import { usePendingSyncCount } from '@/hooks/pulse/usePendingSyncCount';

const mockOnline = vi.mocked(useOnline);
const mockCount = vi.mocked(usePendingSyncCount);

describe('PendingSyncBadge', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders nothing when online and count is 0', () => {
        mockOnline.mockReturnValue(true);
        mockCount.mockReturnValue(0);
        const { container } = render(<PendingSyncBadge />);
        expect(container).toBeEmptyDOMElement();
    });

    it('shows pluralized pending count when there are queued changes', () => {
        mockOnline.mockReturnValue(true);
        mockCount.mockReturnValue(2);
        render(<PendingSyncBadge />);
        expect(screen.getByText('2 changes pending sync')).toBeInTheDocument();
    });

    it('shows the offline message when offline with no queued changes', () => {
        mockOnline.mockReturnValue(false);
        mockCount.mockReturnValue(0);
        render(<PendingSyncBadge />);
        expect(screen.getByText('Offline — changes save locally')).toBeInTheDocument();
    });
});
