# Cronograma: depuración y brechas tipo ERP construcción

## Qué significaba la nota del baseline

La **línea base** en pantalla compara el plan actual del cronograma que estás viendo (normalmente un **DRAFT**) con las fechas plan guardadas en la **versión baseline** del mismo proyecto. Ese mapa llega en `baselinePlanByWbsNodeId` desde `getScheduleForView`. En el Gantt SVAR se activa con la prop `baselines={true}` y fechas `base_start` / `base_end` por tarea (mismo `wbsNodeId`). No es un flag de entorno: depende de que exista una versión marcada como baseline en el proyecto.

## Checklist de depuración (cuando algo falla)

1. **Datos**: ¿El cronograma está en `DRAFT` para editar? Las acciones de fechas, progreso y dependencias suelen rechazar otros estados (mensaje del servidor).
2. **Red / sesión**: Revisar pestaña Network en las server actions (`updateTaskDates`, `updateTaskProgress`, `addTaskDependency`, …) y respuesta JSON (`success`, `error`).
3. **Consola**: Errores de hidratación o de SVAR suelen indicar fechas inválidas o props inesperadas; comprobar `parseSchedulePlanDate` y strings ISO de Prisma.
4. **WBS y visibilidad**: Filtros de filas (`visibleTaskIds`) y nodos colapsados: una tarea fuera del set no aparece en el Gantt aunque exista en el servidor.
5. **Baseline**: Si el interruptor está desactivado o el tooltip dice que no hay baseline, confirmar en BD/UI que otra versión del proyecto tenga `isBaseline: true` y que no estés viendo esa misma versión (en ese caso el servidor no envía mapa de comparación).
6. **i18n**: Tras añadir claves en `messages/en.json` y `es.json`, ejecutar `pnpm i18n:check-keys` en la raíz del monorepo.

## Funcionalidades que un ERP de construcción suele exigir en planificación

| Área | Estado orientativo en Bloqer | Notas |
|------|------------------------------|--------|
| WBS / tareas / hitos | Cubierto | Tabla + Gantt + calendario. |
| Dependencias FS/SS/FF/SF + lag | Cubierto en modelo y SVAR | Validar ciclos en servidor. |
| Ruta crítica / float | Parcial | Cálculo en backend; visual SVAR según `critical`. |
| Calendario laborable + feriados | Parcial | Excepciones en cronograma; SVAR OSS usa escala por día — calendario laboral fino es típico de SVAR **PRO** u otra librería. |
| Baseline y varianza | Parcial → mejorado | Comparación visual en Gantt con baseline del proyecto; varianza numérica (días de desvío) puede añadirse en columnas o informes. |
| Avance físico vs plan (% y fechas reales) | Parcial | `actualStart` / `actualEnd` / progreso según modelo; revisar paridad en UI e informes. |
| Curva S / earned value ligada al cronograma | Depende del módulo financiero | A menudo integración dashboard EVM + tareas. |
| Restricciones (no empezar antes de, deadlines) | Suelte faltar | Muchos ERPs tienen “must start on / deadline”. |
| Asignación de recursos y carga | Suelte faltar | Hoy asignación como texto; sin histograma de carga. |
| Subcontratistas y permisos por paquete | Suelte faltar | RBAC por WBS o por proyecto. |
| Multiproyecto / programas | Suelte faltar | Vista portfolio. |
| Import/export MS Project | Parcial | Import XML existe; export según producto. |
| Auditoría y versiones aprobadas | Parcial | Versiones y baseline; extender trazabilidad si hace falta compliance. |

## Próximos pasos recomendados (prioridad)

1. **Smoke manual** del flujo: DRAFT → mover barra → refresco → baseline ON/OFF con dos versiones.
2. **Tests e2e** (Playwright) opcionales: login, abrir cronograma, comprobar que el Gantt monta sin error.
3. **Decisión comercial**: si hace falta calendario laboral en el Gantt, auto-scheduling fuerte o export PRO, evaluar SVAR PRO vs alternativas (ver sitio SVAR: funciones PRO listadas).

Este documento es orientativo; el código fuente y las acciones en `apps/web/app/actions/schedule.ts` son la referencia final.
