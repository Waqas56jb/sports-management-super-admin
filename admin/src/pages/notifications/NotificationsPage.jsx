import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellOff, CheckCheck, Mail, MailOpen, Megaphone, Send, Trash2, Users } from 'lucide-react';
import NotificationIcon from '@/components/common/NotificationIcon';
import TeamLogo from '@/components/common/TeamLogo';
import { useNotificationText } from '@/components/common/useNotificationText';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Select, Textarea } from '@/components/ui/Field';
import Modal from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import PageHeader from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import Tabs from '@/components/ui/Tabs';
import { useNotifications } from '@/context/NotificationContext';
import { useToast } from '@/context/ToastContext';
import { useAction } from '@/hooks/useAction';
import { useForm } from '@/hooks/useForm';
import { useListParams } from '@/hooks/useListParams';
import { useOptions, useTeamOptions } from '@/hooks/useOptions';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useQuery } from '@/hooks/useQuery';
import { useI18n } from '@/i18n';
import { notificationService } from '@/services/notificationService';
import { NOTIFICATION_TYPES } from '@/utils/constants';
import { formatDateTime, formatRelative } from '@/utils/format';
import { cn } from '@/utils/cn';
import { maxLength, minLength, required } from '@/utils/validators';

const AUDIENCES = ['all', 'coaches', 'players', 'team'];

function ComposeModal({ open, onClose, onSent }) {
  const { t } = useI18n();
  const run = useAction();
  const { teamOptions } = useTeamOptions();
  const form = useForm({
    initial: { title: '', message: '', audience: 'all', team_id: '' },
    schema: {
      title: [required, minLength(4), maxLength(80)],
      message: [required, minLength(10), maxLength(500)],
      team_id: [(v, values) => (values.audience === 'team' ? required(v) : null)],
    },
    onSubmit: async (values) => {
      const res = await run(() => notificationService.sendAnnouncement(values));
      onSent(res);
    },
  });
  const { reset } = form;
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) reset({ title: '', message: '', audience: 'all', team_id: '' });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('notifications.composeForm.title')}
      description={t('notifications.composeForm.description')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="compose-form" icon={Send} loading={form.submitting} className="w-full sm:w-auto">
            {t('notifications.composeForm.send')}
          </Button>
        </>
      }
    >
      <form id="compose-form" ref={form.formRef} onSubmit={form.handleSubmit} noValidate className="grid gap-4">
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-ink">{t('notifications.audience.label')}</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {AUDIENCES.map((a) => (
              <label key={a} className={cn('flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-2 text-center text-sm font-medium transition-colors', form.values.audience === a ? 'border-brand-500 bg-brand-50 text-brand-800 ring-1 ring-brand-500 dark:bg-brand-500/10 dark:text-brand-200' : 'border-line text-ink-2 hover:bg-surface-2')}>
                <input type="radio" name="audience" className="sr-only" checked={form.values.audience === a} onChange={() => form.setValue('audience', a)} />
                {t(`notifications.audience.${a}`)}
              </label>
            ))}
          </div>
        </fieldset>
        {form.values.audience === 'team' && <Select label={t('notifications.composeForm.team')} required options={teamOptions} placeholder={t('common.notSet')} {...form.field('team_id')} />}
        <Input label={t('notifications.composeForm.subject')} required {...form.field('title')} />
        <Textarea label={t('notifications.composeForm.message')} required rows={4} {...form.field('message')} />
      </form>
    </Modal>
  );
}

function InboxItem({ n, onOpen, onToggle, onDelete }) {
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
            {!n.is_read && <Badge tone="brand" dot>{t('notifications.unread')}</Badge>}
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
      <div className="flex shrink-0 items-start gap-1 sm:opacity-60 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
        <button type="button" onClick={() => onToggle(n)} className="grid size-10 place-items-center rounded-lg text-ink-3 hover:bg-surface-3 hover:text-ink sm:size-9" aria-label={n.is_read ? t('notifications.markUnread') : t('notifications.markRead')} title={n.is_read ? t('notifications.markUnread') : t('notifications.markRead')}>
          {n.is_read ? <Mail className="size-4" /> : <MailOpen className="size-4" />}
        </button>
        <button type="button" onClick={() => onDelete(n)} className="grid size-10 place-items-center rounded-lg text-ink-3 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 sm:size-9" aria-label={t('notifications.delete')} title={t('notifications.delete')}>
          <Trash2 className="size-4" />
        </button>
      </div>
    </li>
  );
}

