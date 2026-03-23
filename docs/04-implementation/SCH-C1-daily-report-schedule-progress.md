# SCH-C1 — Avance parte diario → cronograma (decisión)

## Decisión

Cuando un **parte diario** pasa a **APROBADO**, el flujo existente `updateWbsProgressOnSubmit` ya recalcula **WBS** (`WbsNode.progressPct`, `WbsProgressUpdate`).

**Política aplicada:** además, se refleja el mismo porcentaje en el cronograma **solo si existe un `Schedule` en estado `DRAFT` para el proyecto** y una **`ScheduleTask` de tipo `TASK`** vinculada al mismo `wbsNodeId`.

- No se modifican versiones **BASELINE** ni **APPROVED**.
- Si hay varios borradores, se usa el **más reciente** por `updatedAt` (mismo criterio práctico que “borrador activo”).
- Se registra un `ProgressUpdate` con `scheduleTaskId` y nota `daily_report:<id>` para trazabilidad.

## Implementación

- `apps/web/app/actions/daily-reports-tier2.ts`: `syncDraftScheduleTaskProgressFromWbs` llamada al final de cada nodo actualizado en `updateWbsProgressOnSubmit`.
- `apps/web/app/actions/daily-reports.ts`: `revalidatePath` de `/projects/:id/schedule` tras aprobar.

## Fuera de alcance (v1)

- Recalcular CPM / hitos resumen en el Gantt tras el cambio de %.
- Sincronizar con más de un borrador a la vez.
- Actualizar desde partes que no pasan por `approveDailyReport`.
