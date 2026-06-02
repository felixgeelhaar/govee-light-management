## Lab sub-language

Define the OSS-playground counterpart to the brand core. Shares atomic tokens but diverges on semantic layer: looser grid, mono-headline-led, accent-color expansion (multiple project accents allowed), more visible technical metadata (commit hashes, language tags, CI badges). Document concrete visual + structural differences from the editorial core so the two halves stay sibling, not clone.

---

## Component primitives expansion

Expand from v0 stubs (button, link, rule, kbd, code block) to the full primitive set needed before pages can be assembled: article header, card, code block with copy button + language label, tag/pill row, footer, nav. Each rendered in preview.html.

---

## Home page v1

First real production page assembled from the design system. Wordmark, hero with positioning line, "what I do" rows, latest writing, lab link, contact. Validates the system in production shape.

---

## Voice guidelines

Document how Felix writes headlines, ledes, button labels, empty-state copy, error messages, and microcopy. Tone: sharp, system-thinker, leader. Locks the verbal half of the brand so future surfaces stay consistent.

---

## Wordmark exploration

Logotype work. Geist Mono caps wordmark is the placeholder. Either commit to it as the canonical wordmark or design a custom mark (logotype, monogram, signal-glyph). Define usage rules and clearspace.

---

## Status color tokens

Add success/warning/danger/info color primitives + semantic tokens for light + dark. Required before any form, alert, or AI confidence signal can ship. Currently only neutrals + electric-blue accent exist.

---

## Focus-visible composite token

Compose a focus-visible token (outline width + offset + color, light + dark variants) referenced from every interactive component. WCAG 2.2 SC 2.4.13 requires an explicit focus appearance; the bare --color-focus-ring is insufficient. Pair with prefers-reduced-motion fallback.

---

## Elevation and shadow scale

Define a 3-level shadow/elevation scale (restrained for blueprint aesthetic), light + dark variants. Prerequisite for any modal, popover, or card-hover. Currently undefined.

---

## Z-index scale

Define z-index scale (base / dropdown / sticky / modal / toast) as named tokens. Prevents stacking-bug whack-a-mole the first time anything overlays content.

---

## Breakpoints and grid tokens

Add breakpoint tokens (sm 640 / md 768 / lg 1024 / xl 1280) and container/grid tokens (column count, gutter, max-width per bp). Preview.html currently uses ad-hoc clamp(); editorial and lab layouts need a real grid.

---

## Icon system tokens and SVG sprite

Define icon size scale (16/20/24/32), stroke-width tokens, and optical adjustments. Scaffold an SVG sprite with the initial 8-12 icons needed for nav, social, copy-action, theme-toggle, RSS, GitHub.

---

## Composite typography tokens

Compose semantic typography tokens (heading-1..6, lede, body-prose, mono-label) that wrap the atomic fs/fw/lh/ls primitives. Components reference one name instead of re-mixing atoms; prevents drift.

---

## APCA contrast verification

Verify every semantic color pair on both light and dark themes against APCA Lc thresholds (Lc 75 for body text, Lc 60 for non-essential). Electric blue on near-black often fails for body — fix ramps if needed before locking the system.

---

## Reduced-motion overrides

Add prefers-reduced-motion media query that zeroes or shortens every motion token (durations, transitions, theme-toggle animation). Current motion tokens have no a11y fallback.

---

## Header with skip-to-content

