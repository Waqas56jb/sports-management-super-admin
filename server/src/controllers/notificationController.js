import { withTransaction } from '../config/database.js';
import * as notificationService from '../services/notificationService.js';
import { created, ok, paged } from '../utils/response.js';

export const list = async (req, res) => paged(res, await notificationService.list(req.actor, req.valid.query), 'Notifications retrieved successfully');
export const unreadCount = async (req, res) => ok(res, await notificationService.unreadCount(req.actor), 'Unread count retrieved');
/** PATCH /notifications/:id { is_read } — also used as PATCH /notifications/:id/read. */
export const setRead = async (req, res) => ok(res, await notificationService.setRead(req.actor, req.params.id, req.valid?.body?.is_read ?? true), 'Notification updated');
export const markAllRead = async (req, res) => ok(res, await notificationService.markAllRead(req.actor), 'All notifications marked as read');
export const remove = async (req, res) => ok(res, await notificationService.remove(req.actor, req.params.id), 'Notification deleted');

export const announcements = async (_req, res) => ok(res, await notificationService.listAnnouncements(), 'Announcements retrieved');
export const sendAnnouncement = async (req, res) =>
  created(res, await withTransaction((client) => notificationService.sendAnnouncement(client, req.actor, req.valid.body)), 'Announcement sent');
