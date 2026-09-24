import * as reportService from '../services/reportService.js';
import { notFound } from '../utils/errors.js';
import { ok } from '../utils/response.js';

/** GET /reports/:type — players | teams | matches | attendance | competitions | performance (+ spec aliases). */
export async function generate(req, res) {
  const type = reportService.REPORT_ALIASES[req.params.type] ?? req.params.type;
  if (!reportService.REPORT_TYPES.includes(type)) throw notFound('Report');
  ok(res, await reportService.generate(req.actor, type, req.valid.query), 'Report generated');
}
