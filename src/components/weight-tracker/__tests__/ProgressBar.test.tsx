import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import ProgressBar from '../ProgressBar';

function getSquares(container: HTMLElement) {
  const wrapper = container.firstElementChild as HTMLElement;
  return Array.from(wrapper.children) as HTMLElement[];
}

// JSDOM normalises hex colours to rgb(...) in getAttribute('style')
const UNFILLED_RGB = 'rgb(42, 42, 42)'; // #2a2a2a

describe('ProgressBar', () => {
  it('renders the correct total number of squares', () => {
    const { container } = render(<ProgressBar filled={2} total={5} color="#f00" />);
    expect(getSquares(container)).toHaveLength(5);
  });

  it('filled squares have a different background than unfilled squares', () => {
    const { container } = render(<ProgressBar filled={3} total={4} color="#ff0000" />);
    const squares = getSquares(container);
    const filledStyle = squares[0].getAttribute('style');
    const unfilledStyle = squares[3].getAttribute('style');
    expect(filledStyle).toContain('rgb(255, 0, 0)'); // #ff0000 → rgb(255,0,0)
    expect(unfilledStyle).toContain(UNFILLED_RGB);
  });

  it('shows all unfilled squares when filled is 0', () => {
    const { container } = render(<ProgressBar filled={0} total={4} color="#ff0000" />);
    getSquares(container).forEach(sq => {
      expect(sq.getAttribute('style')).toContain(UNFILLED_RGB);
    });
  });

  it('shows all filled squares when filled equals total', () => {
    const { container } = render(<ProgressBar filled={4} total={4} color="#ff0000" />);
    getSquares(container).forEach(sq => {
      expect(sq.getAttribute('style')).not.toContain(UNFILLED_RGB);
    });
  });
});
