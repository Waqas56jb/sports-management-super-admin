import { Router } from 'express';
import * as c from '../controllers/notificationController.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/roles.js';
import { idParam, validate } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import * as v from '../validators/attendanceValidators.js';

const r = Router();

// Every user only ever sees and changes their own inbox (user id comes from the token).
r.get('/notifications', requireAuth, validate({ query: v.notificationQuery }), h(c.list));
r.get('/notifications/unread-count', requireAuth, h(c.unreadCount));
r.post('/notifications/mark-all-read', requireAuth, h(c.markAllRead));
r.patch('/notifications/read-all', requireAuth, h(c.markAllRead));
r.patch('/notifications/:id/read', requireAuth, idParam(), h(c.setRead));
r.patch('/notifications/:id', requireAuth, idParam(), validate({ body: v.notificationPatch }), h(c.setRead));
r.delete('/notifications/:id', requireAuth, idParam(), h(c.remove));

r.get('/announcements', requireAuth, requirePermission('notifications:broadcast'), h(c.announcements));
r.post('/announcements', requireAuth, requirePermission('notifications:broadcast'), validate({ body: v.announcement }), h(c.sendAnnouncement));

export default r;
