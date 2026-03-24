export function mapPaddleEventType(eventType: string): string {
  switch (eventType) {
    case 'subscription.created':
    case 'subscription.activated':
    case 'subscription.updated':
    case 'subscription.canceled':
    case 'subscription.paused':
    case 'transaction.paid':
    case 'transaction.completed':
    case 'transaction.payment_failed':
      return eventType
    default:
      return 'ignored'
  }
}
