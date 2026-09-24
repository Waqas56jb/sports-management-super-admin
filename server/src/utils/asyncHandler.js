/**
 * Wraps an async controller so rejected promises reach the error middleware.
 * (Express 5 already forwards them; the wrapper keeps controllers explicit and portable.)
 */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
