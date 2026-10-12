import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { AuthRequest, requireChoirAccess } from '../../middleware/auth';

const router = Router();

router.post('/:choirId/rehearsals/:rehearsalId/attendance', requireChoirAccess, async (request: AuthRequest, response) => {
  const body = request.body ?? {};
  const statuses = ['YES', 'MAYBE', 'NO', 'PENDING'];
  const status = statuses.includes(body.status)
    ? body.status
    : body.status === undefined && typeof body.present === 'boolean'
      ? body.present ? 'YES' : 'NO'
      : null;
  if (!status) return response.status(400).json({ message: 'Choose YES, MAYBE, NO, or PENDING for your attendance response.' });
  const rehearsalId = String(request.params.rehearsalId);
  const userId = request.userId as string;
  const [membership, rehearsal] = await Promise.all([
    prisma.membership.findUnique({ where: { userId_choirId: { userId, choirId: String(request.params.choirId) } } }),
    prisma.rehearsal.findFirst({ where: { id: rehearsalId, choirId: String(request.params.choirId) }, include: { invitations: { where: { userId }, select: { id: true } } } }),
  ]);
  if (!membership || !rehearsal) return response.status(403).json({ message: 'You cannot respond to this event.' });
  if (rehearsal.endsAt.getTime() < Date.now()) return response.status(410).json({ message: 'This event has ended, so its attendance response is closed.' });
  const invitationCount = await prisma.eventInvitation.count({ where: { rehearsalId } });
  if (invitationCount > 0 && rehearsal.invitations.length === 0) return response.status(403).json({ message: 'This event is invitation-only, and you were not invited.' });
  const attendance = await prisma.attendance.upsert({ where: { rehearsalId_userId: { rehearsalId, userId } }, update: { status, present: status === 'YES' }, create: { rehearsalId, userId, status, present: status === 'YES' } });
  return response.json(attendance);
});


export default router;
