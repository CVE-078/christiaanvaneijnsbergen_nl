# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A personal portfolio site for Christiaan van Eijnsbergen, a front-end developer based in the Netherlands. Static marketing page (hero, about, experience, footer), Poppins font, light theme.

## Commands

Package manager is **bun** (`bun.lock` is the source of truth). Scripts run the same under `npm run`.

- `bun run dev`, start the Next.js dev server (http://localhost:3000)
- `bun run build`, production build
- `bun run lint`, ESLint (`next/core-web-vitals`)
- `bun run typecheck`, `tsc --noEmit`
- `bun run format` / `format:check`, Prettier over `src/**/*.{ts,tsx}`

## Tech stack

Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4.

Path alias: `@/*` → `src/*` (configured in both `tsconfig.json` and `vitest.config.mjs`).

## Structure

- `src/app/page.tsx` composes the page from `src/components/*` (hero, about, experience, header, footer, navigation, logo, hamburger).
- `src/app/layout.tsx` sets the Poppins font, metadata, and Vercel Analytics.
- `src/lib/` holds `experience.tsx` (the experience/stack data) and `origin.ts` (request-origin helper).
- `src/utils/index.ts` holds shared helpers (e.g. `scrollToElement`).
- Theme tokens are defined inline via `@theme` in `src/app/globals.css` (no `tailwind.config`); `prettier-plugin-tailwindcss` sorts classes.

## Styling

Tailwind v4 with theme tokens in `@theme` (`globals.css`). Colors: `primary`, `secondary`, `gray-dark`, `gray`. Use these tokens rather than hardcoded hex.

## Writing style

Clear, simple, direct. No em dashes anywhere (rework with a comma, period, semicolon, or parentheses).
