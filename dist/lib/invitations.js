"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInvitationToken = createInvitationToken;
exports.sendMemberInvitation = sendMemberInvitation;
const node_crypto_1 = require("node:crypto");
const nodemailer_1 = __importDefault(require("nodemailer"));
const invitationLifetimeMs = 7 * 24 * 60 * 60 * 1000;
function createInvitationToken() {
    const token = (0, node_crypto_1.randomBytes)(32).toString('base64url');
    return {
        token,
        tokenHash: (0, node_crypto_1.createHash)('sha256').update(token).digest('hex'),
        expiresAt: new Date(Date.now() + invitationLifetimeMs),
    };
}
function getEmailConfiguration() {
    const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM', 'FRONTEND_URL'];
    const missing = required.filter((key) => !process.env[key]?.trim());
    if (missing.length) {
        throw new Error(`Email delivery is not configured. Set ${missing.join(', ')} in server/.env.`);
    }
    const port = Number(process.env.SMTP_PORT);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('SMTP_PORT must be a valid TCP port number.');
    }
    let frontendUrl;
    try {
        frontendUrl = new URL(process.env.FRONTEND_URL.trim());
    }
    catch {
        throw new Error('FRONTEND_URL must be an absolute HTTP or HTTPS URL.');
    }
    if (frontendUrl.protocol !== 'https:' && frontendUrl.protocol !== 'http:') {
        throw new Error('FRONTEND_URL must use HTTP or HTTPS.');
    }
    return {
        host: process.env.SMTP_HOST.trim(),
        port,
        secure: process.env.SMTP_SECURE?.trim().toLowerCase() === 'true' || port === 465,
        user: process.env.SMTP_USER.trim(),
        password: process.env.SMTP_PASSWORD,
        from: process.env.SMTP_FROM.trim(),
        frontendUrl,
    };
}
function escapeHtml(value) {
    const escapedCharacters = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    };
    return value.replace(/[&<>"']/g, (character) => escapedCharacters[character] ?? character);
}
async function sendMemberInvitation(email, name, token) {
    const config = getEmailConfiguration();
    const invitationUrl = new URL('/', config.frontendUrl);
    invitationUrl.searchParams.set('invite', token);
    const transport = nodemailer_1.default.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: { user: config.user, pass: config.password },
    });
    try {
        await transport.sendMail({
            from: config.from,
            to: email,
            subject: 'Set up your Elayone Music account',
            text: `Hello ${name},\n\nAn Elayone Music administrator created an account for you. Set your password using this link within 7 days:\n${invitationUrl.toString()}\n\nIf you did not expect this invitation, you can ignore this message.`,
            html: `<p>Hello ${escapeHtml(name)},</p><p>An Elayone Music administrator created an account for you. Set your password using the link below within 7 days:</p><p><a href="${escapeHtml(invitationUrl.toString())}">Set up my Elayone account</a></p><p>If you did not expect this invitation, you can ignore this message.</p>`,
        });
    }
    finally {
        transport.close();
    }
}
