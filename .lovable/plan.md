## Goal

Rebuild `Schedora_Demo.pptx` for an **engineering hiring panel**. Light minimal aesthetic, animated GIFs for the live demos, deep technical data model, no email feature anywhere.

## Style system

- White background, charcoal text (`#0F172A`), single violet accent (`#7C3AED`).
- Typography: Calibri body, large bold headings (44pt titles, 14–16pt body).
- Generous whitespace, ≤25 words per content slide, max 3 bullet groupings.
- One visual per slide (GIF, diagram, or large stat). No decorative lines under titles. No gradients. No clip-art icons.

## Deck (~14 slides, down from 22)

1. **Title** — "Schedora · Appointment booking, end-to-end" + 1-line subtitle.
2. **What I built** — 3 stats (e.g. routes, tables, tests) — no prose.
3. **Customer flow — GIF** — full-bleed recorded GIF of: browse → pick service → pick slot → confirm. 1-line caption.
4. **Provider flow — GIF** — recorded GIF of: login → /provider hub → open dashboard → bookings tab.
5. **New business setup — GIF** — recorded GIF of: /provider/new → fill form → land in dashboard Store tab.
6. **Architecture (one diagram)** — clean 3-tier SVG-style PNG: Browser (React 19 + TanStack Start) → Edge Worker (server fns, RPCs) → Postgres (RLS, pg_cron). No email/Resend node.
7. **Request lifecycle** — sequence diagram for booking: client → server fn → `acquire_slot_lock` RPC → `confirm_booking` RPC → invoice row. (Email step removed.)
8. **Data model — ERD** — technical ERD with PK/FK, types, key constraints, and the lock/RPC surface annotated. Tables: businesses, business_owners, business_invites, services, staff, staff_availability, store_hours, time_blocks, bookings, invoices, customer_profiles, user_roles, app_role enum. Show FKs and unique constraints.
9. **Security model** — `user_roles` + `has_role()` SECURITY DEFINER; RLS on every table; privileged writes via RPC (`assign_my_role`, `create_business_with_owner`, `invite_business_manager`, `accept_pending_business_invites`, slot lock + confirm).
10. **PRD at a glance** — problem · personas · success metrics, 3 columns, terse.
11. **Stack & why** — 2-column table: choice → one-line justification (TS5, TanStack Start SSR on Workers, Postgres+RLS, TanStack Query, shadcn/ui, Vitest-style in-app runner).
12. **Key engineering decisions** — 4 cards: roles in separate table; DB-side slot lock for race safety; split browser/admin Supabase clients; client-side slot computation with server validation.
13. **Test coverage** — real numbers from `/internal/tests` (suites + pass count + items in `coverage.ts`). Single big stat + small per-suite list.
14. **What's next / Q&A** — 3 bullets max.

## How GIFs get made

1. Use `browser--navigate_to_sandbox` + `browser--act` to walk each flow at 1366×768.
2. Capture a sequence of PNG screenshots between actions (5–8 frames per flow).
3. Compose to GIF with ImageMagick (`nix run nixpkgs#imagemagick -- convert -delay 120 -loop 0 frames/*.png flow.gif`), ~1.5s/frame, optimized.
4. Embed the GIF in the .pptx via `slide.addImage({ data: 'image/gif;base64,...' })` — pptxgenjs preserves GIF animation when opened in PowerPoint/Keynote.

## What's removed vs. previous deck

- All mention of `booking-confirmation` edge function, Resend, ICS email, email status.
- Architecture diagram's email node + sequence diagram's email step.
- Slide 4 ("Confirmation + email") — replaced by GIF ending on success screen.
- Heavy bullet slides condensed; redundant Services/Staff/Hours/Metrics/Invoices sub-slides removed (covered inside the Provider GIF).

## QA

Render to PDF → JPG and inspect every slide for: overflow, low contrast, leftover placeholders, any stray "email"/"Resend"/"ICS" text. `grep -i 'email\|resend\|ics'` the extracted text before delivery. Iterate until clean.

## Deliverable

`/mnt/documents/Schedora_Demo_v2.pptx` (kept v1 alongside for comparison), surfaced via `<lov-artifact>`.