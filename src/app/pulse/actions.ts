// Barrel of all Pulse server actions. Implementations live in ./actions/* split
// by domain; this file re-exports them so existing importers (`@/app/pulse/actions`)
// keep working unchanged. Each domain file carries its own 'use server' directive,
// so this barrel must NOT itself be a 'use server' file: Next forbids wildcard
// re-exports there (it can't verify every re-export is an async server action).
export * from './actions/profile';
export * from './actions/exercises';
export * from './actions/routines';
export * from './actions/notes';
export * from './actions/session';
export * from './actions/swaps';
export * from './actions/adjustments';
