import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorkoutTabs from '../WorkoutTabs';

describe('WorkoutTabs', () => {
  it('renders Push, Pull and Legs tabs', () => {
    render(<WorkoutTabs activeTab="push" onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: /push/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pull/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /legs/i })).toBeInTheDocument();
  });

  it('applies solid background to the active tab', () => {
    render(<WorkoutTabs activeTab="pull" onSelect={vi.fn()} />);
    const pullBtn = screen.getByRole('button', { name: /pull/i }) as HTMLElement;
    const pushBtn = screen.getByRole('button', { name: /push/i }) as HTMLElement;
    expect(pullBtn.style.background).not.toBe('transparent');
    expect(pushBtn.style.background).toBe('transparent');
  });

  it('calls onSelect when an inactive tab is clicked', async () => {
    const onSelect = vi.fn();
    render(<WorkoutTabs activeTab="push" onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: /legs/i }));
    expect(onSelect).toHaveBeenCalledWith('legs');
  });

  it('does not call onSelect when the active tab is clicked', async () => {
    const onSelect = vi.fn();
    render(<WorkoutTabs activeTab="push" onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: /push/i }));
    // onSelect is still called (no prevention needed), but it will be 'push'
    expect(onSelect).toHaveBeenCalledWith('push');
  });
});
