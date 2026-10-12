import { serializeEventSongs } from './shared';

export function serializeCreatedEvent(rehearsal: any) {
  return {
    id: rehearsal.id,
    title: rehearsal.title,
    eventType: rehearsal.eventType,
    customEventType: rehearsal.customEventType,
    eventTypeName: rehearsal.customEventType ?? rehearsal.eventType,
    location: rehearsal.location,
    startsAt: rehearsal.startsAt,
    endsAt: rehearsal.endsAt,
    invitationOnly: rehearsal.invitations.length > 0,
    invited: true,
    myStatus: 'PENDING',
    confirmedCount: 0,
    songs: serializeEventSongs(rehearsal.eventSongs),
    invitees: rehearsal.invitations.map((invitation: any) => ({ userId: invitation.userId, name: invitation.user.name, status: 'PENDING' })),
  };
}
