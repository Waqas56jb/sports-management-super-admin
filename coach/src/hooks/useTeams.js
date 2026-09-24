import { teamService } from '@/services/teamService';
import { useQuery } from './useQuery';

/** The coach's assigned teams (summaries) plus ready-made <Select> options. */
export function useTeams() {
  const { data, loading } = useQuery(() => teamService.options(), []);
  const teams = data ?? [];
  return { teams, loading, teamOptions: teams.map((t) => ({ value: t.id, label: t.name })) };
}
