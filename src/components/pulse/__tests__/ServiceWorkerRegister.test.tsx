import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import ServiceWorkerRegister from '../ServiceWorkerRegister';

describe('ServiceWorkerRegister', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders nothing', () => {
        const { container } = render(<ServiceWorkerRegister />);
        expect(container.firstChild).toBeNull();
    });

    it('does not register the service worker in the test environment', () => {
        const register = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'serviceWorker', {
            configurable: true,
            value: { register },
        });

        render(<ServiceWorkerRegister />);

        expect(register).not.toHaveBeenCalled();

        // @ts-expect-error cleanup of the test-only stub
        delete (navigator as Navigator & { serviceWorker?: unknown }).serviceWorker;
    });
});
