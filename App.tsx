import React, { useState, useEffect } from 'react';
import { UserProfile } from './types';
import { subscribeToAuth, db } from './services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { TripView } from './components/TripView';
import { ProfileView } from './components/ProfileView';
import { User } from 'firebase/auth';
import { MainTab, Trip } from './types';
import { Home, Map as MapIcon, PlusCircle, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, orderBy, onSnapshot, getDocs, limit, addDoc, deleteDoc, arrayUnion, updateDoc } from 'firebase/firestore';

const App: React.FC = () => {
  console.log("App rendering...");
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTripId, setActiveTripId] = useState<string | null>(null);
  const [activeMainTab, setActiveMainTab] = useState<MainTab>(MainTab.TRIPS);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [joiningTripId, setJoiningTripId] = useState<string | null>(null);
  const [showJoinModal, setShowJoinModal] = useState(false);

  // Handle URL parameters for sharing
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tripId = params.get('tripId');
    if (tripId) {
      setJoiningTripId(tripId);
    }
  }, []);

  // Check if user needs to join the trip
  useEffect(() => {
    if (joiningTripId && user && trips.length > 0) {
      const isMember = trips.some(t => t.id === joiningTripId);
      if (!isMember) {
        setShowJoinModal(true);
      } else {
        // If already a member, just switch to that trip
        setActiveTripId(joiningTripId);
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
      const tripRef = doc(db, 'trips', joiningTripId);
      const tripSnap = await getDoc(tripRef);
      if (tripSnap.exists()) {
        await updateDoc(tripRef, {
          memberUids: arrayUnion(user.uid)
        });
        setActiveTripId(joiningTripId);
        setShowJoinModal(false);
        setJoiningTripId(null);
        // Clear URL param
        const url = new URL(window.location.href);
        url.searchParams.delete('tripId');
        window.history.replaceState({}, '', url.toString());
      } else {
        alert("找不到該旅程，可能已被刪除。");
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

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-sky-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (activeTripId) {
    return (
      <TripView 
        tripId={activeTripId} 
        user={user} 
        onBack={() => setActiveTripId(null)} 
      />
    );
  }

  const renderMainContent = () => {
    switch (activeMainTab) {
      case MainTab.HOME:
      case MainTab.TRIPS:
        return (
          <Dashboard 
            user={user} 
            trips={trips} 
            onSelectTrip={(id) => setActiveTripId(id)} 
            isCreateModalOpen={isCreateModalOpen} 
            setIsCreateModalOpen={setIsCreateModalOpen} 
          />
        );
      case MainTab.PROFILE:
        return <ProfileView user={user} trips={trips} />;
      default:
        return (
          <Dashboard 
            user={user} 
            trips={trips} 
            onSelectTrip={(id) => setActiveTripId(id)} 
            isCreateModalOpen={isCreateModalOpen} 
            setIsCreateModalOpen={setIsCreateModalOpen} 
          />
        );
    }
  };

  return (
    <div className="h-screen flex flex-col bg-transparent max-w-[390px] mx-auto shadow-2xl overflow-hidden relative">
      {renderMainContent()}

      {/* Join Trip Modal */}
      <AnimatePresence>
        {showJoinModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-xs bg-white rounded-[32px] p-8 shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-sky-50 rounded-full flex items-center justify-center mx-auto mb-4 text-sky-500">
                <PlusCircle size={32} />
              </div>
              <h3 className="text-lg font-black text-slate-800 mb-2">加入新旅程？</h3>
              <p className="text-slate-400 text-xs font-bold mb-8 leading-relaxed">
                您被邀請加入一個新的旅程！<br/>點擊下方按鈕即可開始共同規劃。
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => { setShowJoinModal(false); setJoiningTripId(null); }}
                  className="flex-1 py-3.5 rounded-2xl bg-slate-100 text-slate-500 text-xs font-black active:scale-95 transition-all"
                >
                  拒絕
                </button>
                <button 
                  onClick={handleJoinTrip}
                  className="flex-1 py-3.5 rounded-2xl text-white text-xs font-black shadow-lg active:scale-95 transition-all"
                  style={{ backgroundColor: 'var(--brand-color)', boxShadow: '0 10px 15px -3px rgba(var(--brand-color-rgb), 0.3)' }}
                >
                  加入旅程
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Bottom Navigation */}
      <div className={`fixed bottom-0 left-0 right-0 max-w-[390px] mx-auto ${user.profileTheme === 'handdrawn' || user.profileTheme === 'scrapbook' ? 'px-6 pb-2' : 'px-6 pb-[env(safe-area-inset-bottom,16px)]'} pt-2 z-[60]`}>
        <nav className={`
          ${user.profileTheme === 'handdrawn' || user.profileTheme === 'scrapbook' ? 'border-2 border-[#4B3F35]/10 bg-white shadow-[4px_4px_0_0_rgba(75,63,53,0.04)] rounded-none flex' : 
            user.profileTheme === 'hipster' ? 'bg-white/90 backdrop-blur-md border border-stone-100 shadow-sm rounded-2xl flex' :
            user.profileTheme === 'watercolor' ? 'bg-white/70 backdrop-blur-xl rounded-[32px] border border-sky-100/20 shadow-sm flex' :
            'bg-white/90 backdrop-blur-md rounded-[24px] shadow-nav border border-slate-100/50 flex'} 
          p-0 overflow-hidden justify-between items-stretch
        `}>
          <NavButton 
            active={activeMainTab === MainTab.HOME || activeMainTab === MainTab.TRIPS} 
            onClick={() => setActiveMainTab(MainTab.HOME)} 
            icon={Home} 
            label="首頁" 
            theme={user.profileTheme} 
          />
          {user.profileTheme === 'scrapbook' || user.profileTheme === 'handdrawn' ? <div className="w-px bg-[#4B3F35]/20" /> : null}
          <NavButton 
            active={false} 
            onClick={() => { setActiveMainTab(MainTab.HOME); setIsCreateModalOpen(true); }} 
            icon={PlusCircle} 
            label="新增" 
            theme={user.profileTheme} 
          />
          {user.profileTheme === 'scrapbook' || user.profileTheme === 'handdrawn' ? <div className="w-px bg-[#4B3F35]/20" /> : null}
          <NavButton 
            active={activeMainTab === MainTab.PROFILE} 
            onClick={() => setActiveMainTab(MainTab.PROFILE)} 
            icon={UserIcon} 
            label="個人" 
            theme={user.profileTheme} 
          />
        </nav>
      </div>
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
    return (
      <button 
        onClick={onClick} 
        className={`flex flex-col items-center justify-center flex-1 py-3 group relative font-handdrawn transition-all ${active ? 'bg-stone-50' : 'hover:bg-stone-50/50'}`}
      >
        <div className={`transition-all duration-300 flex items-center justify-center mb-1 ${active ? 'text-stone-800 scale-110' : 'text-stone-300'}`}>
          <Icon size={18} strokeWidth={active ? 2.5 : 2} />
        </div>
        <span className={`text-[10px] font-black transition-colors duration-300 ${active ? 'text-stone-800' : 'text-stone-300'}`}>
          {label}
        </span>
        {active && (
          <div className="absolute inset-0 border-[2.5px] border-[#4B3F35] pointer-events-none" />
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
