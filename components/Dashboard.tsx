
import React, { useState, useEffect } from 'react';
import { Trip, UserProfile } from '../types';
import { Plus, Calendar, MapPin, LogOut, Settings, User as UserIcon, Trash2, Wallet, Star, Award, Heart, Compass, Plane, Tent, Ticket, Camera, Pencil, Sparkles, Footprints } from 'lucide-react';
import { db, logout } from '../services/firebase';
import { collection, query, where, onSnapshot, addDoc, orderBy, getDocs, limit, deleteDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';

interface DashboardProps {
  user: UserProfile;
  trips: Trip[];
  onSelectTrip: (tripId: string) => void;
  isCreateModalOpen: boolean;
  setIsCreateModalOpen: (open: boolean) => void;
  onJoinTrip: (code: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, trips, onSelectTrip, isCreateModalOpen, setIsCreateModalOpen, onJoinTrip }) => {
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [tripToDelete, setTripToDelete] = useState<{id: string, name: string} | null>(null);
  const [newTripName, setNewTripName] = useState('');
  const [newTripCity, setNewTripCity] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [modalMode, setModalMode] = useState<'create' | 'join'>('create');
  const [joinCode, setJoinCode] = useState('');

  const filteredTrips = trips.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTripName || !startDate || !endDate) return;

    try {
      // Generate a short 6-character invite code
      const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars
      let inviteCode = '';
      for (let i = 0; i < 6; i++) {
        inviteCode += characters.charAt(Math.floor(Math.random() * characters.length));
      }

      const tripData = {
        name: newTripName,
        city: newTripCity,
        subtitle: "", // Default to empty as requested
        startDate,
        endDate,
        coverImage: `https://picsum.photos/seed/${newTripName}/800/400`,
        memberUids: [user.uid],
        ownerUid: user.uid,
        createdAt: serverTimestamp(),
        inviteCode
      };
      const tripRef = await addDoc(collection(db, 'trips'), tripData);
      
      // Also add the owner as the first member in the subcollection
      await setDoc(doc(db, 'trips', tripRef.id, 'members', user.uid), {
        id: user.uid,
        name: user.displayName || '旅伴',
        avatar: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
        color: 'bg-sky-400'
      });

      setIsCreateModalOpen(false);
      setNewTripName('');
      setNewTripCity('');
      setStartDate('');
      setEndDate('');
    } catch (err) {
      console.error("Failed to create trip:", err);
    }
  };

  const handleDeleteTrip = (e: React.MouseEvent, tripId: string, tripName: string) => {
    e.stopPropagation();
    setTripToDelete({ id: tripId, name: tripName });
    setIsDeleteConfirmOpen(true);
  };

  const confirmDeleteTrip = async () => {
    if (!tripToDelete) return;
    try {
      await deleteDoc(doc(db, 'trips', tripToDelete.id));
      setIsDeleteConfirmOpen(false);
      setTripToDelete(null);
    } catch (err) {
      console.error("Failed to delete trip:", err);
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const plannedTrips = filteredTrips
    .filter(t => t.endDate >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const completedTrips = filteredTrips.filter(t => t.endDate < today);
  const nextTrip = plannedTrips.length > 0 ? plannedTrips[0] : null;

  const daysUntilNextTrip = nextTrip ? Math.ceil((new Date(nextTrip.startDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0;

  const getThemeStyles = () => {
    switch (user.profileTheme) {
      case 'handdrawn':
        return {
          container: 'bg-transparent',
          font: 'font-handdrawn',
          accent: 'var(--brand-color)',
          card: 'bg-white border-[1.5px] border-[#4B3F35]/10 shadow-[4px_4px_0_0_rgba(75,63,53,0.03)]',
        };
      case 'scrapbook':
        return {
          container: 'bg-transparent paper-texture',
          font: 'font-handdrawn',
          accent: 'text-stone-500',
          card: 'bg-white border border-stone-200/60 shadow-sm',
        };
      case 'hipster':
        return {
          container: 'bg-transparent',
          font: 'font-hipster',
          accent: 'text-stone-400',
          card: 'bg-white border border-stone-100 shadow-sm',
        };
      case 'minimalist':
        return {
          container: 'bg-transparent',
          font: 'font-sans',
          accent: 'text-slate-400',
          card: 'bg-white border border-slate-100 shadow-soft',
        };
      default:
        return {
          container: 'bg-transparent',
          font: 'font-sans',
          accent: 'text-slate-400',
          card: 'bg-white border border-slate-100 shadow-soft',
        };
    }
  };

  const styles = getThemeStyles();

  const formatHanddrawnText = (text: string) => {
    if (user.profileTheme !== 'handdrawn' && user.profileTheme !== 'scrapbook') return text;
    return text.split(/(\s+)/).map((part, i) => {
      if (/^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+$/.test(part)) {
        return <span key={i} className="tracking-[0.25em]">{part}</span>;
      }
      return part;
    });
  };

  const TripCard: React.FC<{ trip: Trip, index: number, theme?: string, isCompact?: boolean }> = ({ trip, index, theme, isCompact }) => {
    const currentTheme = theme || user.profileTheme;
    
    if (currentTheme === 'handdrawn' || currentTheme === 'scrapbook') {
      const tapeColors = ['bg-amber-200/80', 'bg-rose-200/80', 'bg-sky-200/80', 'bg-emerald-200/80'];
      const tapeRotations = ['rotate-[-45deg]', 'rotate-[45deg]', 'rotate-[45deg]', 'rotate-[-45deg]'];
      
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.1 }}
          onClick={() => onSelectTrip(trip.id)}
          className="relative group cursor-pointer active:scale-[0.98] transition-all p-3"
        >
          <div className="relative">
            {/* Main Card Container */}
            <div className="relative aspect-[16/9] overflow-hidden rounded-sm border-[6px] border-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] bg-white">
              <img 
                src={trip.coverImage} 
                alt={trip.name} 
                className="w-full h-full object-cover grayscale-[0.1] contrast-[1.05] group-hover:scale-110 transition-transform duration-1000" 
              />
              
              {/* Overlay Gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80" />
              
              {/* Content Overlays */}
              <div className="absolute bottom-4 left-5 right-5 text-white">
                <h3 className="text-xl font-black font-handdrawn leading-tight mb-2 tracking-wider drop-shadow-md">
                  {trip.name.toUpperCase()}
                </h3>
                <div className="flex items-center gap-4 text-[10px] font-bold font-handdrawn opacity-90">
                  <span className="flex items-center gap-1.5 drop-shadow-sm">
                    <Calendar size={12} /> {trip.startDate.replace(/-/g, '.')}
                  </span>
                  {trip.city && (
                    <span className="flex items-center gap-1.5 drop-shadow-sm">
                      <MapPin size={12} /> {trip.city}
                    </span>
                  )}
                </div>
              </div>

              {/* Delete button in circle at bottom right */}
              <button 
                onClick={(e) => handleDeleteTrip(e, trip.id, trip.name)}
                className="absolute bottom-4 right-4 p-2.5 bg-black/40 backdrop-blur-md rounded-full text-white/90 hover:bg-rose-500 hover:text-white transition-all scale-90"
              >
                <Trash2 size={16} strokeWidth={2.5} />
              </button>
            </div>

            {/* Washi Tapes at corners - only for the closest upcoming trip */}
            {index === 0 && !isCompact && (
              <>
                <div className={`absolute top-0 left-0 w-12 h-5 washi-tape-grid ${tapeColors[0]} ${tapeRotations[0]} z-20 border-x border-black/5 opacity-90 -translate-x-3 -translate-y-1`} />
                <div className={`absolute top-0 right-0 w-12 h-5 washi-tape-grid ${tapeColors[1]} ${tapeRotations[1]} z-20 border-x border-black/5 opacity-90 translate-x-3 -translate-y-1`} />
                <div className={`absolute bottom-0 left-0 w-12 h-5 washi-tape-grid ${tapeColors[2]} ${tapeRotations[2]} z-20 border-x border-black/5 opacity-90 -translate-x-3 translate-y-1`} />
                <div className={`absolute bottom-0 right-0 w-12 h-5 washi-tape-grid ${tapeColors[3]} ${tapeRotations[3]} z-20 border-x border-black/5 opacity-90 translate-x-3 translate-y-1`} />
              </>
            )}
          </div>
          
          {/* Handdrawn text doodles below card */}
          <div className="mt-4 flex justify-between px-2 text-[10px] font-handdrawn text-stone-500 opacity-60 italic">
            <span>✎ {trip.subtitle || '與朋友們一起'}</span>
            <span>⊹</span>
          </div>
        </motion.div>
      );
    }

    if (currentTheme === 'hipster') {
      return (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          onClick={() => onSelectTrip(trip.id)}
          className={`bg-white group cursor-pointer active:scale-95 transition-all shadow-sm border border-stone-100 hover:shadow-md ${isCompact ? 'p-3 pb-8' : 'p-4 pb-12'}`}
        >
          <div className={`relative overflow-hidden ${isCompact ? 'aspect-square mb-3' : 'aspect-[4/3] mb-5'}`}>
            <img src={trip.coverImage} alt={trip.name} className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 group-hover:scale-105 transition-all duration-1000" />
            <div className="absolute inset-0 ring-1 ring-inset ring-black/5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className={`text-stone-700 font-hipster leading-tight truncate ${isCompact ? 'text-xs' : 'text-base'}`}>{trip.name}</h3>
              <button 
                onClick={(e) => handleDeleteTrip(e, trip.id, trip.name)}
                className="p-1 text-stone-300 hover:text-rose-400 transition-colors"
              >
                <Trash2 size={12} />
              </button>
            </div>
            <div className="flex items-center gap-2 text-[9px] font-hipster text-stone-400">
              <span className="tracking-widest uppercase">{trip.startDate.replace(/-/g, '.')}</span>
              {trip.city && <span className="opacity-50">/</span>}
              {trip.city && <span className="tracking-widest uppercase">{trip.city}</span>}
            </div>
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
        onClick={() => onSelectTrip(trip.id)}
        className={`${styles.card} rounded-[32px] overflow-hidden group cursor-pointer active:scale-[0.98] transition-all relative`}
      >
        <div className="h-44 relative overflow-hidden">
          <img src={trip.coverImage} alt={trip.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-black text-white leading-tight mb-1">{formatHanddrawnText(trip.name)}</h3>
              <div className="flex items-center gap-3 text-white/80 text-[9px] font-bold">
                <span className="flex items-center gap-1"><Calendar size={10} /> {trip.startDate.replace(/-/g, '.')}</span>
                {trip.city && <span className="flex items-center gap-1"><MapPin size={10} /> {trip.city}</span>}
              </div>
            </div>
            <button 
              onClick={(e) => handleDeleteTrip(e, trip.id, trip.name)}
              className="p-2 bg-black/20 backdrop-blur-md rounded-full text-white/70 hover:text-white transition-all ml-2"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className={`flex-1 min-h-0 overflow-y-auto no-scrollbar ${styles.container} ${styles.font} relative`}>
      {/* Universal Header (Top Row) */}
      <div className="px-6 pt-12 pb-8 flex justify-between items-center relative z-10">
        <div className="space-y-1">
          <h1 className={`text-2xl font-black ${
            user.profileTheme === 'handdrawn' || user.profileTheme === 'scrapbook' ? 'text-stone-700 font-handdrawn' : 
            user.profileTheme === 'hipster' ? 'text-stone-700 font-hipster' :
            'text-slate-800'
          }`}>
            嗨，{user.displayName.split(' ')[0]} 👋
          </h1>
          <p className={`text-xs font-bold ${
            user.profileTheme === 'handdrawn' || user.profileTheme === 'scrapbook' ? 'text-stone-400 font-handdrawn' : 
            user.profileTheme === 'hipster' ? 'text-stone-400 font-hipster' :
            'text-slate-400'
          }`}>
            下一趟旅程還有 <span className={`text-lg ${
              user.profileTheme === 'handdrawn' || user.profileTheme === 'scrapbook' || user.profileTheme === 'hipster' ? 'text-stone-700' : 'text-slate-800'
            }`}>{daysUntilNextTrip}</span> 天 ✈️
          </p>
        </div>
        <div className="relative">
          {(user.profileTheme === 'handdrawn' || user.profileTheme === 'scrapbook') && (
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-rose-200/60 rounded-full blur-sm" />
          )}
          <div className={`w-12 h-12 rounded-full border-2 p-0.5 bg-white shadow-sm overflow-hidden relative z-10 ${
            user.profileTheme === 'handdrawn' || user.profileTheme === 'scrapbook' || user.profileTheme === 'hipster' ? 'border-stone-200' : 'border-slate-100'
          }`}>
            <img src={user.photoURL || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + user.uid} alt="" className="w-full h-full rounded-full object-cover" />
          </div>
        </div>
      </div>

      {/* Search and list section removed the absolute doodle block */}
      {user.profileTheme === 'hipster' ? (
        <div className="px-6 pb-32 space-y-10 relative z-10">
          {/* Search Bar */}
          <div className="relative mx-4">
            <input 
              type="text" 
              placeholder="Search memories..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 bg-transparent border border-stone-200 rounded-xl outline-none text-xs text-stone-500 font-hipster text-center focus:border-stone-400 transition-colors"
            />
          </div>

          {/* Trip Lists */}
          <div className="space-y-12">
            {plannedTrips.length > 0 && (
              <div className="space-y-6">
                <div className="flex flex-col items-center gap-1">
                  <h3 className="text-sm font-hipster text-stone-500 uppercase tracking-widest">Planned Journey</h3>
                  <div className="w-6 h-px bg-stone-100" />
                </div>
                <div className="grid grid-cols-1 gap-8">
                  {plannedTrips.map(trip => (
                    <TripCard key={trip.id} trip={trip} theme={user.profileTheme} />
                  ))}
                </div>
              </div>
            )}

            {completedTrips.length > 0 && (
              <div className="space-y-6">
                <div className="flex flex-col items-center gap-1">
                  <h3 className="text-sm font-hipster text-stone-500 uppercase tracking-widest">Recent Memories</h3>
                  <div className="w-6 h-px bg-stone-100" />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  {completedTrips.map(trip => (
                    <TripCard key={trip.id} trip={trip} theme={user.profileTheme} isCompact />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : user.profileTheme === 'handdrawn' || user.profileTheme === 'scrapbook' ? (
        <div className="px-6 pb-32 space-y-8 relative z-10">
          {/* Search Bar */}
          <div className="relative">
            <input 
              type="text" 
              placeholder="搜尋回憶..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-5 py-3 bg-white border border-stone-200/60 shadow-sm outline-none text-xs text-stone-500 font-handdrawn"
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300">
              <Plus size={16} className="rotate-45" />
            </div>
          </div>

          {/* Trip Lists */}
          <div className="space-y-10">
            {plannedTrips.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-4 rounded-full" style={{ backgroundColor: 'var(--brand-color)' }} />
                  <h2 className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] font-handdrawn">正在進行中 ({plannedTrips.length})</h2>
                </div>
                <div className="space-y-6">
                  {plannedTrips.map((trip, index) => (
                    <TripCard key={trip.id} trip={trip} index={index} />
                  ))}
                </div>
              </div>
            )}

            {completedTrips.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-4 rounded-full opacity-50" style={{ backgroundColor: 'var(--brand-color)' }} />
                  <h2 className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] font-handdrawn">已完成的回憶 ({completedTrips.length})</h2>
                </div>
                <div className="space-y-6">
                  {completedTrips.map((trip, index) => (
                    <TripCard key={trip.id} trip={trip} index={index + plannedTrips.length} />
                  ))}
                </div>
              </div>
            )}

            {filteredTrips.length === 0 && (
              <div className="py-20 text-center space-y-4">
                <div className="text-4xl opacity-20">📔</div>
                <p className="text-xs text-stone-400 font-handdrawn">還沒有旅程紀錄喔，點擊下方按鈕開始吧！</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="px-6 mt-4">
            <div className="relative">
              <input 
                type="text" 
                placeholder="搜尋旅程..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-5 py-3 rounded-[20px] bg-white border border-slate-100 shadow-soft outline-none text-xs font-bold text-slate-700 transition-all focus:ring-2"
                style={{ '--tw-ring-color': 'rgba(var(--brand-color-rgb), 0.2)' } as React.CSSProperties}
              />
              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300">
                <Plus size={20} className="rotate-45" />
              </div>
            </div>
          </div>

          <div className="px-6 mt-8 pb-32 space-y-10">
            {plannedTrips.length > 0 && (
              <div>
                <h2 className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] ml-2 mb-4">計畫中的旅遊 ({plannedTrips.length})</h2>
                <div className="space-y-6">
                  {plannedTrips.map((trip, index) => (
                    <TripCard key={trip.id} trip={trip} index={index} />
                  ))}
                </div>
              </div>
            )}
            {completedTrips.length > 0 && (
              <div>
                <h2 className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] ml-2 mb-4">已完成的旅遊 ({completedTrips.length})</h2>
                <div className="space-y-6">
                  {completedTrips.map((trip, index) => (
                    <TripCard key={trip.id} trip={trip} index={index + plannedTrips.length} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Create Trip Modal */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative w-full max-w-[390px] bg-white rounded-[40px] p-8 shadow-2xl"
            >
              <div className="w-12 h-1.5 bg-slate-100 rounded-full mx-auto mb-6 sm:hidden" />
              
              <div className="flex gap-4 mb-6 border-b border-slate-100">
                <button 
                  onClick={() => setModalMode('create')}
                  className={`pb-2 text-sm font-black transition-all relative ${modalMode === 'create' ? 'text-sky-500' : 'text-slate-300'}`}
                >
                  建立新旅程
                  {modalMode === 'create' && <motion.div layoutId="modal-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-500" />}
                </button>
                <button 
                  onClick={() => setModalMode('join')}
                  className={`pb-2 text-sm font-black transition-all relative ${modalMode === 'join' ? 'text-sky-500' : 'text-slate-300'}`}
                >
                  加入旅程
                  {modalMode === 'join' && <motion.div layoutId="modal-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-500" />}
                </button>
              </div>

              {modalMode === 'create' ? (
                <form onSubmit={handleCreateTrip} className="space-y-3">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">旅程名稱</label>
                      <input 
                        type="text" 
                        value={newTripName}
                        onChange={(e) => setNewTripName(e.target.value)}
                        placeholder="例如：2026 首爾冬日之旅"
                        className={`w-full px-4 py-3 outline-none text-xs font-bold text-slate-700 transition-all ${user.profileTheme === 'handdrawn' ? 'bg-transparent border-b border-stone-200' : 'rounded-xl bg-slate-50 border-none'}`}
                        style={{ outline: 'none' }}
                        onFocus={(e) => { if (user.profileTheme !== 'handdrawn') e.target.style.boxShadow = '0 0 0 2px rgba(var(--brand-color-rgb), 0.1)'; }}
                        onBlur={(e) => e.target.style.boxShadow = 'none'}
                      />
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">目的地城市 (以+分隔)</label>
                      <input 
                        type="text" 
                        value={newTripCity}
                        onChange={(e) => setNewTripCity(e.target.value)}
                        placeholder="例如：首爾+釜山"
                        className={`w-full px-4 py-3 outline-none text-xs font-bold text-slate-700 transition-all ${user.profileTheme === 'handdrawn' ? 'bg-transparent border-b border-stone-200' : 'rounded-xl bg-slate-50 border-none'}`}
                        style={{ outline: 'none' }}
                        onFocus={(e) => { if (user.profileTheme !== 'handdrawn') e.target.style.boxShadow = '0 0 0 2px rgba(var(--brand-color-rgb), 0.1)'; }}
                        onBlur={(e) => e.target.style.boxShadow = 'none'}
                      />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">開始日期</label>
                      <input 
                        type="date" 
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className={`w-full px-4 py-3 outline-none text-xs font-bold text-slate-700 transition-all ${user.profileTheme === 'handdrawn' ? 'bg-transparent border-b border-stone-200' : 'rounded-xl bg-slate-50 border-none'}`}
                        style={{ outline: 'none' }}
                        onFocus={(e) => { if (user.profileTheme !== 'handdrawn') e.target.style.boxShadow = '0 0 0 2px rgba(var(--brand-color-rgb), 0.1)'; }}
                        onBlur={(e) => e.target.style.boxShadow = 'none'}
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">結束日期</label>
                      <input 
                        type="date" 
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className={`w-full px-4 py-3 outline-none text-xs font-bold text-slate-700 transition-all ${user.profileTheme === 'handdrawn' ? 'bg-transparent border-b border-stone-200' : 'rounded-xl bg-slate-50 border-none'}`}
                        style={{ outline: 'none' }}
                        onFocus={(e) => { if (user.profileTheme !== 'handdrawn') e.target.style.boxShadow = '0 0 0 2px rgba(var(--brand-color-rgb), 0.1)'; }}
                        onBlur={(e) => e.target.style.boxShadow = 'none'}
                      />
                    </div>
                  </div>

                  <div className="pt-3 flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setIsCreateModalOpen(false)}
                      className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-500 text-xs font-black transition-all active:scale-95"
                    >
                      取消
                    </button>
                    <button 
                      type="submit"
                      className="flex-[2] py-3 rounded-xl text-xs font-black shadow-lg transition-all active:scale-95"
                      style={{ backgroundColor: 'var(--brand-color)', color: 'var(--brand-text)', boxShadow: '0 10px 15px -3px rgba(var(--brand-color-rgb), 0.3)' }}
                    >
                      建立旅程
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-6 py-4">
                  <div className="text-center space-y-2">
                    <div className="text-3xl">🎫</div>
                    <p className="text-xs font-bold text-slate-500 leading-relaxed text-center">輸入朋友分享給您的旅程編號<br/>即可立即同步計畫！</p>
                  </div>
                  
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">旅程編號</label>
                    <input 
                      type="text" 
                      placeholder="請貼上編號..." 
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      className={`w-full px-4 py-4 rounded-xl bg-slate-50 border-none outline-none text-center text-sm font-black text-sky-600 tracking-wider placeholder:tracking-normal placeholder:font-bold placeholder:text-slate-300 font-mono`}
                    />
                  </div>

                  <div className="flex gap-3">
                    <button 
                      onClick={() => setIsCreateModalOpen(false)}
                      className="flex-1 py-3.5 rounded-2xl bg-slate-100 text-slate-500 text-xs font-black active:scale-95 transition-all"
                    >
                      取消
                    </button>
                    <button 
                      onClick={() => {
                        if (joinCode.trim()) {
                          onJoinTrip(joinCode.trim());
                          setIsCreateModalOpen(false);
                          setJoinCode('');
                        }
                      }}
                      disabled={!joinCode.trim()}
                      className="flex-[2] py-3.5 rounded-2xl text-white text-xs font-black shadow-lg active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
                      style={{ 
                        backgroundColor: joinCode.trim() ? 'var(--brand-color)' : undefined, 
                        boxShadow: joinCode.trim() ? '0 10px 15px -3px rgba(var(--brand-color-rgb), 0.2)' : undefined 
                      }}
                    >
                      加入旅程
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteConfirmOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDeleteConfirmOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-xs bg-white rounded-[32px] p-8 shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-500">
                <Trash2 size={32} />
              </div>
              <h3 className="text-lg font-black text-slate-800 mb-2">確定要刪除嗎？</h3>
              <p className="text-slate-400 text-xs font-bold mb-8 leading-relaxed">
                確定要刪除「{tripToDelete?.name}」嗎？<br/>此動作無法復原。
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsDeleteConfirmOpen(false)}
                  className="flex-1 py-3.5 rounded-2xl bg-slate-100 text-slate-500 text-xs font-black active:scale-95 transition-all"
                >
                  取消
                </button>
                <button 
                  onClick={confirmDeleteTrip}
                  className="flex-1 py-3.5 rounded-2xl bg-rose-500 text-white text-xs font-black shadow-lg shadow-rose-200 active:scale-95 transition-all"
                >
                  確定刪除
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
