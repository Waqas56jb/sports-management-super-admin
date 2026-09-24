import * as authService from '../services/authService.js';
import * as userService from '../services/userService.js';
import { ok } from '../utils/response.js';
import { unauthorized } from '../utils/errors.js';

const meta = (req) => ({ userAgent: req.get('user-agent'), ip: req.ip });

export async function login(req, res) {
  const session = await authService.login(req.valid.body, meta(req));
  ok(res, session, 'Login successful');
}

export async function logout(req, res) {
  await authService.logout(req.actor);
  ok(res, { ok: true }, 'Logged out');
}

export async function me(req, res) {
  const user = await authService.publicUser(req.actor.userId);
  if (!user) throw unauthorized();
  ok(res, user, 'Current user');
}

export async function updateMe(req, res) {
  ok(res, await userService.updateProfile(req.actor, req.valid.body), 'Profile updated');
}

export async function refresh(req, res) {
  ok(res, await authService.refresh(req.actor, meta(req)), 'Session refreshed');
}

export async function forgotPassword(req, res) {
  await authService.requestPasswordReset(req.valid.body);
  ok(res, { ok: true }, 'If an account exists for this email, a reset link has been sent');
}

export async function resetPassword(req, res) {
  ok(res, await authService.resetPassword(req.valid.body), 'Password has been reset');
}

export async function changePassword(req, res) {
  ok(res, await authService.changePassword(req.actor, req.valid.body), 'Password updated');
}
