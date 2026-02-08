
import React, { useState, useEffect } from 'react';
import { AppView, Member, Post } from './types';
import { HeritageExplorer } from './components/HeritageExplorer';
import { LanguageTutor } from './components/LanguageTutor';
import { MemberProfile } from './components/MemberProfile';
import { CreativeStudio } from './components/CreativeStudio';
import { AdminDashboard } from './components/AdminDashboard';
import { Auth } from './components/Auth';
import { MemberDirectory } from './components/MemberDirectory';
import { BackgroundMusic } from './components/BackgroundMusic';
import { HelpSection } from './components/HelpSection';
import { CreatePost } from './components/CreatePost';
import { MembershipApplication } from './components/MembershipApplication';
import { WaitingRoom } from './components/WaitingRoom';
import { Messaging } from './components/Messaging';
import { AttendanceLedger } from './components/AttendanceLedger';
import { CalendarView } from './components/CalendarView';
import { STORAGE_KEYS } from './services/geminiService';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.HOME);
  const [user, setUser] = useState<Member | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  const [isDark, setIsDark] = useState(true);
  const [approvedPosts, setApprovedPosts] = useState<Post[]>([]);
  
  const [masterWisdom, setMasterWisdom] = useState(localStorage.getItem(STORAGE_KEYS.MASTER_WISDOM) || "Kabo s'inu ogba awon omo kaaro oojiire. Eni ti o ba fe ki oruko re duro, o gbodo se rere.");
  const [masterChapter, setMasterChapter] = useState(localStorage.getItem(STORAGE_KEYS.MASTER_CHAPTER) || "DFW METROPLEX");
  const [masterLogo, setMasterLogo] = useState(localStorage.getItem(STORAGE_KEYS.MASTER_LOGO) || "https://file-service.aistudio.google.com/file/files/978h4g5j2k3l");

  useEffect(() => {
    const persistentUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    const sessionUser = sessionStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    const localUser = persistentUser || sessionUser;

    if (localUser) {
      const users: Member[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
      const parsedUser = JSON.parse(localUser);
      const latestUser = users.find(u => u.id === parsedUser.id);
      setUser(latestUser || parsedUser);
      setShowSplash(false);
    }

    const savedTheme = localStorage.getItem('ysi_theme') || 'dark';
    setIsDark(savedTheme === 'dark');
    document.documentElement.classList.toggle('dark', savedTheme === 'dark');

    const handleMasterUpdate = () => {
      setMasterWisdom(localStorage.getItem(STORAGE_KEYS.MASTER_WISDOM) || masterWisdom);
      setMasterChapter(localStorage.getItem(STORAGE_KEYS.MASTER_CHAPTER) || masterChapter);
      setMasterLogo(localStorage.getItem(STORAGE_KEYS.MASTER_LOGO) || masterLogo);
    };
    window.addEventListener('ysi_master_update', handleMasterUpdate);
    loadBoard();

    return () => window.removeEventListener('ysi_master_update', handleMasterUpdate);
  }, [currentView]);

  const loadBoard = () => {
    const posts: Post[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.POSTS) || '[]');
    const now = Date.now();
    setApprovedPosts(posts.filter(p => p.status === 'approved' && (!p.expiryDate || p.expiryDate > now)).slice(0, 10));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    sessionStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  };

  const handleUpdateProfile = (updatedUser: Member) => {
    setUser(updatedUser);
    if (localStorage.getItem(STORAGE_KEYS.CURRENT_USER)) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(updatedUser));
    } else {
      sessionStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(updatedUser));
    }
    const allUsers: Member[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    const updatedList = allUsers.map(u => u.id === updatedUser.id ? updatedUser : u);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updatedList));
  };

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    localStorage.setItem('ysi_theme', nextDark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', nextDark);
  };

  const handleLike = (postId: string) => {
    if (!user) return;
    const allPosts: Post[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.POSTS) || '[]');
    const updated = allPosts.map(p => {
      if (p.id !== postId) return p;
      const likes = p.likes || [];
      const newLikes = likes.includes(user.id) ? likes.filter(id => id !== user.id) : [...likes, user.id];
      return { ...p, likes: newLikes };
    });
    localStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(updated));
    loadBoard();
  };

  if (!user) return <Auth onLogin={(u, rem) => { 
    setUser(u); 
    if (rem) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(u));
    } else {
      sessionStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(u));
    }
    setShowSplash(false); 
    setCurrentView(AppView.HOME); 
  }} />;

  if (user.status === 'pending') return <MembershipApplication user={user} onSubmitted={setUser} onLogout={handleLogout} />;
  if (user.status === 'intending') return <WaitingRoom onLogout={handleLogout} />;
  
  const greeting = user.status === 'active' ? `Supreme ${user.name}` : user.name;

  if (showSplash) return (
    <div className="fixed inset-0 bg-obsidian flex flex-col items-center justify-center z-[100] text-white text-center p-6">
      <img src={masterLogo} className="w-24 h-24 drop-shadow-[0_0_30px_rgba(191,149,63,0.5)] animate-pulse mb-6 object-contain" />
      <h1 className="text-2xl font-serif font-black gold-text mb-6 uppercase tracking-[0.1em]">Yoruba Supreme Indigenes</h1>
      <button onClick={() => setShowSplash(false)} className="px-10 py-3 gold-bg text-royal-950 text-xs font-bold rounded-sm shadow-lg uppercase">Enter YSI Imperial Portal</button>
    </div>
  );

  return (
    <div className={`h-full flex flex-col items-center justify-center theme-transition ${isDark ? 'bg-black' : 'bg-royal-100'}`}>
      <BackgroundMusic playOnMount={true} />
      <div className={`mobile-frame theme-transition overflow-hidden shadow-2xl relative ${isDark ? 'bg-obsidian-light text-white' : 'bg-[#fffdfb] text-royal-900'}`}>
        <header className="glass-panel shrink-0 h-14 flex items-center px-4 border-b border-gold-border/20 z-50">
           <div className="flex-1 flex items-center gap-2 cursor-pointer" onClick={() => setCurrentView(AppView.HOME)}>
              <img src={masterLogo} className="h-7 w-7 object-contain" />
              <span className="text-[10px] font-bold gold-text font-serif tracking-widest uppercase truncate">YSI Imperial Portal</span>
           </div>
           <div className="flex items-center gap-1">
             <button onClick={() => setCurrentView(AppView.HELP)} className="w-8 h-8 flex items-center justify-center rounded-full text-lg" title="Help & Manual">❓</button>
             <button onClick={() => setCurrentView(AppView.CALENDAR)} className="w-8 h-8 flex items-center justify-center rounded-full text-lg" title="Calendar">📅</button>
             <button onClick={toggleTheme} className="w-8 h-8 flex items-center justify-center rounded-full text-lg" title="Toggle Theme">{isDark ? '☀️' : '🌙'}</button>
           </div>
        </header>

        <main className="flex-1 overflow-y-auto custom-scroll p-3">
          <div className="animate-fade-in space-y-4">
            {currentView === AppView.HOME && (
              <div className="text-center py-2">
                 <p className="text-gold-mid text-[6px] font-bold uppercase tracking-[0.3em] mb-0.5">Heritage & Excellence</p>
                 <h1 className="font-serif text-lg font-black gold-text mb-1 uppercase tracking-tight">Kabo, Supreme</h1>
                 <h2 className={`text-md font-serif mb-3 opacity-80`}>{greeting}</h2>
                 
                 <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="p-2 regal-card rounded-md bg-white dark:bg-obsidian-panel">
                       <p className="text-[6px] font-bold uppercase text-gold-start mb-0.5">Mandate Status</p>
                       <p className="text-[8px] font-black uppercase tracking-tight">Active Member</p>
                    </div>
                    <div className="p-2 regal-card rounded-md bg-white dark:bg-obsidian-panel">
                       <p className="text-[6px] font-bold uppercase text-gold-start mb-0.5">Chapter Sovereignty</p>
                       <p className="text-[8px] font-black uppercase tracking-tight">{masterChapter}</p>
                    </div>
                 </div>

                 <div className="p-2.5 regal-card rounded-md text-left bg-gold-start/[0.03] border-gold-border/20 mb-3 shadow-inner">
                    <h3 className="font-serif gold-text font-bold text-[7px] uppercase tracking-widest mb-1 opacity-70">Daily Decree</h3>
                    <p className={`text-[10px] font-bold italic leading-snug font-serif ${isDark ? 'text-royal-100' : 'text-royal-900'}`}>"{masterWisdom}"</p>
                 </div>
                 
                 <div className="text-left space-y-2 pb-10">
                    <div className="flex justify-between items-center mb-1.5 px-1">
                      <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-gold-mid">Community Plaza</h3>
                      <button onClick={() => setCurrentView(AppView.CREATE_POST)} className="px-3 py-1 bg-gold-start/20 border border-gold-border/30 rounded-sm text-[7px] font-black text-gold-mid uppercase">+ New Update</button>
                    </div>

                    {approvedPosts.length === 0 ? <p className="text-center py-10 opacity-20 text-[8px] font-bold uppercase">No updates inscribed</p> : 
                      approvedPosts.map(post => (
                        <div key={post.id} className="regal-card p-3 rounded-md bg-white dark:bg-obsidian-panel border-gold-border/20 shadow-sm animate-fade-in-up">
                          <h4 className="text-[10px] font-bold dark:text-gold-mid text-gold-heritage font-serif uppercase truncate">{post.title}</h4>
                          <p className="text-[6px] uppercase opacity-50 font-bold mb-1">Supreme {post.authorName} • {new Date(post.date).toLocaleDateString()}</p>
                          {post.imageUrl && <img src={post.imageUrl} className="w-full h-24 object-cover rounded-sm mb-2" />}
                          <p className="text-[9px] leading-relaxed opacity-80 mb-3">{post.content}</p>
                          <div className="flex gap-4 border-t border-gold-border/5 pt-2">
                             <button onClick={() => handleLike(post.id)} className={`text-[8px] font-bold flex items-center gap-1 ${post.likes?.includes(user.id) ? 'text-gold-mid' : 'text-gray-500'}`}>
                                <span>{post.likes?.includes(user.id) ? '⚔️' : '⚖️'}</span> {post.likes?.length || 0} Honors
                             </button>
                             <button className="text-[8px] font-bold flex items-center gap-1 text-gray-500">
                                <span>📜</span> {post.comments?.length || 0} Inscriptions
                             </button>
                          </div>
                        </div>
                      ))
                    }
                 </div>
              </div>
            )}
            
            {currentView === AppView.HERITAGE && <HeritageExplorer />}
            {currentView === AppView.LANGUAGE && <LanguageTutor />}
            {currentView === AppView.STUDIO && <CreativeStudio />}
            {currentView === AppView.DIRECTORY && <MemberDirectory onNavigateToDM={() => setCurrentView(AppView.MESSAGING)} />}
            {currentView === AppView.MESSAGING && <Messaging currentUser={user} />}
            {currentView === AppView.PROFILE && <MemberProfile profile={user} onUpdate={handleUpdateProfile} onLogout={handleLogout} />}
            {currentView === AppView.ADMIN && <AdminDashboard />}
            {currentView === AppView.HELP && <HelpSection currentUser={user} />}
            {currentView === AppView.CREATE_POST && <CreatePost currentUser={user} onPostCreated={() => { setCurrentView(AppView.HOME); loadBoard(); }} />}
            {currentView === AppView.LEDGER && <AttendanceLedger currentUser={user} />}
            {currentView === AppView.CALENDAR && <CalendarView />}
          </div>
        </main>

        <nav className="glass-panel shrink-0 h-14 flex items-center justify-around px-1 border-t border-gold-border/20 z-50">
          <NavBtn icon="🏠" active={currentView === AppView.HOME} onClick={() => setCurrentView(AppView.HOME)} />
          <NavBtn icon="🌍" active={currentView === AppView.HERITAGE} onClick={() => setCurrentView(AppView.HERITAGE)} />
          <NavBtn icon="🔬" active={currentView === AppView.LANGUAGE} onClick={() => setCurrentView(AppView.LANGUAGE)} />
          <NavBtn icon="📜" active={currentView === AppView.LEDGER} onClick={() => setCurrentView(AppView.LEDGER)} />
          <NavBtn icon="🎨" active={currentView === AppView.STUDIO} onClick={() => setCurrentView(AppView.STUDIO)} />
          <NavBtn icon="💬" active={currentView === AppView.MESSAGING} onClick={() => setCurrentView(AppView.MESSAGING)} />
          <NavBtn icon="👤" active={currentView === AppView.PROFILE} onClick={() => setCurrentView(AppView.PROFILE)} />
          {user.isAdmin && <NavBtn icon="🏛️" active={currentView === AppView.ADMIN} onClick={() => setCurrentView(AppView.ADMIN)} />}
        </nav>
      </div>
    </div>
  );
};

const NavBtn = ({ icon, active, onClick }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center justify-center w-8 h-8 rounded-md transition-all ${active ? 'gold-bg text-royal-950 shadow-md' : 'text-gold-mid/40'}`}>
    <span className="text-base">{icon}</span>
  </button>
);

export default App;
