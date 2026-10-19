import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const router = Router();
const credentials = z.object({
  name: z.string().trim().min(2, 'Please enter your full name.').optional(),
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
});

function issueSession(user: { id: string; name: string; email: string; role: 'MEMBER' | 'LEADER' | 'ADMIN' }) {
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET as string, { expiresIn: '30d' });
  return { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
}

router.post('/signup', async (_request, response) => {
  return response.status(403).json({ message: 'Accounts are created by a ministry administrator. Please contact them for access.' });
});

router.post('/login', async (request, response) => {
  const parsed = credentials.omit({ name: true }).safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ message: parsed.error.issues[0].message });
  let user;
  try {
    user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  } catch (error) {
    console.error('[auth/login] Could not query the user database:', error);
    return response.status(503).json({ message: 'The sign-in service is temporarily unable to reach the account database. Please try again shortly.' });
  }
  if (!user) return response.status(404).json({ message: 'No account uses that email. Check the address or ask your ministry administrator for help.' });
  let valid: boolean;
  try {
    valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  } catch (error) {
    console.error('[auth/login] Could not verify the stored password hash:', error);
    return response.status(500).json({ message: 'The account password record could not be verified. Please ask an administrator to reset the password.' });
  }
  if (!valid) return response.status(401).json({ message: 'That password is incorrect. Try again or ask your ministry administrator to reset it.' });
  try {
    return response.json(issueSession(user));
  } catch (error) {
    console.error('[auth/login] Could not issue a session token:', error);
    return response.status(503).json({ message: 'The sign-in service is not fully configured. Please contact the system administrator.' });
  }
});

export default router;
