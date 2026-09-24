import { useEffect } from 'react';
import { APP_NAME } from '@/utils/constants';

export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME} Admin` : `${APP_NAME} Admin`;
  }, [title]);
}
