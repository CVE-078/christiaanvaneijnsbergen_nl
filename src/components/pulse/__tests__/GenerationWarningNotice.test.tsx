import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GenerationWarningNotice from '../GenerationWarningNotice';

describe('GenerationWarningNotice', () => {
    beforeEach(() => localStorage.clear());

    it('renders nothing when there are no warnings', () => {
        const { container } = render(<GenerationWarningNotice routineId="r1" warnings={[]} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('renders the WARNING_COPY for a known key', () => {
        render(<GenerationWarningNotice routineId="r1" warnings={['no_compound']} />);
        expect(screen.getByText('Accessory work only')).toBeInTheDocument();
    });

    it('hides a warning after it is dismissed', () => {
        render(<GenerationWarningNotice routineId="r1" warnings={['no_compound']} />);
        fireEvent.click(screen.getByLabelText('Dismiss'));
        expect(screen.queryByText('Accessory work only')).not.toBeInTheDocument();
    });

    it('falls back to a generic notice for an unknown key', () => {
        render(<GenerationWarningNotice routineId="r1" warnings={['something_new']} />);
        expect(screen.getByText('Heads-up')).toBeInTheDocument();
    });
});
