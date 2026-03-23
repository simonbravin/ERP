# Plan de internacionalización (punta a punta)

Objetivo: **ningún texto de usuario** hardcodeado en `apps/web`; todo vive en `messages/es.json` y `messages/en.json` y se consume con `next-intl`.

## Principios

1. **Paridad es/en**: cada clave nueva en el mismo PR/cambio.
2. **Namespace por dominio**: `finance`, `projects`, `team`, `inventory`, `auth`, `common`, etc.
3. **Toasts y errores de UI**: claves bajo `*.toast.*` o mensajes dedicados; el fallback si el servidor no devuelve mensaje siempre es i18n.
4. **Zod y validación**: mensajes de error visibles deben obtenerse de `t()` (p. ej. pasar `t` al schema o mapear códigos a claves).
5. **Datos vs UI**: nombres de empresa, WBS, emails, etc. no se traducen; sí las etiquetas que los rodean.

## Fases

### Fase A — Inventario (automatizable)

- Buscar literales con acentos o patrones típicos en `apps/web/components` y `apps/web/app`.
- Buscar `placeholder="`, `title="`, `description="`, `aria-label="`, `toast.`, `z.string().min(..., '`.
- Mantener una lista viva en issues o checklist hasta cerrar.

### Fase B — Componentes cliente (`'use client'`)

- Sustituir strings por `useTranslations('namespace')`.
- Tablas y formularios: extraer cabeceras y placeholders a JSON.
- Listas estáticas (módulos, permisos): claves `team.module.*`, `team.permission.*` o equivalente.

### Fase C — Servidor (RSC, actions, PDF)

- `getTranslations` en layouts/pages que rendericen HTML con copy.
- Respuestas de error user-facing desde actions: claves consistentes o mensajes ya traducidos según `locale`.

### Fase D — Reportes, CSV y PDF

- Encabezados de exportación: claves por idioma o generación según `locale` en el request.
- Plantillas PDF: pasar strings traducidos desde el servidor.

### Fase E — Calidad

- **Paridad de claves** (obligatorio en CI cuando cambian mensajes): `pnpm i18n:check-keys` — compara todas las rutas de clave entre [`apps/web/messages/es.json`](../apps/web/messages/es.json) y [`apps/web/messages/en.json`](../apps/web/messages/en.json); falla si falta el mismo path en uno de los dos.
- `pnpm exec tsc --noEmit -p apps/web`.
- Revisión manual cambiando idioma en la UI.
- Regla Cursor: [`.cursor/rules/i18n-next-intl.mdc`](../.cursor/rules/i18n-next-intl.mdc).

## Revisión de traducciones: proceso en 3 pasos

1. **Paridad JSON** — `pnpm i18n:check-keys` (sin diferencias = OK).
2. **Código** — comandos de búsqueda abajo; cada hallazgo es migración a `t()` + clave en es/en.
3. **Manual con toggle** — recorrer el módulo en ES y EN; anotar textos que no cambian, mezclas de idioma o cortes de layout.

## Comandos útiles (desde la raíz del repo)

Con [ripgrep](https://github.com/BurntSushi/ripgrep) (`rg`), en PowerShell o bash:

```bash
# Toasts aún con string literal
rg "toast\.(success|error|info|warning)\([`'\"]" apps/web --glob "*.{tsx,ts}"

# Placeholders / aria / títulos con comillas (revisar hits; no todos son UI)
rg "placeholder=\"[^\"]+\"" apps/web/components --glob "*.tsx"
rg "aria-label=\"[^\"]+\"" apps/web/components --glob "*.tsx"
rg "title=\"[^\"]+\"" apps/web/components --glob "*.tsx"

# Zod con mensaje inline (suele ser copy de usuario)
rg "z\.string\(\)\.min\([^,]+,\s*['\`]" apps/web --glob "*.{tsx,ts}"

# Pista rápida de español en strings (acentos / ñ)
rg "['\`\"][^'\`\"]*[áéíóúñÁÉÍÓÚÑ][^'\`\"]*['\`\"]" apps/web/components --glob "*.tsx"
```

Interpretación: los `rg` pueden dar **falsos positivos** (URLs, nombres técnicos). El criterio sigue siendo: ¿lo ve el usuario final? → debe ir a i18n.

## Checklist manual por módulo (toggle ES / EN)

Marcar cada ítem cuando no queden textos hardcodeados visibles y la paridad de claves pase.

| Módulo | Rutas / pantallas a cubrir |
|--------|----------------------------|
| Auth | Login, registro, recuperar contraseña, super-admin login |
| Navegación | [`global-sidebar`](../apps/web/components/layout/global-sidebar.tsx), [`project-sidebar`](../apps/web/components/layout/project-sidebar.tsx), header |
| Proyectos | Lista, creación, formulario proyecto, dashboard proyecto |
| Presupuesto / WBS | Vista presupuesto, APU, editor WBS |
| Finanzas | Transacciones, OC, dashboards ejecutivo y proyecto, caja |
| Materiales / inventario / calidad | Listados, formularios de movimiento, RFIs |
| Equipo e invitaciones | Miembros, permisos, invitaciones pendientes |
| Reportes y exportaciones | Predefinidos, columnas CSV/Excel |
| Configuración | Perfil, organización, equipo en settings |
| Libro de obra | Lista, detalle, formulario |

**Hecho por oleada:** `pnpm i18n:check-keys` OK + checklist del módulo marcado + `pnpm exec tsc --noEmit -p apps/web` OK.

## Estado actual (marzo 2026)

Corregido en esta pasada: **detalle de OC**, **permisos de miembro**, **invitaciones pendientes**, **edición/creación de OC (materiales)**, **super admin edición de usuario** (cabeceras principales), **adjuntos libro de obra**.

Pendiente de alto volumen (siguiente oleadas): **project-dashboard**, **finance-executive-dashboard**, **formularios de inventario/movimientos**, **auth (super-admin login)**, **team-members-table**, **reportes predefinidos**, **schedule calendar días**, **dashboard activity feed**, **wbs/budget dialogs**, etc.

## Orden recomendado para seguir

1. Auth y onboarding (primer contacto).
2. Navegación y sidebars.
3. Finanzas y proyectos (dashboards con muchos strings).
4. Inventario y calidad.
5. Reportes y exportaciones.
6. Pulsar Zod en formularios grandes archivo por archivo.
