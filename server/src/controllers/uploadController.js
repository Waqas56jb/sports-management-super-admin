import { one, query } from '../config/database.js';
import * as storageService from '../services/storageService.js';
import { audit } from '../services/shared.js';
import { AppError, notFound } from '../utils/errors.js';
import { created } from '../utils/response.js';

function requireFile(req) {
  if (!req.file) throw new AppError(400, 'FILE_REQUIRED', 'Attach an image in the "file" field', { i18nKey: 'validation.required', fields: { file: 'validation.required' } });
  return req.file;
}

/** POST /uploads/avatar — stores the image and sets it as the caller's profile photo. */
export async function avatar(req, res) {
  const file = requireFile(req);
  const folder = { admin: 'users', coach: 'coaches', player: 'players' }[req.actor.role];
  const result = await storageService.uploadImage(folder, file, req.actor.userId);
  const previous = await one(`SELECT avatar_url FROM users WHERE id = $1`, [req.actor.userId]);
  await query(`UPDATE users SET avatar_url = $2, updated_by = $1 WHERE id = $1`, [req.actor.userId, result.url]);
  await storageService.removeByUrl(previous?.avatar_url);
  await audit(undefined, req.actor, 'upload.avatar', 'user', req.actor.userId, { path: result.path });
  created(res, { url: result.url }, 'Photo uploaded');
}

/** POST /uploads/team-logo (admin) — optional team_id sets the logo directly. */
export async function teamLogo(req, res) {
  const file = requireFile(req);
  const teamId = req.body?.team_id;
  if (teamId && !(await one(`SELECT id FROM teams WHERE id = $1 AND deleted_at IS NULL`, [teamId]).catch(() => null))) throw notFound('Team');
  const result = await storageService.uploadImage('teams', file, req.actor.userId);
  if (teamId) await query(`UPDATE teams SET logo_url = $2, updated_by = $3 WHERE id = $1`, [teamId, result.url, req.actor.userId]);
  await audit(undefined, req.actor, 'upload.team_logo', 'team', teamId ?? null, { path: result.path });
  created(res, { url: result.url }, 'Logo uploaded');
}

/** GET /media/:file — public images from the database fallback store (immutable, cacheable). */
export async function media(req, res) {
  const m = String(req.params.file).match(/^([0-9a-f-]{36})(\.(jpg|png|webp))?$/);
  const row = m ? await storageService.readMedia(m[1]) : null;
  if (!row) throw notFound('Image');
  res.set({
    'Content-Type': row.content_type,
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': 'inline',
  });
  res.send(row.data);
}
