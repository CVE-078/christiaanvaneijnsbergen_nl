import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RecoveryTile from '../RecoveryTile';

describe('RecoveryTile', () => {
    it('renders the word, detail, and Recovery label', () => {
        render(
            <RecoveryTile
                readout={{ tone: 'watch', word: 'Watch', detail: 'back · legs', muscles: ['back', 'legs'] }}
            />,
        );
        expect(screen.getByText('Watch')).toBeInTheDocument();
        expect(screen.getByText('back · legs')).toBeInTheDocument();
        expect(screen.getByText('Recovery')).toBeInTheDocument();
    });

    it('opens a state-aware why with the full recovery scale legend', async () => {
        render(<RecoveryTile readout={{ tone: 'ready', word: 'Ready', detail: 'room to build', muscles: [] }} />);
        const why = screen.getByRole('button', { name: /recovery: ready/i });
        expect(why).toHaveTextContent('Ready');
        await userEvent.click(why);
        // State-specific explanation, not the old generic blurb.
        expect(screen.getByText(/room to do more/i)).toBeInTheDocument();
        // The legend makes every state legible, including the inactive ones.
        expect(screen.getByText('Watch')).toBeInTheDocument();
        expect(screen.getByText('Ease off')).toBeInTheDocument();
    });

    it('names the muscles driving a Watch state in the why', async () => {
        render(
            <RecoveryTile
                readout={{ tone: 'watch', word: 'Watch', detail: 'chest · back', muscles: ['chest', 'back'] }}
            />,
        );
        await userEvent.click(screen.getByRole('button', { name: /recovery: watch/i }));
        expect(screen.getByText(/Chest and Back are getting heavy/i)).toBeInTheDocument();
    });
});
