# Schedora Demo Presentation Plan

Deliverable: a single downloadable `.pptx` saved to `/mnt/documents/Schedora_Demo.pptx`, generated with `pptxgenjs`, embedding real screenshots captured from the live preview.

## Deck structure (~22 slides)

**Section 1 — Title & agenda (2 slides)**
1. Title: "Schedora — Appointment Booking Platform" + tagline, gradient cover.
2. Agenda: Customer demo → Provider demo → New business setup → Architecture → Tech decisions.

**Section 2 — Customer flow (4 slides)**
3. Discover businesses (`/businesses`) — screenshot + callouts.
4. View business + pick service (`/businesses/{id}`) — screenshot.
5. Pick date/slot, complete profile, book (`/book/{serviceId}`) — screenshot.
6. Confirmation + My Reservations (`/pay/{bookingId}` → `/reservations`) — screenshot, note ICS email via edge fn.

**Section 3 — Provider flow (4 slides)**
7. Provider hub `/provider` (multi-business cards) — screenshot.
8. Admin dashboard tabs overview (`/admins/{id}`) — screenshot of Bookings tab.
9. Services / Staff / Hours / Time blocks — 2x2 thumbnails.
10. Metrics + Invoices tabs — screenshots, mention 18-month retention + pg_cron cleanup.

**Section 4 — New business setup flow (2 slides)**
11. `/provider/new` form — screenshot, mention `create_business_with_owner` RPC.
12. Store tab post-creation: name, description, logo upload to `business-images` bucket.

**Section 5 — Architecture (4 slides)**
13. System architecture diagram (rendered offline as PNG, embedded). Layers:
    - Client: React 19 + TanStack Router/Start (SSR) on Cloudflare Worker
    - Edge: server fns + `/api/*` routes + `booking-confirmation` edge fn
    - Data: Supabase Postgres (RLS), Auth, Storage, pg_cron, Resend
14. Request lifecycle diagram: customer booking → acquireLock RPC → confirmBooking RPC → edge fn → invoice + Resend ICS email.
15. Data model ERD: `businesses`, `services`, `staff`, `staff_availability`, `store_hours`, `time_blocks`, `bookings`/`invoices`, `business_owners`, `business_invites`, `customer_profiles`, `user_roles`.
16. Security model: `user_roles` + `has_role()` SECURITY DEFINER, RLS on every table, RPCs for privileged writes (`assign_my_role`, `create_business_with_owner`, `invite_business_manager`, `accept_pending_business_invites`).

**Section 6 — Technical decisions (5 slides)**
17. PRD summary: two-sided marketplace, problem, personas (provider/customer), success metrics — distilled from `README.md`.
18. User flows + entities recap (compact swimlane).
19. Stack justification table:
    - Language: TypeScript 5 (type safety end-to-end, shared types via generated `Database`)
    - Framework: TanStack Start (file-based routing, SSR on edge, typed links)
    - DB: Supabase Postgres (RLS, RPCs, pg_cron, Storage, Auth in one) vs roll-your-own
    - Styling: Tailwind v4 + shadcn/ui (velocity, accessibility)
    - Hosting: Cloudflare Worker via Lovable Cloud (global, zero ops)
20. Key engineering decisions & trade-offs:
    - Roles in separate table (prevents privilege escalation)
    - Slot computation client-side (`lib/slots.ts`) + DB-side lock RPC for race safety
    - Two Supabase clients (browser RLS vs service-role server)
    - Best-effort email (UI doesn't claim sent if Resend missing)
21. Test coverage: enumerate suites from `src/tests/index.ts` (format, utils, slots-unit, slots-integration, booking-flow, auth-context, use-mobile) and the items in `src/tests/coverage.ts`. Will run `/internal/tests` headlessly via the browser to capture the actual % covered and pass/fail counts, then put real numbers on this slide.

**Section 7 — Closing (1 slide)**
22. What's next + Q&A (roadmap: payments, SMS reminders, multi-tz polish, native mobile).

## How it gets built

1. Use `browser--navigate_to_sandbox` + `browser--screenshot` to capture ~12 screenshots (customer pages, provider hub, admin tabs, new business form, store tab, /internal/tests results page). Save to `/tmp/shots/`.
2. Generate the architecture, sequence, and ERD diagrams as PNGs (Python + matplotlib/graphviz, no external services), saved to `/tmp/diagrams/`.
3. Read `src/tests/coverage.ts`, `src/tests/index.ts`, `README.md`, key route files, and `supabase/migrations/` to ground the technical slides in real code/config.
4. Run a Node script using `pptxgenjs` to assemble the deck (16:9, US Letter equivalent), embedding all images as base64 (per skill rules), with a cohesive Schedora palette (fuchsia → violet → indigo gradient covers, charcoal body slides).
5. QA: convert .pptx → PDF via LibreOffice → render each page to JPG → visually inspect every slide for overflow / overlap / contrast / leftover placeholders. Iterate until clean.
6. Deliver as `<lov-artifact path="Schedora_Demo.pptx" mime_type="application/vnd.openxmlformats-officedocument.presentationml.presentation">`.

## Notes / assumptions
- Screenshots will be taken while logged-out for public pages and against an existing seeded provider/business for admin pages. If login is required and credentials aren't in the preview session, I'll fall back to a clean "logged-out" view + describe the screen, and flag the gap.
- Test-coverage numbers come from actually running the in-app `/internal/tests` page, not estimates.
- Diagrams are generated as static PNGs (not Mermaid artifacts) so they embed cleanly inside the .pptx.
