/**
 * Supabase Storage uploads (profile photos, team logos, competition images).
 * Files are validated by MIME type, extension, size AND magic bytes, and stored under a
 * generated name — client file names never reach the bucket path.
 */
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { API_PREFIX, IMAGE_TYPES, UPLOAD_FOLDERS } from '../config/constants.js';
import { one } from '../config/database.js';
import { getSupabase, isStorageConfigured } from '../config/supabase.js';
import { AppError } from '../utils/errors.js';

const SIGNATURES = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': (b) => b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP',
};

const invalidType = () => new AppError(400, 'UNSUPPORTED_FILE_TYPE', 'Only JPG, PNG or WebP images are allowed', { i18nKey: 'validation.imageType', fields: { file: 'validation.imageType' } });

export function validateImage({ buffer, mimetype, originalname }) {
  if (!IMAGE_TYPES[mimetype]) throw invalidType();
  if (originalname) {
    const ext = originalname.split('.').pop()?.toLowerCase();
    if (!IMAGE_TYPES[mimetype].includes(ext)) throw invalidType();
  }
  if (!buffer?.length) throw new AppError(400, 'EMPTY_FILE', 'The file is empty', { i18nKey: 'validation.imageType' });
  if (buffer.length > env.storage.maxBytes) {
    throw new AppError(413, 'FILE_TOO_LARGE', `Image must be smaller than ${Math.round(env.storage.maxBytes / 1048576)} MB`, { i18nKey: 'validation.imageSize', fields: { file: 'validation.imageSize' } });
  }
  if (!SIGNATURES[mimetype](buffer)) throw invalidType();
}

/** Public base URL of this API (for images served from the database fallback). */
export function publicApiUrl() {
  if (env.publicApiUrl) return env.publicApiUrl;
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  return `http://localhost:${process.env.PORT || env.port}`;
}

const mediaBase = () => `${publicApiUrl()}${API_PREFIX}/media/`;
const storageBase = () => (env.supabase.url ? `${env.supabase.url}/storage/v1/object/public/${env.storage.bucket}/` : null);

/**
 * Uploads an image and returns its public URL: Supabase Storage when the service-role key is
 * configured, otherwise the database fallback (served by GET /api/v1/media/:id).
 */
export async function uploadImage(folder, { buffer, mimetype, originalname }, actorId = null) {
  if (!UPLOAD_FOLDERS.includes(folder)) throw new AppError(400, 'INVALID_FOLDER', 'Invalid upload folder');
  validateImage({ buffer, mimetype, originalname });
  const ext = IMAGE_TYPES[mimetype][0];
  if (!isStorageConfigured()) {
    const row = await one(`INSERT INTO media (folder, content_type, size, data, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id`, [folder, mimetype, buffer.length, buffer, actorId]);
    return { url: `${mediaBase()}${row.id}.${ext}`, path: `media/${row.id}`, size: buffer.length, contentType: mimetype };
  }
  const objectPath = `${folder}/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
  const supabase = getSupabase();
  const { error } = await supabase.storage.from(env.storage.bucket).upload(objectPath, buffer, { contentType: mimetype, cacheControl: '31536000', upsert: false });
  if (error) throw new AppError(502, 'STORAGE_UPLOAD_FAILED', 'The file could not be stored. Please try again.', { i18nKey: 'errors.generic' });
  const { data } = supabase.storage.from(env.storage.bucket).getPublicUrl(objectPath);
  return { url: data.publicUrl, path: objectPath, size: buffer.length, contentType: mimetype };
}

/** Reads an image stored by the database fallback. */
export async function readMedia(id) {
  return one(`SELECT content_type, data FROM media WHERE id = $1`, [id]);
}

/** Deletes a previously uploaded object (best effort — never blocks the main operation). */
export async function removeByUrl(url) {
  if (!url) return;
  if (url.startsWith(mediaBase())) {
    const id = url.slice(mediaBase().length).split('.')[0];
    if (/^[0-9a-f-]{36}$/.test(id)) await one(`DELETE FROM media WHERE id = $1 RETURNING id`, [id]).catch(() => {});
    return;
  }
  if (!isStorageConfigured()) return;
  const marker = `/storage/v1/object/public/${env.storage.bucket}/`;
  const i = url.indexOf(marker);
  if (i === -1) return;
  await getSupabase().storage.from(env.storage.bucket).remove([url.slice(i + marker.length)]).catch(() => {});
}

/**
 * Normalises an image field coming from a JSON form:
 *   data:image/...;base64,…  → uploaded, returns the public URL
 *   https://…                → kept (already stored)
 *   null / ''                → removed
 */
export async function resolveImageField(value, folder, actorId = null) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const s = String(value);
  if (s.startsWith('data:')) {
    const m = s.match(/^data:([\w/+.-]+);base64,(.+)$/);
    if (!m) throw invalidType();
    const buffer = Buffer.from(m[2], 'base64');
    return (await uploadImage(folder, { buffer, mimetype: m[1] }, actorId)).url;
  }
  // Only images this API stored itself may be referenced (no arbitrary external URLs).
  const own = [mediaBase(), storageBase()].filter(Boolean);
  if (s.length < 2048 && own.some((base) => s.startsWith(base))) return s;
  throw invalidType();
}
