import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthRequest, requireAdministrator } from '../middleware/auth';

const router = Router();

const newMemberSchema = z.object({
  name: z.string().trim().min(2, 'Enter the member’s full name.'),
  email: z.string().trim().email('Enter a valid email address.').transform((email) => email.toLowerCase()),
  password: z.string().min(8, 'The temporary password must be at least 8 characters.'),
  ministryTeam: z.enum(['SINGERS', 'BAND']).default('SINGERS'),
});

router.get('/', requireAdministrator, async (_request, response) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      memberships: { select: { choirId: true, ministryTeam: true, availability: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return response.json(users);
});

router.post('/', requireAdministrator, async (request: AuthRequest, response) => {
  const parsed = newMemberSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ message: parsed.error.issues[0].message });
  const { name, email, password, ministryTeam } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return response.status(409).json({ message: 'An account already uses that email. Try signing in or enter a different address.' });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.$transaction(async (transaction) => {
    const choir = await transaction.choir.upsert({
      where: { id: 'elayone-main-choir' },
      update: {},
      create: { id: 'elayone-main-choir', name: 'Elayone Music Ministry', description: 'A ministry serving through music.' },
    });
    const created = await transaction.user.create({
      data: { name, email, passwordHash, role: 'MEMBER' },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    await transaction.membership.create({ data: { userId: created.id, choirId: choir.id, ministryTeam } });
    return created;
  });

  return response.status(201).json({
    ...user,
    memberships: [{ choirId: 'elayone-main-choir', ministryTeam, availability: 'PENDING' }],
  });
});

router.patch('/:userId/role', requireAdministrator, async (request: AuthRequest, response) => {
  const { role } = request.body ?? {};
  if (!role || !['MEMBER', 'LEADER', 'ADMIN'].includes(role)) {
    return response.status(400).json({ message: 'A valid role is required: MEMBER, LEADER, or ADMIN.' });
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: String(request.params.userId) },
    select: { id: true, email: true, role: true },
  });

  if (!targetUser) {
    return response.status(404).json({ message: 'User not found.' });
  }

  const protectedAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const isProtectedAdmin = protectedAdminEmail && targetUser.email.toLowerCase() === protectedAdminEmail;

  if (isProtectedAdmin && role !== 'ADMIN') {
    return response.status(403).json({ message: 'The configured admin account is protected and cannot be changed to a normal role.' });
  }

  const user = await prisma.user.update({
    where: { id: String(request.params.userId) },
    data: { role },
    select: { id: true, name: true, email: true, role: true, createdAt: true, memberships: { select: { choirId: true, ministryTeam: true, availability: true } } },
  });

  return response.json(user);
});

router.patch('/:userId/ministry-team', requireAdministrator, async (request, response) => {
  const parsed = z.object({
    choirId: z.string().trim().min(1),
    ministryTeam: z.enum(['SINGERS', 'BAND']),
  }).safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ message: 'Choose Singers or Band.' });

  const membership = await prisma.membership.findUnique({
    where: { userId_choirId: { userId: String(request.params.userId), choirId: parsed.data.choirId } },
  });
  if (!membership) return response.status(404).json({ message: 'This person is not part of this ministry.' });

  const updated = await prisma.membership.update({
    where: { id: membership.id },
    data: { ministryTeam: parsed.data.ministryTeam },
    select: { choirId: true, ministryTeam: true },
  });
  return response.json(updated);
});

router.patch('/:userId/password', requireAdministrator, async (request: AuthRequest, response) => {
  const password = typeof request.body?.password === 'string' ? request.body.password : '';
  if (password.length < 12) return response.status(400).json({ message: 'The new password must be at least 12 characters long and include a number and a symbol.' });
  const targetUser = await prisma.user.findUnique({ where: { id: String(request.params.userId) }, select: { id: true, name: true } });
  if (!targetUser) return response.status(404).json({ message: 'User not found.' });
  await prisma.user.update({ where: { id: targetUser.id }, data: { passwordHash: await bcrypt.hash(password, 12) } });
  return response.json({ message: `Password reset for ${targetUser.name}.` });
});

router.patch('/:userId/password/self', async (request: AuthRequest, response) => {
  if (request.userId !== String(request.params.userId)) {
    return response.status(403).json({ message: 'You can only change your own password.' });
  }
  const { currentPassword, newPassword } = request.body ?? {};
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    return response.status(400).json({ message: 'Current password and new password are required.' });
  }
  if (newPassword.length < 8) return response.status(400).json({ message: 'The new password must be at least 8 characters.' });
  const targetUser = await prisma.user.findUnique({
    where: { id: String(request.params.userId) },
    select: { id: true, name: true, passwordHash: true },
  });
  if (!targetUser) return response.status(404).json({ message: 'User not found.' });
  const valid = targetUser.passwordHash ? await bcrypt.compare(currentPassword, targetUser.passwordHash) : false;
  if (!valid) return response.status(401).json({ message: 'The current password is incorrect.' });
  await prisma.user.update({
    where: { id: targetUser.id },
    data: { passwordHash: await bcrypt.hash(newPassword, 12) },
  });
  return response.json({ message: `Your password has been updated successfully.` });
});

export default router;
