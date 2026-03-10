import { describe, it, expect } from 'vitest'
import { wouldCreateCycle } from '../dependency-cycle'

describe('wouldCreateCycle', () => {
  it('returns false when edges are empty', () => {
    expect(wouldCreateCycle([], 'A', 'B')).toBe(false)
  })

  it('returns false when no path from successor to predecessor', () => {
    // A -> B, B -> C. Adding C -> A would create cycle. Adding A -> C would not (A->B->C, then A->C is redundant but no cycle).
    // Actually: we have A->B, B->C. If we add C->A, then we have A->B->C->A = cycle. So wouldCreateCycle([{A,B},{B,C}], C, A) = true.
    // If we add A->C: do we have path from C to A? C has no outgoing. So no. wouldCreateCycle([{A,B},{B,C}], A, C) = false.
    const edges = [
      { predecessorId: 'A', successorId: 'B' },
      { predecessorId: 'B', successorId: 'C' },
    ]
    expect(wouldCreateCycle(edges, 'A', 'C')).toBe(false)
  })

  it('returns true when adding edge would create cycle', () => {
    // A -> B, B -> C. Adding C -> A creates cycle C -> A -> B -> C.
    const edges = [
      { predecessorId: 'A', successorId: 'B' },
      { predecessorId: 'B', successorId: 'C' },
    ]
    expect(wouldCreateCycle(edges, 'C', 'A')).toBe(true)
  })

  it('returns true for direct back-edge', () => {
    // A -> B. Adding B -> A creates cycle A -> B -> A.
    const edges = [{ predecessorId: 'A', successorId: 'B' }]
    expect(wouldCreateCycle(edges, 'B', 'A')).toBe(true)
  })

  it('returns false for linear chain extension', () => {
    // A -> B -> C. Adding C -> D does not create cycle.
    const edges = [
      { predecessorId: 'A', successorId: 'B' },
      { predecessorId: 'B', successorId: 'C' },
    ]
    expect(wouldCreateCycle(edges, 'C', 'D')).toBe(false)
  })

  it('returns true for longer cycle', () => {
    // A -> B -> C -> D. Adding D -> A creates cycle.
    const edges = [
      { predecessorId: 'A', successorId: 'B' },
      { predecessorId: 'B', successorId: 'C' },
      { predecessorId: 'C', successorId: 'D' },
    ]
    expect(wouldCreateCycle(edges, 'D', 'A')).toBe(true)
  })
})
