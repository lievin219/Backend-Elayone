import { Router } from 'express';
import peopleRoutes from './choir/people';
import eventListRoutes from './choir/event-list';
import attendanceSummaryRoutes from './choir/attendance-summary';
import attendanceReportRoutes from './choir/attendance-report';
import attendanceResponseRoutes from './choir/attendance-response';
import createEventRoutes from './choir/create-event';
import eventSongRoutes from './choir/event-songs';
import announcementRoutes from './choir/announcements';
import reminderRoutes from './choir/reminders';
import songRoutes from './choir/songs';

const router = Router();
router.use(peopleRoutes);
router.use(eventListRoutes);
router.use(attendanceSummaryRoutes);
router.use(attendanceReportRoutes);
router.use(attendanceResponseRoutes);
router.use(createEventRoutes);
router.use(eventSongRoutes);
router.use(announcementRoutes);
router.use(reminderRoutes);
router.use(songRoutes);

export default router;
