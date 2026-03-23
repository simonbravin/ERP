# Cronograma: issues por fase

Lista accionable derivada del análisis de funcionalidad, permisos, exportación e integraciones. Convención de IDs: **`SCH-XYn`** (fase + número). Marcar `[x]` al cerrar cada ítem.

---

## Fase A — Correcciones y seguridad

Objetivo: cerrar inconsistencias de gobernanza y acceso antes de features nuevas.

- [x] **SCH-A1 — Bloquear `updateTaskProgress` fuera de DRAFT (o política explícita)**  
  - **Problema:** `updateTaskProgress` en `apps/web/app/actions/schedule.ts` no valida `schedule.status === 'DRAFT'`; fechas plan y dependencias sí quedan bloqueadas en BASELINE/APPROVED.  
  - **Criterios de aceptación:**  
    - Si la política es “solo borrador”: rechazar con mensaje claro si `status !== 'DRAFT'`.  
    - UI alineada (diálogo de tarea / barras de progreso deshabilitadas si no aplica).  
    - Si se elige permitir solo campos “reales” (`actual*`) en versiones firmadas, documentarlo en el mismo PR y reflejar en UI + action.  
  - **Archivos típicos:** `schedule.ts`, `task-edit-dialog.tsx`, `schedule-view-client.tsx` / componentes que llamen a `updateTaskProgress`.

- [x] **SCH-A2 — Endurecer `validateAccess` del PDF de cronograma**  
  - **Problema:** `apps/web/lib/pdf/templates/schedule.template.ts` solo comprueba que el schedule exista en la org; no valida membresía/proyecto.  
  - **Criterios de aceptación:**  
    - Tras resolver el schedule, ejecutar el mismo criterio que la vista: p. ej. `assertProjectAccess(schedule.projectId, org)` con sesión/org cargada.  
    - Si el producto exige área SCHEDULE: opcionalmente `canAccessProjectArea(..., SCHEDULE)` para **view**.  
    - Prueba manual: usuario restringido sin proyecto no puede generar PDF por `scheduleId` ajeno.  
  - **Archivos típicos:** `schedule.template.ts`, posiblemente `apps/web/app/api/pdf/route.ts` si hace falta pasar más contexto a `validateAccess`.

- [x] **SCH-A3 — Política org EDITOR + proyecto VIEWER en cronograma**  
  - **Problema:** `canEditSchedule` permite editar si el rol de org es EDITOR/ADMIN/OWNER aunque el rol en proyecto sea VIEWER (si el área schedule en proyecto no otorga edit).  
  - **Decisión aplicada:** `canEditSchedule` vive en `lib/schedule-permissions.ts`. **OWNER** y **ADMIN** de organización mantienen bypass en cualquier proyecto (tras acceso al proyecto). El resto (incl. **EDITOR** org) debe tener **edición** en área **SCHEDULE** del rol en proyecto (`canEditProjectArea`).  
  - **Criterios de aceptación:**  
    - ~~Decisión de producto documentada~~ ✓ (este bloque + JSDoc en `schedule-permissions.ts`).  
    - ~~Opción restrictiva~~ ✓  
    - ~~CTAs alineadas~~ ✓ (`schedule/page.tsx`, `schedule/new/page.tsx`; acciones ya usaban `canEditSchedule`).  
  - **Archivos típicos:** `apps/web/app/actions/schedule.ts` (`canEditSchedule`), `schedule/page.tsx`, `schedule/new/page.tsx`.

---

## Fase B — Paridad “obra estándar” (UX y export)

Objetivo: acercar la experiencia a lo que suelen pedir jefes de obra y PMO.

- [x] **SCH-B1 — Selector de versión de cronograma**  
  - **Qué:** Lista de schedules del proyecto; elegir cuál ver/editar (no solo “DRAFT si existe, si no baseline”).  
  - **Criterios:** URL con `?schedule=<uuid>` cuando se elige una versión no default; sin query se mantiene la prioridad DRAFT → baseline → más reciente; permisos según versión activa.  
  - **Implementación:** `ScheduleVersionSelector` + `schedule/page.tsx`.  
  - **Archivos típicos:** `schedule/page.tsx`, `schedule-view.tsx`, posible ruta o query param.

