import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { AuthRequest, requireAdmin, requireChoirAccess } from '../../middleware/auth';

const router = Router();

router.get('/me', async (request: AuthRequest, response) => {
  const memberships = await prisma.membership.findMany({ where: { userId: request.userId }, include: { choir: true } });
  return response.json(memberships);
});

router.get('/:choirId/people', requireChoirAccess, async (request, response) => {
  const members = await prisma.membership.findMany({ where: { choirId: String(request.params.choirId) }, include: { user: { select: { id: true, name: true, email: true, role: true } } }, orderBy: { user: { name: 'asc' } } });
  return response.json(members);
});

router.delete('/:choirId/people/:userId', requireAdmin, async (request, response) => {
  await prisma.membership.delete({ where: { userId_choirId: { userId: String(request.params.userId), choirId: String(request.params.choirId) } } });
  return response.status(204).send();
});


export default router;
