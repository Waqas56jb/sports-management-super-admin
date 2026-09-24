import { useNavigate } from 'react-router-dom';
import { BellOff, CheckCheck, Mail, MailOpen, Trash2 } from 'lucide-react';
import NotificationIcon from '@/components/common/NotificationIcon';
import { useNotificationText } from '@/components/common/useNotificationText';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import Pagination from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import Tabs from '@/components/ui/Tabs';
import { useConfirm } from '@/context/ConfirmContext';
import { useToast } from '@/context/ToastContext';
import { useListParams } from '@/hooks/useListParams';
import { useNotifications } from '@/hooks/useNotifications';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useQuery } from '@/hooks/useQuery';
import { useI18n } from '@/i18n';
import { notificationService } from '@/services/notificationService';
import { NOTIFICATION_CATEGORIES } from '@/utils/constants';
import { formatDateTime, formatRelative } from '@/utils/formatters';
import { cn } from '@/utils/cn';

function Item({ n, onOpen, onToggle, onDelete }) {
  const { t, lang } = useI18n();
  const text = useNotificationText();
  const { title, message } = text(n);
  return (
    <li className={cn('group flex gap-3 px-4 py-4 sm:gap-4 sm:px-5', !n.is_read && 'bg-brand-50/40 dark:bg-brand-500/[0.04]')}>
      <NotificationIcon type={n.type} />
      <div className="min-w-0 flex-1">
        <button type="button" onClick={() => onOpen(n)} className="block w-full text-left">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={cn('text-sm', n.is_read ? 'font-medium text-ink-2' : 'font-semibold text-ink')}>{title}</span>
            {!n.is_read && (
              <Badge tone="brand" dot>
                {t('notifications.unread')}
              </Badge>
            )}
          </span>
          <span className="mt-1 block text-sm text-ink-2">{message}</span>
        </button>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-3">
          <span>{t(`notifications.types.${n.type}`)}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={n.created_at} title={formatDateTime(n.created_at, lang)}>
            {formatRelative(n.created_at, lang)}
          </time>
        </p>
      </div>
      <div className="flex shrink-0 items-start gap-1 sm:opacity-60 sm:focus-within:opacity-100 sm:group-hover:opacity-100">
        <button
          type="button"
          onClick={() => onToggle(n)}
          className="grid size-11 place-items-center rounded-lg text-ink-3 hover:bg-surface-3 hover:text-ink sm:size-9"
          aria-label={n.is_read ? t('notifications.markUnread') : t('notifications.markRead')}
          title={n.is_read ? t('notifications.markUnread') : t('notifications.markRead')}
        >
          {n.is_read ? <Mail className="size-4" /> : <MailOpen className="size-4" />}
        </button>
        <button type="button" onClick={() => onDelete(n)} className="grid size-11 place-items-center rounded-lg text-ink-3 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 sm:size-9" aria-label={t('notifications.delete')} title={t('notifications.delete')}>
          <Trash2 className="size-4" />
        </button>
      </div>
    </li>
  );
}

export default function Notifications() {
  const { t } = useI18n();
  usePageTitle(t('notifications.title'));
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { unread, version } = useNotifications();
  const { params, set } = useListParams({ filter: 'all' });
  const filter = NOTIFICATION_CATEGORIES.includes(params.filter) ? params.filter : 'all';

  const inbox = useQuery(
    () =>
      notificationService.list({
        status: filter === 'unread' ? 'unread' : undefined,
        category: filter !== 'all' && filter !== 'unread' ? filter : undefined,
        page: params.page,
        pageSize: 10,
      }),
    [filter, params.page, version],
  );

  const open = async (n) => {
    if (!n.is_read) {
      await notificationService.markRead(n.id);
      toast.success(t('notifications.toasts.read'));
    }
    if (n.link) navigate(n.link);
  };
  const toggle = async (n) => {
    await notificationService.markRead(n.id, !n.is_read);
    toast.success(t(n.is_read ? 'notifications.toasts.unread' : 'notifications.toasts.read'));
  };
  const remove = async (n) => {
    const ok = await confirm({ title: t('notifications.confirmDelete.title'), message: t('notifications.confirmDelete.message'), confirmLabel: t('common.delete') });
    if (!ok) return;
    await notificationService.remove(n.id);
    toast.success(t('notifications.toasts.deleted'));
  };
  const markAll = async () => {
    await notificationService.markAllRead();
    toast.success(t('notifications.toasts.allRead'));
  };

  return (
    <>
      <PageHeader
        title={t('notifications.title')}
        description={t('notifications.description')}
        actions={
          unread > 0 && (
            <Button variant="secondary" icon={CheckCheck} onClick={markAll}>
              {t('notifications.markAllRead')}
            </Button>
          )
        }
      />
      <Card>
        <div className="border-b border-line p-3 sm:p-4">
          <Tabs
            size="sm"
            label={t('common.filters')}
            value={filter}
            onChange={(v) => set({ filter: v })}
            tabs={NOTIFICATION_CATEGORIES.map((c) => ({ value: c, label: t(`notifications.categories.${c}`), count: c === 'unread' ? unread : undefined }))}
          />
        </div>
        {inbox.error ? (
          <ErrorState error={inbox.error} onRetry={inbox.refetch} />
        ) : inbox.loading ? (
          <div className="space-y-4 p-5" role="status" aria-label={t('common.loading')}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="size-10 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : inbox.data.data.length === 0 ? (
          <EmptyState icon={BellOff} title={filter !== 'all' ? t('notifications.empty.filteredTitle') : t('notifications.empty.title')} description={t('notifications.empty.description')} />
        ) : (
          <>
            <ul className={cn('divide-y divide-line transition-opacity', inbox.fetching && 'opacity-60')} aria-live="polite">
              {inbox.data.data.map((n) => (
                <Item key={n.id} n={n} onOpen={open} onToggle={toggle} onDelete={remove} />
              ))}
            </ul>
            <div className="border-t border-line px-4 py-3 sm:px-5">
              <Pagination page={inbox.data.page} pages={inbox.data.pages} total={inbox.data.total} pageSize={inbox.data.pageSize} onChange={(page) => set({ page })} />
            </div>
          </>
        )}
      </Card>
    </>
  );
}
