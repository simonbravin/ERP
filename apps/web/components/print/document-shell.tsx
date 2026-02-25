/**
 * Optional wrapper: header + children for print layout.
 * Use when a page needs to compose header + content in one place.
 * The main print layout already provides DocumentHeader + main; use this only for custom compositions.
 */
type DocumentShellProps = {
  children: React.ReactNode
  className?: string
}

export function DocumentShell({ children, className }: DocumentShellProps) {
  return (
    <div className={`print-document-shell ${className ?? ''}`.trim()}>
      {children}
    </div>
  )
}
