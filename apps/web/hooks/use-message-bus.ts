'use client'

import { useCallback, useEffect, useRef } from 'react'

/**
 * Event types emitted by the outbox / backend.
 * Add new types here as you add new events in event-publisher.
 */
export type MessageBusEventType =
  | 'PROJECT.CREATED'
  | 'PROJECT.UPDATED'
  | 'PROJECT.DELETED'
  | 'WBS.UPDATED'
  | 'WBS_NODE.CREATED'
  | 'WBS_NODE.UPDATED'
  | 'WBS_NODE.DELETED'
  | 'WBS_NODE.REORDERED'
  | 'BUDGET.UPDATED'
  | 'BUDGET_LINE.CREATED'
  | 'BUDGET_LINE.UPDATED'
  | 'BUDGET_LINE.DELETED'
  | 'BUDGET_RESOURCE.ADDED'
  | 'BUDGET_VERSION.APPROVED'
  // Inventory
  | 'INVENTORY_CATEGORY.CREATED'
  | 'INVENTORY_SUBCATEGORY.CREATED'
  | 'INVENTORY_ITEM.CREATED'
  | 'INVENTORY_ITEM.UPDATED'
  | 'INVENTORY_ITEM.DELETED'
  | 'INVENTORY_LOCATION.CREATED'
  | 'INVENTORY_MOVEMENT.CREATED'
  // Finance
  | 'FINANCE_TRANSACTION.CREATED'
  | 'FINANCE_TRANSACTION.UPDATED'
  | 'OVERHEAD_ALLOCATION.UPDATED'
  | 'OVERHEAD_ALLOCATION.DELETED'
  // Documents
  | 'DOCUMENT.UPLOADED'
  | 'DOCUMENT.VERSION_ADDED'
  | 'DOCUMENT.LINKED'
  | 'DOCUMENT.DELETED'
  // Team / Org
  | 'ORG_MEMBER.INVITED'
  | 'ORG_MEMBER.UPDATED'
  // Certifications
  | 'CERTIFICATION.CREATED'
  | 'CERTIFICATION.UPDATED'
  | 'CERTIFICATION.ISSUED'
  | 'CERTIFICATION.APPROVED'
  | 'CERTIFICATION.REJECTED'
  | 'CERTIFICATION.DELETED'
  // Party / Suppliers
  | 'PARTY.CREATED'
  | 'PARTY.UPDATED'
  | 'PARTY.LINKED'
  | 'PARTY.UNLINKED'
  // Change orders
  | 'CHANGE_ORDER.CREATED'
  | 'CHANGE_ORDER.UPDATED'
  | 'CHANGE_ORDER.APPROVED'

/** All event types for "subscribe to all" (e.g. debug widget). */
export const ALL_MESSAGE_BUS_EVENT_TYPES: MessageBusEventType[] = [
  'PROJECT.CREATED',
  'PROJECT.UPDATED',
  'PROJECT.DELETED',
  'WBS.UPDATED',
  'WBS_NODE.CREATED',
  'WBS_NODE.UPDATED',
  'WBS_NODE.DELETED',
  'WBS_NODE.REORDERED',
  'BUDGET.UPDATED',
  'BUDGET_LINE.CREATED',
  'BUDGET_LINE.UPDATED',
  'BUDGET_LINE.DELETED',
  'BUDGET_RESOURCE.ADDED',
  'BUDGET_VERSION.APPROVED',
  'INVENTORY_CATEGORY.CREATED',
  'INVENTORY_SUBCATEGORY.CREATED',
  'INVENTORY_ITEM.CREATED',
  'INVENTORY_ITEM.UPDATED',
  'INVENTORY_ITEM.DELETED',
  'INVENTORY_LOCATION.CREATED',
  'INVENTORY_MOVEMENT.CREATED',
  'FINANCE_TRANSACTION.CREATED',
  'FINANCE_TRANSACTION.UPDATED',
  'OVERHEAD_ALLOCATION.UPDATED',
  'OVERHEAD_ALLOCATION.DELETED',
  'DOCUMENT.UPLOADED',
  'DOCUMENT.VERSION_ADDED',
  'DOCUMENT.LINKED',
  'DOCUMENT.DELETED',
  'ORG_MEMBER.INVITED',
  'ORG_MEMBER.UPDATED',
  'CERTIFICATION.CREATED',
  'CERTIFICATION.UPDATED',
  'CERTIFICATION.ISSUED',
  'CERTIFICATION.APPROVED',
  'CERTIFICATION.REJECTED',
  'CERTIFICATION.DELETED',
  'PARTY.CREATED',
  'PARTY.UPDATED',
  'PARTY.LINKED',
  'PARTY.UNLINKED',
  'CHANGE_ORDER.CREATED',
  'CHANGE_ORDER.UPDATED',
  'CHANGE_ORDER.APPROVED',
]

export type MessageBusPayload = {
  entityType: string
  entityId: string
  [key: string]: unknown
}

type Listener = (payload: MessageBusPayload) => void

/** Simple in-memory event bus for client-side subscriptions. */
const listenersByType = new Map<MessageBusEventType, Set<Listener>>()

function subscribe(eventType: MessageBusEventType, listener: Listener): () => void {
  let set = listenersByType.get(eventType)
  if (!set) {
    set = new Set()
    listenersByType.set(eventType, set)
  }
  set.add(listener)
  return () => {
    set!.delete(listener)
    if (set!.size === 0) listenersByType.delete(eventType)
  }
}

/**
 * Emit an event on the client bus (e.g. after an optimistic update or for testing).
 * In the future, this can be replaced by or merged with events received via SSE/WebSockets
 * that are pushed by the backend when Inngest completes processing.
 */
export function emitMessageBusEvent(
  eventType: MessageBusEventType,
  payload: MessageBusPayload
): void {
  const set = listenersByType.get(eventType)
  if (!set) return
  set.forEach((listener) => {
    try {
      listener(payload)
    } catch (err) {
      console.error('[MessageBus] listener error:', err)
    }
  })
}

/**
 * Hook to subscribe to specific event types from the message bus.
 * Uses a client-side EventEmitter-style bus; prepared for future
 * connection to WebSockets or SSE when Inngest (or another service)
 * pushes notifications to the client.
 *
 * @param eventType - e.g. 'PROJECT.UPDATED'
 * @param onEvent - callback when an event of this type is received
 */
export function useMessageBus(
  eventType: MessageBusEventType,
  onEvent: (payload: MessageBusPayload) => void
): void {
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  const stableCallback = useCallback((payload: MessageBusPayload) => {
    onEventRef.current(payload)
  }, [])

  useEffect(() => {
    return subscribe(eventType, stableCallback)
  }, [eventType, stableCallback])
}

/**
 * Subscribe to all event types (e.g. for debug widget).
 * Calls onEvent(eventType, payload) for every event.
 */
export function useMessageBusAll(
  onEvent: (eventType: MessageBusEventType, payload: MessageBusPayload) => void
): void {
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent
  const stableCallback = useCallback((eventType: MessageBusEventType, payload: MessageBusPayload) => {
    onEventRef.current(eventType, payload)
  }, [])

  useEffect(() => {
    const unsubs = ALL_MESSAGE_BUS_EVENT_TYPES.map((eventType) =>
      subscribe(eventType, (payload) => stableCallback(eventType, payload))
    )
    return () => {
      unsubs.forEach((u) => u())
    }
  }, [stableCallback])
}
