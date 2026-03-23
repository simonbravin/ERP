import type { ListProjectRow, ListProjectsResult } from '@/app/actions/projects'

/** Normalize `listProjects()` result (array or paginated wrapper) to `projects[]`. */
export function unwrapListProjects(
  result: ListProjectRow[] | ListProjectsResult
): ListProjectRow[] {
  if (Array.isArray(result)) return result
  return result.projects
}