export default function NotificationsPage() {
  const { t, lang } = useI18n();
  usePageTitle(t('notifications.title'));
  const navigate = useNavigate();
  const toast = useToast();
  const toOptions = useOptions();
  const { teams } = useTeamOptions();
  const { unread, version } = useNotifications();
  const { params, set } = useListParams({ tab: 'inbox', status: 'all' });
  const [composeOpen, setComposeOpen] = useState(false);

  const inbox = useQuery(
    () => notificationService.list({ status: params.status === 'all' ? undefined : params.status, type: params.type, page: params.page, pageSize: 10 }),
    [params.status, params.type, params.page, version],
    { enabled: params.tab === 'inbox' },
  );
  const sent = useQuery(() => notificationService.announcements(), [], { enabled: params.tab === 'sent' });

  const open = async (n) => {
    if (!n.is_read) await notificationService.markRead(n.id);
    if (n.link) navigate(n.link);
  };
  const toggle = (n) => notificationService.markRead(n.id, !n.is_read);
  const remove = async (n) => {
    await notificationService.remove(n.id);
    toast.success(t('notifications.toasts.deleted'));
  };
  const markAll = async () => {
    await notificationService.markAllRead();
    toast.success(t('notifications.toasts.allRead'));
  };

  const teamById = Object.fromEntries(teams.map((tm) => [tm.id, tm]));

  return (
    <>
      <PageHeader
        title={t('notifications.title')}
        description={t('notifications.description')}
        actions={
          <>
            {params.tab === 'inbox' && unread > 0 && (
              <Button variant="secondary" icon={CheckCheck} onClick={markAll}>
                {t('notifications.markAllRead')}
              </Button>
            )}
            <Button icon={Megaphone} onClick={() => setComposeOpen(true)}>
              {t('notifications.compose')}
            </Button>
          </>
        }
      />
      <Tabs
        className="mb-4"
        label={t('notifications.title')}
        value={params.tab}
        onChange={(v) => set({ tab: v })}
        tabs={[
          { value: 'inbox', label: t('notifications.tabs.inbox'), icon: Bell, count: unread || undefined },
          { value: 'sent', label: t('notifications.tabs.sent'), icon: Send },
        ]}
      />

      {params.tab === 'inbox' ? (
        <Card>
          <div className="flex flex-col gap-3 border-b border-line p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <Tabs
              size="sm"
              label={t('common.status')}
              value={params.status}
              onChange={(v) => set({ status: v })}
              tabs={['all', 'unread', 'read'].map((s) => ({ value: s, label: t(`notifications.status.${s}`) }))}
            />
            <Select aria-label={t('common.filters')} value={params.type ?? ''} onChange={(e) => set({ type: e.target.value })} options={toOptions(NOTIFICATION_TYPES, 'notifications.types')} placeholder={t('notifications.allTypes')} fieldClassName="sm:w-60" />
          </div>
          {inbox.error ? (
            <ErrorState error={inbox.error} onRetry={inbox.refetch} />
          ) : inbox.loading ? (
            <div className="space-y-4 p-5">
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
            <EmptyState icon={BellOff} title={params.status !== 'all' || params.type ? t('notifications.empty.filteredTitle') : t('notifications.empty.title')} description={t('notifications.empty.description')} />
          ) : (
            <>
              <ul className={cn('divide-y divide-line transition-opacity', inbox.fetching && 'opacity-60')}>
                {inbox.data.data.map((n) => (
                  <InboxItem key={n.id} n={n} onOpen={open} onToggle={toggle} onDelete={remove} />
                ))}
              </ul>
              <div className="border-t border-line px-4 py-3 sm:px-5">
                <Pagination page={inbox.data.page} pages={inbox.data.pages} total={inbox.data.total} pageSize={inbox.data.pageSize} onChange={(page) => set({ page })} />
              </div>
            </>
          )}
        </Card>
      ) : (
        <Card>
          {sent.error ? (
            <ErrorState error={sent.error} onRetry={sent.refetch} />
          ) : sent.loading ? (
            <div className="space-y-4 p-5">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : sent.data.length === 0 ? (
            <EmptyState icon={Megaphone} title={t('notifications.empty.sentTitle')} description={t('notifications.empty.sentDescription')} action={<Button icon={Megaphone} onClick={() => setComposeOpen(true)}>{t('notifications.compose')}</Button>} />
          ) : (
            <ul className="divide-y divide-line">
              {sent.data.map((a) => (
                <li key={a.id} className="flex gap-4 px-4 py-4 sm:px-5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                    <Megaphone className="size-[18px]" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{a.title}</p>
                    <p className="mt-1 text-sm text-ink-2">{a.message}</p>
                    <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-3">
                      <Badge tone="neutral">
                        {a.audience === 'team' && teamById[a.team_id] ? (
                          <span className="inline-flex items-center gap-1">
                            <TeamLogo team={teamById[a.team_id]} size="xs" className="size-3.5" />
                            {teamById[a.team_id].name}
                          </span>
                        ) : (
                          t(`notifications.audience.${a.audience}`)
                        )}
                      </Badge>
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3.5" aria-hidden="true" />
                        {t('notifications.recipients', { count: a.recipients })}
                      </span>
                      <span aria-hidden="true">·</span>
                      <time dateTime={a.created_at}>{formatDateTime(a.created_at, lang)}</time>
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <ComposeModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        onSent={(a) => {
          setComposeOpen(false);
          toast.success(t('notifications.toasts.sent', { count: a.recipients }));
          if (params.tab === 'sent') sent.refetch();
          else set({ tab: 'sent' });
        }}
      />
    </>
  );
}
