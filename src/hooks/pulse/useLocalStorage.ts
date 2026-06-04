import { useState, useEffect, useRef } from 'react';

export function useLocalStorage<T>(key: string, defaultValue: T): [T, (value: T) => void] {
    const [value, setValue] = useState<T>(defaultValue);
    const hydrated = useRef(false);

    useEffect(() => {
        try {
            const stored = localStorage.getItem(key);
            if (stored !== null) setValue(JSON.parse(stored) as T);
        } catch {
            // localStorage unavailable or invalid JSON, keep the default value.
        }
        // Read once on mount so the first client render matches the server render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        // Skip the mount run so we never overwrite the stored value with the
        // default before the read-effect above has hydrated it.
        if (!hydrated.current) {
            hydrated.current = true;
            return;
        }
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch {
            // localStorage unavailable (private browsing quota exceeded, etc.)
        }
    }, [key, value]);

    return [value, setValue];
}
