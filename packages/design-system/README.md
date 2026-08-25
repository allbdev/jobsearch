# @jobsearch/design-system — "Industry"

**Vendored from Claude Design. Do not hand-edit `src/styles.css`.**

| | |
|---|---|
| Design project | `Jobsearch feed design` |
| Project ID | `9dcb1900-074e-47ea-b840-522983e2b202` |
| URL | https://claude.ai/design/p/9dcb1900-074e-47ea-b840-522983e2b202 |
| Design system | `industry-0c021b97-e4e0-4037-a20b-2a135fcc7d67` |
| Imported | 2026-08-25 |
| Source screens | `Feed.dc.html`, `Profile.dc.html`, `Login.dc.html` |

## What lives here vs. in `@jobsearch/ui`

This package is the **unmodified** design-system output: the token sheet and the
component class layer, exactly as the design project produces them. Keeping it
byte-identical to the source is what makes re-syncing a diff rather than a merge.

`@jobsearch/ui` holds the React components that *consume* these classes. All
application markup imports from there — never from here, and never by writing a
DS class name inline.

## Rules taken from the system's own readme

- Link the one stylesheet; take every color, font, spacing, radius and shadow
  from its variables (`var(--color-*)`, `var(--space-*)`, …). Never hard-code a
  hex, a font name, or a px value the tokens already carry.
- Cards, figures and primary buttons are **blueprint objects**: square corners,
  hairline border, and four `+` registration marks. Never drop the marks from a
  framed element; never round or surface-fill a card.
- Icons are Lucide at `stroke-width: 1.5`. Never thicker.
- Interaction states are built into the stylesheet (hover tints, pressed steps
  from the accent ramp, a 2px accent `:focus-visible` ring). Do not restyle them
  per component.
- The accent-to-ground pair is tuned to ~3:1 — enough for icons, large text and
  chrome, **not** for body copy. Paragraph-size accent text uses
  `--color-accent-700`.
- Mono palette: `--color-accent-2-*` is a machine-derived stand-in that resolves
  to the same role as `--color-accent-*`. Treat them as one role.

## Re-syncing

The design project is the upstream. To pull a change:

1. Read the changed files with the `DesignSync` MCP (`get_file`).
2. Replace `src/styles.css` wholesale — do not merge by hand.
3. Run `pnpm --filter @jobsearch/ui test` — the token contract tests fail loudly
   if a variable the components depend on disappeared.
4. Reconcile any component that referenced a removed class.

The `.dc.html` screens are **prototypes, not source**. They use the Claude
Design canvas runtime (`x-dc`, `sc-for`, `sc-if`, `DCLogic` in `support.js`),
which is a preview interpreter — it is deliberately not ported. The screens are
read as design intent and re-expressed as React in `@jobsearch/ui`.
