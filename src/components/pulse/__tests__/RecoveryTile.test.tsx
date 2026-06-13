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

    it('makes the recovery word a tappable why', async () => {
        render(<RecoveryTile readout={{ tone: 'ready', word: 'Ready', detail: 'all fresh', muscles: [] }} />);
        const why = screen.getByRole('button', { name: /^recovery$/i });
        expect(why).toHaveTextContent('Ready');
        await userEvent.click(why);
        expect(screen.getByText(/based on how hard and how recently you trained each muscle/i)).toBeInTheDocument();
    });
});
