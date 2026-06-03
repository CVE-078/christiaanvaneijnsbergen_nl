import { useState, useEffect } from 'react';

// Read the match synchronously when running in the browser so the first client
// render already reflects the real viewport. This avoids a false-to-true flip
// that would remount the shell on desktop load. SSR has no window, so it falls
// back to defaultValue (false = mobile-first).
export function useMediaQuery(query: string, defaultValue = false): boolean {
    const [matches, setMatches] = useState<boolean>(() => {
        if (typeof window === 'undefined') return defaultValue;
        return window.matchMedia(query).matches;
    });

    useEffect(() => {
        const mql = window.matchMedia(query);
        setMatches(mql.matches);
        const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
        mql.addEventListener('change', handler);
        return () => mql.removeEventListener('change', handler);
    }, [query]);

    return matches;
}