- [x] **SCH-B2 — Baseline visible en el Gantt**  
  - **Qué:** Sustituir o complementar el placeholder “baseline próximamente”: barras sombra, segunda barra o columnas de varianza mínimas.  
  - **Criterios:** Requiere definir fuente de datos (baseline del proyecto vs tarea a tarea); coherente con `isBaseline` / fechas de proyecto.  
  - **Implementación:** `getScheduleForView` expone `baselinePlanByWbsNodeId` (cronograma con `isBaseline` del mismo proyecto, distinto al visto); Gantt dibuja barras semitransparentes detrás del plan actual; switch habilitado cuando hay datos.  
  - **Archivos típicos:** `gantt-timeline-dynamic.tsx`, `schedule-view-client.tsx`, datos desde `getScheduleForView` o query adicional.

- [x] **SCH-B3 — Export Excel del cronograma**  
  - **Qué:** Descarga XLSX con tareas, fechas plan, duración, %, predecesoras (texto o IDs), crítico.  
  - **Criterios:** Mismo alcance que tabla visible o proyecto completo; i18n de cabeceras si aplica.  
  - **Implementación:** `exportScheduleToExcel` en `app/actions/export.ts` (datos vía `getScheduleForView`: todas las tareas ordenadas por WBS); cabeceras y textos ES/EN según `document.documentElement.lang`; CTA en cabecera y panel.  
  - **Archivos típicos:** nueva server action o API route, patrón similar a otros exports Excel del repo.

- [x] **SCH-B4 — PDF: modos o segunda plantilla (tabular vs “vista”)**  
  - **Qué:** Mantener PDF tabular actual; añadir opción de PDF con vista calendario o captura Gantt (definir técnica: print page dedicada, Puppeteer, etc.).  
  - **Criterios:** Parámetros de query documentados; mismo control de acceso que SCH-A2.  
  - **Implementación:** PDF tabular + **A4 horizontal**; encabezado reutilizado; `?mode=view` = Gantt estático (HTML). `validateAccess` del template alineado con `assertProjectAccess` + área SCHEDULE. **Opcional futuro:** calendario mensual dedicado o captura del canvas del Gantt.  
  - **Archivos típicos:** `api/pdf/route.ts`, `lib/pdf/templates/`, `print/schedule/`.

- [x] **SCH-B5 — Pestaña Cronograma condicionada a permisos de proyecto**  
  - **Qué:** No mostrar enlace a `/schedule` si `canAccessProjectArea` para SCHEDULE es falso.  
  - **Criterios:** Consistente con otras áreas del proyecto; layout recibe `projectRole` o flags desde servidor.  
  - **Implementación:** `canViewProjectSchedule` en `project-permissions.ts`; layout de proyecto + página versión presupuesto pasan `showScheduleTab`; `/schedule` y `/schedule/new` con `notFound` si no aplica.  
  - **Archivos típicos:** `project-tabs.tsx` / wrapper server que pase permisos.

---

## Fase C — Integración (datos y flujos)

Objetivo: un hilo de avance y lectura cruzada con finanzas y obra.

**C2 / C3:** implementados en dashboard de proyecto (`getProjectDashboardData` + `project-dashboard-client`): EVM ligero y alertas cruzadas retraso/coste por partida (umbrales 5% / 10%).

- [x] **SCH-C1 — Política de avance: parte diario ↔ cronograma**  
  - **Qué:** Definir si `WbsProgressUpdate` (tier 2) debe actualizar `ScheduleTask` del DRAFT activo, crear `ProgressUpdate` con `scheduleTaskId`, o solo dashboard WBS.  
  - **Criterios:** Documento corto de decisión + implementación mínima (una de las ramas) y tests o checklist manual.  
  - **Implementación:** `docs/04-implementation/SCH-C1-daily-report-schedule-progress.md` + sincronización en `daily-reports-tier2.ts` y `revalidatePath` en `approveDailyReport`.  
  - **Archivos típicos:** `daily-reports-tier2.ts`, `schedule.ts`, schema si hace falta FK opcional.

