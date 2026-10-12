"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeCreatedEvent = serializeCreatedEvent;
const shared_1 = require("./shared");
function serializeCreatedEvent(rehearsal) {
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
        songs: (0, shared_1.serializeEventSongs)(rehearsal.eventSongs),
        invitees: rehearsal.invitations.map((invitation) => ({ userId: invitation.userId, name: invitation.user.name, status: 'PENDING' })),
    };
}
