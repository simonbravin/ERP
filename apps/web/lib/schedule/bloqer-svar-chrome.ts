import type { IToolbarItem } from '@svar-ui/react-toolbar'

/** IDs de menú contextual propios (no ejecutan acciones internas de SVAR no persistidas en Prisma). */
export const BLOQER_GANTT_MENU = {
  edit: 'bloqer-edit-task',
  dependencies: 'bloqer-task-dependencies',
  view: 'bloqer-view-task',
} as const

export type BloqerGanttMenuActionId =
  (typeof BLOQER_GANTT_MENU)[keyof typeof BLOQER_GANTT_MENU]

/**
 * Barra SVAR: solo acciones que enlazamos con el servidor (formulario Bloqer).
 * No incluye alta/baja/mover filas del store local — el WBS vive en Prisma.
 */
export function buildBloqerGanttToolbarItems(opts: {
  isReadonly: boolean
  readonlyHint: string
  editLabel: string
  onOpenTaskForm: () => void
}): IToolbarItem[] {
  if (opts.isReadonly) {
    return [
      {
        id: 'bloqer-toolbar-readonly',
        comp: 'button',
        text: opts.readonlyHint,
        disabled: true,
        css: 'bloqer-svar-toolbar-readonly pointer-events-none opacity-70',
      },
    ]
  }
  return [
    {
      id: 'bloqer-toolbar-open-form',
      comp: 'icon',
      icon: 'wxi-edit',
      menuText: opts.editLabel,
      text: opts.editLabel,
      handler: () => {
        opts.onOpenTaskForm()
      },
    },
  ]
}

export function buildBloqerGanttContextMenuOptions(opts: {
  isReadonly: boolean
  editLabel: string
  dependenciesLabel: string
  viewLabel: string
}): Array<
  | { id: string; text: string; icon: string }
  | { type: 'separator' }
> {
  if (opts.isReadonly) {
    return [{ id: BLOQER_GANTT_MENU.view, text: opts.viewLabel, icon: 'wxi-info' }]
  }
  return [
    { id: BLOQER_GANTT_MENU.edit, text: opts.editLabel, icon: 'wxi-edit' },
    { type: 'separator' },
    {
      id: BLOQER_GANTT_MENU.dependencies,
      text: opts.dependenciesLabel,
      icon: 'wxi-menu-down',
    },
  ]
}
