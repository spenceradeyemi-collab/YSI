import React, { useEffect, useState } from 'react';
import { Member } from '../types';
import {
  canShowDevTools,
  isUsingFirebase,
  persistSessionUser,
  subscribeToMember,
  updateMemberStatus,
  upsertMember,
} from '../services/memberService';
import { YSI_LOGO } from '../constants/brand';

interface WaitingRoomProps {
  user?: Member;
  onStatusChange?: (user: Member) => void;
  onLogout?: () => void;
}

export const WaitingRoom: React.FC<WaitingRoomProps> = ({
  user,
  onStatusChange,
  onLogout,
}) => {
  const [liveUser, setLiveUser] = useState<Member | null>(user ?? null);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncNote, setSyncNote] = useState<string | null>(null);

  const showTesterTools = canShowDevTools(liveUser);
  const firebaseOn = isUsingFirebase();

  useEffect(() => {
    if (user) setLiveUser(user);
  }, [user]);

  useEffect(() => {
    if (!user?.id) {
      setError('Session missing. Please sign out and sign in again.');
      return;
    }

    setSyncNote(firebaseOn ? 'Connecting to registry…' : null);

    const unsub = subscribeToMember(user.id, (latest) => {
      if (!latest) {
        setSyncNote(firebaseOn ? 'Waiting for registry sync…' : null);
        return;
      }
      setSyncNote(null);
      setLiveUser(latest);
      if (latest.status && latest.status !== 'intending') {
        persistSessionUser(latest, true);
        onStatusChange?.(latest);
      }
    });

    return () => unsub();
  }, [user?.id, onStatusChange, firebaseOn]);

  const handleSimulateApproval = async () => {
    if (!showTesterTools || !liveUser) return;
    setSimulating(true);
    setError(null);
    try {
      let approved = await updateMemberStatus(liveUser.id, 'active');
      if (!approved) {
        approved = await upsertMember({
          ...liveUser,
          status: 'active',
          isPaidMember: true,
        });
      }
      persistSessionUser(approved, true);
      setLiveUser(approved);
      onStatusChange?.(approved);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : firebaseOn
            ? 'Could not simulate approval. Firestore rules may require an admin account (use Vizier Entrance).'
            : 'Could not simulate approval.'
      );
    } finally {
      setSimulating(false);
    }
  };

  const displayName = liveUser?.name || user?.name || 'Applicant';
  const photo = liveUser?.photoUrl || user?.photoUrl;
  const memberId = liveUser?.memberId || user?.memberId;

  return (
    <div className="app-shell bg-black">
      <div className="mobile-frame bg-obsidian-light text-white overflow-hidden flex flex-col">
        <header className="glass-panel shrink-0 h-16 flex items-center justify-between px-3 sm:px-4 border-b border-gold-border/20 z-50 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <img src={YSI_LOGO} alt="YSI" className="h-10 w-10 object-contain shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#c9a227]/80">
                YSI Imperial Portal
              </p>
              <h1 className="text-sm font-serif font-black text-[#c9a227] uppercase tracking-wide truncate">
                Verification Chamber
              </h1>
            </div>
          </div>
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="text-xs font-bold uppercase tracking-widest text-gold-mid/70 hover:text-gold-mid px-2 py-1.5 shrink-0"
            >
              Sign Out
            </button>
          )}
        </header>

        <main className="flex-1 overflow-y-auto custom-scroll px-5 py-8 flex flex-col items-center text-center">
          <div className="w-28 h-28 rounded-full border-2 border-gold-border/50 overflow-hidden mb-5 bg-obsidian-panel shadow-[0_0_30px_rgba(191,149,63,0.25)]">
            {photo ? (
              <img src={photo} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl opacity-40">
                ⏳
              </div>
            )}
          </div>

          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#c9a227] mb-2">
            Status
          </p>
          <h2 className="font-serif text-2xl sm:text-3xl font-black text-[#c9a227] uppercase tracking-tight mb-2">
            Awaiting Approval
          </h2>
          <p className="text-sm sm:text-base opacity-75 mb-1 font-serif">
            Supreme {displayName}
          </p>
          {memberId && (
            <p className="text-xs uppercase tracking-widest opacity-45 mb-2">
              Registry · {memberId}
            </p>
          )}
          <p
            className={`text-[11px] font-bold uppercase tracking-widest mb-2 ${
              firebaseOn ? 'text-emerald-400/70' : 'text-amber-400/60'
            }`}
          >
            {firebaseOn ? 'Live · Firestore sync' : 'Local registry'}
          </p>
          {syncNote && (
            <p className="text-[11px] text-gold-mid/60 mb-4 animate-pulse">{syncNote}</p>
          )}
          {!syncNote && <div className="mb-4" />}

          <div className="regal-card rounded-md p-4 w-full max-w-sm bg-gold-start/[0.04] border-gold-border/25 text-left mb-6">
            <p className="text-sm leading-relaxed opacity-85">
              Your membership application has been received and inscribed in the
              chapter registry. An authorized officer will review your profile.
              You will gain full portal access once your status is set to{' '}
              <span className="text-gold-mid font-bold">Active</span>.
            </p>
          </div>

          <div className="flex items-center gap-2 mb-8">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-[0.15em] text-amber-200/85">
              Pending chapter review
            </span>
          </div>

          {error && (
            <p className="text-sm text-red-400 mb-4 px-2" role="alert">
              {error}
            </p>
          )}

          {showTesterTools && (
            <div className="w-full max-w-sm space-y-2 border border-dashed border-gold-border/30 rounded-md p-3.5 bg-obsidian-panel/80">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gold-mid/55 mb-2">
                Dev / Admin Tools
              </p>
              <button
                type="button"
                disabled={simulating}
                onClick={handleSimulateApproval}
                className="w-full py-3 border border-gold-border/40 text-gold-mid text-xs font-black uppercase tracking-[0.12em] rounded-sm hover:bg-gold-start/10 disabled:opacity-50"
              >
                {simulating ? 'Approving…' : 'Tester: Simulate Admin Approval'}
              </button>
              {firebaseOn && (
                <p className="text-[11px] opacity-45 leading-snug">
                  With strict security rules, self-approval may be denied. Use Vizier
                  (admin) account or approve from Admin Dashboard.
                </p>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default WaitingRoom;
