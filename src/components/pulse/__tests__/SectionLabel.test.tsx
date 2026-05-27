import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SectionLabel from '../SectionLabel';

describe('SectionLabel', () => {
    it('renders children as text content', () => {
        render(<SectionLabel>Weekly Volume</SectionLabel>);
        expect(screen.getByText('Weekly Volume')).toBeInTheDocument();
    });

    it('applies font-pulse class', () => {
        render(<SectionLabel>Test</SectionLabel>);
        expect(screen.getByText('Test').className).toContain('font-pulse');
    });

    it('applies uppercase class', () => {
        render(<SectionLabel>Test</SectionLabel>);
        expect(screen.getByText('Test').className).toContain('uppercase');
    });

    it('applies text-pulse-muted class', () => {
        render(<SectionLabel>Test</SectionLabel>);
        expect(screen.getByText('Test').className).toContain('text-pulse-muted');
    });

    it('merges additional className', () => {
        render(<SectionLabel className="mb-2">Test</SectionLabel>);
        expect(screen.getByText('Test').className).toContain('mb-2');
    });
});
