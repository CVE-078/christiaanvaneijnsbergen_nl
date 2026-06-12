import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import RecoveryTile from '../RecoveryTile';

describe('RecoveryTile', () => {
    it('renders the word, detail, and Recovery label', () => {
        render(<RecoveryTile readout={{ tone: 'watch', word: 'Watch', detail: 'back · legs', muscles: ['back', 'legs'] }} />);
        expect(screen.getByText('Watch')).toBeInTheDocument();
        expect(screen.getByText('back · legs')).toBeInTheDocument();
        expect(screen.getByText('Recovery')).toBeInTheDocument();
    });
});
