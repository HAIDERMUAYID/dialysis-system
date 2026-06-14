---
name: awesome-claude-design
description: >-
  Use curated DESIGN.md design-system templates from Awesome Claude Design when
  scaffolding UI, choosing tokens, or starting new screens. Read when the user
  asks for a design system, DESIGN.md, Claude Design, or brand-inspired UI direction.
---

# Awesome Claude Design

Collection of **68+ `DESIGN.md`** files — structured design briefs AI agents can act on (colors, type, components, layout, do's/don'ts).

## Resources

| Resource | URL |
|----------|-----|
| **Repository** | https://github.com/VoltAgent/awesome-claude-design |
| **DESIGN.md catalog** | https://getdesign.md/ |
| **Claude Design workspace** | https://claude.ai/design |

## When to use

- Starting a **new surface** (landing, dashboard shell, marketing page) and need a coherent token set
- User wants a **named aesthetic** (Linear, Stripe, Notion, Supabase, Cursor, …) without cloning trademarks
- Project lacks `DESIGN.md` / `PRODUCT.md` and Impeccable `/impeccable init` has not run yet

## Workflow

1. Pick a close match from the [repo README](https://github.com/VoltAgent/awesome-claude-design#collection) or [getdesign.md](https://getdesign.md/).
2. Download that brand's `DESIGN.md`.
3. Either:
   - Upload to [Claude Design](https://claude.ai/design) to scaffold a full kit, **or**
   - Place `DESIGN.md` in the project root and implement tokens/components in this codebase (CSS variables, Ant Design theme, dialysis design system files).
4. Adapt — do **not** 1:1 clone proprietary brands; use as **inspiration** for an original system.

## Pair with project skills

- **Impeccable** (`.cursor/skills/impeccable`) — `/impeccable init`, audit, polish, anti-slop detectors
- **Taste Skill** (`.cursor/skills/design-taste-frontend`) — anti-template frontend, motion, typography dials

## This hospital project

Prefer extending existing files before inventing a parallel system:

- `client/src/styles/modern-design-system.css`
- `client/src/styles/theme.css`
- `client/src/components/Dialysis/app/dialysis-mobile-polish.css`

When adding UI, stay consistent with RTL Arabic, Ant Design patterns, and mobile PWA constraints already in the repo.
