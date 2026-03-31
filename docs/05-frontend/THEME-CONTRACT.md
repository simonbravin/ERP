# Theme Contract — Design System Tokens

This document defines the **canonical CSS variable tokens** for the Bloqer frontend. All UI color usage must reference these tokens only. No hardcoded Tailwind color utilities (e.g. `bg-white`, `text-gray-900`, `bg-blue-600`) or arbitrary values (e.g. `bg-[#...]`, `style={{ color: '...' }}`) are allowed in components.

---

## 1. Shadcn-compatible token set

These tokens are defined in `globals.css` so shadcn/ui (and similar) components work without hardcoding:

| Token | Purpose |
|-------|--------|
| `--background`, `--foreground` | Page / app surface and primary text |
| `--card`, `--card-foreground` | Raised surfaces (cards, modals) |
| `--popover`, `--popover-foreground` | Dropdowns, tooltips |
| `--border`, `--input`, `--ring` | Borders, input border, focus ring |
| `--primary`, `--primary-foreground` | Primary actions (see strategy below) |
| `--secondary`, `--secondary-foreground` | Secondary surfaces |
| `--accent`, `--accent-foreground` | Highlights, tags, focus (see strategy below) |
| `--muted`, `--muted-foreground` | Muted surface and secondary text |
| `--destructive`, `--destructive-foreground` | Destructive actions |
| `--radius` | Default border radius (single value; also `--radius-sm`, `--radius-md`, etc.) |
| `--chart-1` … `--chart-5` | Data viz; use instead of `style={{ color }}` in charts |

---

## 2. Sidebar tokens (full set)

Sidebars use **only** these tokens (no `bg-muted` or `bg-secondary` in sidebar):

| Token | Tailwind / usage | Meaning |
|-------|------------------|--------|
| `--sidebar` | `bg-sidebar` | Sidebar background |
| `--sidebar-foreground` | `text-sidebar-foreground` | Primary text on sidebar |
| `--sidebar-muted` | `text-sidebar-muted` | Inactive / secondary text |
| `--sidebar-accent` | `bg-sidebar-accent` | Hover / active item background |
| `--sidebar-border` | `border-sidebar-border` | Dividers and borders inside sidebar |
| `--sidebar-ring` | `ring-sidebar-ring` | Focus ring inside sidebar (optional) |

This keeps sidebars consistent across all theme templates.

---

## 3. Status tokens (with foregrounds)

Badges and status pills use **both** the status color and its foreground so they work in every theme:

| Token | Foreground | Usage |
|-------|------------|--------|
| `--status-success` | `--status-success-foreground` | Approved, done |
| `--status-warning` | `--status-warning-foreground` | Pending, caution |
| `--status-danger` | `--status-danger-foreground` | Error, blocked |
| `--status-neutral` | `--status-neutral-foreground` | Unknown, neutral |
| `--status-info` | `--status-info-foreground` | Informational |

Use the utility classes `badge-success`, `badge-warning`, etc. (they already use the foreground tokens), or `bg-status-*` + `text-status-*-foreground`. Do not invent per-component colors for status.

---

## 4. Primary vs accent strategy

- **Primary** = main CTA: “Nuevo Proyecto”, “Guardar”, “Ejecutar”, primary buttons.  
  - **Rule**: `bg-primary text-primary-foreground` (no `bg-blue-600`).  
  - In this ERP: primary is **neutral** (dark in light mode, light in dark mode) so it works in all templates.

- **Accent** = secondary emphasis: links, active tab, focus ring, progress bars, tags.  
  - **Rule**: `bg-accent`, `text-accent`, `ring-ring` (ring follows accent).  
  - In this ERP: accent = **Verde** para highlight de marca y estados positivos.

- **Brand accent** = `--brand-accent`, `--brand-accent-soft`, `--brand-accent-dark`.
- **Orange / Cobre** = token legacy (`--orange*`) mantenido temporalmente por compatibilidad; migrar nuevos usos a `--brand-accent*`.

**Do not** use primary as blue in light and accent in dark; keep one strategy and stick to tokens.

---

## 5. Table tokens

Tables use a small contract so they behave the same in every theme:

| Token | Meaning | Default (maps to) |
|-------|--------|--------------------|
| `--table-head` | Header row background | Muted-like surface |
| `--table-row-hover` | Row hover background | Slight tint of muted |
| `--table-border` | Cell borders / dividers | Same as `--border` in most themes |

Use `erp-table-surface` (which uses these tokens) or manually: `bg-table-head` for `<thead>`, `hover:bg-table-row-hover` for rows, `border-table-border` for borders.

---

## 6. Theme switching: class vs data-theme

- **`:root`** = default light. No class required.
- **`.dark`** = default dark. Set `class="dark"` on `<html>`.
- **`[data-theme="midnight"]`** = overrides only the variables defined for that selector.  
  - **Designed for dark.** Use with `class="dark"` on `<html>` for correct contrast.  
  - If you use it without `.dark`, only the overridden variables apply; the rest still come from `:root`, so you can get a light/midnight mix. Prefer `class="dark" data-theme="midnight"`.
- **`[data-theme="slate"]`** = same idea; works best with `class="dark"`.

**Fallback:**  
- Light: `:root` only.  
- Dark: `.dark` only.  
- Dark + template: `.dark` + `data-theme="midnight"` (or `slate`). Midnight/slate override only what they define; the rest come from `.dark`.  
- Do **not** rely on `data-theme` alone for a full dark look unless the template redefines every needed variable.

---

## 7. Surface utility classes (@layer utilities)

All in `globals.css` under `@layer utilities`; no hardcoded colors inside them:

| Class | Purpose |
|-------|--------|
| `erp-page` | `bg-background text-foreground` |
| `erp-panel` | `rounded-lg border border-border bg-card text-card-foreground` |
| `erp-input-surface` | Input-style: border, background, placeholder, focus ring (tokens only) |
| `erp-section-title` | `text-foreground` (section headings) |
| `erp-section-desc` | `text-muted-foreground` (section descriptions) |
| `erp-table-surface` | Table using `--table-head`, `--table-row-hover`, `--table-border` |

Use these instead of ad-hoc `text-gray-500` or similar.

---

## 8. Rules (summary)

1. **No hardcoded colors** — no `bg-white`, `text-gray-*`, `bg-blue-600`, etc.
2. **No arbitrary theme colors** — no `bg-[#...]`, `style={{ color }}` for theme; use `--chart-*` or status tokens in charts.
3. **Primary buttons** — always `bg-primary text-primary-foreground` (never `bg-blue-600`).
4. **Sidebars** — only sidebar tokens: `bg-sidebar`, `text-sidebar-foreground`, `text-sidebar-muted`, `bg-sidebar-accent`, `border-sidebar-border`.
5. **Status/badges** — use `badge-*` classes or `status-*` + `status-*-foreground`; no custom blue/amber/slate for status.
6. **Tables** — use `erp-table-surface` or `table-head` / `table-row-hover` / `table-border`.
7. **New tokens** — add in `:root`, `.dark`, and theme templates; document here. Prefer extending the existing set over one-off values.

With this, **templates are unlimited** by changing only `globals.css`.
