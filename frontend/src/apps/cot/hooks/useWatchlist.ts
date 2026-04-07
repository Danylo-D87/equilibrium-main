import { useState, useCallback } from 'react';
import { DEFAULT_PINNED_CODES } from '../utils/pinnedMarkets';

const STORAGE_KEY = 'eq-watchlist-custom';

function loadCustomStars(): Set<string> {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return new Set();
        return new Set(JSON.parse(raw));
    } catch {
        return new Set();
    }
}

function saveCustomStars(stars: Set<string>) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...stars]));
}

/**
 * Manages a watchlist of pinned market codes.
 * Combines default pinned codes with user-added stars (persisted in localStorage).
 */
export function useWatchlist() {
    const [customStars, setCustomStars] = useState<Set<string>>(() => loadCustomStars());

    const isPinned = useCallback((code: string) => {
        return DEFAULT_PINNED_CODES.has(code) || customStars.has(code);
    }, [customStars]);

    const isCustomStar = useCallback((code: string) => {
        return customStars.has(code);
    }, [customStars]);

    const isDefaultPin = useCallback((code: string) => {
        return DEFAULT_PINNED_CODES.has(code);
    }, []);

    const toggleStar = useCallback((code: string) => {
        setCustomStars(prev => {
            const next = new Set(prev);
            if (next.has(code)) {
                next.delete(code);
            } else {
                next.add(code);
            }
            saveCustomStars(next);
            return next;
        });
    }, []);

    return { isPinned, isCustomStar, isDefaultPin, toggleStar };
}
