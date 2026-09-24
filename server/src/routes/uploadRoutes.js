import { Router } from 'express';
import multer from 'multer';
import { env } from '../config/env.js';
import { IMAGE_TYPES } from '../config/constants.js';
import * as c from '../controllers/uploadController.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/roles.js';
import { AppError } from '../utils/errors.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';

/** Memory storage + size / type limits; content is re-checked by magic bytes in storageService. */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.storage.maxBytes, files: 1, fields: 5 },
  fileFilter: (_req, file, cb) => {
    if (!IMAGE_TYPES[file.mimetype]) return cb(new AppError(400, 'UNSUPPORTED_FILE_TYPE', 'Only JPG, PNG or WebP images are allowed', { i18nKey: 'validation.imageType' }));
    return cb(null, true);
  },
});

const r = Router();
r.post('/uploads/avatar', requireAuth, upload.single('file'), h(c.avatar));
r.post('/uploads/team-logo', requireAuth, requirePermission('uploads:team-logo'), upload.single('file'), h(c.teamLogo));

export default r;
