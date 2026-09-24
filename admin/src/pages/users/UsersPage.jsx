import { useState } from 'react';
import { KeyRound, Pencil, Plus, Power, ShieldOff, Trash2, UserCheck, UserX } from 'lucide-react';
import PersonCell from '@/components/common/PersonCell';
import RowActions from '@/components/common/RowActions';
import Badge, { StatusBadge } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import DataTable from '@/components/ui/DataTable';
import FilterBar from '@/components/ui/FilterBar';
import PageHeader from '@/components/ui/PageHeader';
import Pagination from '@/components/ui/Pagination';
import { EmptyState, ErrorState } from '@/components/ui/States';
import Tabs from '@/components/ui/Tabs';
import { useAuth } from '@/context/AuthContext';
import { useConfirm } from '@/context/ConfirmContext';
import { useAction } from '@/hooks/useAction';
import { useListParams } from '@/hooks/useListParams';
import { useOptions } from '@/hooks/useOptions';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useQuery } from '@/hooks/useQuery';
import { useI18n } from '@/i18n';
import { userService } from '@/services/userService';
import { ACCOUNT_STATUSES, PAGE_SIZE } from '@/utils/constants';
import { formatDate, formatRelative } from '@/utils/format';
import ResetPasswordModal from './ResetPasswordModal';
import UserFormModal from './UserFormModal';

const ROLE_TONE = { super_admin: 'brand', coach: 'info', player: 'neutral' };

