import { useCallback } from 'react';
import { useI18n } from '@/i18n';
import { formatDate } from '@/utils/formatters';

/**
 * System notifications are stored as template + params so they render in the viewer's
 * language; free-text announcements carry their own title/message.
 */
export function useNotificationText() {
  const { t, lang } = useI18n();
  return useCallback(
    (n) => {
      if (!n.template) return { title: n.title, message: n.message };
      const params = { ...n.params };
      if (params.date) params.date = formatDate(params.date, lang, { weekday: 'long', day: 'numeric', month: 'long' });
      return {
        title: t(`notifications.templates.${n.template}.title`, params),
        message: t(`notifications.templates.${n.template}.message`, params),
      };
    },
    [t, lang],
  );
}
