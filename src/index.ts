import 'dotenv/config';
import cors from 'cors';
import express, { ErrorRequestHandler } from 'express';
import path from 'node:path';
import os from 'node:os';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import authRoutes from './routes/auth';
import choirRoutes from './routes/choir';
import userRoutes from './routes/users';
import { prisma } from './lib/prisma';
import { requireAuth } from './middleware/auth';

if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
  throw new Error('Server configuration missing. Copy server/.env.example to server/.env, set DATABASE_URL and JWT_SECRET, and start PostgreSQL before running the API.');
}

process.on('unhandledRejection', (reason) => {
  console.error('[process] Unhandled promise rejection:', reason);
});

const app = express();
const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('This website origin is not allowed by the API.'));
  },
}));
app.use(express.json());
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));
app.get('/health', async (_request, response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await prisma.user.findFirst({ select: { id: true } });
    return response.json({ ok: true, service: 'elayone-choir-api', database: 'connected', accounts: 'available' });
  } catch (error) {
    console.error('[health] Database or account-table check failed:', error);
    return response.status(503).json({ ok: false, service: 'elayone-choir-api', database: 'unavailable', accounts: 'unavailable', message: 'The API cannot read the account database. Check backend database configuration and migrations.' });
  }
});
app.use('/api/auth', authRoutes);
app.use('/api/choirs', requireAuth, choirRoutes);
app.use('/api/users', requireAuth, userRoutes);

// Self-service password change: any signed-in member can set/change their own
// password (they must supply their current password to prove identity).
app.patch('/api/me/password', requireAuth, async (request, response) => {
  const { currentPassword, newPassword } = request.body ?? {};
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    return response.status(400).json({ message: 'Current password and new password are required.' });
  }
  if (newPassword.length < 8) return response.status(400).json({ message: 'The new password must be at least 8 characters.' });
  const authRequest = request as import('./middleware/auth').AuthRequest;
  const user = await prisma.user.findUnique({ where: { id: authRequest.userId }, select: { id: true, name: true, passwordHash: true } });
  if (!user) return response.status(404).json({ message: 'User not found.' });
  const valid = user.passwordHash ? await bcrypt.compare(currentPassword, user.passwordHash) : false;
  if (!valid) return response.status(401).json({ message: 'The current password is incorrect.' });
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(newPassword, 12) } });
  return response.json({ message: `Your password has been updated successfully.` });
});

app.use('/api/me', requireAuth, async (request, response) => {
  response.setHeader('Allow', 'PATCH');
  return response.status(405).json({ message: 'Method PATCH is not allowed for this endpoint. Use /api/me/password.' });
});

app.use((_request, response) => response.status(404).json({ message: 'API endpoint not found.' }));

const handleApiError: ErrorRequestHandler = (error, _request, response, next) => {
  if (response.headersSent) return next(error);
  console.error('[api] Request failed:', error);

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') return response.status(409).json({ message: 'A record with those details already exists.' });
    if (error.code === 'P2025') return response.status(404).json({ message: 'The requested record was not found.' });
    if (error.code === 'P2003') return response.status(400).json({ message: 'This change conflicts with related records.' });
  }

  if (error instanceof SyntaxError && 'status' in error && error.status === 400) {
    return response.status(400).json({ message: 'The request body must contain valid JSON.' });
  }

  return response.status(500).json({ message: 'Something went wrong on our end. Please wait a moment, then try again.' });
};
app.use(handleApiError);

const port = Number(process.env.PORT) || 4000;

app.listen(port, '0.0.0.0', () => {
  const interfaces = Object.values(os.networkInterfaces()).flat();
  const lanAddress = interfaces.find((networkInterface) => networkInterface?.family === 'IPv4' && !networkInterface.internal)?.address;
  console.log(`Elayone API listening locally at http://localhost:${port}`);
  console.log(`LAN API URL: http://${lanAddress ?? '<your-computer-ip>'}:${port}`);
});
