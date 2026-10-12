import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { AuthRequest, requireChoirAccess } from '../../middleware/auth';
import { eventSongInclude, serializeEventSongs } from './shared';

const router = Router();

router.get('/:choirId/rehearsals', requireChoirAccess, async (request: AuthRequest, response) => {
  const userId = request.userId as string;
  const choirId = String(request.params.choirId);
  const viewer = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  const canManage = viewer?.role === 'ADMIN' || viewer?.role === 'LEADER';
  const rehearsals = await prisma.rehearsal.findMany({
    where: { choirId },
    orderBy: { startsAt: 'asc' },
    include: {
      attendances: { select: { userId: true, status: true } },
      invitations: { include: { user: { select: { id: true, name: true } } } },
      eventSongs: eventSongInclude,
    },
  });
  const choirMembers = canManage ? await prisma.membership.findMany({
    where: { choirId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { user: { name: 'asc' } },
  }) : [];
  const visibleEvents = rehearsals.filter((event) => canManage || event.invitations.length === 0 || event.invitations.some((invitation) => invitation.userId === userId));
  return response.json(visibleEvents.map((event) => ({
    id: event.id,
    title: event.title,
    eventType: event.eventType,
    customEventType: event.customEventType,
    eventTypeName: event.customEventType ?? event.eventType,
    recurrenceFrequency: event.recurrenceFrequency,
    recurrenceIndex: event.recurrenceIndex,
    recurrenceTotal: event.recurrenceTotal,
    location: event.location,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    createdAt: event.createdAt,
    invitationOnly: event.invitations.length > 0,
    invited: event.invitations.length === 0 || event.invitations.some((invitation) => invitation.userId === userId),
    myStatus: event.attendances.find((attendance) => attendance.userId === userId)?.status ?? 'PENDING',
    confirmedCount: event.attendances.filter((attendance) => attendance.status === 'YES').length,
    songs: serializeEventSongs(event.eventSongs),
    invitees: canManage ? (event.invitations.length > 0
      ? event.invitations.map((invitation) => ({ userId: invitation.userId, name: invitation.user.name }))
      : choirMembers.map((member) => ({ userId: member.user.id, name: member.user.name }))).map((invitee) => ({
        ...invitee,
        status: event.attendances.find((attendance) => attendance.userId === invitee.userId)?.status ?? 'PENDING',
      })) : undefined,
  })));
});


export default router;
