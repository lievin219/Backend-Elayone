"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const node_crypto_1 = require("node:crypto");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const router = (0, express_1.Router)();
const credentials = zod_1.z.object({
    name: zod_1.z.string().trim().min(2, 'Please enter your full name.').optional(),
    email: zod_1.z.string().trim().email('Enter a valid email address.'),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters.'),
});
function issueSession(user) {
    const token = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    return { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
}
router.post('/signup', async (_request, response) => {
    return response.status(403).json({ message: 'Accounts are created by a ministry administrator. Please contact them for access.' });
});
router.get('/verify-email', async (request, response) => {
    const token = zod_1.z.string().min(40).max(100).safeParse(request.query.token);
    if (!token.success)
        return response.status(400).send('This email confirmation link is invalid.');
    const tokenHash = (0, node_crypto_1.createHash)('sha256').update(token.data).digest('hex');
    const user = await prisma_1.prisma.user.findFirst({
        where: {
            emailVerificationTokenHash: tokenHash,
            emailVerificationExpiresAt: { gt: new Date() },
            emailVerifiedAt: null,
        },
        select: { id: true },
    });
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Robots-Tag', 'noindex, nofollow');
    response.setHeader('Referrer-Policy', 'no-referrer');
    if (!user) {
        return response.status(400).send('This confirmation link is invalid or has expired. Ask your ministry administrator to send a new one.');
    }
    return response.type('html').send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Confirm your Elayone email</title></head>
<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:10vh auto;padding:1rem;color:#202124">
<h1>Confirm your email address</h1><p>Press the button below to confirm that you own this email address and activate your Elayone account.</p>
<form method="post" action="/api/auth/verify-email"><input type="hidden" name="token" value="${token.data}"><button style="padding:.75rem 1rem" type="submit">Confirm email address</button></form>
</body></html>`);
});
router.post('/verify-email', async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    const parsed = zod_1.z.object({ token: zod_1.z.string().min(40).max(100) }).safeParse(request.body);
    if (!parsed.success)
        return response.status(400).send('This email confirmation link is invalid.');
    const tokenHash = (0, node_crypto_1.createHash)('sha256').update(parsed.data.token).digest('hex');
    const updated = await prisma_1.prisma.user.updateMany({
        where: {
            emailVerificationTokenHash: tokenHash,
            emailVerificationExpiresAt: { gt: new Date() },
            emailVerifiedAt: null,
        },
        data: {
            emailVerifiedAt: new Date(),
            emailVerificationTokenHash: null,
            emailVerificationExpiresAt: null,
        },
    });
    if (updated.count === 0) {
        return response.status(400).send('This confirmation link is invalid, expired, or has already been used.');
    }
    return response.type('html').send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Email confirmed</title></head>
<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:10vh auto;padding:1rem;color:#202124">
<h1>Email confirmed</h1><p>Your Elayone email address is confirmed. You can now sign in to your account.</p>
</body></html>`);
});
router.post('/login', async (request, response) => {
    const parsed = credentials.omit({ name: true }).safeParse(request.body);
    if (!parsed.success)
        return response.status(400).json({ message: parsed.error.issues[0].message });
    const user = await prisma_1.prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
    if (!user)
        return response.status(404).json({ message: 'No account uses that email. Check the address or ask your ministry administrator for help.' });
    if (!user.emailVerifiedAt) {
        return response.status(403).json({ message: 'Confirm your email address using the link sent to you before signing in. Ask your ministry administrator to resend it if the link expired.' });
    }
    const valid = await bcryptjs_1.default.compare(parsed.data.password, user.passwordHash);
    if (!valid)
        return response.status(401).json({ message: 'That password is incorrect. Try again or ask your ministry administrator to reset it.' });
    return response.json(issueSession(user));
});
exports.default = router;