- [x] **SCH-C2 — Panel o KPIs mini-EVM (o puente hacia finanzas)**  
  - **Qué:** BAC/PV/EV/AC a nivel proyecto o WBS, usando presupuesto + avance de schedule + transacciones (aunque sea solo lectura).  
  - **Criterios:** Ubicación en UI acordada (dashboard proyecto vs pestaña cronograma); sin duplicar fuentes de verdad.  
  - **Implementación:** Tarjeta EVM en dashboard del proyecto; BAC = total presupuesto referencia del dashboard; AC = gastado pagado; EV = BAC × avance físico (tareas TASK ponderadas por duración); PV lineal en ventana plan del cronograma activo (DRAFT → baseline → último); CPI/SPI/CV/SV.  
  - **Archivos típicos:** `app/actions/project-dashboard.ts`, `project-dashboard-client.tsx`, impresión `print/project-dashboard`.

- [x] **SCH-C3 — Alertas cruzadas (retraso vs materiales / coste)**  
  - **Qué:** Señales cuando tarea retrasada y desvío de consumo o coste por misma WBS (datos ya existentes o incremental).  
  - **Criterios:** Al menos una alerta en dashboard o cronograma; configurable o por umbrales simples.  
  - **Implementación:** Retraso = fin plan &lt; hoy y avance &lt; 100%; coste = gasto real por WBS vs presupuesto partida; cruce +5% con retraso; solo coste +10%; lista acotada (8).  
  - **Archivos típicos:** `project-dashboard.ts`, `project-dashboard-client.tsx`.

---

## Fase D — Opcional enterprise

Objetivo: profundidad tipo MS Project / P6 solo si hay demanda clara.

**Estado:** sin implementar en código; queda como backlog de producto cuando exista demanda.

- [x] **SCH-D1 — Calendarios laborables por proyecto (feriados, excepciones)** (v1)  
  - **Qué:** Lista de fechas no laborables por **cronograma** (`schedules.non_working_dates` JSONB), además de `workingDaysPerWeek`.  
  - **Uso:** CPM (`calculateCriticalPath`), rollup SUMMARY, validación de dependencias, `updateTaskDates`, Gantt (arrastre) y tabla WBS; UI en vista cronograma (solo DRAFT) + duplicado de revisión copia excepciones.  
  - **Pendiente evolutivo:** calendarios reutilizables por org/proyecto, “días laborables” distintos al patrón 5/6/7, y zona horaria explícita.

- [x] **SCH-D2 — Import / export MS Project (XML)** (v1)
  - **Export:** `exportScheduleToMsProjectXml` + `lib/schedule/ms-project-xml.ts` (MSPDI); tareas ordenadas por WBS, `OutlineNumber`, fechas, duración en horas según `hoursPerDay`, % avance, `PredecessorLink` con tipo FS/SS/FF/SF y lag (décimas de minuto). CTA en vista cronograma.
  - **Import:** `importScheduleFromMsProjectXml` solo **DRAFT**: empareja `OutlineNumber` con código WBS; actualiza inicio/fin/duración (TASK/MILESTONE; ignora filas summary del XML para fechas); **reemplaza** todas las dependencias del cronograma; omite enlaces que crearían ciclo; rollup SUMMARY + ruta crítica. Dependencia: `fast-xml-parser`.
  - **Evolutivo:** recursos, calendarios externos, validación más estricta con archivos de Project reales.

- [x] **SCH-D3 — Recursos en cronograma (asignación simple)** (v1 texto libre + equipo)
  - **Qué:** Campo `assigned_to` en `schedule_tasks` editable desde **Editar tarea** (`updateTaskDates` + `TaskEditDialog`): selector con **miembros del proyecto** (`getProjectMembers`) + texto libre; tarjeta **Carga por responsable** (conteo TASK/MILESTONE, sin SUMMARY); agrupación por asignado y columna Excel “Asignado a”.
  - **Evolutivo:** FK a `org_member` / horas por tarea, nivelación automática, calendario por recurso.

---

## Orden de trabajo sugerido

1. Cerrar **toda la Fase A** antes de B1+.  
2. **B1** y **B5** mejoran navegación y contexto; **B3** suele ser el quick win de negocio.  
3. **C1** desbloquea coherencia de datos para C2/C3.

Cuando pasemos a implementar, abrir un PR por issue (o agrupar A1+A2 si son tocados pequeños en los mismos archivos) y actualizar los checkboxes de este documento al mergear.
