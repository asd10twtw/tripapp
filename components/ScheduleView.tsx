
import React, { useState, useEffect, useRef } from 'react';
import { ScheduleEvent, EventCategory, PreTripTask, Member } from '../types';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../constants';
import { MapPin, Info, Plus, X, Check, Trash2, Plane, ChevronDown, Clock } from 'lucide-react';
import { db } from '../services/firebase';
import { collection, query, onSnapshot, addDoc, deleteDoc, updateDoc, doc, arrayUnion, arrayRemove, orderBy, getDoc, setDoc } from 'firebase/firestore';

interface ScheduleViewProps {
  members: Member[];
  tripId: string;
  startDate: string;
  endDate: string;
  theme?: string;
}

export const ScheduleView: React.FC<ScheduleViewProps> = ({ members, tripId, startDate, endDate, theme }) => {
  const generateDates = () => {
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    const dateList = [{ display: 'PRE', val: 'PRE_TRIP', icon: '📝', date: '' }];
    
    let current = new Date(start);
    let dayCount = 1;
    while (current <= end) {
      const year = current.getFullYear();
      const month = (current.getMonth() + 1).toString().padStart(2, '0');
      const day = current.getDate().toString().padStart(2, '0');
      const val = `${year}-${month}-${day}`;
      
      const display = dayCount.toString();
      const dateStr = `${current.getMonth() + 1}/${day}`;
      dateList.push({ display, val, date: dateStr } as any);
      current.setDate(current.getDate() + 1);
      dayCount++;
    }
    return dateList;
  };

  const dates = generateDates();

  // 初始化日期邏輯：如果是旅程開始前顯示行前準備，旅程期間顯示當天，否則顯示第一天
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    if (today < startDate) return 'PRE_TRIP';
    if (today > endDate) return startDate;
    return today;
  });

  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [preTripTasks, setPreTripTasks] = useState<PreTripTask[]>([]);
  
  // 自定義分類相關狀態
  const [customCategories, setCustomCategories] = useState<Record<string, string>>({});
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatEmoji, setNewCatEmoji] = useState('📍');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newLocation, setNewLocation] = useState('');
  const [newCategory, setNewCategory] = useState<string>(EventCategory.SIGHTSEEING);
  const [newNotes, setNewNotes] = useState('');
  const [newTime, setNewTime] = useState(''); 
  const [newTaskTitle, setNewTaskTitle] = useState('');

  // Swipe gesture state
  const [touchStart, setTouchStart] = useState<{x: number, y: number} | null>(null);
  const [touchEnd, setTouchEnd] = useState<{x: number, y: number} | null>(null);
  const minSwipeDistance = 50;

  // Auto-scroll date tab
  useEffect(() => {
    const scroll = () => {
      const el = document.getElementById(`date-tab-${selectedDate}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    };
    
    // Use a small timeout to ensure DOM is ready
    const timer = setTimeout(scroll, 100);
    return () => clearTimeout(timer);
  }, [selectedDate]);

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const xDistance = touchStart.x - touchEnd.x;
    const yDistance = touchStart.y - touchEnd.y;

    // Ignore vertical scrolls
    if (Math.abs(yDistance) >= Math.abs(xDistance)) return;

    const isLeftSwipe = xDistance > minSwipeDistance;
    const isRightSwipe = xDistance < -minSwipeDistance;
    
    const currentIndex = dates.findIndex(d => d.val === selectedDate);

    if (isLeftSwipe) {
      // Go to Next Day
      if (currentIndex < dates.length - 1) {
        setSelectedDate(dates[currentIndex + 1].val);
      }
    }

    if (isRightSwipe) {
      // Go to Previous Day
      if (currentIndex > 0) {
        setSelectedDate(dates[currentIndex - 1].val);
      }
    }
  };

  // 獲取自定義分類
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'trips', tripId, 'config', 'scheduleSettings'), (docSnap) => {
      if (docSnap.exists()) {
        if (docSnap.data().customCategories) setCustomCategories(docSnap.data().customCategories);
      }
    });
    return () => unsubscribe();
  }, [tripId]);

  const handleAddNewCategory = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    const updated = { ...customCategories, [newCatName.trim()]: newCatEmoji };
    setCustomCategories(updated);
    setIsAddingCategory(false);
    await setDoc(doc(db, 'trips', tripId, 'config', 'scheduleSettings'), { customCategories: updated }, { merge: true });
    setNewCategory(newCatName.trim());
    setNewCatName('');
  };

  useEffect(() => {
    const q = query(collection(db, 'trips', tripId, 'events'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ScheduleEvent)));
    });
    return () => unsubscribe();
  }, [tripId]);

  useEffect(() => {
    const q = query(collection(db, 'trips', tripId, 'pretrip_tasks'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPreTripTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PreTripTask)));
    });
    return () => unsubscribe();
  }, [tripId]);

  const handleAddPreTripTask = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newTaskTitle.trim()) return;
      await addDoc(collection(db, 'trips', tripId, 'pretrip_tasks'), { 
        title: newTaskTitle, 
        completedBy: [], 
        createdAt: new Date().toISOString() 
      });
      setNewTaskTitle('');
  };

  const deletePreTripTask = async (id: string) => { 
    await deleteDoc(doc(db, 'trips', tripId, 'pretrip_tasks', id)); 
  }

  const toggleTaskCompletion = async (taskId: string, memberId: string, isCompleted: boolean) => {
      const taskRef = doc(db, 'trips', tripId, 'pretrip_tasks', taskId);
      await updateDoc(taskRef, { completedBy: isCompleted ? arrayRemove(memberId) : arrayUnion(memberId) });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocation) return;
    try {
      if (editingId) {
        await updateDoc(doc(db, 'trips', tripId, 'events', editingId), { 
          location: newLocation, 
          category: newCategory, 
          notes: newNotes,
          time: newTime
        });
      } else {
        await addDoc(collection(db, 'trips', tripId, 'events'), { 
          date: selectedDate, 
          time: newTime,
          title: '', 
          location: newLocation, 
          category: newCategory, 
          notes: newNotes, 
          createdAt: new Date().toISOString() 
        });
      }
      setIsModalOpen(false);
    } catch (e) { console.error(e); }
  };
  
  const handleDeleteEvent = async (id?: string) => {
    const targetId = id || editingId;
    if (!targetId) return;
    setDeleteTargetId(targetId);
    setIsDeleteConfirmOpen(true);
  }

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await deleteDoc(doc(db, 'trips', tripId, 'events', deleteTargetId)); 
      setIsModalOpen(false); 
      setIsDeleteConfirmOpen(false);
      setDeleteTargetId(null);
    } catch (err) {
      console.error("Delete failed:", err);
    }
  }

  const openEditModal = (event: ScheduleEvent) => {
    setEditingId(event.id);
    setNewLocation(event.location);
    setNewCategory(event.category);
    setNewNotes(event.notes || '');
    setNewTime(event.time || '');
    setIsModalOpen(true);
  };

  const openAddModal = () => {
    setEditingId(null);
    setNewLocation('');
    setNewNotes('');
    setNewTime('');
    setIsModalOpen(true);
  };

  const allCategoryIcons = { ...CATEGORY_ICONS, ...customCategories };
  const allCategoryColors = { ...CATEGORY_COLORS };

  const getCategoryIcon = (cat: string) => (allCategoryIcons as any)[cat] || '📍';
  const getCategoryColorClass = (cat: string) => (allCategoryColors as any)[cat] || 'bg-slate-50 text-slate-400 border-slate-100';

  const filteredEvents = events
    .filter(e => e.date === selectedDate)
    .sort((a, b) => {
      if (a.time && b.time) return a.time.localeCompare(b.time);
      if (a.time) return -1;
      if (b.time) return 1;
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    });

  return (
    <div className="h-full flex flex-col">
      <div className="w-full overflow-x-auto no-scrollbar pt-1 pb-4 mb-0">
        <div className="flex gap-3 px-8 min-w-max">
          {dates.map((d) => (
            <button
              key={d.val}
              id={`date-tab-${d.val}`}
              onClick={() => setSelectedDate(d.val)}
              className={`flex-shrink-0 flex flex-col items-center justify-center w-[48px] h-[64px] transition-all duration-500 ${
                selectedDate === d.val
                  ? 'bg-white shadow-[0_8px_20px_rgba(66,121,179,0.12)] scale-105 z-10'
                  : 'bg-white border-[1.5px] border-slate-50 text-slate-300 shadow-sm'
              } ${theme === 'scrapbook' ? 'rounded-xl' : 'rounded-[18px]'}`}
              style={{ 
                borderWidth: selectedDate === d.val ? '2px' : '1.5px',
                borderColor: selectedDate === d.val ? (theme === 'scrapbook' ? '#8B5E3C' : 'var(--brand-color)') : undefined,
              }}
            >
              {d.val === 'PRE_TRIP' ? (
                <div className="flex flex-col items-center w-full px-1">
                  <span className="text-[8px] font-black text-slate-400 mb-0.5 uppercase tracking-normal w-full text-center">PRE</span>
                  <span className="text-xl leading-none" style={{ color: 'var(--brand-color)' }}>📝</span>
                </div>
              ) : (
                <>
                  <span className="text-[8px] font-black text-slate-300 mb-0.5 uppercase tracking-tighter">DAY</span>
                  <span className={`text-[16px] font-black leading-tight ${selectedDate === d.val ? '' : 'text-slate-300'}`} style={{ color: selectedDate === d.val ? 'var(--brand-color)' : undefined }}>{d.display}</span>
                  <span className="text-[8px] font-black text-slate-400 leading-none mt-0.5">{d.date}</span>
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      <div 
        className="flex-1 overflow-y-auto px-8 pb-32 no-scrollbar pt-0"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {selectedDate === 'PRE_TRIP' ? (
             <div className="space-y-3 pt-2">
                 <div className="bg-white p-5 rounded-3xl shadow-soft border border-slate-50">
                     <h3 className="text-base font-bold text-slate-800 mb-4">行前準備</h3>
                     <form onSubmit={handleAddPreTripTask} className="relative mb-4">
                        <input 
                           type="text" 
                           placeholder="準備事項..." 
                           value={newTaskTitle}
                           onChange={e => setNewTaskTitle(e.target.value)}
                           className="w-full pl-4 pr-12 py-3 rounded-xl bg-slate-50 border-none outline-none text-xs font-bold"
                        />
                        <button type="submit" className="absolute right-1.5 top-1.5 w-8 h-8 rounded-lg flex items-center justify-center shadow-active" style={{ backgroundColor: 'var(--brand-color)', color: 'var(--brand-text)' }}>
                           <Plus size={18} />
                        </button>
                     </form>
                     <div className="space-y-2">
                        {preTripTasks.map(task => (
                            <div key={task.id} className="bg-white rounded-xl border border-slate-100 p-3 shadow-xs">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="font-bold text-slate-700 text-xs">{task.title}</span>
                                    <button onClick={() => deletePreTripTask(task.id)} className="text-slate-200 p-1 hover:text-rose-400 transition-colors">
                                      <Trash2 size={14} />
                                    </button>
                                </div>
                                <div className="flex justify-between items-start w-full px-0.5">
                                    {members.map(member => {
                                        const isDone = task.completedBy.includes(member.id);
                                        return (
                                            <button 
                                                key={member.id}
                                                onClick={() => toggleTaskCompletion(task.id, member.id, isDone)}
                                                className="flex flex-col items-center shrink-0 gap-1 w-12"
                                            >
                                                <div className="w-10 h-10 rounded-full border-2 overflow-hidden relative transition-all" style={{ borderColor: isDone ? 'var(--brand-color)' : undefined, boxShadow: isDone ? '0 0 0 2px rgba(var(--brand-color-rgb), 0.1)' : undefined }}>
                                                    <img src={member.avatar} className="w-full h-full object-cover" alt={member.name} referrerPolicy="no-referrer" />
                                                    {isDone && (
                                                        <div className="absolute inset-0 flex items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(var(--brand-color-rgb), 0.3)' }}>
                                                            <Check size={14} className="text-white drop-shadow-md" strokeWidth={4} />
                                                        </div>
                                                    )}
                                                </div>
                                                <span className={`text-[8px] font-bold truncate w-full text-center ${isDone ? '' : 'text-slate-300'}`} style={{ color: isDone ? 'var(--brand-color)' : undefined }}>{member.name}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                     </div>
                 </div>
             </div>
        ) : (
        <>
            {selectedDate === '2026-01-30' && (
              <div className="bg-white rounded-[24px] border-2 border-dashed border-sky-400/20 p-4 shadow-soft relative overflow-hidden mb-4">
                <div className="flex justify-between items-center mb-4">
                  <div className="border text-[10px] font-bold px-3 py-0.5 rounded-full uppercase tracking-tighter" style={{ backgroundColor: 'var(--brand-color)', borderColor: 'rgba(var(--brand-color-rgb), 0.3)', color: 'var(--brand-text)' }}>出發</div>
                  <div className="text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--brand-color)' }}>TPE → ICN</div>
                </div>
                <div className="flex items-center justify-between px-1 mb-2">
                  <div className="text-center">
                    <h4 className="text-2xl font-bold text-slate-700">TPE</h4>
                    <div className="bg-slate-50 px-2 py-0.5 rounded-full text-[9px] text-slate-400 mt-1 font-bold">20:00</div>
                  </div>
                  <div className="flex-1 flex flex-col items-center px-3 relative">
                    <Plane size={14} className="mb-1 rotate-45" style={{ color: 'var(--brand-color)' }} />
                    <div className="w-full h-[1px] flex items-center justify-between" style={{ backgroundColor: 'rgba(var(--brand-color-rgb), 0.2)' }}>
                       <div className="w-1.5 h-1.5 rounded-full -ml-0.5" style={{ backgroundColor: 'var(--brand-color)' }}></div>
                       <div className="w-1.5 h-1.5 rounded-full -mr-0.5" style={{ backgroundColor: 'var(--brand-color)' }}></div>
                    </div>
                    <span className="text-[8px] text-slate-300 mt-1 font-bold tracking-wider uppercase">IT 602</span>
                  </div>
                  <div className="text-center">
                    <h4 className="text-2xl font-bold text-slate-700">ICN</h4>
                    <div className="bg-slate-50 px-2 py-0.5 rounded-full text-[9px] text-slate-400 mt-1 font-bold">23:30</div>
                  </div>
                </div>
              </div>
            )}

            {selectedDate === '2026-02-05' && (
              <div className="bg-white rounded-[24px] border-2 border-dashed border-sky-400/20 p-4 shadow-soft relative overflow-hidden mb-4">
                <div className="flex justify-between items-center mb-4">
                  <div className="border text-[10px] font-bold px-3 py-0.5 rounded-full uppercase tracking-tighter" style={{ backgroundColor: 'var(--brand-color)', borderColor: 'rgba(var(--brand-color-rgb), 0.3)', color: 'var(--brand-text)' }}>抵達</div>
                  <div className="text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--brand-color)' }}>ICN → TPE</div>
                </div>
                <div className="flex items-center justify-between px-1 mb-2">
                  <div className="text-center">
                    <h4 className="text-2xl font-bold text-slate-700">ICN</h4>
                    <div className="bg-slate-50 px-2 py-0.5 rounded-full text-[9px] text-slate-400 mt-1 font-bold">16:20</div>
                  </div>
                  <div className="flex-1 flex flex-col items-center px-3 relative">
                    <Plane size={14} className="mb-1 rotate-45" style={{ color: 'var(--brand-color)' }} />
                    <div className="w-full h-[1px] flex items-center justify-between" style={{ backgroundColor: 'rgba(var(--brand-color-rgb), 0.2)' }}>
                       <div className="w-1.5 h-1.5 rounded-full -ml-0.5" style={{ backgroundColor: 'var(--brand-color)' }}></div>
                       <div className="w-1.5 h-1.5 rounded-full -mr-0.5" style={{ backgroundColor: 'var(--brand-color)' }}></div>
                    </div>
                    <span className="text-[8px] text-slate-300 mt-1 font-bold tracking-wider uppercase">KE 2027</span>
                  </div>
                  <div className="text-center">
                    <h4 className="text-2xl font-bold text-slate-700">TPE</h4>
                    <div className="bg-slate-50 px-2 py-0.5 rounded-full text-[9px] text-slate-400 mt-1 font-bold">18:10</div>
                  </div>
                </div>
              </div>
            )}

            <button 
                onClick={openAddModal}
                className={`w-full font-black py-4 shadow-active flex items-center justify-center space-x-2 active:scale-[0.98] transition-all mb-4 border ${
                  theme === 'scrapbook' ? 'rounded-xl bg-[#8B5E3C] text-white border-[#8B5E3C]' : 'rounded-2xl'
                }`}
                style={theme !== 'scrapbook' ? { backgroundColor: 'var(--brand-color)', color: 'var(--brand-text)', borderColor: 'rgba(var(--brand-color-rgb), 0.2)' } : {}}
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shadow-soft ${theme === 'scrapbook' ? 'bg-white/20' : 'bg-white/20'}`}>
                <Plus size={14} strokeWidth={4} style={{ color: theme === 'scrapbook' ? 'white' : 'var(--brand-text)' }} />
              </div>
              <span className="text-sm tracking-tight uppercase">新增行程</span>
            </button>

            <div className={`space-y-4 ${theme === 'scrapbook' ? 'relative pl-8' : ''}`}>
            {theme === 'scrapbook' && filteredEvents.length > 0 && (
              <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-stone-200 dashed-line" />
            )}
            {filteredEvents.map((event, idx) => (
                <div 
                    key={event.id}
                    onClick={() => openEditModal(event)}
                    className={`p-5 active:scale-[0.98] transition-all relative group ${
                      theme === 'scrapbook'
                        ? 'bg-white border border-stone-200 shadow-sm rotate-[0.5deg] mb-6' 
                        : theme === 'handdrawn'
                        ? 'bg-white border-[1.5px] border-[#4B3F35]/10 shadow-[4px_4px_0_0_rgba(75,63,53,0.03)] rotate-[0.5deg] mb-6'
                        : 'bg-white rounded-[24px] border border-slate-50 shadow-[0_4px_20px_rgba(0,0,0,0.02)] mb-4'
                    }`}
                >
                    {theme === 'scrapbook' && (
                      <div className="absolute -left-8 top-1/2 -translate-y-1/2 flex flex-col items-center">
                        <div className="w-3 h-3 rounded-full bg-white border-2 border-[#8B5E3C] z-10" />
                        {event.time && (
                          <span className="text-[8px] font-black text-stone-400 mt-1 whitespace-nowrap -rotate-90">{event.time}</span>
                        )}
                      </div>
                    )}
                    {(theme === 'handdrawn' || theme === 'scrapbook') && (
                      <div className={`absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-3 washi-tape-grid border-x border-black/5 rotate-[-1deg] ${
                        idx % 3 === 0 ? 'bg-amber-200/40' : idx % 3 === 1 ? 'bg-rose-200/40' : 'bg-sky-200/40'
                      }`} />
                    )}
                    <div className="flex justify-between items-center mb-3">
                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold border ${CATEGORY_COLORS[event.category] || 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                            <span>{getCategoryIcon(event.category)}</span>
                            <span className="tracking-tight">{event.category}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          {event.time && (
                            <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400">
                              <Clock size={12} className="opacity-60" style={{ color: 'var(--brand-color)' }} /> {event.time}
                            </div>
                          )}
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteEvent(event.id); }}
                            className={`${theme === 'handdrawn' ? 'text-stone-300' : 'text-slate-100'} hover:text-rose-400 transition-colors p-1`}
                          >
                              <Trash2 size={14} />
                          </button>
                        </div>
                    </div>
                    <h3 className="text-[14px] font-bold text-slate-800 leading-tight tracking-tight">{event.location}</h3>
                    {event.notes && <p className="text-xs text-slate-400 font-medium mt-1 italic">{event.notes}</p>}
                </div>
            ))}
            {filteredEvents.length === 0 && selectedDate !== 'PRE_TRIP' && (
              <div className="text-center py-20 text-slate-200 text-[11px] font-black uppercase tracking-[0.2em] italic">No events planned</div>
            )}
            </div>
        </>
        )}
      </div>

      {isModalOpen && selectedDate !== 'PRE_TRIP' && (
        <div className="fixed inset-0 z-[100] bg-black/30 backdrop-blur-sm flex items-end justify-center">
           <div className="bg-white w-full max-w-[390px] rounded-t-[32px] p-6 shadow-2xl animate-in slide-in-from-bottom-10 overflow-y-auto max-h-[90vh]">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-slate-800">{editingId ? '編輯行程' : '新增行程'}</h2>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-300 text-xl">✕</button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                 <div>
                    <label className="text-[8px] font-black text-slate-300 uppercase tracking-widest block ml-1 mb-1">目的地名稱</label>
                    <input type="text" placeholder="目的地名稱" value={newLocation} onChange={e => setNewLocation(e.target.value)} className="w-full text-lg font-bold py-3 border-b-2 border-slate-50 focus:border-sky-400 outline-none transition-colors" required />
                 </div>
                 
                 <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                        <label className="text-[8px] font-black text-slate-300 uppercase tracking-widest block ml-1">時間 (可選)</label>
                        <input 
                            type="time" 
                            value={newTime} 
                            onChange={e => setNewTime(e.target.value)} 
                            className="w-full p-3 bg-slate-50 rounded-2xl text-sm font-bold border-none outline-none focus:ring-1" 
                            onFocus={(e) => e.target.style.boxShadow = '0 0 0 1px rgba(var(--brand-color-rgb), 0.1)'}
                            onBlur={(e) => e.target.style.boxShadow = 'none'}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[8px] font-black text-slate-300 uppercase tracking-widest block ml-1">行程分類</label>
                        <div className="relative">
                            <select 
                                value={newCategory} 
                                onChange={(e) => {
                                    if (e.target.value === 'ADD_NEW') { setIsAddingCategory(true); } 
                                    else { setNewCategory(e.target.value); setIsAddingCategory(false); }
                                }}
                                className="w-full p-3 bg-slate-50 rounded-2xl text-sm font-bold text-slate-700 border-none outline-none appearance-none pr-8 focus:ring-1"
                                onFocus={(e) => e.target.style.boxShadow = '0 0 0 1px rgba(var(--brand-color-rgb), 0.1)'}
                                onBlur={(e) => e.target.style.boxShadow = 'none'}
                            >
                                {Object.entries(CATEGORY_ICONS).map(([name, emoji]) => (
                                    <option key={name} value={name}>{emoji} {name}</option>
                                ))}
                                {Object.entries(customCategories).map(([name, emoji]) => (
                                    <option key={name} value={name}>{emoji} {name}</option>
                                ))}
                                <option value="ADD_NEW" className="font-bold" style={{ color: 'var(--brand-color)' }}>+ 新增分類...</option>
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                        </div>
                    </div>
                 </div>

                 {isAddingCategory && (
                    <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100 space-y-3 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <label className="text-[8px] font-bold text-purple-400 mb-1 block">分類名稱</label>
                                <input type="text" placeholder="例: 練舞" value={newCatName} onChange={e => setNewCatName(e.target.value)} className="w-full p-2 bg-white rounded-lg text-xs font-bold outline-none border border-purple-100 focus:border-purple-300" />
                            </div>
                            <div className="w-12">
                                <label className="text-[8px] font-bold text-purple-400 mb-1 block">圖示</label>
                                <input type="text" placeholder="💃" value={newCatEmoji} onChange={e => setNewCatEmoji(e.target.value)} className="w-full p-2 bg-white rounded-lg text-center text-xs outline-none border border-purple-100" />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setIsAddingCategory(false)} className="flex-1 py-1.5 bg-white text-slate-400 text-[10px] font-bold rounded-lg border border-slate-100">取消</button>
                            <button type="button" onClick={handleAddNewCategory} className="flex-1 py-1.5 text-white text-[10px] font-bold rounded-lg shadow-sm" style={{ backgroundColor: 'var(--brand-color)', color: 'var(--brand-text)' }}>新增分類</button>
                        </div>
                    </div>
                 )}

                 <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-300 uppercase tracking-widest block ml-1">備註 (可選)</label>
                    <textarea placeholder="有些備註想記錄嗎？" value={newNotes} onChange={e => setNewNotes(e.target.value)} className="w-full p-4 bg-slate-50 rounded-xl h-24 outline-none text-xs font-bold text-slate-600 border border-transparent transition-all" onFocus={(e) => e.target.style.borderColor = 'var(--brand-color)'} onBlur={(e) => e.target.style.borderColor = 'transparent'} />
                 </div>
                 
                 <div className="flex gap-3 pt-4">
                     {editingId && (
                         <button type="button" onClick={() => handleDeleteEvent()} className="px-5 py-4 bg-rose-50 text-rose-500 font-bold rounded-2xl active:scale-95 transition-all">
                             <Trash2 size={20} />
                         </button>
                     )}
                     <button type="submit" className="flex-1 py-4 text-white text-base font-bold rounded-2xl shadow-active active:scale-95 transition-all" style={{ backgroundColor: 'var(--brand-color)', color: 'var(--brand-text)' }}>
                        {editingId ? '儲存變更' : '確定新增'}
                     </button>
                 </div>
              </form>
           </div>
        </div>
      )}
      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-xs rounded-[32px] p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-800 mb-2 text-center">確定要刪除嗎？</h3>
            <p className="text-slate-400 text-xs text-center mb-6">此操作無法復原，請確認是否繼續。</p>
            <div className="flex gap-3">
              <button 
                onClick={() => { setIsDeleteConfirmOpen(false); setDeleteTargetId(null); }}
                className="flex-1 py-3 bg-slate-100 text-slate-500 font-bold rounded-2xl active:scale-95 transition-all"
              >
                取消
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 py-3 bg-rose-500 text-white font-bold rounded-2xl shadow-lg shadow-rose-200 active:scale-95 transition-all"
              >
                確定刪除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
