import { useEffect } from 'react';
import { APP_NAME } from '@/utils/constants';

export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME} Coach` : `${APP_NAME} Coach`;
  }, [title]);
}
