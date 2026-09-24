import { z } from 'zod';
import { email, password, strongPassword } from './common.js';

export const login = z.object({
  email,
  password,
  remember: z.boolean().optional().default(false),
  portal: z.enum(['admin', 'coach', 'player']).optional(),
});

export const forgotPassword = z.object({ email });

export const resetPassword = z.object({
  token: z.string().min(20, 'validation.invalid').max(200),
  password: strongPassword,
});

export const changePassword = z.object({
  currentPassword: password,
  newPassword: strongPassword,
});
