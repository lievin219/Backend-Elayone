"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middleware/auth");
const create_event_persistence_1 = require("./create-event-persistence");
const create_event_response_1 = require("./create-event-response");
const create_event_validation_1 = require("./create-event-validation");
const router = (0, express_1.Router)();
router.post('/:choirId/rehearsals', auth_1.requireAdmin, async (request, response) => {
    const input = (0, create_event_validation_1.validateCreateEventInput)(request.body ?? {});
    if ('error' in input)
        return response.status(400).json({ message: input.error });
    const choirId = String(request.params.choirId);
    const referenceError = await (0, create_event_validation_1.validateEventReferences)(choirId, input);
    if (referenceError)
        return response.status(400).json({ message: referenceError });
    const rehearsal = await (0, create_event_persistence_1.createRecurringEvent)(choirId, input);
    return response.status(201).json((0, create_event_response_1.serializeCreatedEvent)(rehearsal));
});
exports.default = router;
