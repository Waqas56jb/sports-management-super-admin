/**
 * Supabase Storage uploads (profile photos, team logos, competition images).
 * Files are validated by MIME type, extension, size AND magic bytes, and stored under a
 * generated name — client file names never reach the bucket path.
 */
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { IMAGE_TYPES, UPLOAD_FOLDERS } from '../config/constants.js';
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

function assertConfigured() {
  if (!isStorageConfigured()) {
    throw new AppError(503, 'STORAGE_NOT_CONFIGURED', 'File storage is not configured on the server (SUPABASE_SERVICE_ROLE_KEY missing)', { i18nKey: 'errors.generic' });
  }
}

/** Uploads an image buffer and returns its public URL. */
export async function uploadImage(folder, { buffer, mimetype, originalname }) {
  if (!UPLOAD_FOLDERS.includes(folder)) throw new AppError(400, 'INVALID_FOLDER', 'Invalid upload folder');
  validateImage({ buffer, mimetype, originalname });
  assertConfigured();
  const ext = IMAGE_TYPES[mimetype][0];
  const objectPath = `${folder}/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
  const supabase = getSupabase();
  const { error } = await supabase.storage.from(env.storage.bucket).upload(objectPath, buffer, { contentType: mimetype, cacheControl: '31536000', upsert: false });
  if (error) throw new AppError(502, 'STORAGE_UPLOAD_FAILED', 'The file could not be stored. Please try again.', { i18nKey: 'errors.generic' });
  const { data } = supabase.storage.from(env.storage.bucket).getPublicUrl(objectPath);
  return { url: data.publicUrl, path: objectPath, size: buffer.length, contentType: mimetype };
}

/** Deletes a previously uploaded object (best effort — never blocks the main operation). */
export async function removeByUrl(url) {
  if (!url || !isStorageConfigured()) return;
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
export async function resolveImageField(value, folder) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const s = String(value);
  if (s.startsWith('data:')) {
    const m = s.match(/^data:([\w/+.-]+);base64,(.+)$/);
    if (!m) throw invalidType();
    const buffer = Buffer.from(m[2], 'base64');
    return (await uploadImage(folder, { buffer, mimetype: m[1] })).url;
  }
  if (/^https:\/\//.test(s) && s.length < 2048) return s;
  throw invalidType();
}
