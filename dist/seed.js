"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
function getRequiredEnv(name) {
    const value = process.env[name];
    if (!value || !value.trim()) {
        throw new Error(`Missing required environment variable: ${name}. Set it in server/.env before seeding.`);
    }
    return value.trim();
}
async function main() {
    const adminEmail = getRequiredEnv('ADMIN_EMAIL').toLowerCase();
    const adminPassword = getRequiredEnv('ADMIN_PASSWORD');
    if (adminPassword.length < 12) {
        throw new Error('ADMIN_PASSWORD must be at least 12 characters long.');
    }
    const passwordHash = await bcryptjs_1.default.hash(adminPassword, 12);
    const choir = await prisma.choir.upsert({ where: { id: 'elayone-main-choir' }, update: {}, create: { id: 'elayone-main-choir', name: 'Elayone Music Ministry', description: 'A ministry serving through music.' } });
    const admin = await prisma.user.upsert({
        where: { email: adminEmail },
        update: { role: client_1.Role.ADMIN, passwordHash, emailVerifiedAt: new Date() },
        create: { name: 'Elayone Admin main', email: adminEmail, passwordHash, role: client_1.Role.ADMIN, emailVerifiedAt: new Date() },
    });
    await prisma.membership.upsert({ where: { userId_choirId: { userId: admin.id, choirId: choir.id } }, update: {}, create: { userId: admin.id, choirId: choir.id, ministryTeam: 'SINGERS' } });
    const eventStart = new Date();
    const daysUntilSunday = (7 - eventStart.getUTCDay()) % 7 || 7;
    eventStart.setUTCDate(eventStart.getUTCDate() + daysUntilSunday);
    eventStart.setUTCHours(18, 0, 0, 0);
    const eventEnd = new Date(eventStart);
    eventEnd.setHours(eventEnd.getHours() + 2);
    const rehearsal = await prisma.rehearsal.upsert({
        where: { id: 'elayone-first-rehearsal' },
        update: { startsAt: eventStart, endsAt: eventEnd },
        create: { id: 'elayone-first-rehearsal', choirId: choir.id, title: 'Sunday service set', startsAt: eventStart, endsAt: eventEnd, location: 'Main sanctuary' },
    });
    await prisma.attendance.upsert({ where: { rehearsalId_userId: { rehearsalId: rehearsal.id, userId: admin.id } }, update: { status: 'YES', present: true }, create: { rehearsalId: rehearsal.id, userId: admin.id, status: 'YES', present: true } });
    await prisma.announcement.upsert({
        where: { id: 'elayone-welcome-announcement' },
        update: {},
        create: { id: 'elayone-welcome-announcement', choirId: choir.id, title: 'Welcome to the new season', message: 'Please confirm your availability before each rehearsal.', priority: 'IMPORTANT' },
    });
    console.log(`Seeded Elayone Music Ministry. Admin login: ${admin.email}`);
}
main()
    .catch((error) => {
    console.error('Database seed failed:', error);
    process.exitCode = 1;
})
    .finally(() => prisma.$disconnect());
