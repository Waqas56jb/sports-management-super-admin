import * as dashboardService from '../services/dashboardService.js';
import * as statisticsService from '../services/statisticsService.js';
import { ok, paged } from '../utils/response.js';

export const players = async (req, res) => paged(res, await statisticsService.playerStatsTable(req.actor, req.valid.query), 'Player statistics retrieved');
export const teams = async (req, res) => ok(res, await statisticsService.teamStatsTable(req.actor, req.valid.query), 'Team statistics retrieved');
export const trend = async (req, res) => ok(res, await statisticsService.trendSeries(req.actor, req.valid.query), 'Statistics trend retrieved');

/** GET /statistics — both tables at once (players paginated, teams complete). */
export async function overview(req, res) {
  const [players, teams] = await Promise.all([statisticsService.playerStatsTable(req.actor, req.valid.query), statisticsService.teamStatsTable(req.actor, req.valid.query)]);
  ok(res, { players: players.rows, totals: players.meta.totals, teams }, 'Statistics retrieved', { pagination: players.pagination });
}

export const adminDashboard = async (_req, res) => ok(res, await dashboardService.admin(), 'Dashboard retrieved');
export const coachDashboard = async (req, res) => ok(res, await dashboardService.coach(req.actor), 'Dashboard retrieved');
export const playerDashboard = async (req, res) => ok(res, await dashboardService.player(req.actor), 'Dashboard retrieved');
