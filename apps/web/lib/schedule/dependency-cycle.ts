/**
 * Pure function: given existing dependency edges, would adding (predecessorId -> successorId) create a cycle?
 * Returns true if adding the edge would create a cycle (i.e. there is already a path from successorId to predecessorId).
 */
export function wouldCreateCycle(
  edges: Array<{ predecessorId: string; successorId: string }>,
  predecessorId: string,
  successorId: string
): boolean {
  const adj = new Map<string, string[]>()
  for (const d of edges) {
    const list = adj.get(d.predecessorId) ?? []
    list.push(d.successorId)
    adj.set(d.predecessorId, list)
  }

  const visited = new Set<string>()
  function dfs(nodeId: string): boolean {
    if (nodeId === predecessorId) return true
    if (visited.has(nodeId)) return false
    visited.add(nodeId)
    for (const next of adj.get(nodeId) ?? []) {
      if (dfs(next)) return true
    }
    return false
  }
  return dfs(successorId)
}
