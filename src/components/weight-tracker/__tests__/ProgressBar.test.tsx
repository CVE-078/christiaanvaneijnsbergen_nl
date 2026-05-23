import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import ProgressBar from '../ProgressBar';

function getSpans(container: HTMLElement) {
  const wrapper = container.firstElementChild as HTMLElement;
  return Array.from(wrapper.children) as HTMLElement[];
}

// JSDOM normalises hex colours to rgb(...)
const UNFILLED_RGB = 'rgb(58, 58, 58)'; // #3a3a3a

describe('ProgressBar', () => {
  it('renders the correct total number of spans', () => {
    const { container } = render(<ProgressBar filled={2} total={5} color="#ff6c2f" />);
    expect(getSpans(container)).toHaveLength(5);
  });

  it('filled spans have accent color; unfilled have muted color', () => {
    const { container } = render(<ProgressBar filled={3} total={4} color="#ff6c2f" />);
    const spans = getSpans(container);
    expect(spans[0].style.color).toBe('rgb(255, 108, 47)'); // #ff6c2f
    expect(spans[3].style.color).toBe(UNFILLED_RGB);
  });

  it('shows all unfilled when filled is 0', () => {
    const { container } = render(<ProgressBar filled={0} total={4} color="#ff6c2f" />);
    getSpans(container).forEach(s => {
      expect(s.style.color).toBe(UNFILLED_RGB);
    });
  });

  it('shows all filled when filled equals total', () => {
    const { container } = render(<ProgressBar filled={4} total={4} color="#ff6c2f" />);
    getSpans(container).forEach(s => {
      expect(s.style.color).not.toBe(UNFILLED_RGB);
    });
  });

  it('filled spans show █ and unfilled show ░', () => {
    const { container } = render(<ProgressBar filled={2} total={4} color="#ff6c2f" />);
    const spans = getSpans(container);
    expect(spans[0].textContent).toBe('█');
    expect(spans[2].textContent).toBe('░');
  });
});
