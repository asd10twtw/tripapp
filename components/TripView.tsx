
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tab, Member, EventCategory, UserProfile, Trip } from '../types';
import { ScheduleView } from './ScheduleView';
import { ExpenseView } from './ExpenseView';
import { PlanningView } from './PlanningView';
import { JournalView } from './JournalView';
import { Calendar, CircleDollarSign, BookOpen, ShoppingBag, Settings, Download, FileSpreadsheet, ChevronLeft, ChevronRight, Plus, Image as ImageIcon, UserPlus, UserCheck, Loader2, AlertCircle, Share2, Scissors, Check, X, Star, Award, MapPin, Heart, Compass, Plane, Tent, Ticket, Camera, Pencil, Sparkles, Footprints, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, doc, updateDoc, setDoc, getDocs, query, orderBy, addDoc, limit, arrayUnion, deleteDoc, writeBatch, where, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import * as XLSX from 'xlsx';
import Cropper from 'react-easy-crop';
import { QRCodeSVG } from 'qrcode.react';

interface TripViewProps {
  user: UserProfile;
  onBack: () => void;
}

export const TripView: React.FC<TripViewProps> = ({ user, onBack }) => {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>(Tab.SCHEDULE);
  
  if (!tripId) {
    navigate('/');
    return null;
  }
  const [members, setMembers] = useState<Member[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [editName, setEditName] = useState('');
  const [editSubtitle, setEditSubtitle] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [hasLegacyData, setHasLegacyData] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [isDeleteTripModalOpen, setIsDeleteTripModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  
  // Cropping state
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [isCropping, setIsCropping] = useState(false);

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const getCroppedImg = async (imageSrc: string, pixelCrop: any): Promise<string> => {
    const image = new Image();
    image.src = imageSrc;
    await new Promise((resolve) => (image.onload = resolve));

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return canvas.toDataURL('image/jpeg', 0.8);
  };

  const handleCropSave = async () => {
    if (!imageToCrop || !croppedAreaPixels) return;
    setIsCropping(true);
    try {
      const croppedImage = await getCroppedImg(imageToCrop, croppedAreaPixels);
      await updateDoc(doc(db, 'trips', tripId), { coverImage: croppedImage });
      setImageToCrop(null);
    } catch (err) {
      console.error("Crop failed:", err);
    } finally {
      setIsCropping(false);
    }
  };

  const handleShareTrip = async () => {
    const shareUrl = `${window.location.origin}?tripId=${tripId}`;
    const shareData = {
      title: `加入我的旅程：${trip?.name || '旅行'}`,
      text: `這裡有個超棒的旅程計畫，快來跟我一起規畫吧！`,
      url: shareUrl,
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Share failed:', err);
          copyToClipboard(shareUrl);
        }
      }
    } else {
      copyToClipboard(shareUrl);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  useEffect(() => {
    checkLegacyData();
    // Fetch trip data
    const unsubscribeTrip = onSnapshot(doc(db, 'trips', tripId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Trip;
        setTrip({ id: docSnap.id, ...data });
        setEditName(data.name || '');
        setEditSubtitle(data.subtitle || '');
        setEditCity(data.city || '');
        setEditStartDate(data.startDate || '');
        setEditEndDate(data.endDate || '');
      }
    });

    // Fetch members scoped to trip
    const unsubscribeMembers = onSnapshot(collection(db, 'trips', tripId, 'members'), (snapshot) => {
      const fetchedMembers: Member[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Member));
      fetchedMembers.sort((a, b) => a.id.localeCompare(b.id));
      
      const hasUser = fetchedMembers.some(m => m.id === user.uid);
      setMembers(fetchedMembers);

      // If user is in memberUids (handled by App.tsx) but not in members subcollection, show claim modal
      if (!hasUser && fetchedMembers.length > 0) {
        setShowClaimModal(true);
      } else {
        setShowClaimModal(false);
      }
    });

    return () => {
      unsubscribeTrip();
      unsubscribeMembers();
    };
  }, [tripId]);

  const handleClaimIdentity = async (placeholderId: string) => {
    setIsClaiming(true);
    try {
      let newMember;
      if (placeholderId === 'new') {
        newMember = {
          id: user.uid,
          name: user.displayName || '新成員',
          avatar: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
          color: 'bg-sky-400'
        };
      } else {
        const placeholder = members.find(m => m.id === placeholderId);
        if (!placeholder) return;

        let finalAvatar = user.photoURL || placeholder.avatar;
        if (finalAvatar.startsWith('data:image')) {
          finalAvatar = await compressImage(finalAvatar, 200, 200, 0.7);
        }

        newMember = {
          ...placeholder,
          id: user.uid,
          name: user.displayName || placeholder.name,
          avatar: finalAvatar
        };
      }
      
      await setDoc(doc(db, 'trips', tripId, 'members', user.uid), newMember);

      if (placeholderId !== 'new') {
        // Delete placeholder
        await deleteDoc(doc(db, 'trips', tripId, 'members', placeholderId));

        // Migrate all data associated with placeholderId to user.uid
        const collections = ['expenses', 'todos', 'journal', 'pretrip_tasks'];
        
        for (const colName of collections) {
          const colRef = collection(db, 'trips', tripId, colName);
          const snap = await getDocs(colRef);
          
          for (const d of snap.docs) {
            const data = d.data();
            let updated = false;
            const newData = { ...data };

            if (colName === 'expenses') {
              if (data.payerId === placeholderId) { newData.payerId = user.uid; updated = true; }
              if (data.splitWithIds?.includes(placeholderId)) {
                newData.splitWithIds = data.splitWithIds.map((id: string) => id === placeholderId ? user.uid : id);
                updated = true;
              }
              if (data.customSplits?.[placeholderId] !== undefined) {
                newData.customSplits[user.uid] = data.customSplits[placeholderId];
                delete newData.customSplits[placeholderId];
                updated = true;
              }
            } else if (colName === 'todos') {
              if (data.ownerId === placeholderId) { newData.ownerId = user.uid; updated = true; }
            } else if (colName === 'journal') {
              if (data.authorId === placeholderId) { newData.authorId = user.uid; updated = true; }
            } else if (colName === 'pretrip_tasks') {
              if (data.completedBy?.includes(placeholderId)) {
                newData.completedBy = data.completedBy.map((id: string) => id === placeholderId ? user.uid : id);
                updated = true;
              }
            }

            if (updated) {
              await updateDoc(doc(db, 'trips', tripId, colName, d.id), newData);
            }
          }
        }
      }

      setShowClaimModal(false);
    } catch (err) {
      console.error("Claim failed:", err);
      alert("認領失敗，請稍後再試。");
    } finally {
      setIsClaiming(false);
    }
  };

  const checkLegacyData = async () => {
    try {
      const collections = ['events', 'expenses', 'todos', 'journal'];
      for (const col of collections) {
        const snap = await getDocs(query(collection(db, col), limit(1)));
        if (!snap.empty) {
          setHasLegacyData(true);
          return;
        }
      }
    } catch (err) {
      console.error("Failed to check legacy data:", err);
    }
  };

  const handleMigrateToCurrentTrip = async () => {
    if (!confirm("確定要將舊版資料匯入到此旅程中嗎？")) return;
    setIsMigrating(true);
    try {
      const collections = ['events', 'expenses', 'todos', 'journal'];
      for (const col of collections) {
        const snap = await getDocs(collection(db, col));
        for (const oldDoc of snap.docs) {
          await addDoc(collection(db, 'trips', tripId, col), oldDoc.data());
        }
      }
      setHasLegacyData(false);
      alert("資料匯入成功！");
    } catch (err) {
      console.error("Migration failed:", err);
      alert("匯入失敗，請稍後再試。");
    } finally {
      setIsMigrating(false);
    }
  };

  const handleUpdateMemberName = async (id: string, newName: string) => {
    await updateDoc(doc(db, 'trips', tripId, 'members', id), { name: newName });
  };

  const handleMemberAvatarChange = async (memberId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      const compressed = await compressImage(base64String, 200, 200, 0.7);
      await updateDoc(doc(db, 'trips', tripId, 'members', memberId), { avatar: compressed });
    };
    reader.readAsDataURL(file);
  };

  const handleTripCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setImageToCrop(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const compressImage = (base64Str: string, maxWidth: number, maxHeight: number, quality: number): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
    });
  };

  const handleUpdateTripInfo = async (field: 'name' | 'subtitle' | 'city' | 'startDate' | 'endDate', value: string) => {
    if (field === 'name') setEditName(value);
    if (field === 'subtitle') setEditSubtitle(value);
    if (field === 'city') setEditCity(value);
    if (field === 'startDate') setEditStartDate(value);
    if (field === 'endDate') setEditEndDate(value);
    await updateDoc(doc(db, 'trips', tripId), { [field]: value });
  };

  const handleAddMember = async () => {
    if (!newMemberName.trim()) return;
    const newId = 'temp_' + Date.now();
    const newMember: Member = {
      id: newId,
      name: newMemberName.trim(),
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${newId}`,
      color: 'bg-sky-400'
    };
    await setDoc(doc(db, 'trips', tripId, 'members', newId), newMember);
    setNewMemberName('');
    setIsAddMemberModalOpen(false);
  };

  const exportToExcel = async () => {
    try {
      const expensesSnap = await getDocs(collection(db, 'trips', tripId, 'expenses'));
      const expensesData = expensesSnap.docs.map(doc => doc.data());
      
      const ws = XLSX.utils.json_to_sheet(expensesData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Expenses");
      XLSX.writeFile(wb, `${trip?.name || 'Trip'}_Expenses.xlsx`);
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  const renderContent = () => {
    if (!trip) return <div className="flex-1 flex items-center justify-center text-slate-300 font-bold uppercase tracking-widest">Loading Trip...</div>;

    switch (activeTab) {
      case Tab.SCHEDULE: return <ScheduleView members={members} tripId={tripId} startDate={trip.startDate} endDate={trip.endDate} theme={user.profileTheme} />;
      case Tab.EXPENSE: return <ExpenseView members={members} tripId={tripId} currentUser={user} theme={user.profileTheme} />;
      case Tab.PLANNING: return <PlanningView members={members} tripId={tripId} currentUser={user} theme={user.profileTheme} />;
      case Tab.JOURNAL: return <JournalView members={members} tripId={tripId} theme={user.profileTheme} />;
      default: return <ScheduleView members={members} tripId={tripId} startDate={trip.startDate} endDate={trip.endDate} />;
    }
  };

  const getThemeBg = () => {
    switch (user?.profileTheme) {
      case 'handdrawn': return 'bg-transparent';
      case 'hipster': return 'bg-[#FDFCF8]';
      case 'minimalist': return 'bg-[#F8FAFC]';
      default: return 'bg-[#FCFBF7]';
    }
  };

  return (
    <div className={`h-full flex flex-col w-full max-w-md mx-auto relative overflow-hidden transition-colors duration-500 ${getThemeBg()}`}>
      {/* Background doodles are handled by App.tsx */}
      {/* Header */}
      <div className={`px-6 pt-6 pb-4 shrink-0 flex flex-col gap-4 relative z-30 backdrop-blur-sm ${
        user.profileTheme === 'handdrawn' ? 'bg-[#F9F5E6]/80' : 
        user.profileTheme === 'scrapbook' ? 'bg-[#FDFCF8]/80' :
        user.profileTheme === 'minimalist' ? 'bg-[#F8FAFC]/80' :
        'bg-transparent'
      }`}>
        {/* Top Bar: Back, Share, Settings */}
        <div className="flex items-center justify-between">
          <button 
            onClick={onBack}
            className={`flex items-center justify-center active:scale-90 transition-all border ${
              user.profileTheme === 'handdrawn' ? 'w-8 h-8 rounded-full bg-white border-[#4B3F35]/30 text-[#4B3F35]' : 
              user.profileTheme === 'scrapbook' ? 'w-9 h-9 rounded-xl bg-white border-stone-200 text-stone-500 shadow-sm' :
              'w-8 h-8 rounded-full bg-white/50 border-slate-100 text-slate-400'
            }`}
          >
            <ChevronLeft size={user.profileTheme === 'scrapbook' ? 22 : 20} strokeWidth={3} />
          </button>

          <div className="flex items-center gap-2">
            <button 
              onClick={handleShareTrip}
              className={`flex items-center justify-center active:scale-90 transition-all border ${
                user.profileTheme === 'handdrawn' ? 'w-8 h-8 rounded-full bg-white border-[#4B3F35]/30 text-[#4B3F35]' : 
                user.profileTheme === 'scrapbook' ? 'w-9 h-9 rounded-xl bg-white border-stone-200 text-stone-500 shadow-sm' :
                'w-8 h-8 rounded-full bg-white border-slate-50 text-slate-400'
              }`}
            >
              <Share2 size={16} strokeWidth={2.5} className={isCopied ? 'text-green-500' : ''} />
            </button>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className={`flex items-center justify-center active:scale-90 transition-all border ${
                user.profileTheme === 'handdrawn' ? 'w-8 h-8 rounded-full bg-white border-[#4B3F35]/30 text-[#4B3F35]' : 
                user.profileTheme === 'scrapbook' ? 'w-9 h-9 rounded-xl bg-white border-stone-200 text-stone-500 shadow-sm' :
                'w-8 h-8 rounded-full bg-white border-slate-50 text-slate-300'
              }`}
            >
              <Settings size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Trip Info & Members */}
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            {user.profileTheme === 'hipster' ? (
              <div className="flex flex-col">
                <h2 className="text-[10px] font-hipster text-stone-400 uppercase tracking-[0.2em] mb-1">Journey</h2>
                <h1 className="text-2xl font-hipster text-stone-700 tracking-tight truncate">
                  {trip?.name || 'Exploring'}
                </h1>
              </div>
            ) : (
              <h1 className={`text-2xl font-black tracking-normal leading-none uppercase truncate drop-shadow-sm ${
                user.profileTheme === 'handdrawn' ? 'text-[#4B3F35]' : 
                user.profileTheme === 'scrapbook' ? 'text-stone-700 font-handdrawn' :
                ''
              }`} style={(!['handdrawn', 'scrapbook'].includes(user.profileTheme || '')) ? { color: 'var(--brand-color)' } : {}}>
                {user.profileTheme === 'handdrawn' || user.profileTheme === 'scrapbook' 
                  ? (trip?.name || 'SEOUL GO').split(/(\s+)/).map((part, i) => {
                      if (/^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+$/.test(part)) {
                        return <span key={i} className="tracking-[0.18em]">{part}</span>;
                      }
                      return part;
                    })
                  : (trip?.name || 'SEOUL GO')}
              </h1>
            )}
            <div className="flex items-center gap-2">
              {trip?.subtitle && (
                <span className={`text-[10px] font-black px-3 py-0.5 rounded-full uppercase tracking-normal ${
                  user.profileTheme === 'handdrawn' ? 'bg-[#4B3F35] text-white' : 
                  user.profileTheme === 'scrapbook' ? 'bg-[#8B5E3C] text-white shadow-sm' :
                  'text-white'
                }`} style={(!['handdrawn', 'scrapbook'].includes(user.profileTheme || '')) ? { backgroundColor: 'var(--brand-color)' } : {}}>
                  {trip.subtitle}
                </span>
              )}
              <div className={`text-[11px] font-black tracking-normal ${
                user.profileTheme === 'handdrawn' ? 'text-[#8B5E3C]' : 
                user.profileTheme === 'scrapbook' ? 'text-stone-400' :
                'text-slate-400'
              }`}>
                {trip?.startDate?.replace(/-/g, '.') || '2026.01.30'} - {trip?.endDate?.split('-').slice(1).join('.') || '02.05'}
              </div>
            </div>
          </div>

          <div className="flex -space-x-2 mt-1 shrink-0 flex-wrap justify-end max-w-[120px]">
            {members.map((m, idx) => (
              <div 
                key={m.id} 
                className={`w-7 h-7 rounded-full border-2 overflow-hidden shadow-sm -ml-2 first:ml-0 ${
                  user.profileTheme === 'handdrawn' ? 'border-[#4B3F35]/30' : 
                  user.profileTheme === 'scrapbook' ? 'border-white' :
                  'border-white bg-slate-100'
                }`}
                style={{ zIndex: members.length - idx }}
              >
                <img src={m.avatar} alt={m.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 min-h-0 overflow-hidden relative bg-transparent flex flex-col">
        {/* Migration Banner */}
        {hasLegacyData && (
          <div className="absolute top-4 left-6 right-6 z-50">
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-amber-50 border-2 border-amber-100 p-4 rounded-3xl shadow-xl flex items-center gap-4"
            >
              <div className="w-10 h-10 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 shrink-0">
                <AlertCircle size={20} />
              </div>
              <div className="flex-1">
                <p className="text-[11px] font-black text-amber-900 leading-tight">偵測到舊版行程資料</p>
                <button 
                  onClick={handleMigrateToCurrentTrip}
                  disabled={isMigrating}
                  className="mt-1.5 text-[10px] font-black text-amber-600 underline flex items-center gap-1"
                >
                  {isMigrating ? <Loader2 size={10} className="animate-spin" /> : '立即匯入到此旅程'}
                </button>
              </div>
              <button 
                onClick={() => setHasLegacyData(false)}
                className="text-amber-300 hover:text-amber-400"
              >
                <Settings size={14} />
              </button>
            </motion.div>
          </div>
        )}
        
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="flex-1 min-h-0 flex flex-col overflow-hidden"
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <div className={`fixed bottom-0 left-0 right-0 max-w-[390px] mx-auto ${user.profileTheme === 'handdrawn' || user.profileTheme === 'scrapbook' ? 'px-6 pb-2' : 'px-6 pb-[env(safe-area-inset-bottom,16px)]'} pt-2 z-[60]`}>
        <nav className={`
          ${user.profileTheme === 'handdrawn' || user.profileTheme === 'scrapbook' ? 'border-2 border-[#4B3F35]/10 bg-white shadow-[4px_4px_0_0_rgba(75,63,53,0.04)] rounded-none flex' : 
            'bg-white/90 backdrop-blur-md rounded-[24px] shadow-nav border border-slate-100/50 flex'} 
          p-0 overflow-hidden justify-between items-stretch
        `}>
          <NavButton active={activeTab === Tab.SCHEDULE} onClick={() => setActiveTab(Tab.SCHEDULE)} icon={Calendar} label="行程" theme={user.profileTheme} />
          {user.profileTheme === 'scrapbook' || user.profileTheme === 'handdrawn' ? <div className="w-px bg-[#4B3F35]/20" /> : null}
          <NavButton active={activeTab === Tab.EXPENSE} onClick={() => setActiveTab(Tab.EXPENSE)} icon={CircleDollarSign} label="記帳" theme={user.profileTheme} />
          {user.profileTheme === 'scrapbook' || user.profileTheme === 'handdrawn' ? <div className="w-px bg-[#4B3F35]/20" /> : null}
          <NavButton active={activeTab === Tab.PLANNING} onClick={() => setActiveTab(Tab.PLANNING)} icon={ShoppingBag} label="購物" theme={user.profileTheme} />
          {user.profileTheme === 'scrapbook' || user.profileTheme === 'handdrawn' ? <div className="w-px bg-[#4B3F35]/20" /> : null}
          <NavButton active={activeTab === Tab.JOURNAL} onClick={() => setActiveTab(Tab.JOURNAL)} icon={BookOpen} label="日誌" theme={user.profileTheme} />
        </nav>
      </div>

      {/* Image Cropper Modal */}
      <AnimatePresence>
        {imageToCrop && (
          <div className="fixed inset-0 z-[300] bg-black flex flex-col">
            <div className="relative flex-1">
              <Cropper
                image={imageToCrop}
                crop={crop}
                zoom={zoom}
                aspect={16 / 9}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>
            <div className="bg-slate-900 p-6 pb-10 flex flex-col gap-6">
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">縮放</span>
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  aria-labelledby="Zoom"
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="flex-1 accent-sky-400"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setImageToCrop(null)}
                  className="flex-1 py-4 bg-white/10 text-white rounded-2xl font-black text-sm active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <X size={18} /> 取消
                </button>
                <button
                  onClick={handleCropSave}
                  disabled={isCropping}
                  className="flex-[2] py-4 bg-sky-500 text-white rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {isCropping ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} 
                  確認裁切
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showClaimModal && (
          <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-white w-full max-w-sm rounded-[32px] p-8 shadow-2xl border border-slate-100"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <UserCheck size={32} style={{ color: 'var(--brand-color)' }} />
                </div>
                <h2 className="text-xl font-black text-slate-800 mb-2 tracking-tight">認領您的旅伴身份</h2>
                <p className="text-slate-400 text-xs font-bold leading-relaxed">
                  歡迎加入旅程！請選擇您在這次旅行中的身份，系統將自動同步您的相關資料。
                </p>
              </div>

              <div className="space-y-3 max-h-[320px] overflow-y-auto no-scrollbar pr-1">
                {members.filter(m => m.id.startsWith('m')).map(m => (
                  <button
                    key={m.id}
                    disabled={isClaiming}
                    onClick={() => handleClaimIdentity(m.id)}
                    className="w-full flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 transition-all group active:scale-[0.98]"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(var(--brand-color-rgb), 0.05)';
                      e.currentTarget.style.borderColor = 'rgba(var(--brand-color-rgb), 0.2)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#F8FAFC';
                      e.currentTarget.style.borderColor = '#F1F5F9';
                    }}
                  >
                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-sm shrink-0">
                      <img src={m.avatar} alt={m.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="text-left flex-1">
                      <div className="text-sm font-black text-slate-700 group-hover:text-sky-500 transition-colors">{m.name}</div>
                      <div className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">點擊認領此身份</div>
                    </div>
                    {isClaiming ? (
                      <Loader2 size={16} className="animate-spin" style={{ color: 'var(--brand-color)' }} />
                    ) : (
                      <Plus size={16} className="text-slate-200 group-hover:text-sky-400" />
                    )}
                  </button>
                ))}
              </div>

              <div className="pt-4 border-t border-slate-50 mt-4">
                <button
                  disabled={isClaiming}
                  onClick={() => handleClaimIdentity('new')}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={16} /> 我是新成員
                </button>
              </div>

              {isClaiming && (
                <div className="mt-6 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest animate-pulse" style={{ color: 'var(--brand-color)' }}>
                  <Loader2 size={12} className="animate-spin" />
                  正在同步資料中...
                </div>
              )}
            </motion.div>
          </div>
        )}

        {isSettingsOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-[390px] bg-white rounded-[40px] p-8 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black text-slate-800">旅程設定</h2>
                <button onClick={exportToExcel} className="p-2 rounded-xl transition-colors" style={{ backgroundColor: 'rgba(var(--brand-color-rgb), 0.1)', color: 'var(--brand-color)' }}>
                  <FileSpreadsheet size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="flex bg-white/50 border border-slate-100 p-4 rounded-3xl items-center justify-between group hov:bg-white transition-all cursor-pointer" onClick={() => setIsQrModalOpen(true)}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-500 flex items-center justify-center">
                      <Share2 size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-700">QR Code 分享</p>
                      <p className="text-[10px] font-bold text-slate-400">讓旅伴掃描快速加入</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-300 group-hover:translate-x-1 transition-transform" />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1 mb-3 block">旅程資訊</label>
                  <div className="space-y-3">
                    <div className={`${user.profileTheme === 'handdrawn' ? 'p-3' : 'bg-slate-50 p-3 rounded-2xl border border-slate-100'}`}>
                      <label className="text-[8px] font-black text-slate-300 uppercase mb-1 block">旅程名稱</label>
                      <input 
                        type="text" 
                        value={editName} 
                        onChange={(e) => handleUpdateTripInfo('name', e.target.value)}
                        className="w-full bg-transparent border-none outline-none font-bold text-slate-700 text-sm"
                      />
                    </div>
                    <div className={`${user.profileTheme === 'handdrawn' ? 'p-3' : 'bg-slate-50 p-3 rounded-2xl border border-slate-100'}`}>
                      <label className="text-[8px] font-black text-slate-300 uppercase mb-1 block">小標 (標籤)</label>
                      <input 
                        type="text" 
                        value={editSubtitle} 
                        onChange={(e) => handleUpdateTripInfo('subtitle', e.target.value)}
                        placeholder="例如：時光膠囊"
                        className="w-full bg-transparent border-none outline-none font-bold text-slate-700 text-sm"
                      />
                    </div>
                    <div className={`${user.profileTheme === 'handdrawn' ? 'p-3' : 'bg-slate-50 p-3 rounded-2xl border border-slate-100'}`}>
                      <label className="text-[8px] font-black text-slate-300 uppercase mb-1 block">目的地城市 (以+分隔)</label>
                      <input 
                        type="text" 
                        value={editCity} 
                        onChange={(e) => handleUpdateTripInfo('city', e.target.value)}
                        placeholder="例如：首爾+釜山"
                        className="w-full bg-transparent border-none outline-none font-bold text-slate-700 text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className={`${user.profileTheme === 'handdrawn' ? 'p-3' : 'bg-slate-50 p-3 rounded-2xl border border-slate-100'}`}>
                        <label className="text-[8px] font-black text-slate-300 uppercase mb-1 block">開始日期</label>
                        <input 
                          type="date" 
                          value={editStartDate} 
                          onChange={(e) => handleUpdateTripInfo('startDate', e.target.value)}
                          className="w-full bg-transparent border-none outline-none font-bold text-slate-700 text-sm"
                        />
                      </div>
                      <div className={`${user.profileTheme === 'handdrawn' ? 'p-3' : 'bg-slate-50 p-3 rounded-2xl border border-slate-100'}`}>
                        <label className="text-[8px] font-black text-slate-300 uppercase mb-1 block">結束日期</label>
                        <input 
                          type="date" 
                          value={editEndDate} 
                          onChange={(e) => handleUpdateTripInfo('endDate', e.target.value)}
                          className="w-full bg-transparent border-none outline-none font-bold text-slate-700 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1 block">封面圖片</label>
                    <label className="text-[10px] font-black text-sky-500 uppercase tracking-widest cursor-pointer flex items-center gap-1">
                      <ImageIcon size={12} /> 更換封面
                      <input type="file" className="hidden" onChange={handleTripCoverChange} accept="image/*" />
                    </label>
                  </div>
                  <div className="h-32 rounded-3xl overflow-hidden border-2 border-slate-50 shadow-inner">
                    <img src={trip?.coverImage} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1 block">成員名單</label>
                    <button 
                      onClick={() => setIsAddMemberModalOpen(true)} 
                      className="text-[10px] font-black text-sky-500 uppercase tracking-widest flex items-center gap-1"
                    >
                      <UserPlus size={12} /> 新增成員
                    </button>
                  </div>
                  <div className="space-y-3">
                    {members.map(m => (
                      <div key={m.id} className={`flex items-center gap-4 p-3 ${user.profileTheme === 'handdrawn' ? '' : 'bg-slate-50 rounded-2xl border border-slate-100'}`}>
                        <div className="relative group">
                          <img src={m.avatar} alt={m.name} className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm" />
                          <label className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                            <Download size={14} className="text-white" />
                            <input type="file" className="hidden" onChange={(e) => handleMemberAvatarChange(m.id, e)} accept="image/*" />
                          </label>
                        </div>
                        <MemberNameInput member={m} onUpdate={handleUpdateMemberName} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-10 flex flex-col gap-3">
                <button 
                  onClick={() => setIsDeleteTripModalOpen(true)}
                  className="w-full py-4 bg-rose-50 text-rose-500 rounded-2xl font-black text-sm active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 size={18} /> 刪除旅程
                </button>
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-all"
                >
                  完成設定
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Member Modal */}
      <AnimatePresence>
        {isAddMemberModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddMemberModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-xs bg-white rounded-[32px] p-8 shadow-2xl"
            >
              <h3 className="text-xl font-black text-slate-800 mb-6 font-sans">新增成員 ✨</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1 mb-1 block">成員名稱</label>
                  <input 
                    type="text" 
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    placeholder="請輸入成員名稱"
                    className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold border-none outline-none focus:ring-2 focus:ring-sky-500/20 transition-all font-sans"
                    autoFocus
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => setIsAddMemberModalOpen(false)}
                    className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs active:scale-95 transition-all"
                  >
                    取消
                  </button>
                  <button 
                    onClick={handleAddMember}
                    className="flex-1 py-4 bg-sky-500 text-white rounded-2xl font-black text-xs shadow-lg shadow-sky-100 active:scale-95 transition-all"
                  >
                    加入
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteTripModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDeleteTripModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-xs bg-white rounded-[32px] p-8 shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-500">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2 font-sans">刪除旅程？</h3>
              <p className="text-slate-400 text-xs font-bold mb-8 leading-relaxed font-sans">
                確定要刪除旅程嗎？此動作無法復原，所有資料將會消失。
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsDeleteTripModalOpen(false)}
                  className="flex-1 py-3.5 rounded-2xl bg-slate-100 text-slate-500 text-xs font-black active:scale-95 transition-all"
                >
                  取消
                </button>
                <button 
                  onClick={async () => {
                    try {
                      await deleteDoc(doc(db, 'trips', tripId));
                      navigate('/');
                    } catch (err) {
                      console.error("Delete failed:", err);
                      alert("刪除失敗");
                    }
                  }}
                  className="flex-1 py-3.5 rounded-2xl bg-rose-500 text-white text-xs font-black shadow-lg shadow-rose-100 active:scale-95 transition-all"
                >
                  確定刪除
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* QR Code Modal */}
      <AnimatePresence>
        {isQrModalOpen && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsQrModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-xs bg-white rounded-[40px] p-8 shadow-2xl overflow-hidden flex flex-col items-center"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-sky-400 to-indigo-400" />
              
              <button 
                onClick={() => setIsQrModalOpen(false)}
                className="absolute top-4 right-4 p-2 bg-slate-50 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={16} strokeWidth={3} />
              </button>

              <div className="mb-6 text-center">
                <h3 className="text-lg font-black text-slate-800 mb-1">掃描加入旅程</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{trip?.name}</p>
              </div>

              <div className="bg-white p-6 rounded-[32px] shadow-soft border border-slate-50 mb-8">
                <QRCodeSVG 
                  value={`${window.location.origin}?tripId=${tripId}`}
                  size={180}
                  level="H"
                  includeMargin={false}
                  imageSettings={{
                    src: "/trippic.png",
                    x: undefined,
                    y: undefined,
                    height: 30,
                    width: 30,
                    excavate: true,
                  }}
                />
              </div>

              <button 
                onClick={() => {
                  const url = `${window.location.origin}?tripId=${tripId}`;
                  copyToClipboard(url);
                  setIsQrModalOpen(false);
                }}
                className="w-full py-4 bg-sky-500 text-white rounded-2xl font-black text-sm shadow-lg shadow-sky-100 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Check size={18} /> {isCopied ? '已複製連結' : '複製邀請連結'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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

const MemberNameInput = ({ member, onUpdate }: { member: Member, onUpdate: (id: string, name: string) => void }) => {
  const [localName, setLocalName] = useState(member.name);
  
  useEffect(() => {
    setLocalName(member.name);
  }, [member.name]);

  return (
    <input 
      type="text" 
      value={localName} 
      onChange={(e) => setLocalName(e.target.value)}
      onBlur={() => {
        if (localName !== member.name) {
          onUpdate(member.id, localName);
        }
      }}
      className="flex-1 bg-transparent border-none outline-none font-bold text-slate-700 text-sm"
    />
  );
};

const NavButton: React.FC<NavButtonProps> = ({ active, onClick, icon: Icon, label, theme }) => {
  const isHanddrawn = theme === 'handdrawn' || theme === 'scrapbook';
  
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
    <button onClick={onClick} className="flex flex-col items-center justify-center flex-1 py-2 group relative">
      <div className={`transition-all duration-300 flex items-center justify-center w-8 h-8 ${active ? 'scale-110' : 'text-slate-300 group-active:scale-90'}`} style={{ color: active ? 'var(--brand-color)' : undefined }}>
        <Icon size={20} strokeWidth={active ? 2.5 : 2} />
      </div>
      <span className={`text-[9px] font-black mt-0.5 transition-colors duration-300 ${active ? '' : 'text-slate-300'}`} style={{ color: active ? 'var(--brand-color)' : undefined }}>
        {label}
      </span>
      {active && (
        <motion.div layoutId="nav-active" className="absolute -bottom-1 w-1 h-1 rounded-full" style={{ backgroundColor: 'var(--brand-color)' }} />
      )}
    </button>
  );
};