Build the global header component: wordmark on the left, primary nav (≤7 entries per Hick's Law), theme toggle, skip-to-content link visible on focus. Used on every page.

---

## Footer component

Global footer: IA-repeat links, social icons, RSS link, copyright, theme-toggle echo. Secondary nav for users who scroll past the header.

---

## Form primitives

Build input, textarea, label, helper text, error message with aria-live announcement. Luke Wroblewski single-column rules; required for contact and newsletter signup.

---

## Newsletter signup component

Inline newsletter signup with documented single-click unsubscribe path. No modal-on-arrival. FTC click-to-cancel symmetry between signup and cancellation.

---

## Code block with copy button

Production code block: copy-to-clipboard button, language label, optional line numbers, inline-code variant distinct from kbd. Reuses Geist Mono token.

---

## Card primitives

Writing card (kicker / title / lede / meta) and project card (status / tech stack / GitHub link). Each appears dozens of times across writing index and lab index.

---

## State templates

Empty state, loading skeleton, 404, and 500 templates. Empty and error pages are part of the brand voice, not afterthoughts.

---

## Modal/dialog primitive

Modal with focus trap, ESC-to-close, scroll lock, return-focus on close. Prerequisite for consent banner and future command palette.

---

## Information architecture and URL structure

Commit to the URL shape: /, /writing, /writing/[slug], /lab, /lab/[slug], /talks, /about, /now, /uses, /contact. Locking URLs now avoids migration debt later.

---

## Page templates

Wireframe-level page templates for every route in the IA: home, writing index, writing post, lab index, lab project, talks, about, now, uses, contact. Surfaces any missing components before final styling.

---

## Long-form reading patterns

Table-of-contents, reading-time, scroll progress bar, prev/next post links, related posts. Applies goal-gradient and serial-position effects to writing pages.

---

## Feeds, sitemap, robots

Generate RSS/Atom feed, sitemap.xml, and robots.txt. Table stakes for a technical-audience personal site; signals craft to engineers.

---

## OG image generator

Brand-consistent 1200x630 OG-image template, auto-rendered per post and per lab note. One of the highest-leverage brand surfaces — every social share is an impression.

---

## Lab vs Writing distinction rules

Concrete visual and structural differences between the editorial core (writing) and the OSS playground (lab): grid looseness, headline font (mono in lab), accent-color expansion, metadata density. Without this the two halves blur.

---

## Bio variants and press kit

Short (one-liner for podcast intros), medium (paragraph for press), long (about-page narrative). Press kit: logos in SVG + PNG, portraits, brand hex codes, downloadable ZIP.

---

## AI-content disclosure pattern

Visual + copy conventions for surfaces that contain AI-generated text (auto-summaries, chat, generated bios). Hedging language rules, source-citation pattern, visual differentiation (tint or icon). Designs against the Misinformed-Use failure mode.

---

## Microcopy library

Reusable strings: button verbs, empty-state lines, error messages, success confirmations, 404 copy. Locks tone-of-voice into the system instead of leaving it per-page.

---

## WCAG 2.2 conformance pass

Single audit covering: heading hierarchy (one h1, no skipped levels), alt-text policy, lang attribute, touch-targets ≥44×44, forced-colors media query support, color-only-meaning audit. Easier to fix now than retrofit.

---

## Keyboard navigation audit

Verify tab order through header/footer, focus traps in modals, ESC behavior, skip-link visibility on focus. Document the expected order so future changes don't regress.

---

## Style Dictionary export pipeline

Single token source → CSS (current), Tailwind config, Figma tokens, slide-deck JSON. Pair with semver scheme + CHANGELOG.md for the design system. Without it, slides and Figma drift from web.

---

## Quality baseline

Visual regression (Playwright screenshots per breakpoint × theme), performance budget (CSS ≤15KB compressed, font subsetting, total page ≤100KB), SEO baseline (meta tags, OG, Twitter Card, JSON-LD Person), analytics (Plausible/Umami) + symmetric cookie/consent pattern with no dark patterns.

---

## Framework-agnostic component architecture

Lock the architecture for every component going forward. Layout/markup-heavy parts ship as CSS + HTML reference + per-framework adapter (Astro/Vue/React). Interactive primitives ship as native Web Components with the `fg-` prefix, light DOM (tokens cascade), JS-only first, types via JSDoc. Document in docs/component-architecture.md and refactor existing theme-toggle + nav-toggle into custom elements as the proof case.

---

## Chart components on D3

Interactive chart primitives as Lit web components wrapping D3 for math + SVG. Light DOM so tokens cascade into SVG elements. Initial set: fg-chart-line (time series), fg-chart-bar (categorical), fg-chart-sparkline (inline trend), fg-chart-network (concept maps, on-brand for System Diagram direction). Reactive properties drive re-renders. Each chart respects prefers-reduced-motion + APCA contrast on series colors + WCAG keyboard nav for tooltips.

---

## UX-review v1 launch criteria

Define v1.0 launch as scaffold + 3 essays + 2 lab notes + 1 talk + OG images per page + favicons + analytics + /work surface. Rename current state v0.9 scaffold. Ship docs/launch-criteria.md as the gate. Source: ux-expert final review finding #3.

---

## UX-review hero h1 rewrite

Replace "A systems thinker for modern engineering." in home.html with a verb-first headline that passes Krug's trunk test on the headline alone. Candidates from review: "I help R&D teams ship clearly." / "Operating models that hold modern engineering together." / "Notes on platforms, ops, and the systems beneath them." Decide, ship, update OG image text. Source: ux-expert finding #1.

---

## UX-review hire-me surface

Add /work route + page template covering: what Felix does, current availability, how to start a conversation. Highest leverage commercial surface for the ops-leader brand. Either as a standalone route or as an above-the-fold block on /about. Update docs/ia.md + docs/page-templates.md. Source: ux-expert finding #2.

---

## UX-review fg-ai-disclosure component

Ship Lit web component <fg-ai-disclosure tier="A|B|C" sources="…"> enforcing the docs/ai-disclosure.md pattern mechanically. Three visual tiers (Light/Heavy/Generated) + slot for body + optional citations footer. Without enforcement the rules drift. Source: ux-expert finding #4.

---

## UX-review /policy/ai page

Reader-facing distilled version of docs/ai-disclosure.md at /policy/ai — Felix's public stance on AI content. Brand trust signal for the engineering-ethics audience. Linked from footer secondary nav. Source: ux-expert finding #10.

---

## UX-review home lab spotlight uniformity

Home page mixes card--feature (sans) next to card--project (mono) — Gestalt similarity break. Pick one variant per section. Either two project cards in a "From the lab" row or one feature card alone. Source: ux-expert finding #6.

---

## UX-review favicon raster build

scripts/build-favicons.mjs that renders wordmark/monogram.svg to favicon-16/32/192/512 via @resvg/resvg-js. Wires into npm run build. Without these the brand ships with default browser-tab icons. Source: ux-expert finding #7.

---

## UX-review mailto obfuscation

Public mailto:felix@felixgeelhaar.com in the footer is a spammer magnet. Replace with a copy-to-clipboard pattern or a small JS-rewritten link that assembles the address at runtime. Document the trade-off in components/footer/README.md. Source: ux-expert finding (Medium).

---

## UX-review code-copy touch target bump

.fg-code\_\_copy button at 32x32 is below WCAG 2.2 SC 2.5.8 floor on mobile. Bump to 44x44 OR provide a long-press alternative on touch. First mobile failure point per ux-expert. Source: ux-expert finding (Medium).

---

## UX-review /now governance

/now pages rot fast and damage the brand when stale. Add a visible "Last updated" date + a quarterly review reminder. Document in docs/page-templates.md under the /now route. Source: ux-expert finding (Medium).

---

## UX-review content sprint

3 essays + 2 lab notes + 1 talk listed minimum before v1.0 launch. Content surface — owned by Felix, not the design system. Tracks readiness, not implementation. Source: ux-expert finding #3.

---

## UX-review Plausible analytics

Wire Plausible (or self-hosted Umami) into the base template. Cookieless, GDPR-clean, no banner required. Without it, day-one traffic is invisible. Document in docs/quality.md. Source: ux-expert finding #7.

---

## UX-review 5-user trunk test

Krug's 5-user test against 3 audience archetypes (engineering peer, VP-of-Engineering, conference organizer or journalist). Brief: land cold on home, narrate. Watch for h1 confusion, /lab confusion, missing hire-me path. 2-hour spend, decisive insight. Source: ux-expert finding #12 + step 2.

---

## UX-review /lab naming decision

"Lab" reads as "experimental, not production" outside the OSS community. Test /lab vs /work vs /projects with the 5-user trunk test. /work has bonus: doubles as hire-me surface (Finding #2). Decide before v1.0 launch and update docs/ia.md if renamed. Source: ux-expert finding #5.

---

## UX-review defer overbuilt components

Mark as deferred (not removed): fg-chart-line, fg-chart-bar, fg-reading-progress, fg-toc, fg-modal, /press page. Keep code committed; remove from preview demo + skip from launch budget. Adds 3-4 days of content-sprint runway. Source: ux-expert "What's overbuilt".

---

## UX-review responsive audit

Full responsive sweep across every shipped page + component. Verify viewport meta, breakpoint coverage (sm 640 / md 768 / lg 1024 / xl 1280), touch-target compliance on narrow viewports, and content reflow. Add @media tweaks where component CSS only handles md+. Document the matrix in docs/responsive.md.

---

## Repo + docker-compose scaffold

Bootstrap Brotwerk repository with self-hostable docker-compose stack: Postgres 16 (user data, bake log, eval results), MinIO (S3-compatible object storage for photos, EU region intent), Redis (sessions + future job queue), Caddy (reverse proxy + auto-HTTPS when hosted), Nuxt 3 web app container. Generic compose file (no host-specific assumptions — Hetzner / Coolify / Fly.io / Railway all targetable later). Include .env.example, healthchecks for every service, named volumes for postgres + minio persistence, and a single `docker compose up` developer experience. Add Makefile or npm scripts for common ops (db:reset, minio:console, logs).

---

## Nuxt 3 app skeleton + brand-fork tokens

Scaffold Nuxt 3 app (apps/web): TypeScript, Vue 3 Composition API, server routes, ESLint + Prettier matching felix's personal-brand conventions. Fork tokens.css from the brand repo into packages/brand and override the accent ramp: primary palette crust amber (#C46B2C variants) on warm cream (#FAF6EE) with dark roast text (#2A1F14). Reuse type.css composite roles + grid.css from brand. Forced-colors + prefers-reduced-motion + focus-ring composite carry over unchanged. Verify APCA contrast for every semantic pair before declaring tokens locked.

---

## DE + EN i18n bootstrap

Wire @nuxtjs/i18n with German (default) + English locales from day one. Co-locate translation files per route (locales/de/_.json, locales/en/_.json). Route prefix strategy: /de/... and /en/... with auto-detect on first visit. All user-facing copy lives in translation files — zero hardcoded strings in templates. Lint rule (eslint-plugin-vue-i18n or custom) to fail builds on hardcoded user-visible text. Native German voice (no machine-translated copy) — Felix is native speaker and reviews every string.

---

## Database schema + Drizzle ORM

Drizzle ORM with Postgres. Initial schema covers MVP + retention foreshadowing: users (id, email, locale, created_at), starters (id, user_id, name, flour_blend, started_at, graduated_at), starter_entries (id, starter_id, day_number, photo_key, uploaded_at, hydration_pct, room_temp_c, smell_note, float_test_pass), starter_evals (id, entry_id, maturity_score, peak_pct, bubble_density, dome_shape, color_drift, confidence_band, tip_de, tip_en, model_version, raw_response_jsonb), bakes (id, user_id, recipe_id, planned_for, notes — for v1.x recipe walkthrough). Critical: starter_entries indexed on (starter_id, day_number) so day-3-upload-rate (the leading indicator) is a one-query lookup. Migrations versioned, drizzle-kit push in dev, deterministic SQL in prod.

---

## Auth with better-auth

better-auth (TypeScript-native, self-hosted) for email-magic-link sign-in. Session storage in Postgres + Redis cache. No social logins for MVP (reduces compliance surface). GDPR-compliant: delete-account endpoint cascade-removes starters, entries, evals, photos in MinIO. Account export (JSON download of all user data) for GDPR Art. 15. Email delivery via Resend or Postmark (EU region). Privacy policy lives in /policy/privacy (DE + EN).

---

## Photo upload pipeline (MinIO + signed URLs)

Client-side photo capture (file input + camera capability via input[capture=environment] for PWA), client-side compression to ~1MB max (browser-image-compression) before upload, server presigned POST to MinIO bucket (private). Photo references stored as object keys (not URLs) — signed GET URLs minted on demand with short TTL. EXIF stripped server-side. Object lifecycle policy: delete originals after 90 days unless user marks favorite. Bucket policies enforce per-user prefix isolation. Photos never publicly accessible.

---

## Photo quality pre-screen (client-side)

Before any photo is uploaded, run client-side quality checks: brightness histogram (reject if mean luminance below threshold — German kitchens often use warm tungsten), blur detection (Laplacian variance), aspect-ratio + jar-in-frame heuristic (basic object boundary check). If photo fails quality, surface a specific reshoot prompt ("Photo too dark — open the curtain or move to bright window") in DE + EN. This is the lethal-risk mitigation: prevents Claude Sonnet from confidently evaluating a bad photo and giving wrong advice. Pre-screen runs before any API call costs are incurred.

---

## Vision-eval adapter (Claude Sonnet)

packages/eval is an isolated, testable module. Single interface: evaluateStarterPhoto(imageBuffer, context: {day, hydration, room_temp, previous_eval}) → { maturity_score: 0-100, peak_pct, bubble_density: low|medium|high, dome_shape: flat|domed|collapsed, color_drift, confidence_band: low|medium|high, tip_de, tip_en, model_version, raw_response }. Implementation calls Anthropic Claude Sonnet vision with structured-output prompt (tool_use mode). System prompt encodes master-baker heuristics from public Plötzblog / Brotdoc methodology with attribution. Strict JSON schema validation on response; reject and retry once if malformed. Cost target: <€0.01 per eval. Adapter mocked in dev (returns canned response) so frontend work doesn't burn API spend.

---

## Confidence-banded eval display (anti-overconfidence UX)

Every eval shown to user includes a visible confidence band: high / medium / low. Medium and low confidence always include hedging language ("Looks ~60% mature. I'm uncertain about the dome shape — reshoot in side-light for a sharper read."). Low-confidence evals never assert a maturity score with false precision — they show a range. Confidence band derives from model_self_report + photo_quality_score (from pre-screen) + signal_agreement (e.g., peak says mature but bubble density says immature → low confidence). Prevents user from acting on a confidently-wrong tip — the moat-credibility risk identified by product-expert.

---

## 7-day starter coach UI flow

Core MVP user-facing surface. /starter/new → pick flour blend + name your starter ("Karl-Heinz, age 0 days"). /starter/[id] → day-by-day timeline view showing current day, expected behavior for today, photo upload CTA, eval history. Each day has its own "what to expect" copy (DE + EN, native voice, master-baker terminology). Day 1: mix + wait. Day 2-4: discard + feed schedule with timers. Day 5-6: 2× daily feed, float test guidance with photo. Day 7: graduation diagnosis — ready, extend, or revival mode. Mobile-first PWA layout, install-to-homescreen manifest, offline timer fallback.

---

## Felix-in-the-loop concierge dashboard

Private admin route (/admin/evals, auth-gated to founder only) that shows every AI eval for the first 100 users side-by-side with the original photo. Felix can mark each eval: agree | disagree | partial. Disagreements are logged with corrected tip text for future prompt tuning. This is the embedded concierge layer — calibrates AI quality against expert judgment in production, not in a separate WhatsApp test. Outputs disagreement-rate metric: target <20% before scaling acquisition. Sunsets once disagreement rate stabilizes or eval volume exceeds founder review capacity.

---

## North-star metric instrumentation

Instrument from commit 1 — not bolted on later. North-star: % of starters that reach "graduated" state by day 7. Leading indicator: day-3 photo-upload rate. Internal metrics dashboard at /admin/metrics shows: signups (last 7/30 days), starter-create rate, day-N upload rate per cohort, eval volume, eval cost (€), graduation rate, disagreement rate from concierge dashboard. No third-party analytics for these — direct Postgres queries on starter_entries table. Plausible cookieless analytics for traffic only (DAU, page views). Privacy-clean by construction.

---

## Landing page + waitlist

Public marketing surface at /. Hero: "Dein Sauerteig. Mit KI-Begleitung." (DE) / "Your sourdough. Coached by AI." (EN). Below: 7-day visual arc preview, attribution to master-baker tradition (linked, not quoted), how-it-works in 3 steps, privacy + GDPR commitment block, founder note from Felix. Waitlist CTA pre-launch; converts to "Start your starter" CTA post-launch. SEO basics: opengraph image, structured data, sitemap. Plausible cookieless analytics. Footer with imprint (Impressum required by German law), privacy, terms.

---

## Legal pages (Impressum, Datenschutz, Terms)

DACH-compliance legal pages: Impressum (German legal requirement — Felix's name, address, contact, USt-IdNr if applicable), Datenschutzerklärung (GDPR-compliant, lists all data processors: Anthropic for vision, Resend/Postmark for email, MinIO self-hosted, Postgres self-hosted), Terms of Service. AI-disclosure section explains exactly when Claude is called, what data leaves the EU (image + minimal context), and that no user photos are used for AI training. DE + EN versions, German legal copy reviewed before launch.

---

## CI/CD pipeline + automated tests

GitHub Actions workflow: lint (ESLint + Prettier), type-check (vue-tsc), unit tests (Vitest, 80% coverage target on packages/eval and server routes), E2E smoke tests (Playwright — landing page renders DE+EN, starter create flow completes with mocked vision adapter, photo upload flow runs against test MinIO). Deploy job placeholder gated on tag push (release shape ready, target host decided later). Dependabot for npm + docker base images. CodeQL security scan.

---

## Starter maintenance + revival mode (Month 2)

Post-MVP retention-driving feature. Once a starter is graduated, user enters maintenance mode: weekly feed reminders, optional weekly photo check ("Is your starter still healthy?"), revival protocol if user reports a skipped feed window (3+ days). Eval adapter reused — same vision call, different context prompt (maintenance vs growing). Starter gets a name + age display ("Karl-Heinz, age 47 days") — Bob Moesta emotional job: pet-ownership of a living thing. Converts one-shot starter creation into a weekly habit. Retains users until recipe library lands. Non-negotiable per product-expert.

---

## Reverse-time planner (Month 3)

"Bread ready Sat 10am" → backwards schedule: levain feed Fri 22:00, autolyse 06:30, mix 07:00, bulk 08:00, shape 12:00, final proof 13:00, bake 09:30. Temperature-aware: warmer kitchen shortens timings, colder lengthens. Pure deterministic JS (no AI for timing — accuracy matters). User inputs target bread-ready time + room temp + dough hydration; output is a timeline with calendar export (.ics) + phone-friendly visual. Validates "users want planning" (value risk per Cagan) cheaply, independent of recipe IP. No recipes required yet — planner works with user's own recipes.

---

## Flagship recipe #1: 70% rye sourdough (Month 4)

First fully-coached bread walkthrough. Original recipe (Felix-authored, inspired by master-baker methods, attributed in copy: "inspired by Plötzblog's rye technique"). Coached steps: levain feed → autolyse → mix → bulk fermentation with 4 photo checkpoints (windowpane test, dough doubling, bulk-end shape, final proof) → shape → bake. Each checkpoint uses the same vision-eval adapter, different context prompt (dough vs starter). Recipe data structured (not free text): hydration%, levain%, flour blend, temp curve, autolyse minutes, bulk hours, proof hours. Validates full closed-loop: starter → recipe → coached bake → eval → bake-log entry. Tests value + feasibility risks per Cagan.

---

## Recipe library #2-5 + paywall (Month 5)

Four more original coached recipes (whole-wheat country, baguette, focaccia, brioche burger buns). First paywall trigger: recipe library gated at €7/mo or €60/year (Stripe checkout, EU billing). Starter coach stays free forever. Free tier sees recipe titles + first photo, paywall at "Start coached bake". Per GTM-expert: this is the natural peak-end paywall — user just graduated starter, motivation peaked, asks "what now?". Tests viability risk. Hard cap: 5 photos/day in free tier (prevents abuse).

---

## AI mentor chat (recipe-context aware, Month 6)

Synchronous Q&A during a bake. User mid-bulk-fermentation, dough looks weird, asks "Is this normal?" Chat is recipe-aware: knows what step user is on, what their last photo showed, what their starter age is, what their room temp is. Claude Sonnet text + optional photo attach. Premium-tier feature (€7/mo or €60/year). Earns its place after monetization is real (don't burn AI cost on free tier). Tests usability risk: do bakers actually pause mid-bake to ask AI, or do they just push through?

---

## Bake log + closed-loop adjustment

Every coached bake produces a log entry: recipe, starter age, hydration, room temp, photo checkpoints, final crumb photo, user-rated outcome (1-5), free-text notes. Closed-loop: on next bake of same recipe, AI mentor references prior bake ("Last time your crumb was tight — try +5% hydration") — recipe + photo + eval + adjustment recommendation. Compounds per user. Bake log exportable as PDF for sharing on r/Brotbacken / Plötzblog comments — surfaces Brotwerk attribution organically.

---

## Founder content + lab page integration

"Building Brotwerk in public" weekly content shipped via felix's personal-brand lab page (lab.html on felixgeelhaar.com) + LinkedIn cross-post. Topics tracked in roady as separate tasks once month 1 ships. Public dashboard: brotwerk.app/labs/metrics — anonymized graduation rate, disagreement rate, total starters. Transparent metrics = trust signal + content fodder. Felix's LinkedIn + personal brand drives first-100-users (GTM-expert top-3 channel).

---

## 10-user validation test (week 3)

Before public launch: recruit 10 testers from felix's network (DACH, sourdough-curious or active). 7-day full starter arc with real product (not WhatsApp concierge). Felix reviews every eval via /admin/evals dashboard. Success criteria: (1) ≥6/10 testers say "the AI tip was right and helpful" in post-arc survey, (2) graduation rate ≥70%, (3) Felix's disagreement rate <20%, (4) zero "confidently wrong" evals (low-confidence-band ones don't count against this). If criteria miss: don't launch publicly. Iterate eval prompt / pre-screen thresholds first. The moat is real only if criteria pass.

---

## GitHub repo + branch protection

Private GitHub repo at felixgeelhaar/brotwerk. Main branch protected (PR-only, status checks required, signed commits encouraged). Issue templates (bug, feature, eval-quality-feedback). PR template enforces test plan + screenshot for UI changes. CODEOWNERS routes all PRs to felix. Conventional commits convention. Renovate or Dependabot for dependency PRs. CodeQL enabled. Repo description, topics (sourdough, baking, ai, vision, nuxt), license decision deferred until launch.

---

## OpenAPI contract + TS codegen

Single source of truth for the HTTP boundary between Astro/Vue frontend and Go backend. OpenAPI 3.1 spec checked into repo at api/openapi.yaml. Backend uses oapi-codegen to generate Go server interface stubs (chi-server template) — implementing the stubs is type-checked at compile time. Frontend uses openapi-typescript or orval to generate TS client + fetch hooks. Spec covers: POST /api/auth/request, GET /api/auth/verify, POST /api/starters, GET /api/starters/:id, POST /api/starters/:id/entries (photo upload + eval trigger), GET /api/starters/:id/entries, DELETE /api/users/me, GET /api/users/me/export. CI verifies that generated code is in sync (fails PR if spec changed but stubs weren't regenerated).

---

## Starter lifecycle state machine (statekit)

github.com/felixgeelhaar/statekit drives the starter 7-day arc + post-graduation lifecycle. State diagram (XState-compatible JSON, visualizable): idle → day_1 → day_2 → ... → day_7 → {graduated, extended, failed}. From graduated: maintenance (default) → {dormant (skipped 2+ weeks), needs_revival (skipped 3+ days)} → revival_protocol → maintenance. Transitions triggered by: photo upload events, scheduled daily ticks (cron), explicit user actions (extend / mark-failed / graduate-now). Guards on transitions enforce business rules (can't graduate before day 5, revival only from dormant/needs_revival). Side-effects (send_reminder_email, trigger_eval, log_metric) declared on transitions, not in handlers — keeps state logic pure + testable. State persisted per-starter in starter_state column (jsonb). Same statechart definition powers backend logic AND optional frontend visualization (XState DevTools-style debug view in /admin). Trivial to extend later: add recipe-walk state machine reusing the same engine.

---
