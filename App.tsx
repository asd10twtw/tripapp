import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { UserProfile } from './types';
import { subscribeToAuth, db } from './services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { TripView } from './components/TripView';
import { ProfileView } from './components/ProfileView';
import { BackgroundDoodles } from './components/BackgroundDoodles';
import { User } from 'firebase/auth';
import { MainTab, Trip } from './types';
import { Home, Map as MapIcon, PlusCircle, User as UserIcon, MapPin, Plus, Compass } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, orderBy, onSnapshot, getDocs, limit, addDoc, deleteDoc, arrayUnion, updateDoc } from 'firebase/firestore';

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [joiningTripId, setJoiningTripId] = useState<string | null>(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [isFirstLoad, setIsFirstLoad] = useState(() => !sessionStorage.getItem('app_initialized'));

  // Handle URL parameters for sharing
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tripId = params.get('tripId');
    if (tripId) {
      setJoiningTripId(tripId);
    }
  }, []);

  // Set session storage once loaded
  useEffect(() => {
    if (!loading && user) {
      sessionStorage.setItem('app_initialized', 'true');
    }
  }, [loading, user]);

  // Sync navigation with state if needed, but we'll use routes now
  const activeMainTab = location.pathname.startsWith('/profile') ? MainTab.PROFILE : MainTab.TRIPS;

  // Check if user needs to join the trip
  useEffect(() => {
    if (joiningTripId && user && trips.length > 0) {
      const isMember = trips.some(t => t.id === joiningTripId);
      if (!isMember) {
        setShowJoinModal(true);
      } else {
        // If already a member, just switch to that trip
        navigate(`/trip/${joiningTripId}`);
        // Clear param to avoid re-triggering
        const url = new URL(window.location.href);
        url.searchParams.delete('tripId');
        window.history.replaceState({}, '', url.toString());
        setJoiningTripId(null);
      }
    }
  }, [joiningTripId, user, trips]);

  const handleJoinTrip = async () => {
    if (!joiningTripId || !user) return;
    try {
      let finalTripId = joiningTripId;
      let tripRef = doc(db, 'trips', finalTripId);
      let tripSnap = await getDoc(tripRef);

      // If not found by direct ID, check short code or prefix
      if (!tripSnap.exists()) {
        const shortCodeQuery = query(collection(db, 'trips'), where('inviteCode', '==', joiningTripId.toUpperCase()), limit(1));
        const shortCodeSnap = await getDocs(shortCodeQuery);
        
        if (!shortCodeSnap.empty) {
          finalTripId = shortCodeSnap.docs[0].id;
          tripRef = doc(db, 'trips', finalTripId);
          tripSnap = shortCodeSnap.docs[0];
        } else {
          // Try prefix match for 8-char codes
          const prefixQuery = query(
            collection(db, 'trips'), 
            where('__name__', '>=', joiningTripId), 
            where('__name__', '<', joiningTripId + '\uf8ff'),
            limit(1)
          );
          const prefixSnap = await getDocs(prefixQuery);
          if (!prefixSnap.empty) {
            finalTripId = prefixSnap.docs[0].id;
            tripRef = doc(db, 'trips', finalTripId);
            tripSnap = prefixSnap.docs[0];
          }
        }
      }

      if (tripSnap.exists()) {
        await updateDoc(tripRef, {
          memberUids: arrayUnion(user.uid)
        });
        navigate(`/trip/${finalTripId}`);
        setShowJoinModal(false);
        setJoiningTripId(null);
        // Clear URL param
        const url = new URL(window.location.href);
        url.searchParams.delete('tripId');
        window.history.replaceState({}, '', url.toString());
      } else {
        alert("找不到該旅程，可能編號錯誤或已被刪除。");
        setJoiningTripId(null);
        setShowJoinModal(false);
      }
    } catch (err) {
      console.error("Failed to join trip:", err);
      alert("加入旅程失敗，請稍後再試。");
    }
  };

  useEffect(() => {
    if (user?.themeColor) {
      document.documentElement.style.setProperty('--brand-color', user.themeColor);
      // Calculate if text should be white or black based on theme color brightness
      const hex = user.themeColor.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      document.documentElement.style.setProperty('--brand-color-rgb', `${r}, ${g}, ${b}`);
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      const textColor = brightness > 155 ? '#1E293B' : '#FFFFFF';
      document.documentElement.style.setProperty('--brand-text', textColor);
    } else {
      document.documentElement.style.setProperty('--brand-color', '#3D74B6');
      document.documentElement.style.setProperty('--brand-color-rgb', '61, 116, 182');
      document.documentElement.style.setProperty('--brand-text', '#FFFFFF');
    }

    // Apply global theme class
    const themeClass = user?.profileTheme === 'handdrawn' || user?.profileTheme === 'scrapbook' ? 'theme-handdrawn' : `theme-${user?.profileTheme || 'minimalist'}`;
    document.body.classList.remove('theme-minimalist', 'theme-hipster', 'theme-handdrawn', 'theme-watercolor');
    document.body.classList.add(themeClass);
  }, [user?.themeColor, user?.profileTheme]);

  // 1. Auth Listener
  useEffect(() => {
    console.log("Setting up auth listener...");
    const unsubscribe = subscribeToAuth((u) => {
      console.log("Auth state changed:", u?.uid);
      setFirebaseUser(u);
      if (!u) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Profile & Data Subscription
  useEffect(() => {
    if (!firebaseUser) {
      console.log("No firebase user, skipping data setup");
      setUser(null);
      setTrips([]);
      return;
    }

    console.log("Firebase user detected, setting up data...");
    let unsubscribeTrips: (() => void) | null = null;
    let unsubscribeProfile: (() => void) | null = null;

    const setupData = async () => {
      try {
        console.log("Subscribing to profile for:", firebaseUser.uid);
        // Real-time Profile Subscription
        unsubscribeProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            console.log("Profile update received");
            setUser(docSnap.data() as UserProfile);
          } else {
            console.log("Profile not found, creating default");
            const newProfile = {
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName || 'Anonymous',
              photoURL: firebaseUser.photoURL || '',
              email: firebaseUser.email || ''
            };
            setUser(newProfile);
          }
        });

        console.log("Subscribing to trips...");
        // Subscribe to Trips
        const q = query(
          collection(db, 'trips'),
          where('memberUids', 'array-contains', firebaseUser.uid),
          orderBy('createdAt', 'desc')
        );

        unsubscribeTrips = onSnapshot(q, 
          (snapshot) => {
            console.log("Trips snapshot received, count:", snapshot.size);
            setTrips(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Trip)));
            setLoading(false);
          },
          (error) => {
            console.error("Trips subscription error:", error);
            setLoading(false);
          }
        );

        // Migration logic (run once)
        const migrate = async () => {
          try {
            const collections = ['events', 'expenses', 'todos', 'journal'];
            let hasData = false;
            for (const col of collections) {
              const snap = await getDocs(query(collection(db, col), limit(1)));
              if (!snap.empty) {
                hasData = true;
                break;
              }
            }

            if (hasData) {
              const tripName = 'SEOUL GO';
              // Check if already migrated to avoid duplicates
              const existingTripQuery = query(
                collection(db, 'trips'),
                where('ownerUid', '==', firebaseUser.uid),
                where('name', '==', tripName),
                limit(1)
              );
              const existingTripSnap = await getDocs(existingTripQuery);
              
              if (!existingTripSnap.empty) {
                console.log("Migration already completed, skipping.");
                // Still delete the legacy data if it somehow exists to be safe
                for (const col of collections) {
                  const snap = await getDocs(collection(db, col));
                  for (const oldDoc of snap.docs) {
                    await deleteDoc(doc(db, col, oldDoc.id));
                  }
                }
                return;
              }

              const tripData = {
                name: tripName,
                startDate: '2026-01-30',
                endDate: '2026-02-05',
                coverImage: 'https://images.unsplash.com/photo-1517154421773-0529f29ea451?q=80&w=800&auto=format&fit=crop',
                memberUids: [firebaseUser.uid],
                ownerUid: firebaseUser.uid,
                createdAt: new Date().toISOString()
              };
              const tripRef = await addDoc(collection(db, 'trips'), tripData);
              const tripId = tripRef.id;

              for (const col of collections) {
                const snap = await getDocs(collection(db, col));
                for (const oldDoc of snap.docs) {
                  await addDoc(collection(db, 'trips', tripId, col), oldDoc.data());
                  await deleteDoc(doc(db, col, oldDoc.id));
                }
              }
            }
          } catch (mErr) {
            console.error("Migration error:", mErr);
          }
        };
        migrate();

      } catch (err) {
        console.error("Data setup error:", err);
        setLoading(false);
      }
    };

    setupData();

    return () => {
      if (unsubscribeTrips) unsubscribeTrips();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, [firebaseUser]);

  // 3. Cleanup duplicate imported trips
  useEffect(() => {
    if (trips.length > 1) {
      const importedTrips = trips.filter(t => t.name === 'SEOUL GO' || t.name === '匯入的旅程 (SEOUL GO)');
      if (importedTrips.length > 1) {
        // Keep the first one (most recent due to orderBy), delete others
        const toDelete = importedTrips.slice(1);
        toDelete.forEach(async (t) => {
          try {
            await deleteDoc(doc(db, 'trips', t.id));
            console.log("Deleted duplicate trip:", t.id);
          } catch (err) {
            console.error("Failed to delete duplicate:", err);
          }
        });
      }
    }
  }, [trips]);

  const getThemeBg = () => {
    switch (user?.profileTheme) {
      case 'handdrawn': return 'bg-[#F9F5E6]';
      case 'hipster': return 'bg-[#FDFCF8]';
      case 'minimalist': return 'bg-[#F8FAFC]';
      default: return 'bg-[#FCFBF7]';
    }
  };

  if (loading) {
    if (isFirstLoad) {
      return (
        <div className="min-h-screen bg-[#FCFBF7] flex flex-col items-center justify-center">
          <div className="w-24 h-24 flex items-center justify-center mb-12">
            <img src="/trippic.png" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <div className="w-8 h-8 border-[3px] border-slate-200 border-t-sky-400 rounded-full animate-spin"></div>
        </div>
      );
    }
    // For non-first loads, show a minimal background or nothing to satisfy "skip splash screen"
    return (
      <div className={`min-h-screen ${getThemeBg()}`} />
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className={`h-screen w-full max-w-md mx-auto flex flex-col relative overflow-hidden transition-colors duration-500 ${getThemeBg()} ${user.profileTheme === 'handdrawn' ? 'font-handdrawn' : user.profileTheme === 'hipster' ? 'font-hipster' : 'font-sans'}`}>
      <BackgroundDoodles user={user} />
      
      <div className="flex-1 min-h-0 overflow-hidden relative z-10 flex flex-col">
        <Routes>
          <Route path="/" element={
            <Dashboard 
              user={user} 
              trips={trips} 
              onSelectTrip={(id) => navigate(`/trip/${id}`)} 
              isCreateModalOpen={isCreateModalOpen} 
              setIsCreateModalOpen={setIsCreateModalOpen} 
              onJoinTrip={(code) => setJoiningTripId(code)}
            />
          } />
          <Route path="/profile" element={<ProfileView user={user} trips={trips} />} />
          <Route path="/trip/:tripId" element={
            <TripView 
              user={user} 
              onBack={() => navigate('/')} 
            />
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      {/* Join Trip Modal */}
      <AnimatePresence>
        {showJoinModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
              onClick={() => { setShowJoinModal(false); setJoiningTripId(null); }}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-xs bg-white rounded-[40px] p-8 shadow-2xl flex flex-col items-center text-center"
            >
              <div className="w-20 h-20 bg-sky-50 rounded-full flex items-center justify-center mb-6 text-sky-500">
                <Compass size={40} />
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2">加入新的旅程？</h3>
              <p className="text-slate-400 text-xs font-bold mb-8 leading-relaxed">
                您獲邀加入一個新的旅程！<br/>點擊下方按鈕即可開始與夥伴們同步計畫。
              </p>
              <div className="flex w-full gap-3">
                <button 
                  onClick={() => { setShowJoinModal(false); setJoiningTripId(null); }}
                  className="flex-1 py-4 rounded-2xl bg-slate-100 text-slate-500 text-sm font-black active:scale-95 transition-all"
                >
                  先不要
                </button>
                <button 
                  onClick={handleJoinTrip}
                  className="flex-[2] py-4 rounded-2xl bg-sky-500 text-white text-sm font-black shadow-lg shadow-sky-100 active:scale-95 transition-all"
                >
                  立刻加入
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Bottom Navigation (Only on main tabs) */}
      {!location.pathname.startsWith('/trip/') && (
        <div className={`fixed bottom-3 left-0 right-0 max-w-md mx-auto px-6 z-[60]`}>
          <nav className={`
            ${user.profileTheme === 'handdrawn' || user.profileTheme === 'scrapbook' ? 
              'bg-white rounded-2xl flex items-stretch p-1 relative overflow-visible border-[1.5px] border-[#4B3F35]/15 shadow-[0_4px_20px_rgba(75,63,53,0.06)]' : 
              user.profileTheme === 'hipster' ? 'bg-white/90 backdrop-blur-md border border-stone-100 shadow-sm rounded-2xl flex' :
              user.profileTheme === 'watercolor' ? 'bg-white/70 backdrop-blur-xl rounded-[32px] border border-sky-100/20 shadow-sm flex' :
              'bg-white/90 backdrop-blur-md rounded-[24px] shadow-nav border border-slate-100/50 flex'} 
            justify-between
          `}>
            {/* Washi Tape Removed */}

            <NavButton 
              active={location.pathname === '/'} 
              onClick={() => navigate('/')} 
              icon={Home} 
              label="首頁" 
              theme={user.profileTheme} 
            />
            
            {(user.profileTheme === 'handdrawn' || user.profileTheme === 'scrapbook') ? (
              <div className="relative flex-1 flex flex-col items-center justify-center pt-1.5 pb-2">
                <button 
                  onClick={() => { navigate('/'); setIsCreateModalOpen(true); }}
                  className="flex flex-col items-center group"
                >
                  <div className="w-9 h-9 bg-[#FCB64E] rounded-full flex items-center justify-center shadow-sm border border-white/20 transition-transform group-active:scale-95 mb-0.5">
                    <Plus size={22} strokeWidth={3} className="text-white" />
                  </div>
                  <span className="text-[9px] font-black text-[#8B5E3C] tracking-widest">新增</span>
                </button>
              </div>
            ) : (
              <NavButton 
                active={false} 
                onClick={() => { navigate('/'); setIsCreateModalOpen(true); }} 
                icon={Plus} 
                label="新增" 
                theme={user.profileTheme} 
              />
            )}

            <NavButton 
              active={location.pathname === '/profile'} 
              onClick={() => navigate('/profile')} 
              icon={UserIcon} 
              label="個人" 
              theme={user.profileTheme} 
            />
          </nav>
        </div>
      )}
    </div>
  );
};

interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: any;
  label: string;
  theme?: string;
}

const NavButton: React.FC<NavButtonProps> = ({ active, onClick, icon: Icon, label, theme }) => {
  const isHanddrawn = theme === 'handdrawn' || theme === 'scrapbook';
  const isHipster = theme === 'hipster';
  const isWatercolor = theme === 'watercolor';
  
  if (isHanddrawn) {
    if (label === '新增') return null; // Handled separately in the nav

    return (
      <button 
        onClick={onClick} 
        className={`flex flex-col items-center justify-center flex-1 py-2 group relative font-handdrawn transition-all`}
      >
        <div className={`transition-all duration-300 flex items-center justify-center mb-0.5 ${active ? 'text-[#8B5E3C] scale-110' : 'text-stone-300 opacity-80'}`}>
          <Icon size={20} strokeWidth={active ? 2.5 : 2} />
        </div>
        <span className={`text-[9px] font-black tracking-widest transition-colors duration-300 ${active ? 'text-[#8B5E3C]' : 'text-stone-300'}`}>
          {label}
        </span>
        {active && (
          <div className="absolute -bottom-1 w-6 h-[2px] bg-[#8B5E3C]/30 rounded-full" style={{ clipPath: 'polygon(1% 40%, 99% 2%, 96% 100%, 4% 90%)' }} />
        )}
      </button>
    );
  }

  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center flex-1 py-2 group relative ${isHipster ? 'font-hipster' : isWatercolor ? 'font-sans italic' : ''}`}>
      <div className={`transition-all duration-300 flex items-center justify-center w-8 h-8 ${active ? 'scale-110' : 'text-stone-300 group-active:scale-90'}`} style={{ color: active ? (isHipster ? '#78716C' : 'var(--brand-color)') : (isWatercolor ? '#A5C4D4' : undefined) }}>
        <Icon size={20} strokeWidth={active ? 2 : 1.5} />
      </div>
      <span className={`text-[9px] font-bold mt-0.5 transition-colors duration-300 ${active ? '' : (isWatercolor ? 'text-sky-200' : 'text-stone-300')}`} style={{ color: active ? (isHipster ? '#78716C' : 'var(--brand-color)') : undefined }}>
        {label}
      </span>
      {active && !isHipster && (
        <motion.div layoutId="nav-active" className="absolute -bottom-1 w-1 h-1 rounded-full" style={{ backgroundColor: 'var(--brand-color)' }} />
      )}
      {active && isHipster && (
        <div className="absolute top-1 right-4 w-1 h-1 bg-stone-400 rounded-full" />
      )}
    </button>
  );
};

export default App;
