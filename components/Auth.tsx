import React, { useState } from 'react';
import { Member } from '../types';
import {
  canShowDevTools,
  ensureVizierAdmin,
  isUsingFirebase,
  loginMember,
  registerMember,
} from '../services/memberService';
import { YSI_LOGO } from '../constants/brand';

interface AuthProps {
  onLogin?: (user: Member, rememberMe: boolean) => void;
}

type Mode = 'login' | 'register';

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showVizier = canShowDevTools(null);
  const firebaseOn = isUsingFirebase();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await loginMember(email, password, rememberMe);
      onLogin?.(user, rememberMe);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await registerMember(name, email, password, rememberMe);
      onLogin?.(user, rememberMe);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVizierEntrance = async () => {
    if (!showVizier) return;
    setLoading(true);
    setError(null);
    try {
      const admin = await ensureVizierAdmin();
      onLogin?.(admin, true);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Vizier entrance failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell bg-black">
      <div className="mobile-frame bg-obsidian-light text-white overflow-y-auto custom-scroll flex flex-col">
        <div className="flex-1 flex flex-col justify-center px-5 sm:px-6 py-10 animate-fade-in">
          <div className="text-center mb-8">
            <img
              src={YSI_LOGO}
              alt="Yoruba Supreme Indigenes"
              className="w-28 h-28 sm:w-32 sm:h-32 mx-auto mb-5 object-contain drop-shadow-[0_0_24px_rgba(191,149,63,0.45)]"
            />
            <p className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.3em] text-[#c9a227] mb-2">
              Heritage & Excellence
            </p>
            <h1 className="font-serif text-2xl sm:text-3xl font-black text-[#c9a227] uppercase tracking-tight mb-1 leading-tight">
              YSI Imperial Portal
            </h1>
            <p className="text-xs sm:text-sm opacity-55 uppercase tracking-widest">
              Yoruba Supreme Indigenes
            </p>
            <p
              className={`mt-3 text-[11px] font-bold uppercase tracking-widest ${
                firebaseOn ? 'text-emerald-400/70' : 'text-amber-400/60'
              }`}
            >
              {firebaseOn
                ? '● Cloud · Firebase Auth + Firestore'
                : '○ Local mode · configure Firebase in .env'}
            </p>
          </div>

          <div className="flex gap-2 mb-6">
            <TabBtn active={mode === 'login'} onClick={() => setMode('login')}>
              Sign In
            </TabBtn>
            <TabBtn active={mode === 'register'} onClick={() => setMode('register')}>
              Register
            </TabBtn>
          </div>

          <form
            onSubmit={mode === 'login' ? handleLogin : handleRegister}
            className="space-y-3.5"
          >
            {mode === 'register' && (
              <AuthInput
                label="Full Name"
                value={name}
                onChange={setName}
                placeholder="Your name"
                autoComplete="name"
                required
              />
            )}
            <AuthInput
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
            <AuthInput
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder={firebaseOn ? 'Min 6 characters' : '••••••••'}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
            />

            <label className="flex items-center gap-2.5 text-xs sm:text-sm opacity-75 cursor-pointer select-none pt-1">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="accent-[#bf953f] w-4 h-4"
              />
              Remember me on this device
            </label>

            {error && (
              <div
                className="rounded-sm border border-red-500/40 bg-red-950/40 px-3 py-2.5 text-xs sm:text-sm text-red-300"
                role="alert"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 mt-2 gold-bg text-royal-950 text-sm font-black uppercase tracking-[0.15em] rounded-sm shadow-lg disabled:opacity-50"
            >
              {loading
                ? 'Please wait…'
                : mode === 'login'
                  ? 'Enter Portal'
                  : 'Create Account'}
            </button>
          </form>

          <p className="mt-5 text-center text-xs sm:text-sm opacity-45 leading-relaxed px-1">
            New members complete a profile application, then wait for chapter approval.
          </p>

          {showVizier && (
            <div className="mt-8 pt-6 border-t border-gold-border/15">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gold-mid/45 text-center mb-3">
                Development Access
              </p>
              <button
                type="button"
                disabled={loading}
                onClick={handleVizierEntrance}
                className="w-full py-3 border border-dashed border-gold-border/40 text-gold-mid text-xs font-black uppercase tracking-[0.15em] rounded-sm hover:bg-gold-start/10 disabled:opacity-50"
              >
                Vizier Entrance
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const TabBtn: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex-1 py-2.5 text-xs sm:text-sm font-black uppercase tracking-widest rounded-sm transition-all ${
      active
        ? 'gold-bg text-royal-950'
        : 'border border-gold-border/20 text-gold-mid/60'
    }`}
  >
    {children}
  </button>
);

const AuthInput: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
}> = ({ label, value, onChange, type = 'text', placeholder, autoComplete, required }) => (
  <div className="space-y-1.5">
    <label className="block text-[11px] sm:text-xs font-black uppercase tracking-[0.18em] text-[#c9a227]">
      {label}
    </label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete={autoComplete}
      required={required}
      className="w-full rounded-sm border border-gold-border/20 px-3.5 py-3 text-sm outline-none focus:border-gold-border/50"
    />
  </div>
);

export default Auth;
