import React, { useEffect, useRef, useState } from 'react';
import { Member } from '../types';
import {
  compressImageFile,
  submitMembershipApplication,
} from '../services/memberService';
import { YSI_LOGO } from '../constants/brand';

interface MembershipApplicationProps {
  user: Member;
  onSubmitted?: (user: Member) => void;
  onLogout?: () => void;
}

/**
 * Profile / membership application gate.
 * Layout uses a fixed footer so "SUBMIT APPLICATION" stays reachable on mobile
 * even after a large profile photo is attached (no scroll trap / layout freeze).
 */
export const MembershipApplication: React.FC<MembershipApplicationProps> = ({
  user,
  onSubmitted,
  onLogout,
}) => {
  const [name, setName] = useState(user.name || '');
  const [tribe, setTribe] = useState(user.tribe || '');
  const [profession, setProfession] = useState(user.profession || '');
  const [bio, setBio] = useState(user.bio || '');
  const [birthday, setBirthday] = useState(user.birthday || '');
  const [photoUrl, setPhotoUrl] = useState(user.photoUrl || '');
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const submitBarRef = useRef<HTMLDivElement>(null);

  // Keep submit bar visible after photo load / keyboard open on mobile
  useEffect(() => {
    if (!photoUrl) return;
    // After layout settles, ensure the sticky bar is in view without jank
    const id = window.setTimeout(() => {
      submitBarRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 120);
    return () => window.clearTimeout(id);
  }, [photoUrl]);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset input so the same file can be re-selected after an error
    e.target.value = '';
    if (!file) return;

    setPhotoError(null);
    setFormError(null);
    setUploading(true);

    try {
      const dataUrl = await compressImageFile(file);
      setPhotoUrl(dataUrl);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Photo upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const clearPhoto = () => {
    setPhotoUrl('');
    setPhotoError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Please enter your full name.');
      return;
    }
    if (!birthday) {
      setFormError('Date of birth is required.');
      return;
    }
    if (!tribe.trim()) {
      setFormError('Please enter your tribe / heritage.');
      return;
    }
    if (!photoUrl) {
      setFormError('A profile photo is required to submit your application.');
      return;
    }
    if (uploading) {
      setFormError('Please wait for the photo to finish processing.');
      return;
    }

    setSubmitting(true);
    try {
      // Writes shared registry (ysi_users) + session so Admin Dashboard sees the applicant
      const saved = await submitMembershipApplication(user, {
        name: name.trim(),
        tribe: tribe.trim(),
        profession: profession.trim() || undefined,
        bio: bio.trim() || undefined,
        birthday,
        photoUrl,
      });

      onSubmitted?.(saved);
    } catch (err) {
      console.error('Application submit failed:', err);
      setFormError(
        err instanceof Error
          ? err.message
          : 'Could not save your application. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app-shell bg-black">
      <div className="mobile-frame bg-obsidian-light text-white overflow-hidden flex flex-col relative">
        {/* Header */}
        <header className="glass-panel shrink-0 h-16 flex items-center justify-between px-3 sm:px-4 border-b border-gold-border/20 z-50 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <img src={YSI_LOGO} alt="YSI" className="h-10 w-10 object-contain shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#c9a227]/80">
                YSI Imperial Portal
              </p>
              <h1 className="text-sm font-serif font-black text-[#c9a227] uppercase tracking-wide truncate">
                Membership Application
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

        {/* Scrollable form body — min-h-0 is critical so sticky footer isn't pushed off-screen */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 flex flex-col min-h-0 overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto custom-scroll min-h-0 px-4 pt-4 pb-6 overscroll-contain">
            <div className="space-y-4 animate-fade-in">
              <div className="regal-card rounded-md p-3.5 bg-gold-start/[0.04] border-gold-border/30">
                <p className="text-sm leading-relaxed opacity-85">
                  Complete your profile to request induction. Admins will review
                  your application — you will see{' '}
                  <strong className="text-gold-mid">Awaiting Approval</strong> after submit.
                </p>
              </div>

              {/* Photo */}
              <div className="space-y-2">
                <label className="block text-[11px] sm:text-xs font-black uppercase tracking-[0.18em] text-[#c9a227]">
                  Profile Photo <span className="text-red-400">*</span>
                </label>
                <div className="flex flex-col items-center gap-3">
                  <div className="relative w-32 h-32 shrink-0 rounded-full border-2 border-gold-border/40 overflow-hidden bg-obsidian-panel shadow-inner">
                    {photoUrl ? (
                      <img
                        src={photoUrl}
                        alt="Profile preview"
                        className="w-full h-full object-cover"
                        draggable={false}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gold-mid/30 text-4xl">
                        👤
                      </div>
                    )}
                    {uploading && (
                      <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                        <span className="text-xs font-bold uppercase tracking-widest text-gold-mid animate-pulse">
                          Processing…
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <button
                      type="button"
                      disabled={uploading || submitting}
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2.5 gold-bg text-royal-950 text-xs font-black uppercase tracking-wider rounded-sm disabled:opacity-50"
                    >
                      {photoUrl ? 'Change Photo' : 'Upload Photo'}
                    </button>
                    {photoUrl && (
                      <button
                        type="button"
                        disabled={uploading || submitting}
                        onClick={clearPhoto}
                        className="px-4 py-2.5 border border-gold-border/30 text-gold-mid text-xs font-bold uppercase tracking-wider rounded-sm disabled:opacity-50"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="user"
                    className="hidden"
                    onChange={handlePhotoChange}
                  />
                  {photoError && (
                    <p className="text-sm text-red-400 text-center font-medium" role="alert">
                      {photoError}
                    </p>
                  )}
                  <p className="text-[11px] opacity-45 text-center uppercase tracking-wide">
                    Photos are compressed for mobile — max ~720px
                  </p>
                </div>
              </div>

              {/* Fields */}
              <Field
                label="Full Name"
                required
                value={name}
                onChange={setName}
                placeholder="As it should appear on the registry"
                disabled={submitting}
              />
              <Field
                label="Date of Birth"
                required
                type="date"
                value={birthday}
                onChange={setBirthday}
                disabled={submitting}
              />
              <Field
                label="Tribe / Heritage"
                required
                value={tribe}
                onChange={setTribe}
                placeholder="e.g. Oyo, Ijebu, Ekiti…"
                disabled={submitting}
              />
              <Field
                label="Profession"
                value={profession}
                onChange={setProfession}
                placeholder="Your vocation"
                disabled={submitting}
              />
              <div className="space-y-1.5">
                <label className="block text-[11px] sm:text-xs font-black uppercase tracking-[0.18em] text-[#c9a227]">
                  Brief Bio
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  disabled={submitting}
                  rows={3}
                  maxLength={500}
                  placeholder="Share a short introduction for the chapter…"
                  className="w-full rounded-sm border border-gold-border/20 px-3.5 py-3 text-sm outline-none focus:border-gold-border/50 resize-none"
                />
              </div>

              {formError && (
                <div
                  className="rounded-sm border border-red-500/40 bg-red-950/40 px-3 py-2.5 text-sm text-red-300"
                  role="alert"
                >
                  {formError}
                </div>
              )}

              {/* Spacer so last fields aren't hidden under sticky bar on small screens */}
              <div className="h-4" aria-hidden />
            </div>
          </div>

          {/* Sticky submit bar — always visible, never pushed off by photo layout */}
          <div
            ref={submitBarRef}
            className="shrink-0 sticky bottom-0 z-50 border-t border-gold-border/25 bg-obsidian-light/95 backdrop-blur-md px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.45)]"
          >
            <button
              type="submit"
              disabled={submitting || uploading}
              className="w-full py-3.5 gold-bg text-royal-950 text-sm font-black uppercase tracking-[0.15em] rounded-sm shadow-lg disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99] transition-transform"
            >
              {submitting
                ? 'Submitting…'
                : uploading
                  ? 'Processing Photo…'
                  : 'Submit Application'}
            </button>
            <p className="mt-1.5 text-center text-[11px] opacity-45 uppercase tracking-widest">
              Status will become Awaiting Approval
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  disabled?: boolean;
}

const Field: React.FC<FieldProps> = ({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = 'text',
  disabled,
}) => (
  <div className="space-y-1.5">
    <label className="block text-[11px] sm:text-xs font-black uppercase tracking-[0.18em] text-[#c9a227]">
      {label} {required && <span className="text-red-400">*</span>}
    </label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      className="w-full rounded-sm border border-gold-border/20 px-3.5 py-3 text-sm outline-none focus:border-gold-border/50 disabled:opacity-50"
    />
  </div>
);

export default MembershipApplication;
