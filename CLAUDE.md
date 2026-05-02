# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
bun dev               # Start dev server (preferred over npm)
bun run build         # Production build
bun run build:dev     # Dev build (unminified)
bun run preview       # Preview production build locally

# Code quality
bun run lint          # ESLint (TS + React hooks + Prettier)
bun run format        # Prettier (100-char width, trailing commas, double quotes)
```

Use `bun` as the package manager — the lockfile is `bun.lockb`.

## Architecture Overview

**Schedora** is an appointment booking SaaS built with TanStack React Start (SSR) + Supabase.

### Tech Stack

- **Framework**: TanStack React Start + TanStack Router v1 (file-based routing)
- **Frontend**: React 19 + TypeScript 5, Tailwind CSS v4, shadcn/ui (Radix UI)
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions + RLS)
- **State/Data**: TanStack Query v5 (React Query)
- **Forms**: React Hook Form + Zod
- **Build**: Vite 7 via `@lovable.dev/vite-tanstack-config` preset (handles Cloudflare, React, Tailwind)

### Code Organization

```
src/
├── routes/                 # File-based routing ($ = dynamic segment)
│   ├── __root.tsx          # Root layout: AuthProvider + Toaster
│   ├── index.tsx           # Landing page
│   ├── auth/               # Auth flows for provider and customer
│   ├── provider.tsx        # Provider's business list
│   ├── admins.$adminId.tsx # Main provider dashboard (8 tabs)
│   ├── book.$serviceId.tsx # Customer booking flow
│   ├── pay.$bookingId.tsx  # Payment/confirmation
│   ├── businesses.*.tsx    # Browse/view businesses
│   └── api/booking.$bookingId.ts  # Server-side API endpoint
├── components/
│   ├── ui/                 # shadcn/ui components (do not modify manually)
│   └── admin/              # Provider dashboard components
├── lib/
│   ├── auth-context.tsx    # Global auth state (user, role, businessId, customerProfile)
│   ├── slots.ts            # Slot generation & availability logic
│   └── format.ts           # Date/time formatting utilities
├── integrations/supabase/
│   ├── client.ts           # Client-side Supabase (lazy-loaded proxy)
│   ├── client.server.ts    # Server-side admin client (bypasses RLS)
│   └── types.ts            # Auto-generated DB types — do not edit
supabase/
├── functions/              # Edge Functions (booking confirmation emails + ICS)
└── migrations/             # Schema migrations
```

### Two User Roles

- **Provider**: Manages businesses, services, staff, hours, bookings, invoices, metrics
- **Customer**: Browses businesses, books appointments, views profile/bookings

Role is stored in `user_roles` table and surfaced via `lib/auth-context.tsx`. Route guards check `role === "provider"` and `businessId` from context.

### Supabase Client Split

- `integrations/supabase/client.ts` — browser client, respects RLS, use in components/routes
- `integrations/supabase/client.server.ts` — admin client with service role key, use only in `src/routes/api/` server routes

### Key Patterns

- **RLS-first**: Authorization enforced at the database level via Row-Level Security policies
- **Zod for URL params**: Search params validated with `z.enum(...)` (see auth routes for example)
- **shadcn/ui**: Components in `src/components/ui/` are generated — extend by adding new files, not editing generated ones
- **`supabase/migrations/`**: Schema changes go here; `types.ts` is regenerated from schema
- **Provider dashboard tabs**: `admins.$adminId.tsx` hosts all 8 tabs (bookings, services, staff, store hours, time blocks, metrics, invoices) using TanStack Tabs
- **Edge Function** `booking-confirmation`: Triggers post-booking to generate invoice, send email, and attach ICS calendar invite

### Path Alias

`@/*` resolves to `./src/*` (configured in `tsconfig.json` and Vite).
