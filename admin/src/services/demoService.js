import { USE_MOCK } from './apiClient';
import { resetDb } from './mock/db';

/** Development helper: restore the original demo dataset (no-op against the real API). */
export const demoService = {
  available: USE_MOCK,
  reset() {
    if (USE_MOCK) resetDb();
  },
};
