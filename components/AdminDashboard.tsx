import React, { useEffect, useMemo, useState } from 'react';
import { Member, MemberStatus } from '../types';
import {
  isUsingFirebase,
  subscribeToMembersRegistry,
  updateMemberStatus,
} from '../services/memberService';

interface AdminDashboardProps {
  currentUser?: Member | null;
}

/**
 * Chapter administration: live approval queue.
 * Subscribes to the shared member registry so new applications appear
 * without a full page reload.
 */
export const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser }) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'queue' | 'all'>('queue');
  const [lastSync, setLastSync] = useState<number>(Date.now());

  const isAdmin =
    currentUser?.isAdmin === true ||
    currentUser?.adminRole === 'SUPER' ||
    currentUser?.adminRole === 'ADMIN';

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = subscribeToMembersRegistry((all) => {
      setMembers(Array.isArray(all) ? all : []);
      setLoading(false);
      setLastSync(Date.now());
      setError(null);
    });

    return () => unsub();
  }, [isAdmin]);

  const setStatus = async (id: string, status: MemberStatus) => {
    if (!id) return;
    setBusyId(id);
    setError(null);
    try {
      const updated = await updateMemberStatus(id, status);
      if (!updated) {
        setError('Could not update member status.');
      }
      // Registry subscription will refresh; optimistic patch for snappy UI
      setMembers((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status, lastActive: Date.now() } : m))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed.');
    } finally {
      setBusyId(null);
    }
  };

  const queue = useMemo(
    () =>
      members.filter((m) => m.status === 'intending' || m.status === 'pending'),
    [members]
  );

  const list = filter === 'queue' ? queue : members;

  if (!isAdmin) {
    return (
      <div className="regal-card rounded-md p-6 text-center">
        <p className="text-sm font-black uppercase tracking-widest text-[#c9a227] mb-2">
          Restricted
        </p>
        <p className="text-sm opacity-60">Admin credentials required for this chamber.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in pb-8">
      <div className="text-center pt-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#c9a227] mb-1">
          Imperial Administration
        </p>
        <img
          src="/ysi-logo.png"
          alt="YSI"
          className="w-14 h-14 mx-auto mb-2 object-contain drop-shadow-[0_0_12px_rgba(191,149,63,0.35)]"
        />
        <h2 className="font-serif text-2xl font-black text-[#c9a227] uppercase">
          Admin Dashboard
        </h2>
        <p className="text-xs opacity-40 mt-1 uppercase tracking-widest">
          {isUsingFirebase() ? 'Firestore + local registry' : 'Local registry'} ·{' '}
          {currentUser?.name || 'Admin'}
        </p>
        <p className="text-[11px] opacity-30 mt-0.5">
          Live sync · {queue.length} in queue · updated{' '}
          {new Date(lastSync).toLocaleTimeString()}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Queue" value={queue.length} />
        <Stat label="Active" value={members.filter((m) => m.status === 'active').length} />
        <Stat label="Total" value={members.length} />
      </div>

      <div className="flex gap-2 flex-wrap">
        <FilterBtn active={filter === 'queue'} onClick={() => setFilter('queue')}>
          Approval Queue ({queue.length})
        </FilterBtn>
        <FilterBtn active={filter === 'all'} onClick={() => setFilter('all')}>
          Full Registry ({members.length})
        </FilterBtn>
      </div>

      {error && (
        <div
          className="rounded-sm border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-300"
          role="alert"
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-sm font-bold uppercase tracking-widest text-[#c9a227]/50 animate-pulse">
          Loading registry…
        </div>
      ) : list.length === 0 ? (
        <div className="regal-card rounded-md py-10 px-4 text-center space-y-2">
          <p className="text-sm font-black uppercase tracking-widest text-[#c9a227]/80">
            {filter === 'queue' ? 'No applications awaiting review' : 'No members inscribed'}
          </p>
          <p className="text-xs opacity-40 leading-relaxed max-w-xs mx-auto">
            Applicants appear after they register and submit a profile. Use another browser
            tab for the member account, then return here — this list refreshes every few
            seconds.
          </p>
          {filter === 'queue' && members.length > 0 && (
            <button
              type="button"
              onClick={() => setFilter('all')}
              className="mt-2 text-xs font-bold uppercase tracking-widest text-[#c9a227] underline"
            >
              View all {members.length} registry entries
            </button>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {list.map((m) => (
            <li
              key={m.id}
              className="regal-card rounded-md p-3 flex gap-3 items-start bg-white dark:bg-obsidian-panel border-gold-border/20"
            >
              <div className="w-11 h-11 rounded-full overflow-hidden border border-gold-border/30 shrink-0 bg-obsidian-panel">
                {m.photoUrl && !m.photoUrl.startsWith('local-photo:') ? (
                  <img src={m.photoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-lg opacity-30">
                    👤
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-bold font-serif truncate text-inherit">
                  {m.name || 'Unnamed'}
                </p>
                <p className="text-xs opacity-55 truncate">{m.email}</p>
                <p className="text-[11px] uppercase tracking-wide opacity-45 mt-0.5">
                  {m.memberId} · {m.tribe || '—'} · {m.status}
                </p>
                {(m.status === 'intending' || m.status === 'pending') && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <button
                      type="button"
                      disabled={busyId === m.id}
                      onClick={() => void setStatus(m.id, 'active')}
                      className="px-3 py-1.5 gold-bg text-royal-950 text-xs font-black uppercase rounded-sm disabled:opacity-50"
                    >
                      {busyId === m.id ? '…' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === m.id}
                      onClick={() => void setStatus(m.id, 'rejected')}
                      className="px-3 py-1.5 border border-red-500/40 text-red-300 text-xs font-bold uppercase rounded-sm disabled:opacity-50"
                    >
                      Decline
                    </button>
                  </div>
                )}
              </div>
              <StatusPill status={m.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="regal-card rounded-md p-2 text-center">
    <p className="text-[11px] font-bold uppercase text-gold-start mb-0.5">{label}</p>
    <p className="text-sm font-black font-serif text-[#c9a227]">{value}</p>
  </div>
);

const FilterBtn: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-sm ${
      active ? 'gold-bg text-royal-950' : 'border border-gold-border/20 text-[#c9a227]/60'
    }`}
  >
    {children}
  </button>
);

const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const colors: Record<string, string> = {
    intending: 'bg-amber-500/20 text-amber-200',
    pending: 'bg-blue-500/15 text-blue-200',
    active: 'bg-emerald-500/15 text-emerald-200',
    rejected: 'bg-red-500/15 text-red-300',
  };
  return (
    <span
      className={`shrink-0 text-[11px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${
        colors[status] || 'bg-white/5 opacity-50'
      }`}
    >
      {status}
    </span>
  );
};

export default AdminDashboard;
