import React, { useState, useEffect, useCallback } from 'react';
import { AppView, Member, Post, MemberStatus } from './types';
import { HeritageExplorer } from './components/HeritageExplorer';
import { LanguageTutor } from './components/LanguageTutor';
import { MemberProfile } from './components/MemberProfile';
import { CreativeStudio } from './components/CreativeStudio';
import { AdminDashboard } from './components/AdminDashboard';
import Auth from './components/Auth';
import { MemberDirectory } from './components/MemberDirectory';
import { BackgroundMusic } from './components/BackgroundMusic';
import HelpSection from './components/HelpSection';
import { CreatePost } from './components/CreatePost';
import { MembershipApplication } from './components/MembershipApplication';
import { WaitingRoom } from './components/WaitingRoom';
import { Messaging } from './components/Messaging';
import { AttendanceLedger } from './components/AttendanceLedger';
import { CalendarView } from './components/CalendarView';
import { STORAGE_KEYS } from './services/geminiService';
import {
  getCachedSessionUser,
  logoutMember,
  normalizeMember,
  persistSessionUser,
  subscribeToAuthSession,
  upsertMember,
} from './services/memberService';
import { YSI_LOGO, resolveLogoUrl } from './constants/brand';

function safeStatus(user: Member | null | undefined): MemberStatus | null {
  if (!user) return null;
  const s = user.status;
  if (s === 'pending' || s === 'intending' || s === 'active' || s === 'rejected') return s;
  return 'pending';
}

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.HOME);
  const [user, setUser] = useState<Member | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [isDark, setIsDark] = useState(true);
  const [approvedPosts, setApprovedPosts] = useState<Post[]>([]);

  const [masterWisdom, setMasterWisdom] = useState(
    () =>
      localStorage.getItem(STORAGE_KEYS.MASTER_WISDOM) ||
      "Kabo s'inu ogba awon omo kaaro oojiire. Eni ti o ba fe ki oruko re duro, o gbodo se rere."
  );
  const [masterChapter, setMasterChapter] = useState(
    () => localStorage.getItem(STORAGE_KEYS.MASTER_CHAPTER) || 'DFW METROPLEX'
  );
  const [masterLogo, setMasterLogo] = useState(() =>
    resolveLogoUrl(localStorage.getItem(STORAGE_KEYS.MASTER_LOGO))
  );

  const applyUser = useCallback((raw: Member | null) => {
    if (!raw) {
      setUser(null);
      return;
    }
    setUser(normalizeMember(raw));
  }, []);

  useEffect(() => {
    let alive = true;
    let splashInitialized = false;

    const cached = getCachedSessionUser();
    if (cached) {
      applyUser(cached);
      setShowSplash(safeStatus(cached) === 'active');
      splashInitialized = true;
      setAuthReady(true);
    }

    const timeout = window.setTimeout(() => {
      if (alive) setAuthReady(true);
    }, 2500);

    let unsub: (() => void) | undefined;
    try {
      unsub = subscribeToAuthSession((member) => {
        if (!alive) return;
        if (!member) {
          applyUser(null);
          setAuthReady(true);
          return;
        }
        applyUser(member);
        if (!splashInitialized) {
          setShowSplash(safeStatus(member) === 'active');
          splashInitialized = true;
        }
        setAuthReady(true);
      });
    } catch (err) {
      console.error('subscribeToAuthSession failed', err);
      applyUser(getCachedSessionUser());
      setAuthReady(true);
    }

    return () => {
      alive = false;
      window.clearTimeout(timeout);
      unsub?.();
    };
  }, [applyUser]);

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('ysi_theme') || 'dark';
      setIsDark(savedTheme === 'dark');
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    } catch {
      /* ignore */
    }

    // Prefer new brand logo; migrate away from legacy AI Studio URL
    const resolved = resolveLogoUrl(localStorage.getItem(STORAGE_KEYS.MASTER_LOGO));
    setMasterLogo(resolved);
    try {
      localStorage.setItem(STORAGE_KEYS.MASTER_LOGO, YSI_LOGO);
    } catch {
      /* ignore */
    }

    const handleMasterUpdate = () => {
      setMasterWisdom(
        localStorage.getItem(STORAGE_KEYS.MASTER_WISDOM) || masterWisdom
      );
      setMasterChapter(
        localStorage.getItem(STORAGE_KEYS.MASTER_CHAPTER) || masterChapter
      );
      setMasterLogo(resolveLogoUrl(localStorage.getItem(STORAGE_KEYS.MASTER_LOGO)));
    };
    window.addEventListener('ysi_master_update', handleMasterUpdate);
    loadBoard();

    return () => window.removeEventListener('ysi_master_update', handleMasterUpdate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView]);

  const loadBoard = () => {
    try {
      const posts: Post[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.POSTS) || '[]');
      if (!Array.isArray(posts)) {
        setApprovedPosts([]);
        return;
      }
      const now = Date.now();
      setApprovedPosts(
        posts
          .filter(
            (p) =>
              p &&
              p.status === 'approved' &&
              (!p.expiryDate || p.expiryDate > now)
          )
          .slice(0, 10)
      );
    } catch {
      setApprovedPosts([]);
    }
  };

  const handleLogout = async () => {
    setUser(null);
    setShowSplash(true);
    setCurrentView(AppView.HOME);
    try {
      await logoutMember();
    } catch (err) {
      console.warn('logout failed', err);
    }
  };

  const handleApplicationSubmitted = (updatedUser: Member) => {
    const safe = normalizeMember(updatedUser);
    if (!safe) return;
    setUser(safe);
    persistSessionUser(safe, true);
  };

  const handleStatusChange = (updatedUser: Member) => {
    const safe = normalizeMember(updatedUser);
    if (!safe) return;
    setUser(safe);
    persistSessionUser(safe, true);
  };

  const handleUpdateProfile = async (updatedUser: Member) => {
    try {
      const saved = await upsertMember(updatedUser);
      const safe = normalizeMember(saved);
      if (safe) {
        setUser(safe);
        persistSessionUser(safe, true);
      }
    } catch (err) {
      console.error('Profile update failed', err);
    }
  };

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    try {
      localStorage.setItem('ysi_theme', nextDark ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
    document.documentElement.classList.toggle('dark', nextDark);
  };

  const handleLike = (postId: string) => {
    if (!user?.id) return;
    try {
      const allPosts: Post[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.POSTS) || '[]');
      if (!Array.isArray(allPosts)) return;
      const updated = allPosts.map((p) => {
        if (!p || p.id !== postId) return p;
        const likes = p.likes || [];
        const newLikes = likes.includes(user.id)
          ? likes.filter((id) => id !== user.id)
          : [...likes, user.id];
        return { ...p, likes: newLikes };
      });
      localStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(updated));
      loadBoard();
    } catch (err) {
      console.warn('handleLike failed', err);
    }
  };

  const logoSrc = resolveLogoUrl(masterLogo);

  if (!authReady && !user) {
    return (
      <div className="app-shell flex flex-col items-center justify-center gap-4 bg-black text-[#c9a227] text-sm font-bold uppercase tracking-widest">
        <img src={YSI_LOGO} alt="YSI" className="w-16 h-16 object-contain opacity-90" />
        Restoring session…
      </div>
    );
  }

  if (!user || !user.id) {
    return (
      <Auth
        onLogin={(u: Member, rem: boolean) => {
          const safe = normalizeMember(u);
          if (!safe) return;
          setUser(safe);
          setAuthReady(true);
          persistSessionUser(safe, rem);
          setShowSplash(safeStatus(safe) === 'active');
          setCurrentView(AppView.HOME);
        }}
      />
    );
  }

  const status = safeStatus(user);

  if (status === 'pending') {
    return (
      <MembershipApplication
        user={user}
        onSubmitted={handleApplicationSubmitted}
        onLogout={handleLogout}
      />
    );
  }

  if (status === 'intending') {
    return (
      <WaitingRoom
        user={user}
        onStatusChange={handleStatusChange}
        onLogout={handleLogout}
      />
    );
  }

  if (status === 'rejected') {
    return (
      <div className="app-shell flex flex-col items-center justify-center bg-black text-white p-6 text-center">
        <div className="mobile-frame bg-obsidian-light flex flex-col items-center justify-center px-6">
          <img src={YSI_LOGO} alt="YSI" className="w-20 h-20 object-contain mb-4" />
          <h1 className="font-serif text-2xl font-black text-[#c9a227] uppercase mb-3">
            Application Declined
          </h1>
          <p className="text-sm opacity-70 mb-6 leading-relaxed">
            Please contact chapter leadership for guidance.
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="px-8 py-3.5 gold-bg text-royal-950 text-sm font-black uppercase rounded-sm"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  const greeting =
    status === 'active' ? `Supreme ${user.name || 'Member'}` : user.name || 'Member';

  if (showSplash) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-[100] text-white text-center p-6">
        <img
          src={logoSrc}
          alt="Yoruba Supreme Indigenes"
          className="w-36 h-36 sm:w-40 sm:h-40 drop-shadow-[0_0_30px_rgba(191,149,63,0.5)] animate-pulse mb-6 object-contain"
          onError={(e) => {
            (e.target as HTMLImageElement).src = YSI_LOGO;
          }}
        />
        <h1 className="text-2xl sm:text-3xl font-serif font-black text-[#c9a227] mb-2 uppercase tracking-[0.08em] leading-tight px-2">
          Yoruba Supreme Indigenes
        </h1>
        <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.25em] text-[#c9a227]/70 mb-8">
          Imperial Portal
        </p>
        <button
          type="button"
          onClick={() => setShowSplash(false)}
          className="px-10 py-3.5 gold-bg text-royal-950 text-sm font-bold rounded-sm shadow-lg uppercase tracking-wide"
        >
          Enter YSI Imperial Portal
        </button>
      </div>
    );
  }

  const isAdmin =
    user.isAdmin === true ||
    user.adminRole === 'SUPER' ||
    user.adminRole === 'ADMIN';

  return (
    <div
      className={`app-shell theme-transition ${
        isDark ? 'bg-black text-white' : 'bg-royal-100 text-royal-900'
      }`}
    >
      <BackgroundMusic playOnMount={true} />
      <div
        className={`mobile-frame theme-transition shadow-2xl ${
          isDark ? 'bg-obsidian-light text-white' : 'bg-[#fffdfb] text-royal-900'
        }`}
      >
        <header className="glass-panel shrink-0 min-h-[3.5rem] h-16 flex items-center px-3 sm:px-4 border-b border-gold-border/20 z-50">
          <div
            className="flex-1 flex items-center gap-2.5 cursor-pointer min-w-0"
            onClick={() => setCurrentView(AppView.HOME)}
          >
            <img
              src={logoSrc}
              alt="YSI"
              className="h-10 w-10 sm:h-11 sm:w-11 object-contain shrink-0 drop-shadow-[0_0_8px_rgba(191,149,63,0.35)]"
              onError={(e) => {
                (e.target as HTMLImageElement).src = YSI_LOGO;
              }}
            />
            <span className="text-xs sm:text-sm font-bold gold-text font-serif tracking-wide uppercase truncate">
              YSI Imperial Portal
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setCurrentView(AppView.HELP)}
              className="w-10 h-10 flex items-center justify-center rounded-full text-xl"
              title="Help & Manual"
            >
              ❓
            </button>
            <button
              type="button"
              onClick={() => setCurrentView(AppView.CALENDAR)}
              className="w-10 h-10 flex items-center justify-center rounded-full text-xl"
              title="Calendar"
            >
              📅
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="w-10 h-10 flex items-center justify-center rounded-full text-xl"
              title="Toggle Theme"
            >
              {isDark ? '☀️' : '🌙'}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto custom-scroll p-3 sm:p-4 text-sm">
          <div className="animate-fade-in space-y-4">
            {currentView === AppView.HOME && (
              <div className="text-center py-2">
                <p className="text-[#c9a227] text-[11px] sm:text-xs font-bold uppercase tracking-[0.25em] mb-1">
                  Heritage & Excellence
                </p>
                <h1 className="font-serif text-2xl sm:text-3xl font-black gold-text mb-1 uppercase tracking-tight">
                  Kabo, Supreme
                </h1>
                <h2 className="text-base sm:text-lg font-serif mb-4 opacity-80">{greeting}</h2>

                <div className="grid grid-cols-2 gap-2.5 mb-4">
                  <div className="p-3 regal-card rounded-md bg-white dark:bg-obsidian-panel">
                    <p className="text-[11px] font-bold uppercase text-gold-start mb-1">
                      Mandate Status
                    </p>
                    <p className="text-xs sm:text-sm font-black uppercase tracking-tight">
                      Active Member
                    </p>
                  </div>
                  <div className="p-3 regal-card rounded-md bg-white dark:bg-obsidian-panel">
                    <p className="text-[11px] font-bold uppercase text-gold-start mb-1">
                      Chapter Sovereignty
                    </p>
                    <p className="text-xs sm:text-sm font-black uppercase tracking-tight">
                      {masterChapter}
                    </p>
                  </div>
                </div>

                <div className="p-3.5 regal-card rounded-md text-left bg-gold-start/[0.03] border-gold-border/20 mb-4 shadow-inner">
                  <h3 className="font-serif gold-text font-bold text-[11px] sm:text-xs uppercase tracking-widest mb-2 opacity-80">
                    Daily Decree
                  </h3>
                  <p
                    className={`text-sm font-bold italic leading-relaxed font-serif ${
                      isDark ? 'text-royal-100' : 'text-royal-900'
                    }`}
                  >
                    &ldquo;{masterWisdom}&rdquo;
                  </p>
                </div>

                <div className="text-left space-y-3 pb-10">
                  <div className="flex justify-between items-center mb-1 px-1 gap-2">
                    <h3 className="text-xs sm:text-sm font-black uppercase tracking-[0.15em] text-[#c9a227]">
                      Community Plaza
                    </h3>
                    <button
                      type="button"
                      onClick={() => setCurrentView(AppView.CREATE_POST)}
                      className="px-3 py-1.5 bg-gold-start/20 border border-gold-border/30 rounded-sm text-[11px] sm:text-xs font-black text-[#c9a227] uppercase shrink-0"
                    >
                      + New Update
                    </button>
                  </div>

                  {approvedPosts.length === 0 ? (
                    <p className="text-center py-10 opacity-30 text-xs font-bold uppercase tracking-wide">
                      No updates inscribed
                    </p>
                  ) : (
                    approvedPosts.map((post) => (
                      <div
                        key={post.id}
                        className="regal-card p-3.5 rounded-md bg-white dark:bg-obsidian-panel border-gold-border/20 shadow-sm animate-fade-in-up"
                      >
                        <h4 className="text-sm font-bold dark:text-gold-mid text-gold-heritage font-serif uppercase truncate">
                          {post.title}
                        </h4>
                        <p className="text-[11px] uppercase opacity-50 font-bold mb-2">
                          Supreme {post.authorName} •{' '}
                          {post.date ? new Date(post.date).toLocaleDateString() : '—'}
                        </p>
                        {post.imageUrl && (
                          <img
                            src={post.imageUrl}
                            alt=""
                            className="w-full h-32 object-cover rounded-sm mb-2"
                          />
                        )}
                        <p className="text-sm leading-relaxed opacity-85 mb-3">
                          {post.content}
                        </p>
                        <div className="flex gap-4 border-t border-gold-border/5 pt-2.5">
                          <button
                            type="button"
                            onClick={() => handleLike(post.id)}
                            className={`text-xs font-bold flex items-center gap-1.5 ${
                              post.likes?.includes(user.id)
                                ? 'text-gold-mid'
                                : 'text-gray-500'
                            }`}
                          >
                            <span>
                              {post.likes?.includes(user.id) ? '⚔️' : '⚖️'}
                            </span>{' '}
                            {post.likes?.length || 0} Honors
                          </button>
                          <button
                            type="button"
                            className="text-xs font-bold flex items-center gap-1.5 text-gray-500"
                          >
                            <span>📜</span> {post.comments?.length || 0} Inscriptions
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {currentView === AppView.HERITAGE && <HeritageExplorer />}
            {currentView === AppView.LANGUAGE && <LanguageTutor />}
            {currentView === AppView.STUDIO && <CreativeStudio />}
            {currentView === AppView.DIRECTORY && (
              <MemberDirectory onNavigateToDM={() => setCurrentView(AppView.MESSAGING)} />
            )}
            {currentView === AppView.MESSAGING && <Messaging currentUser={user} />}
            {currentView === AppView.PROFILE && (
              <MemberProfile
                profile={user}
                onUpdate={handleUpdateProfile}
                onLogout={handleLogout}
              />
            )}
            {currentView === AppView.ADMIN &&
              (isAdmin ? (
                <AdminDashboard currentUser={user} />
              ) : (
                <div className="regal-card rounded-md p-6 text-center text-sm opacity-50">
                  Admin access required.
                </div>
              ))}
            {currentView === AppView.HELP && <HelpSection currentUser={user} />}
            {currentView === AppView.CREATE_POST && (
              <CreatePost
                currentUser={user}
                onPostCreated={() => {
                  setCurrentView(AppView.HOME);
                  loadBoard();
                }}
              />
            )}
            {currentView === AppView.LEDGER && <AttendanceLedger currentUser={user} />}
            {currentView === AppView.CALENDAR && <CalendarView />}
          </div>
        </main>

        <nav className="glass-panel shrink-0 h-16 flex items-center justify-around px-1 border-t border-gold-border/20 z-50">
          <NavBtn
            icon="🏠"
            active={currentView === AppView.HOME}
            onClick={() => setCurrentView(AppView.HOME)}
          />
          <NavBtn
            icon="🌍"
            active={currentView === AppView.HERITAGE}
            onClick={() => setCurrentView(AppView.HERITAGE)}
          />
          <NavBtn
            icon="🔬"
            active={currentView === AppView.LANGUAGE}
            onClick={() => setCurrentView(AppView.LANGUAGE)}
          />
          <NavBtn
            icon="📜"
            active={currentView === AppView.LEDGER}
            onClick={() => setCurrentView(AppView.LEDGER)}
          />
          <NavBtn
            icon="🎨"
            active={currentView === AppView.STUDIO}
            onClick={() => setCurrentView(AppView.STUDIO)}
          />
          <NavBtn
            icon="💬"
            active={currentView === AppView.MESSAGING}
            onClick={() => setCurrentView(AppView.MESSAGING)}
          />
          <NavBtn
            icon="👤"
            active={currentView === AppView.PROFILE}
            onClick={() => setCurrentView(AppView.PROFILE)}
          />
          {isAdmin && (
            <NavBtn
              icon="🏛️"
              active={currentView === AppView.ADMIN}
              onClick={() => setCurrentView(AppView.ADMIN)}
            />
          )}
        </nav>
      </div>
    </div>
  );
};

const NavBtn = ({
  icon,
  active,
  onClick,
}: {
  icon: string;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex flex-col items-center justify-center w-10 h-10 rounded-md transition-all ${
      active ? 'gold-bg text-royal-950 shadow-md' : 'text-gold-mid/40'
    }`}
  >
    <span className="text-xl leading-none">{icon}</span>
  </button>
);

export default App;
