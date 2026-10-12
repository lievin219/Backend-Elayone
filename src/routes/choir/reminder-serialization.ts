export function buildEventReminders(events: any[], userId: string, canManage: boolean, now: Date) {
  return events.flatMap((event) => {
    const invited = event.invitations.length === 0 || event.invitations.some((invitation: any) => invitation.userId === userId);
    if (!canManage && !invited) return [];
    const hoursUntil = Math.max(0, Math.round((event.startsAt.getTime() - now.getTime()) / (60 * 60 * 1000)));
    const eventLabel = event.customEventType ?? event.eventType.replace('_', ' ');
    const pending = event.attendances.filter((attendance: any) => attendance.status === 'PENDING');
    const accepted = event.attendances.filter((attendance: any) => attendance.status === 'YES').length;
    const declined = event.attendances.filter((attendance: any) => attendance.status === 'NO').length;
    const results: Array<{ id: string; kind: 'EVENT' | 'RESPONSE'; title: string; message: string; priority: 'NORMAL' | 'IMPORTANT'; createdAt: string; eventId: string }> = [{
      id: `event-${event.id}-${userId}`, kind: 'EVENT', title: `${event.title} is coming up`,
      message: `${eventLabel} starts ${hoursUntil < 24 ? `in ${hoursUntil} hour${hoursUntil === 1 ? '' : 's'}` : `on ${event.startsAt.toLocaleDateString()}`} at ${event.location}.`,
      priority: hoursUntil < 24 ? 'IMPORTANT' : 'NORMAL', createdAt: now.toISOString(), eventId: event.id,
    }];
    if (canManage) {
      results.push({
        id: `response-${event.id}-${userId}`, kind: 'RESPONSE', title: `${event.title} attendance`,
        message: `${accepted} accepted, ${declined} declined, ${pending.length} still awaiting a response.`,
        priority: pending.length > 0 ? 'IMPORTANT' : 'NORMAL', createdAt: now.toISOString(), eventId: event.id,
      });
    } else if (event.attendances.find((attendance: any) => attendance.userId === userId)?.status === undefined) {
      results.push({
        id: `reply-${event.id}-${userId}`, kind: 'RESPONSE', title: `Respond to ${event.title}`,
        message: 'Please accept, choose maybe, or decline this event.', priority: 'IMPORTANT',
        createdAt: now.toISOString(), eventId: event.id,
      });
    }
    return results;
  });
}
