
import React, { useState, useEffect } from 'react';
import { Trip, UserProfile } from '../types';
import { Plus, Calendar, MapPin, LogOut, Settings, User as UserIcon, Trash2, Wallet, Star } from 'lucide-react';
import { db, logout } from '../services/firebase';
import { collection, query, where, onSnapshot, addDoc, orderBy, getDocs, limit, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';

interface DashboardProps {
  user: UserProfile;
  trips: Trip[];
  onSelectTrip: (tripId: string) => void;
  isCreateModalOpen: boolean;
  setIsCreateModalOpen: (open: boolean) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, trips, onSelectTrip, isCreateModalOpen, setIsCreateModalOpen }) => {
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [tripToDelete, setTripToDelete] = useState<{id: string, name: string} | null>(null);
  const [newTripName, setNewTripName] = useState('');
  const [newTripCity, setNewTripCity] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTrips = trips.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTripName || !startDate || !endDate) return;

    try {
      const tripData = {
        name: newTripName,
        city: newTripCity,
        startDate,
        endDate,
        coverImage: `https://picsum.photos/seed/${newTripName}/800/400`,
        memberUids: [user.uid],
        ownerUid: user.uid,
        createdAt: new Date().toISOString()
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
  const plannedTrips = filteredTrips.filter(t => t.endDate >= today);
  const completedTrips = filteredTrips.filter(t => t.endDate < today);
  const nextTrip = plannedTrips.length > 0 ? plannedTrips.sort((a, b) => a.startDate.localeCompare(b.startDate))[0] : null;

  const daysUntilNextTrip = nextTrip ? Math.ceil((new Date(nextTrip.startDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0;

  const getThemeStyles = () => {
    switch (user.profileTheme) {
      case 'scrapbook':
        return {
          container: 'bg-[#FDFCF8] paper-texture',
          font: 'font-handdrawn',
          accent: 'text-stone-500',
          card: 'bg-white border border-stone-200/60 shadow-sm',
        };
      case 'hipster':
        return {
          container: 'bg-[#FDFCF8]',
          font: 'font-hipster',
          accent: 'text-stone-400',
          card: 'bg-white border border-stone-100 shadow-sm',
        };
      default:
        return {
          container: 'bg-white',
          font: 'font-sans',
          accent: 'text-slate-400',
          card: 'bg-white border border-slate-100 shadow-soft',
        };
    }
  };

  const styles = getThemeStyles();

  const TripCard: React.FC<{ trip: Trip, index: number }> = ({ trip, index }) => {
    if (user.profileTheme === 'scrapbook') {
      const isCompleted = new Date(trip.endDate) < new Date();
      return (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          onClick={() => onSelectTrip(trip.id)}
          className={`relative aspect-[4/5] bg-white p-2 group cursor-pointer active:scale-[0.98] transition-all shadow-sm border border-stone-200/60`}
        >
          <div className="w-full h-full relative overflow-hidden">
            <img src={trip.coverImage} alt={trip.name} className="w-full h-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 bg-white/90 backdrop-blur-sm p-2 border-t border-stone-100">
              <h3 className="text-[10px] font-black text-stone-700 truncate">{trip.name}</h3>
              <p className="text-[8px] text-stone-400 mt-0.5">{trip.startDate.replace(/-/g, '.')}</p>
            </div>
          </div>
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-3 washi-tape-grid bg-stone-200/50 rotate-1" />
          <div className="absolute -bottom-1 -right-1 text-amber-400/40 rotate-12 group-hover:scale-110 transition-transform">
            <Star size={12} fill="currentColor" />
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
          <div className="absolute bottom-4 left-5 right-5">
            <h3 className="text-base font-black text-white leading-tight mb-1">{trip.name}</h3>
            <div className="flex items-center gap-3 text-white/80 text-[9px] font-bold">
              <span className="flex items-center gap-1"><Calendar size={10} /> {trip.startDate.replace(/-/g, '.')}</span>
              {trip.city && <span className="flex items-center gap-1"><MapPin size={10} /> {trip.city}</span>}
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className={`flex-1 overflow-y-auto no-scrollbar ${styles.container} ${styles.font}`}>
      {user.profileTheme === 'scrapbook' ? (
        <div className="px-6 pt-12 pb-32 space-y-8">
          {/* Scrapbook Header */}
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <h1 className="text-2xl font-black text-stone-700 font-handdrawn">
                嗨，{user.displayName.split(' ')[0]} 👋
              </h1>
              <p className="text-xs font-bold text-stone-400 font-handdrawn">
                下一趟旅程還有 <span className="text-lg text-stone-700">{daysUntilNextTrip}</span> 天 ✈️
              </p>
            </div>
            <div className="relative">
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-rose-200/60 rounded-full blur-sm" />
              <div className="w-12 h-12 rounded-full border-2 border-stone-200 p-0.5 bg-white shadow-sm overflow-hidden relative z-10">
                <img src={user.photoURL || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + user.uid} alt="" className="w-full h-full rounded-full object-cover" />
              </div>
            </div>
          </div>

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
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 bg-sky-300 rounded-full" />
                  <h2 className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] font-handdrawn">未完成的旅程 ({plannedTrips.length})</h2>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {plannedTrips.map((trip, index) => (
                    <TripCard key={trip.id} trip={trip} index={index} />
                  ))}
                </div>
              </div>
            )}

            {completedTrips.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 bg-rose-300 rounded-full" />
                  <h2 className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] font-handdrawn">已完成的旅程 ({completedTrips.length})</h2>
                </div>
                <div className="grid grid-cols-2 gap-4">
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

          {/* Floating Add Button for Scrapbook */}
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="fixed bottom-24 right-6 w-14 h-14 bg-[#8B5E3C] text-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-all z-40 border-4 border-white"
          >
            <Plus size={28} strokeWidth={3} />
          </button>
        </div>
      ) : (
        <>
          {/* Default/Hipster Header */}
          <div className="px-6 pt-10 pb-3 flex justify-between items-center sticky top-0 z-30 backdrop-blur-sm">
            <h1 className="text-xl font-black tracking-tight" style={{ color: 'var(--brand-color)' }}>GoGoTrip</h1>
            <div className="w-10 h-10 rounded-full border-2 border-slate-50 overflow-hidden shadow-sm">
              <img src={user.photoURL || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + user.uid} alt="" className="w-full h-full object-cover" />
            </div>
          </div>

          <div className="px-6 mt-4">
            <div className="relative">
              <input 
                type="text" 
                placeholder="搜尋旅程..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-5 py-3 rounded-[20px] bg-white border border-slate-100 shadow-soft outline-none text-xs font-bold text-slate-700"
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
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
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
              className="relative w-full max-w-[390px] bg-white rounded-t-[40px] sm:rounded-[40px] p-8 shadow-2xl"
            >
              <div className="w-12 h-1.5 bg-slate-100 rounded-full mx-auto mb-6 sm:hidden" />
              <h3 className="text-xl font-black text-slate-800 mb-6">開啟新旅程 🌟</h3>
              
              <form onSubmit={handleCreateTrip} className="space-y-3">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">旅程名稱</label>
                    <input 
                      type="text" 
                      value={newTripName}
                      onChange={(e) => setNewTripName(e.target.value)}
                      placeholder="例如：2026 首爾冬日之旅"
                      className={`w-full px-4 py-3 outline-none text-xs font-bold text-slate-700 transition-all ${user.profileTheme === 'handdrawn' ? 'bg-transparent' : 'rounded-xl bg-slate-50 border-none'}`}
                      style={{ outline: 'none' }}
                      onFocus={(e) => { if (user.profileTheme !== 'handdrawn') e.target.style.boxShadow = '0 0 0 2px rgba(var(--brand-color-rgb), 0.1)'; }}
                      onBlur={(e) => e.target.style.boxShadow = 'none'}
                    />
                </div>

                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">目的地城市</label>
                    <input 
                      type="text" 
                      value={newTripCity}
                      onChange={(e) => setNewTripCity(e.target.value)}
                      placeholder="例如：首爾"
                      className={`w-full px-4 py-3 outline-none text-xs font-bold text-slate-700 transition-all ${user.profileTheme === 'handdrawn' ? 'bg-transparent' : 'rounded-xl bg-slate-50 border-none'}`}
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
                      className={`w-full px-4 py-3 outline-none text-xs font-bold text-slate-700 transition-all ${user.profileTheme === 'handdrawn' ? 'bg-transparent' : 'rounded-xl bg-slate-50 border-none'}`}
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
                      className={`w-full px-4 py-3 outline-none text-xs font-bold text-slate-700 transition-all ${user.profileTheme === 'handdrawn' ? 'bg-transparent' : 'rounded-xl bg-slate-50 border-none'}`}
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
