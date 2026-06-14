# Design System — D-IRS

> مستخرج من `dialysis-app.css`, `dialysis-mobile-polish.css`, `modern-design-system.css` — وحدة الغسل الكلوي، RTL، Ant Design 5.

## 1. Visual Theme & Atmosphere

- **Register:** product (تطبيق تشغيلي طبي، ليس landing تسويقي).
- **Mood:** نظيف، هادئ، احترافي؛ خلفية فاتحة مع لمسة ambient خفيفة على الموبايل.
- **Density:** مريح على الموبايل (بطاقات 14–18px padding)؛ جداول على سطح المكتب.

## 2. Color Palette & Roles

| Token | Hex / value | Role |
|-------|-------------|------|
| `--d-brand-teal` | `#157c67` | Primary brand (sidebar, theme-color, CTAs طبية) |
| `--d-brand-teal-dark` | `#0d9488` | Hover / accent depth |
| `--d-brand-cyan` | `#28b2e1` | Gradient highlight |
| `--d-ink` | `#0f172a` | Primary text |
| `--d-ink-muted` | `#475569` | Secondary text |
| `--d-surface` | `#ffffff` | Cards, drawers |
| `--d-surface-muted` | `#f8fafc` → `#eef2ff` | Page background gradient (mobile) |
| `--d-border` | `#e8ecf4` | Card borders |
| `--d-accent-indigo` | `#6366f1` | Secondary accent (KPIs, links) — ** sparingly ** |
| Status active | `#ef4444` / red tag | جلسة نشطة |
| Status completed | `#22c55e` | منتهية |
| Status scheduled | `#3b82f6` | مجدولة |
| Warning | `#f59e0b` | بلا بصمة وجه، off-schedule |

**Rules:** Primary actions in dialysis app lean **teal**, not purple. Reserve indigo/violet for KPI icons and subtle ambient only.

## 3. Typography

- **UI:** system stack + Ant Design defaults; Arabic RTL throughout.
- **Headings (mobile page):** gradient ink `#0f172a` → `#334155` on `.d-app-page-title` — no letter-spacing on Arabic labels.
- **Scale:** stat values ~20px mobile; card titles 14–16px semibold; meta 12px muted.
- **Print/PDF:** Cairo loaded in print pipeline; avoid letter-spacing in table headers.

## 4. Component Stylings

- **Cards** (`.d-session-card`, `.d-report-session-card`, `.d-patient-card`): radius 16–18px, border `1px solid #e8ecf4`, soft shadow; optional accent bar (report sessions).
- **FAB** (`.d-mobile-fab`): pill, teal-forward gradient, safe-area bottom offset above nav.
- **Bottom nav:** fixed z-index 1200; hidden when overlay/face modal open.
- **Drawers (session create):** bottom sheet 92% height mobile; footer sticky with safe-area.
- **Buttons:** primary min-height 46–50px mobile; face scan uses primary teal/indigo only on mobile emphasis.
- **Tags:** Ant Design Tag colors mapped to intake/status enums — consistent labels across Sessions & Reports.

## 5. Layout Principles

- **Mobile:** single column, no horizontal scroll; toolbar stacks vertically.
- **Spacing scale:** 8 / 10 / 12 / 14 / 16 px gaps in cards and toolbars.
- **Stat grid:** 2 columns on mobile sessions/reports KPIs.

## 6. Depth & Elevation

- Cards: `0 8px 24px rgba(15,23,42,0.06)`.
- Header scrolled: frosted glass `backdrop-filter blur(18px)`.
- FAB: stronger colored shadow (teal), not flat.

## 7. Do's and Don'ts

**Do**
- Use ministry logo + `DIALYSIS_MINISTRY_LINE` in reports/print.
- Keep face-enroll and session flows as bottom sheets above nav (z-index 1450+).
- Animate card entrance with `dMobileCardIn` (subtle translateY).

**Don't**
- Purple-to-blue gradient on every primary button.
- Gray `#94a3b8` text on colored alert backgrounds.
- Nested cards for simple lists.
- Bounce easing on UI transitions.

## 8. Responsive Behavior

- Breakpoint **991px** for `.d-app-mobile` patterns.
- `env(safe-area-inset-*)` on footer, FAB, bottom nav.
- Pull-to-refresh on sessions/reports mobile lists.
- Touch targets ≥ 44px for nav and FAB.

## 9. Agent Prompt Guide

When designing or polishing D-IRS UI:

1. Read `PRODUCT.md` register = **product**.
2. Extend existing CSS files — do not introduce parallel token files unless refactoring.
3. Prefer **teal `#157c67`** for brand actions; test in RTL.
4. For new mobile surfaces, match `.d-app-mobile` card + toolbar patterns.
5. Run `/impeccable audit` on touched pages before ship; `/impeccable polish` for pre-release pass.

**Key files:** `client/src/components/Dialysis/app/dialysis-app.css`, `dialysis-mobile-polish.css`, `pages/sessions-page.css`, `pages/dialysis-reports.css`.