export default function UsersPage() {
  const { t, lang } = useI18n();
  usePageTitle(t('users.title'));
  const { user: me } = useAuth();
  const confirm = useConfirm();
  const run = useAction();
  const toOptions = useOptions();
  const { params, set, reset } = useListParams({ sort: 'created_at', dir: 'desc' });
  const [modal, setModal] = useState({ type: null, user: null });

  const list = useQuery(
    () => userService.list({ search: params.search, role: params.role, status: params.status, page: params.page, pageSize: PAGE_SIZE, sort: params.sort, dir: params.dir }),
    [params.search, params.role, params.status, params.page, params.sort, params.dir],
  );
  const counts = useQuery(() => userService.counts(), [list.data]);

  const close = () => setModal({ type: null, user: null });
  const refresh = () => list.refetch();

  const saveUser = async (values) => {
    if (modal.user) await run(() => userService.update(modal.user.id, values), { success: 'users.toasts.updated' });
    else await run(() => userService.create(values), { success: 'users.toasts.created' });
    close();
    refresh();
  };

  const changeStatus = async (u, status) => {
    const toast = { active: 'users.toasts.activated', inactive: 'users.toasts.deactivated', suspended: 'users.toasts.suspended' }[status];
    if (status === 'active') {
      await run(() => userService.setStatus(u.id, status), { success: toast }).catch(() => {});
      return refresh();
    }
    const ok = await confirm({
      title: t(status === 'suspended' ? 'users.confirmStatus.suspendTitle' : 'users.confirmStatus.deactivateTitle', { name: u.name }),
      message: t(status === 'suspended' ? 'users.confirmStatus.suspendMessage' : 'users.confirmStatus.deactivateMessage'),
      confirmLabel: t(status === 'suspended' ? 'users.actions.suspend' : 'users.actions.deactivate'),
      tone: 'danger',
      onConfirm: () => run(() => userService.setStatus(u.id, status), { success: toast }),
    });
    if (ok) refresh();
  };

  const remove = async (u) => {
    const ok = await confirm({
      title: t('users.confirmDelete.title', { name: u.name }),
      message: u.profile ? t('users.confirmDelete.messageLinked', { role: t(`roles.${u.role}`).toLowerCase() }) : t('users.confirmDelete.message'),
      confirmLabel: t('users.actions.delete'),
      onConfirm: () => run(() => userService.remove(u.id, me?.id), { success: 'users.toasts.deleted' }),
    });
    if (ok) refresh();
  };

  const resetPassword = async ({ mode, password }) => {
    await run(() => userService.resetPassword(modal.user.id, { mode, password }), {
      success: mode === 'link' ? t('users.toasts.resetLink', { email: modal.user.email }) : 'users.toasts.resetManual',
    });
    close();
  };

  const actionsFor = (u) => [
    { label: t('users.actions.edit'), icon: Pencil, onClick: () => setModal({ type: 'form', user: u }) },
    { label: t('users.actions.resetPassword'), icon: KeyRound, onClick: () => setModal({ type: 'reset', user: u }) },
    u.profile && { label: t('users.openProfile'), icon: UserCheck, to: `/admin/${u.profile.type === 'coach' ? 'coaches' : 'players'}/${u.profile.id}` },
    { divider: true },
    u.status !== 'active' && { label: t('users.actions.activate'), icon: Power, onClick: () => changeStatus(u, 'active') },
    u.status === 'active' && u.id !== me?.id && { label: t('users.actions.deactivate'), icon: UserX, onClick: () => changeStatus(u, 'inactive') },
    u.status !== 'suspended' && u.id !== me?.id && { label: t('users.actions.suspend'), icon: ShieldOff, onClick: () => changeStatus(u, 'suspended') },
    u.id !== me?.id && { divider: true },
    u.id !== me?.id && { label: t('users.actions.delete'), icon: Trash2, tone: 'danger', onClick: () => remove(u) },
  ];

  const nameCell = (u) => (
    <PersonCell
      name={u.name}
      photo={u.avatar}
      sub={u.email}
      trailing={u.id === me?.id && <Badge tone="brand">{t('users.you')}</Badge>}
    />
  );

  const columns = [
    { key: 'name', header: t('users.columns.user'), sortable: true, render: nameCell, className: 'max-w-80' },
    { key: 'role', header: t('users.columns.role'), sortable: true, render: (u) => <Badge tone={ROLE_TONE[u.role]}>{t(`roles.${u.role}`)}</Badge> },
    { key: 'status', header: t('users.columns.status'), sortable: true, render: (u) => <StatusBadge value={u.status} /> },
    { key: 'created_at', header: t('users.columns.created'), sortable: true, render: (u) => <span className="tabular">{formatDate(u.created_at, lang)}</span> },
    { key: 'last_login_at', header: t('users.columns.lastLogin'), sortable: true, render: (u) => (u.last_login_at ? formatRelative(u.last_login_at, lang) : <span className="text-ink-3">{t('users.never')}</span>) },
    { key: 'actions', header: <span className="sr-only">{t('common.actions')}</span>, align: 'right', render: (u) => <RowActions items={actionsFor(u)} /> },
  ];

  const c = counts.data;
  const hasFilters = params.search || params.status || params.role;

  return (
    <>
      <PageHeader
        title={t('users.title')}
        description={t('users.description')}
        actions={
          <Button icon={Plus} onClick={() => setModal({ type: 'form', user: null })}>
            {t('users.add')}
          </Button>
        }
      />

      <Tabs
        className="mb-4"
        label={t('users.columns.role')}
        value={params.role ?? ''}
        onChange={(v) => set({ role: v })}
        tabs={[
          { value: '', label: t('users.tabs.all'), count: c?.total },
          { value: 'super_admin', label: t('users.tabs.super_admin'), count: c?.super_admin },
          { value: 'coach', label: t('users.tabs.coach'), count: c?.coach },
          { value: 'player', label: t('users.tabs.player'), count: c?.player },
        ]}
      />

      <Card>
        <div className="border-b border-line p-3 sm:p-4">
          <FilterBar
            search={params.search ?? ''}
            onSearch={(v) => set({ search: v })}
            searchPlaceholder={t('users.searchPlaceholder')}
            filters={[{ key: 'status', label: t('common.status'), options: toOptions(ACCOUNT_STATUSES, 'status'), placeholder: t('common.allStatuses') }]}
            values={params}
            onChange={set}
            onReset={() => reset(['status', 'search'])}
          />
        </div>
        {list.error ? (
          <ErrorState error={list.error} onRetry={list.refetch} />
        ) : (
          <DataTable
            caption={t('users.title')}
            columns={columns}
            rows={list.data?.data}
            loading={list.loading}
            fetching={list.fetching}
            sort={params.sort}
            dir={params.dir}
            onSort={(sort, dir) => set({ sort, dir })}
            empty={
              <EmptyState
                icon={UserX}
                title={t('users.empty.title')}
                description={t('users.empty.description')}
                action={hasFilters && <Button variant="secondary" onClick={() => reset()}>{t('common.reset')}</Button>}
              />
            }
            mobileCard={(u) => (
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  {nameCell(u)}
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 pl-[52px]">
                    <Badge tone={ROLE_TONE[u.role]}>{t(`roles.${u.role}`)}</Badge>
                    <StatusBadge value={u.status} />
                  </div>
                </div>
                <RowActions items={actionsFor(u)} />
              </div>
            )}
          />
        )}
        {list.data && list.data.total > 0 && (
          <div className="border-t border-line px-4 py-3 sm:px-5">
            <Pagination page={list.data.page} pages={list.data.pages} total={list.data.total} pageSize={list.data.pageSize} onChange={(page) => set({ page })} />
          </div>
        )}
      </Card>

      <UserFormModal open={modal.type === 'form'} user={modal.user} onClose={close} onSubmit={saveUser} />
      <ResetPasswordModal open={modal.type === 'reset'} user={modal.user} onClose={close} onSubmit={resetPassword} />
    </>
  );
}
