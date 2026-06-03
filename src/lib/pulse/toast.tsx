'use client';
import { createContext, useContext, useReducer, useCallback } from 'react';
import type { ReactNode } from 'react';

export type ToastVariant = 'error' | 'success' | 'info';

export interface Toast {
    id: string;
    message: string;
    variant: ToastVariant;
}

type Action = { type: 'ADD'; toast: Toast } | { type: 'REMOVE'; id: string };

function reducer(state: Toast[], action: Action): Toast[] {
    switch (action.type) {
        case 'ADD': {
            const capped = state.length >= 3 ? state.slice(1) : state;
            return [...capped, action.toast];
        }
        case 'REMOVE':
            return state.filter((t) => t.id !== action.id);
        default:
            return state;
    }
}

interface ToastContextValue {
    toasts: Toast[];
    show: (message: string, variant?: ToastVariant) => void;
    dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, dispatch] = useReducer(reducer, []);

    const show = useCallback((message: string, variant: ToastVariant = 'info') => {
        const id = Math.random().toString(36).slice(2, 10);
        dispatch({ type: 'ADD', toast: { id, message, variant } });
    }, []);

    const dismiss = useCallback((id: string) => {
        dispatch({ type: 'REMOVE', id });
    }, []);

    return <ToastContext.Provider value={{ toasts, show, dismiss }}>{children}</ToastContext.Provider>;
}

export function useToast(): ToastContextValue {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used inside ToastProvider');
    return ctx;
}
