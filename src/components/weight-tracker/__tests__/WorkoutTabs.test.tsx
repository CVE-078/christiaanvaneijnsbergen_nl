import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorkoutTabs from '../WorkoutTabs';

describe('WorkoutTabs', () => {
  it('renders Push, Pull and Legs tabs', () => {
    render(<WorkoutTabs activeTab="push" onSelect={vi.fn()} />);
    expect(screen.getByRole('tab', { name: /push/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /pull/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /legs/i })).toBeInTheDocument();
  });

  it('marks the active tab with aria-selected="true" and others with false', () => {
    render(<WorkoutTabs activeTab="pull" onSelect={vi.fn()} />);
    expect(screen.getByRole('tab', { name: /pull/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /push/i })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: /legs/i })).toHaveAttribute('aria-selected', 'false');
  });

  it('calls onSelect when an inactive tab is clicked', async () => {
    const onSelect = vi.fn();
    render(<WorkoutTabs activeTab="push" onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('tab', { name: /legs/i }));
    expect(onSelect).toHaveBeenCalledWith('legs');
  });

  it('calls onSelect with active tab type when active tab is clicked', async () => {
    const onSelect = vi.fn();
    render(<WorkoutTabs activeTab="push" onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('tab', { name: /push/i }));
    expect(onSelect).toHaveBeenCalledWith('push');
  });

  it('navigates to the next tab on ArrowRight', async () => {
    const onSelect = vi.fn();
    render(<WorkoutTabs activeTab="push" onSelect={onSelect} />);
    screen.getByRole('tab', { name: /push/i }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onSelect).toHaveBeenCalledWith('pull');
  });

  it('wraps around to the last tab on ArrowLeft from the first', async () => {
    const onSelect = vi.fn();
    render(<WorkoutTabs activeTab="push" onSelect={onSelect} />);
    screen.getByRole('tab', { name: /push/i }).focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(onSelect).toHaveBeenCalledWith('legs');
  });
});
