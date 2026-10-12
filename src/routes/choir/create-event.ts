import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { requireAdmin } from '../../middleware/auth';
import { createRecurringEvent } from './create-event-persistence';
import { serializeCreatedEvent } from './create-event-response';
import { validateCreateEventInput, validateEventReferences } from './create-event-validation';

const router = Router();

router.post('/:choirId/rehearsals', requireAdmin, async (request, response) => {
  const input = validateCreateEventInput(request.body ?? {});
  if ('error' in input) return response.status(400).json({ message: input.error });
  const choirId = String(request.params.choirId);
  const referenceError = await validateEventReferences(choirId, input);
  if (referenceError) return response.status(400).json({ message: referenceError });
  const rehearsal = await createRecurringEvent(choirId, input);
  return response.status(201).json(serializeCreatedEvent(rehearsal));
});


export default router;
