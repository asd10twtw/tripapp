import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { MainTab, Trip, UserProfile, Member } from './types';
import { subscribeToAuth, db } from './services/firebase';
import { collection, query, where, orderBy, onSnapshot, getDocs, limit, addDoc, deleteDoc, arrayUnion, updateDoc, doc, getDoc, setDoc, documentId, startAt, endAt, serverTimestamp } from 'firebase/firestore';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { TripView } from './components/TripView';
import { ProfileView } from './components/ProfileView';
import { BackgroundDoodles } from './components/BackgroundDoodles';
import { User } from 'firebase/auth';
import { Home, Map as MapIcon, PlusCircle, User as UserIcon, MapPin, Plus, Compass } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [joiningTripId, setJoiningTripId] = useState<string | null>(null);
  const [pendingTrip, setPendingTrip] = useState<Trip | null>(null);
  const [pendingMembers, setPendingMembers] = useState<Member[]>([]);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinStep, setJoinStep] = useState<'confirm' | 'select'>('confirm');
  const [isJoiningLoading, setIsJoiningLoading] = useState(false);
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
    if (joiningTripId && user && !loading) {
      console.log("Processing join trip for:", joiningTripId);
      const isMember = trips.some(t => t.id === joiningTripId || t.inviteCode?.toUpperCase() === joiningTripId.toUpperCase());
      if (!isMember) {
        console.log("User is not a member, showing join modal");
        setJoinStep('confirm');
        setShowJoinModal(true);
      } else {
        console.log("User is already a member, navigating to trip");
        // If already a member, navigate to it
        const trip = trips.find(t => t.id === joiningTripId || t.inviteCode?.toUpperCase() === joiningTripId.toUpperCase());
        if (trip) navigate(`/trip/${trip.id}`);
        setJoiningTripId(null);
      }
    }
  }, [joiningTripId, user, trips, loading]);

  const fetchPendingTripDetails = async () => {
    if (!joiningTripId || !user) {
      console.log("Fetch skipped: joiningTripId or user missing", { joiningTripId, user: !!user });
      return;
    }
    setIsJoiningLoading(true);
    const searchCode = joiningTripId.trim();
    console.log("--- Starting Deep Search ---");
    console.log("Search target:", searchCode);
    console.log("Current user UID:", user.uid);

    try {
      // 1. Try fetching by exact Document ID first
      console.log("Step 1: Fetching by Doc ID...");
      let tripSnap = await getDoc(doc(db, 'trips', searchCode));
      let finalTripId: string | null = null;

      if (tripSnap.exists()) {
        finalTripId = searchCode;
        console.log("Success: Found by Doc ID");
      } else {
        console.log("Doc ID not found, Step 2: Querying inviteCode field...");
        
        // Search for exact match
        const qRaw = query(collection(db, 'trips'), where('inviteCode', '==', searchCode), limit(1));
        const snapRaw = await getDocs(qRaw);
        
        if (!snapRaw.empty) {
          finalTripId = snapRaw.docs[0].id;
          tripSnap = snapRaw.docs[0];
          console.log("Success: Found by raw inviteCode");
        } else {
          // Step 3: Try Prefix search (for cases like 7GXZz2IE which is a prefix of the ID)
          console.log("InviteCode search empty, trying prefix search on Document ID...");
          const qPrefix = query(
            collection(db, 'trips'), 
            orderBy(documentId()), 
            startAt(searchCode), 
            endAt(searchCode + '\uf8ff'), 
            limit(1)
          );
          const snapPrefix = await getDocs(qPrefix);
          
          if (!snapPrefix.empty) {
            finalTripId = snapPrefix.docs[0].id;
            tripSnap = snapPrefix.docs[0];
            console.log("Success: Found by ID prefix:", finalTripId);
          } else {
            // Last Try: uppercase search (our generator uses uppercase)
            console.log("Prefix search empty, trying uppercase inviteCode...");
            const qUpper = query(collection(db, 'trips'), where('inviteCode', '==', searchCode.toUpperCase()), limit(1));
            const snapUpper = await getDocs(qUpper);
            
            if (!snapUpper.empty) {
              finalTripId = snapUpper.docs[0].id;
              tripSnap = snapUpper.docs[0];
              console.log("Success: Found by uppercase inviteCode");
            }
          }
        }
      }

      if (tripSnap && tripSnap.exists() && finalTripId) {
        const tripData = { id: finalTripId, ...tripSnap.data() } as Trip;
        console.log("Trip data retrieved:", tripData.name);
        setPendingTrip(tripData);
        
        // Fetch members to choose identity
        console.log("Step 4: Fetching members...");
        const membersSnap = await getDocs(collection(db, 'trips', finalTripId, 'members'));
        const members = membersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Member));
        console.log("Members fetched:", members.length);
        setPendingMembers(members);
        setJoinStep('select');
      } else {
        console.error("CRITICAL: Trip not found after all attempts");
        alert(`找不到編號為「${searchCode}」的旅程。\n\n請聯絡建立者確認這是否為正確的「旅程編號」（可以在該旅程的分享頁面中找到，通常為 6 位大寫英數組合）。`);
        setJoiningTripId(null);
        setShowJoinModal(false);
      }
    } catch (err: any) {
      console.error("Join process crashed:", err);
      const errMsg = err.message || "未知錯誤";
      alert(`發生錯誤：${errMsg}\n\n這可能是網路連線問題，請稍後再試。`);
    } finally {
      setIsJoiningLoading(false);
    }
  };

  const handleJoinTripAs = async (memberId?: string) => {
    if (!pendingTrip || !user) return;
    
    try {
      // 1. Update trip memberUids
      await updateDoc(doc(db, 'trips', pendingTrip.id), {
        memberUids: arrayUnion(user.uid)
      });

      // 2. Handle member record
      if (memberId && memberId !== 'new') {
        const isPlaceholder = memberId.startsWith('m') || memberId.startsWith('temp');
        if (!isPlaceholder) {
          console.error("Security: Attempted to claim a non-placeholder member ID");
          alert("此身份已被其他真實使用者使用，無法認領。");
          return;
        }

        // Link existing record to this UID
        const memberRef = doc(db, 'trips', pendingTrip.id, 'members', memberId);
        const memberSnap = await getDoc(memberRef);
        if (memberSnap.exists()) {
          const data = memberSnap.data();
          // Create new doc with user UID and delete old one if ID changed
          await setDoc(doc(db, 'trips', pendingTrip.id, 'members', user.uid), {
            ...data,
            id: user.uid,
            name: user.displayName || data.name,
            avatar: user.photoURL || data.avatar,
            legacyIds: [memberId] // Save for data rescue if needed
          });
          if (memberId !== user.uid) {
            await deleteDoc(memberRef);
          }

          // Migrate all data associated with placeholder ID (memberId) to user.uid
          const collectionsToMigrate = ['expenses', 'todos', 'journal', 'pretrip_tasks'];
          
          for (const colName of collectionsToMigrate) {
            try {
              const colRef = collection(db, 'trips', pendingTrip.id, colName);
              const snap = await getDocs(colRef);
              
              for (const d of snap.docs) {
                const data = d.data();
                let updated = false;
                const newData = { ...data };

                if (colName === 'expenses') {
                  if (data.payerId === memberId) { newData.payerId = user.uid; updated = true; }
                  if (data.splitWithIds?.includes(memberId)) {
                    newData.splitWithIds = data.splitWithIds.map((id: string) => id === memberId ? user.uid : id);
                    updated = true;
                  }
                  if (data.customSplits && data.customSplits[memberId] !== undefined) {
                    newData.customSplits[user.uid] = data.customSplits[memberId];
                    delete newData.customSplits[memberId];
                    updated = true;
                  }
                } else if (colName === 'todos') {
                  if (data.ownerId === memberId) { newData.ownerId = user.uid; updated = true; }
                } else if (colName === 'journal') {
                  if (data.authorId === memberId) { newData.authorId = user.uid; updated = true; }
                } else if (colName === 'pretrip_tasks') {
                  if (data.completedBy?.includes(memberId)) {
                    newData.completedBy = data.completedBy.map((id: string) => id === memberId ? user.uid : id);
                    updated = true;
                  }
                }

                if (updated) {
                  await updateDoc(doc(db, 'trips', pendingTrip.id, colName, d.id), newData);
                }
              }
            } catch (err) {
              console.warn(`Failed to migrate collection ${colName}:`, err);
            }
          }
        }
      } else {
        // Create new member record
        await setDoc(doc(db, 'trips', pendingTrip.id, 'members', user.uid), {
          id: user.uid,
          name: user.displayName,
          avatar: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
          color: 'bg-sky-400'
        });
      }

      navigate(`/trip/${pendingTrip.id}`);
      setShowJoinModal(false);
      setJoiningTripId(null);
      setPendingTrip(null);
      setPendingMembers([]);
    } catch (err) {
      console.error("Join error:", err);
      alert("加入失敗，請稍後再試。");
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
            <img src="https://cdn.imgchest.com/files/44520c1f1cd5.png" alt="Logo" className="w-full h-full object-contain" />
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
              onClick={() => { if (!isJoiningLoading) { setShowJoinModal(false); setJoiningTripId(null); setPendingTrip(null); } }}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-[40px] p-8 shadow-2xl flex flex-col items-center"
            >
              {joinStep === 'confirm' ? (
                <>
                  <div className="w-20 h-20 bg-sky-50 rounded-full flex items-center justify-center mb-6 text-sky-500">
                    <Compass size={40} />
                  </div>
                  <h3 className="text-xl font-black text-slate-800 mb-2 text-center">加入新的旅程？</h3>
                  <p className="text-slate-400 text-xs font-bold mb-8 leading-relaxed text-center">
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
                      onClick={fetchPendingTripDetails}
                      disabled={isJoiningLoading}
                      className="flex-[2] py-4 rounded-2xl bg-sky-500 text-white text-sm font-black shadow-lg shadow-sky-100 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {isJoiningLoading ? '讀取中...' : '立刻加入'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="w-full">
                  <h3 className="text-lg font-black text-slate-800 mb-2">確認您的身份</h3>
                  <p className="text-slate-400 text-xs font-bold mb-6">請選擇您在旅程中的預設身份，或新增自己為新成員。</p>
                  
                  <div className="space-y-3 max-h-[300px] overflow-y-auto no-scrollbar mb-8">
                    {/* Only show members who aren't already linked to a real user UID (placeholders) */}
                    {pendingMembers.filter(m => m.id.startsWith('temp') || m.id.startsWith('m')).map(m => (
                      <button
                        key={m.id}
                        onClick={() => handleJoinTripAs(m.id)}
                        className="w-full flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 hover:border-sky-300 transition-all text-left"
                      >
                        <img src={m.avatar} className="w-10 h-10 rounded-full object-cover" />
                        <span className="text-sm font-black text-slate-700">{m.name}</span>
                      </button>
                    ))}
                    <button
                      onClick={() => handleJoinTripAs('new')}
                      className="w-full flex items-center gap-3 p-3 bg-sky-50 rounded-2xl border border-sky-100 hover:border-sky-300 transition-all text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-sky-500 border border-sky-100">
                        <Plus size={20} />
                      </div>
                      <span className="text-sm font-black text-sky-600">這是新成員（我自己）</span>
                    </button>
                  </div>
                </div>
              )}
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
