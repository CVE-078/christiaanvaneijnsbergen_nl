import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SessionsCalendar from '../SessionsCalendar';

describe('SessionsCalendar', () => {
    it('marks session days and fires onSelectDay', () => {
        const onSelect = vi.fn();
        render(
            <SessionsCalendar
                year={2026}
                month={5}
                sessions={[
                    {
                        id: 's1',
                        completed_at: '2026-06-09T19:30:00Z',
                        started_at: '2026-06-09T18:45:00Z',
                    } as any,
                ]}
                tz="Europe/Amsterdam"
                onSelectDay={onSelect}
            />,
        );
        // Day "9" should be rendered and clickable
        fireEvent.click(screen.getByText('9'));
        expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 's1' }));
    });
});
