
import React, { useEffect, useState } from 'react';
import { UserProfile, Trip } from '../types';
import { Settings, Bell, Moon, LogOut, ChevronRight, Award, Calendar, MapPin, Github, Pencil, X, Image as ImageIcon, Loader2, Check, Scissors, Wallet, Clock, Heart, Star, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { logout } from '../services/firebase';
import { doc, updateDoc, collection, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import Cropper from 'react-easy-crop';
import { useCallback } from 'react';

interface ProfileViewProps {
  user: UserProfile;
  trips: Trip[];
}

export const ProfileView: React.FC<ProfileViewProps> = ({ user, trips }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [githubUser, setGithubUser] = useState<any>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [editName, setEditName] = useState(user.displayName);
  const [editPhoto, setEditPhoto] = useState(user.photoURL || '');
  const [editMotto, setEditMotto] = useState(user.motto || '');
  const [editLocation, setEditLocation] = useState(user.location || '');
  const [editInterests, setEditInterests] = useState(user.interests?.join('、') || '');
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [annualSpending, setAnnualSpending] = useState(0);
  const [topCityStat, setTopCityStat] = useState("尚未設定");

  useEffect(() => {
    const currentYear = new Date().getFullYear();
    const annualTrips = trips.filter(t => {
      const tripDate = new Date(t.startDate);
      return tripDate.getFullYear() === currentYear;
    });
    
    // Calculate top city (Most visited destination)
    const cityCounts: Record<string, number> = {};
    trips.forEach(t => {
      if (t.city) {
        cityCounts[t.city] = (cityCounts[t.city] || 0) + 1;
      }
    });
    const sortedCities = Object.entries(cityCounts).sort((a, b) => b[1] - a[1]);
    if (sortedCities.length > 0) {
      setTopCityStat(sortedCities[0][0]);
    }

    // Calculate annual spending (only for current user)
    const fetchSpending = async () => {
      let total = 0;
      try {
        const currentYear = new Date().getFullYear();
        const annualTrips = trips.filter(t => {
          const tripDate = new Date(t.startDate);
          return tripDate.getFullYear() === currentYear;
        });

        const spendingResults = await Promise.all(annualTrips.map(async (trip) => {
          let tripTotal = 0;
          
          // Fetch exchange rate for this trip
          const settingsSnap = await getDoc(doc(db, 'trips', trip.id, 'config', 'settings'));
          const exchangeRate = settingsSnap.exists() ? settingsSnap.data().exchangeRate || 0.0245 : 0.0245;

          const expensesSnap = await getDocs(collection(db, 'trips', trip.id, 'expenses'));
          expensesSnap.forEach(doc => {
            const exp = doc.data();
            const splitIds = exp.splitWithIds || [];
            
            // Calculate my share for this expense
            if (splitIds.includes(user.uid)) {
              let myShare = 0;
              const currentTWD = exp.currency === 'KRW' ? Math.round(exp.amountKRW * exchangeRate) : exp.amountTWD;
              
              if (exp.customSplits && exp.customSplits[user.uid] !== undefined) {
                myShare = exp.currency === 'KRW' ? exp.customSplits[user.uid] * exchangeRate : exp.customSplits[user.uid];
              } else {
                myShare = splitIds.length > 0 ? currentTWD / splitIds.length : 0;
              }
              tripTotal += myShare;
            }
          });
          return tripTotal;
        }));
        
        total = spendingResults.reduce((acc, curr) => acc + curr, 0);
        setAnnualSpending(Math.round(total));
      } catch (err) {
        console.error("Failed to fetch annual spending:", err);
      }
    };
    fetchSpending();
  }, [trips, user.uid]);

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
      // Further compress to ensure it's small
      const finalImage = await compressImage(croppedImage, 400, 400, 0.7);
      setEditPhoto(finalImage);
      setImageToCrop(null);
    } catch (err) {
      console.error("Crop failed:", err);
    } finally {
      setIsCropping(false);
    }
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Initial check for very large files to save processing
    if (file.size > 5 * 1024 * 1024) { 
      alert('圖片太大囉！請選擇小於 5MB 的圖片。');
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      setImageToCrop(reader.result as string);
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleProfileThemeSelect = async (themeId: 'minimalist' | 'hipster' | 'scrapbook') => {
    const updates: any = { profileTheme: themeId };
    
    // Automatically set a suitable color based on theme
    if (themeId === 'hipster') {
      updates.themeColor = '#8BA88E'; // Morandi Green
    } else if (themeId === 'scrapbook') {
      updates.themeColor = '#8B5E3C'; // Hand-drawn Brown
    } else {
      updates.themeColor = '#3D74B6'; // Classic Blue
    }

    await updateDoc(doc(db, 'users', user.uid), updates);
  };

  const profileThemes = [
    { id: 'minimalist', name: '極簡風', icon: '✨' },
    { id: 'hipster', name: '文青風', icon: '🌿' },
    { id: 'scrapbook', name: '手繪風', icon: '🎨' },
  ] as const;

  const themeColors = [
    { name: '經典藍', value: '#3D74B6' },
    { name: '莫蘭迪灰', value: '#94A3B8' },
    { name: '莫蘭迪灰綠', value: '#8BA88E' },
    { name: '莫蘭迪粉', value: '#C9A9A6' },
    { name: '莫蘭迪藍', value: '#7D9BB0' },
    { name: '莫蘭迪紫', value: '#A696C1' },
    { name: '珊瑚紅', value: '#F43F5E' },
    { name: '翡翠綠', value: '#10B981' },
    { name: '暖陽黃', value: '#F59E0B' },
    { name: '手繪粉', value: '#FFB7B2' },
    { name: '手繪棕', value: '#8B5E3C' },
    { name: '手繪綠', value: '#6B8E23' },
    { name: '手繪藍', value: '#4682B4' },
  ];

  const getThemeStyles = () => {
    switch (user.profileTheme) {
      case 'hipster':
        return {
          container: 'bg-[#FDFCF8]',
          header: 'bg-[#FDFCF8] border-b border-stone-100',
          card: 'bg-white rounded-none border border-stone-100 shadow-sm',
          font: 'font-hipster',
          accent: 'text-stone-400',
          badge: 'bg-stone-50 text-stone-500 border border-stone-100 rounded-full px-2 py-0.5 text-[10px]',
          brandColor: '#A89F91'
        };
      case 'scrapbook':
        return {
          container: 'bg-[#FDFCF8] paper-texture',
          header: 'bg-[#FDFCF8] border-b border-stone-200/50',
          card: 'bg-white border border-stone-200/60 shadow-sm',
          font: 'font-handdrawn',
          accent: 'text-stone-500',
          badge: 'bg-stone-100 text-stone-600 border border-stone-200 rounded-md px-2 py-0.5 text-[9px]',
          brandColor: '#D4A373'
        };
      case 'minimalist':
      default:
        return {
          container: 'bg-white',
          header: 'bg-white border-b border-slate-100',
          card: 'bg-slate-50/50 rounded-3xl border border-slate-100',
          font: 'font-sans',
          accent: 'text-slate-400',
          badge: 'bg-white text-slate-500 border border-slate-200 rounded-md px-2 py-0.5 text-[9px]'
        };
    }
  };

  const styles = getThemeStyles();

  const handleUpdateProfile = async () => {
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: editName,
        photoURL: editPhoto,
        motto: editMotto,
        location: editLocation,
        interests: editInterests.split(/[、,，\s]+/).filter(Boolean)
      });
      setIsEditingProfile(false);
    } catch (err) {
      console.error('Failed to update profile:', err);
    }
  };

  const handleColorSelect = async (color: string) => {
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        themeColor: color
      });
    } catch (err) {
      console.error('Failed to update theme color:', err);
    }
  };

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data?.provider === 'github') {
        const ghData = event.data.user;
        setGithubUser(ghData);
        
        try {
          await updateDoc(doc(db, 'users', user.uid), {
            githubId: ghData.id,
            githubUsername: ghData.login,
            githubUrl: ghData.html_url
          });
          alert(`成功連結 GitHub 帳號: ${ghData.login}`);
        } catch (err) {
          console.error('Failed to save GitHub info:', err);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [user.uid]);

  const handleConnectGithub = async () => {
    setIsConnecting(true);
    try {
      const response = await fetch('/api/auth/github/url');
      const { url } = await response.json();
      
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      window.open(
        url,
        'github_oauth',
        `width=${width},height=${height},left=${left},top=${top}`
      );
    } catch (err) {
      console.error('Failed to initiate GitHub OAuth:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  const completedTrips = trips.filter(t => new Date(t.endDate) < new Date()).length;
  const totalDays = trips.reduce((acc, t) => {
    const start = new Date(t.startDate);
    const end = new Date(t.endDate);
    return acc + Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }, 0);
  
  const cityCounts: Record<string, number> = {};
  trips.forEach(t => {
    if (t.city) {
      cityCounts[t.city] = (cityCounts[t.city] || 0) + 1;
    }
  });
  const sortedCities = Object.entries(cityCounts).sort((a, b) => b[1] - a[1]);
  const topCity = sortedCities.length > 0 ? sortedCities[0][0] : "尚未設定";

  return (
    <div className={`flex-1 overflow-y-auto no-scrollbar ${styles.container} ${styles.font}`}>
      {user.profileTheme === 'scrapbook' ? (
        /* Scrapbook Profile (Matching user image) */
        <div className="px-6 pt-12 pb-6 space-y-6 flex flex-col items-center">
          {/* Main Profile Card */}
          <div className="w-full bg-white border border-stone-200/60 shadow-[5px_5px_15px_rgba(0,0,0,0.05)] p-6 relative">
            {/* Pink Heart Sticker */}
            <div className="absolute top-4 right-4 text-rose-300/80 rotate-12 z-10">
              <Heart size={20} fill="currentColor" />
            </div>
            {/* Blue Doodle Sticker */}
            <div className="absolute bottom-4 right-8 text-sky-200/60 rotate-[-15deg] z-10">
              <Sparkles size={24} />
            </div>
            {/* Top Washi Tape */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-20 h-6 washi-tape-grid bg-amber-100/60 border-x border-amber-200/20 shadow-sm z-20" />

            <div className="flex items-center gap-6">
              {/* Polaroid Avatar */}
              <div className="relative shrink-0">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-12 h-4 washi-tape-grid bg-stone-200/50 rotate-[-2deg] z-20" />
                <div className="w-28 h-36 bg-white p-2 pb-8 shadow-md rotate-[-1deg] border border-stone-100 relative">
                  <img 
                    src={user.photoURL || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + user.uid} 
                    alt="" 
                    className="w-full h-full object-cover grayscale-[0.1]" 
                  />
                  <button 
                    onClick={() => setIsEditingProfile(true)} 
                    className="absolute bottom-1 right-1 p-1 bg-stone-800 rounded-sm text-white shadow-sm"
                  >
                    <Pencil size={8} />
                  </button>
                </div>
              </div>

              {/* Name & Motto */}
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-handdrawn text-stone-700 font-black mb-2">{user.displayName}</h1>
                <p className="text-xs text-stone-500 font-handdrawn leading-relaxed">
                  「{user.motto || '慢行，是最美的風景'}」
                </p>
              </div>
            </div>
          </div>

          {/* Sticky Note Stats */}
          <div className="w-full grid grid-cols-2 gap-4 font-handdrawn">
            <div className="bg-[#FEF9C3] p-4 pt-6 shadow-sm rotate-[-1deg] relative border border-stone-300">
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-12 h-4 washi-tape-grid bg-amber-200/40 rotate-1" />
              <div className="flex flex-col items-center">
                <Award size={18} className="text-amber-500 mb-1" />
                <div className="text-lg font-black text-stone-700">{completedTrips}</div>
                <div className="text-[8px] uppercase tracking-widest text-stone-500">已完成旅程</div>
              </div>
            </div>
            <div className="bg-[#DBEAFE] p-4 pt-6 shadow-sm rotate-[1deg] relative border border-stone-300">
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-12 h-4 washi-tape-grid bg-sky-200/40 rotate-[-1deg]" />
              <div className="flex flex-col items-center">
                <Calendar size={18} className="text-sky-500 mb-1" />
                <div className="text-lg font-black text-stone-700">{totalDays}</div>
                <div className="text-[8px] uppercase tracking-widest text-stone-500">累積天數</div>
              </div>
            </div>
            <div className="bg-[#FCE7F3] p-4 pt-6 shadow-sm rotate-[1.5deg] relative border border-stone-300">
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-12 h-4 washi-tape-grid bg-pink-200/40 rotate-[-2deg]" />
              <div className="flex flex-col items-center">
                <MapPin size={18} className="text-pink-500 mb-1" />
                <div className="text-sm font-black text-stone-700 truncate w-full text-center">{topCity}</div>
                <div className="text-[8px] uppercase tracking-widest text-stone-500">喜歡的城市</div>
              </div>
            </div>
            <div className="bg-[#DCFCE7] p-4 pt-6 shadow-sm rotate-[-1.5deg] relative border border-stone-300">
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-12 h-4 washi-tape-grid bg-emerald-200/40 rotate-[2deg]" />
              <div className="flex flex-col items-center">
                <Wallet size={18} className="text-emerald-500 mb-1" />
                <div className="text-sm font-black text-stone-700">${annualSpending.toLocaleString()}</div>
                <div className="text-[8px] uppercase tracking-widest text-stone-500">查看個人消費</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Personalized Business Card */}
          <div className="px-6 pt-12 pb-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`relative p-6 transition-all duration-500 ${styles.card} ${
                user.profileTheme === 'hipster' ? 'rotate-[-1deg] overflow-hidden' :
                user.profileTheme === 'handdrawn' ? 'rotate-[0.5deg] !p-6 !pb-8' :
                'overflow-hidden'
              }`}
            >
              {/* Theme Specific Decorations */}
              {user.profileTheme === 'hipster' && (
                <>
                  <div className="absolute -top-10 -left-10 w-40 h-40 bg-stone-100/30 rounded-full blur-3xl" />
                  <div className="absolute bottom-0 right-0 w-32 h-32 bg-stone-50/50 rounded-full blur-2xl" />
                  <div className="absolute top-4 right-6 text-stone-200/40 rotate-12 pointer-events-none">
                    <span className="text-4xl">🌿</span>
                  </div>
                  <div className="absolute bottom-4 left-6 text-stone-200/30 -rotate-12 pointer-events-none">
                    <span className="text-3xl">🍃</span>
                  </div>
                </>
              )}
              {user.profileTheme === 'handdrawn' && (
                <>
                  <div className="absolute top-4 right-6 text-rose-300/40 rotate-12"><Heart size={22} fill="currentColor" /></div>
                  <div className="absolute bottom-6 right-8 text-sky-300/30 rotate-6"><Sparkles size={20} /></div>
                </>
              )}
              
              <div className={`flex items-center gap-6 relative z-10 ${user.profileTheme === 'hipster' ? 'flex-col text-center' : 'flex-row'}`}>
                <div className="relative shrink-0">
                  {user.profileTheme === 'handdrawn' && (
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-16 h-6 washi-tape-grid bg-amber-200/60 rotate-[-2deg] z-20 border-x border-amber-300/20 shadow-sm" />
                  )}
                  <div className={`
                    ${user.profileTheme === 'hipster' ? 'w-28 h-28 rounded-full border border-stone-100 p-1 bg-white shadow-sm overflow-hidden' : 
                      user.profileTheme === 'handdrawn' ? 'w-36 h-40 rounded-none border-[1.5px] border-[#4B3F35]/10 p-2 pb-14 bg-white shadow-[4px_4px_15px_rgba(0,0,0,0.05)] overflow-hidden rotate-[-2deg]' :
                      'w-20 h-20 rounded-3xl p-0.5 bg-gradient-to-br from-sky-100 to-indigo-100 shadow-inner overflow-hidden'}
                  `}>
                    <img 
                      src={user.photoURL || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + user.uid} 
                      alt={user.displayName} 
                      className={`${user.profileTheme === 'hipster' ? 'w-full h-full rounded-full object-cover' : user.profileTheme === 'handdrawn' ? 'w-full h-full object-cover border border-[#4B3F35]/5' : 'w-full h-full rounded-none object-cover'}`}
                    />
                  </div>
                  <button 
                    onClick={() => setIsEditingProfile(true)}
                    className={`absolute -bottom-1 -right-1 p-1.5 shadow-lg text-white border-2 border-white active:scale-95 transition-all z-30 ${user.profileTheme === 'handdrawn' ? 'rounded-none' : 'rounded-full'}`} 
                    style={{ backgroundColor: user.profileTheme === 'handdrawn' ? '#4B3F35' : 'var(--brand-color)' }}
                  >
                    <Pencil size={10} />
                  </button>
                </div>
                
                <div className={`flex-1 min-w-0 ${user.profileTheme === 'hipster' ? 'w-full mt-2' : ''}`}>
                  <div className={`flex items-center gap-2 ${user.profileTheme === 'handdrawn' ? 'justify-start pt-6' : user.profileTheme === 'hipster' ? 'justify-center' : 'justify-between'}`}>
                    <h1 className={`text-xl font-black tracking-tight truncate ${user.profileTheme === 'handdrawn' ? 'text-[#4B3F35] font-handdrawn' : user.profileTheme === 'hipster' ? 'text-stone-700 font-medium font-hipster' : 'text-slate-800'}`}>
                      {user.displayName}
                    </h1>
                  </div>
                  
                  {user.location && (
                    <div className={`flex items-center gap-1 mt-0.5 font-bold ${user.profileTheme === 'handdrawn' ? 'text-[#8B5E3C] text-[10px] justify-start font-handdrawn' : user.profileTheme === 'hipster' ? 'text-stone-400 text-[9px] justify-center font-hipster' : 'text-slate-400 text-[10px]'}`}>
                      <MapPin size={9} />
                      <span className={user.profileTheme === 'handdrawn' ? 'tracking-[0.1em]' : ''}>{user.location}</span>
                    </div>
                  )}
                  
                  <p className={`mt-2 text-[10px] font-medium leading-relaxed ${
                    user.profileTheme === 'hipster' ? 'text-stone-500 font-hipster' : 
                    user.profileTheme === 'handdrawn' ? 'text-[#4B3F35]/80 italic font-handdrawn' : 
                    'text-slate-500'
                  }`}>
                    「{user.motto || '慢行，是最美的風景'}」
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Stats Grid */}
          <div className="px-6 pb-8">
            <div className={`grid ${user.profileTheme === 'handdrawn' ? 'grid-cols-2 gap-4' : 'grid-cols-2 gap-3'}`}>
              <StatCard 
                icon={<Award size={18} className={user.profileTheme === 'handdrawn' ? 'text-amber-500' : 'text-sky-400'} />} 
                value={trips.length} 
                label={user.profileTheme === 'handdrawn' ? "ACHIEVEMENTS" : "已完成旅程"} 
                theme={user.profileTheme}
              />
              <StatCard 
                icon={<Calendar size={18} className={user.profileTheme === 'handdrawn' ? 'text-rose-400' : 'text-indigo-400'} />} 
                value={trips.filter(t => new Date(t.startDate) > new Date()).length} 
                label={user.profileTheme === 'handdrawn' ? "UPCOMING" : "累積天數"} 
                theme={user.profileTheme}
              />
              <StatCard 
                icon={<MapPin size={18} className={user.profileTheme === 'handdrawn' ? 'text-sky-400' : 'text-emerald-400'} />} 
                value={topCityStat} 
                label={user.profileTheme === 'handdrawn' ? "TOP CITY" : "常去城市"} 
                theme={user.profileTheme}
              />
              <StatCard 
                icon={<Wallet size={18} className={user.profileTheme === 'handdrawn' ? 'text-emerald-400' : 'text-rose-400'} />} 
                value={`$${annualSpending.toLocaleString()}`} 
                label={user.profileTheme === 'handdrawn' ? "SPENDING" : "個人消費"} 
                theme={user.profileTheme}
              />
            </div>
          </div>
        </>
      )}

      {/* Settings Section */}
      <div className="px-6 mt-2 pb-32">
        <div className={`${
          user.profileTheme === 'scrapbook' ? 'space-y-4' :
          'rounded-[24px] shadow-soft overflow-hidden bg-white border border-slate-50'
        }`}>
          {/* Theme Style Picker (Moved back here) */}
          <div className={`${
            user.profileTheme === 'scrapbook' ? 'bg-white border border-stone-200/60 shadow-sm' :
            `border-b ${user.profileTheme === 'handdrawn' ? 'border-slate-50' : 'border-slate-50'}`
          }`}>
            <button 
              onClick={() => setShowThemePicker(!showThemePicker)}
              className={`w-full flex items-center gap-3 p-4 transition-colors ${
                user.profileTheme === 'scrapbook' ? 'hover:bg-stone-50' :
                'hover:bg-slate-50'
              }`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                user.profileTheme === 'scrapbook' ? 'bg-stone-100 text-stone-500' :
                'bg-slate-50 text-amber-500'
              }`}>
                <Award size={16} />
              </div>
              <div className="flex-1 text-left">
                <p className={`text-xs font-black ${
                  user.profileTheme === 'scrapbook' ? 'text-stone-700' :
                  'text-slate-800'
                }`}>頁面風格</p>
                <p className={`text-[9px] font-bold ${
                  user.profileTheme === 'scrapbook' ? 'text-stone-400' :
                  'text-slate-400'
                }`}>切換不同的視覺主題</p>
              </div>
              <span className={`text-xs font-bold mr-1 ${
                user.profileTheme === 'scrapbook' ? 'text-stone-400' :
                'text-slate-400'
              }`}>
                {profileThemes.find(t => t.id === (user.profileTheme || 'minimalist'))?.name}
              </span>
              <ChevronRight size={14} className={`${
                user.profileTheme === 'scrapbook' ? 'text-stone-300' :
                'text-slate-200'
              } transition-transform ${showThemePicker ? 'rotate-90' : ''}`} />
            </button>
            
            <AnimatePresence>
              {showThemePicker && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className={`overflow-hidden px-4 pb-4 bg-slate-50/50`}
                >
                  <div className="grid grid-cols-3 gap-3 pt-2">
                    {profileThemes.map((theme) => (
                      <button
                        key={theme.id}
                        onClick={() => handleProfileThemeSelect(theme.id)}
                        className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-all ${user.profileTheme === theme.id || (!user.profileTheme && theme.id === 'minimalist') ? 'bg-white shadow-sm ring-1 ring-slate-200' : 'hover:bg-white/50'}`}
                      >
                        <span className="text-xl">{theme.icon}</span>
                        <span className={`text-[10px] font-black text-slate-600`}>{theme.name}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Theme Color Picker */}
          <div className={`${
            user.profileTheme === 'scrapbook' ? 'bg-white border border-stone-200/60 shadow-sm' :
            `border-b ${user.profileTheme === 'handdrawn' ? 'border-[#93A1A1]' : 'border-slate-50'}`
          }`}>
            <button 
              onClick={() => setShowColorPicker(!showColorPicker)}
              className={`w-full flex items-center gap-3 p-4 transition-colors ${
                user.profileTheme === 'handdrawn' ? 'hover:bg-[#EEE8D5]' : 
                user.profileTheme === 'scrapbook' ? 'hover:bg-stone-50' :
                'hover:bg-slate-50'
              }`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                user.profileTheme === 'handdrawn' ? 'bg-[#EEE8D5] text-[#268BD2]' : 
                user.profileTheme === 'scrapbook' ? 'bg-stone-100 text-stone-500' :
                'bg-slate-50 text-indigo-400'
              }`}>
                <Moon size={16} />
              </div>
              <div className="flex-1 text-left">
                <p className={`text-xs font-black ${
                  user.profileTheme === 'handdrawn' ? 'text-[#586E75]' : 
                  user.profileTheme === 'scrapbook' ? 'text-stone-700' :
                  'text-slate-800'
                }`}>主題顏色</p>
                <p className={`text-[9px] font-bold ${
                  user.profileTheme === 'handdrawn' ? 'text-[#93A1A1]' : 
                  user.profileTheme === 'scrapbook' ? 'text-stone-400' :
                  'text-slate-400'
                }`}>自定義您的介面風格</p>
              </div>
              <div 
                className={`w-4 h-4 rounded-full border ${
                  user.profileTheme === 'handdrawn' ? 'border-[#93A1A1]' : 
                  user.profileTheme === 'scrapbook' ? 'border-stone-200' :
                  'border-slate-200'
                }`} 
                style={{ backgroundColor: user.themeColor || '#3D74B6' }}
              />
              <ChevronRight size={14} className={`${
                user.profileTheme === 'handdrawn' ? 'text-[#93A1A1]' : 
                user.profileTheme === 'scrapbook' ? 'text-stone-300' :
                'text-slate-200'
              } transition-transform ${showColorPicker ? 'rotate-90' : ''}`} />
            </button>
            
            <AnimatePresence>
              {showColorPicker && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className={`overflow-hidden px-4 pb-4 ${user.profileTheme === 'handdrawn' ? 'bg-[#EEE8D5]/30' : 'bg-slate-50/50'}`}
                >
                  <div className="grid grid-cols-4 gap-3 pt-2">
                    {themeColors.map((color) => (
                      <button
                        key={color.value}
                        onClick={() => handleColorSelect(color.value)}
                        className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all ${user.themeColor === color.value || (!user.themeColor && color.value === '#3D74B6') ? (user.profileTheme === 'handdrawn' ? 'bg-[#FFFBF0] shadow-sm ring-1 ring-[#93A1A1]' : 'bg-white shadow-sm ring-1') : 'hover:bg-white/50'}`}
                        style={{ ringColor: user.themeColor === color.value || (!user.themeColor && color.value === '#3D74B6') ? (user.profileTheme === 'handdrawn' ? '#93A1A1' : 'rgba(var(--brand-color-rgb), 0.2)') : undefined }}
                      >
                        <div 
                          className="w-6 h-6 rounded-full shadow-sm" 
                          style={{ backgroundColor: color.value }}
                        />
                        <span className={`text-[8px] font-bold ${user.profileTheme === 'handdrawn' ? 'text-[#586E75]' : 'text-slate-500'}`}>{color.name}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className={`${
            user.profileTheme === 'scrapbook' ? 'bg-white border border-stone-200/60 shadow-sm' : ''
          }`}>
            <SettingItem icon={<LogOut size={16} />} label="登出帳號" subLabel="安全退出系統" color="text-rose-400" onClick={logout} isLast theme={user.profileTheme} />
          </div>
        </div>
      </div>

      {/* Profile Edit Modal */}
      <AnimatePresence>
        {isEditingProfile && (
          <div className="fixed inset-0 z-[100] bg-black/30 backdrop-blur-sm flex items-center justify-center p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`bg-white w-full max-w-xs rounded-[32px] p-6 shadow-2xl ${styles.font}`}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-800">編輯個人資料</h3>
                <button onClick={() => setIsEditingProfile(false)} className="text-slate-300">
                  <X size={20} />
                </button>
              </div>
              
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 no-scrollbar">
                <div>
                  <label className={`text-[8px] font-black text-slate-300 uppercase tracking-widest block ml-1 mb-1 ${styles.font}`}>顯示名稱</label>
                  <input 
                    type="text" 
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className={`w-full p-3 bg-slate-50 rounded-2xl text-sm font-bold border-none outline-none focus:ring-1 ${styles.font}`}
                    style={{ outline: 'none' }}
                  />
                </div>
                <div>
                  <label className={`text-[8px] font-black text-slate-300 uppercase tracking-widest block ml-1 mb-1 ${styles.font}`}>旅行座右銘</label>
                  <input 
                    type="text" 
                    value={editMotto}
                    onChange={e => setEditMotto(e.target.value)}
                    placeholder="例如：慢行，是最美的風景"
                    className={`w-full p-3 bg-slate-50 rounded-2xl text-sm font-bold border-none outline-none focus:ring-1 ${styles.font}`}
                    style={{ outline: 'none' }}
                  />
                </div>
                <div>
                  <label className={`text-[8px] font-black text-slate-300 uppercase tracking-widest block ml-1 mb-1 ${styles.font}`}>所在地</label>
                  <input 
                    type="text" 
                    value={editLocation}
                    onChange={e => setEditLocation(e.target.value)}
                    placeholder="例如：台北, 台灣"
                    className={`w-full p-3 bg-slate-50 rounded-2xl text-sm font-bold border-none outline-none focus:ring-1 ${styles.font}`}
                    style={{ outline: 'none' }}
                  />
                </div>
                <div>
                  <label className={`text-[8px] font-black text-slate-300 uppercase tracking-widest block ml-1 mb-1 ${styles.font}`}>興趣標籤 (以頓號或空格分隔)</label>
                  <input 
                    type="text" 
                    value={editInterests}
                    onChange={e => setEditInterests(e.target.value)}
                    placeholder="例如：咖啡、攝影、老街散步"
                    className={`w-full p-3 bg-slate-50 rounded-2xl text-sm font-bold border-none outline-none focus:ring-1 ${styles.font}`}
                    style={{ outline: 'none' }}
                  />
                </div>
                <div>
                  <label className={`text-[8px] font-black text-slate-300 uppercase tracking-widest block ml-1 mb-1 ${styles.font}`}>大頭貼</label>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 overflow-hidden flex-shrink-0">
                      {isUploading ? (
                        <div className="w-full h-full flex items-center justify-center">
                          <Loader2 size={16} className="animate-spin text-slate-300" />
                        </div>
                      ) : (
                        <img src={editPhoto || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + user.uid} className="w-full h-full object-cover" />
                      )}
                    </div>
                    <label className={`flex-1 flex items-center justify-center gap-2 p-3 bg-slate-50 rounded-2xl text-xs font-bold text-slate-500 cursor-pointer hover:bg-slate-100 transition-all ${styles.font}`}>
                      <ImageIcon size={14} />
                      <span>上傳照片</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </label>
                  </div>
                  <input 
                    type="text" 
                    value={editPhoto}
                    onChange={e => setEditPhoto(e.target.value)}
                    placeholder="或輸入圖片網址..."
                    className={`w-full p-3 bg-slate-50 rounded-2xl text-[10px] font-bold border-none outline-none focus:ring-1 mt-2 ${styles.font}`}
                    style={{ outline: 'none' }}
                  />
                </div>
              </div>

              <button 
                onClick={handleUpdateProfile}
                className={`w-full py-4 text-white text-sm font-black rounded-2xl shadow-lg active:scale-95 transition-all mt-6 ${styles.font}`}
                style={{ backgroundColor: 'var(--brand-color)', color: 'var(--brand-text)' }}
              >
                儲存修改
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Image Cropper Modal */}
      <AnimatePresence>
        {imageToCrop && (
          <div className="fixed inset-0 z-[300] bg-black flex flex-col">
            <div className="relative flex-1">
              <Cropper
                image={imageToCrop}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
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
    </div>
  );
};

const StatCard: React.FC<{ icon: React.ReactNode, value: string | number, label: string, theme?: string }> = ({ icon, value, label, theme }) => {
  const getCardStyle = () => {
    switch (theme) {
      case 'hipster':
        const isPurple = label.includes('消費') || label.includes('城市');
        return `${isPurple ? 'bg-stone-50/50' : 'bg-white'} rounded-none border border-stone-100 shadow-sm font-hipster`;
      case 'handdrawn':
        const rotations = ['rotate-[-1.2deg]', 'rotate-[1deg]', 'rotate-[-0.5deg]', 'rotate-[1.2deg]'];
        const colors = ['bg-[#FEF9C3]', 'bg-[#FFEDD5]', 'bg-[#DBEAFE]', 'bg-[#F3E8FF]'];
        const randomIndex = Math.abs(label.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 4;
        
        let finalColor = colors[randomIndex];
        if (label.includes('旅程') || label.includes('成就')) finalColor = 'bg-[#FEF9C3]'; // Yellow
        if (label.includes('行程') || label.includes('天數')) finalColor = 'bg-[#DBEAFE]'; // Blue
        if (label.includes('城市')) finalColor = 'bg-[#FFEDD5]'; // Orange
        if (label.includes('消費')) finalColor = 'bg-[#F3E8FF]'; // Purple
        
        return `${finalColor} rounded-none border-[1.2px] border-[#4B3F35]/15 shadow-[3px_3px_0_0_rgba(75,63,53,0.03)] font-handdrawn ${rotations[randomIndex]}`;
      case 'scrapbook':
        return 'bg-white border-2 border-stone-200 shadow-sm font-handdrawn';
      case 'minimalist':
      default:
        const isMinimalistPurple = label.includes('消費') || label.includes('城市');
        return `${isMinimalistPurple ? 'bg-indigo-50/50' : 'bg-[#F8FAFC]'} rounded-2xl border border-slate-100 font-sans`;
    }
  };

  return (
    <div className={`${getCardStyle()} p-3 pt-5 flex flex-col items-center text-center relative`}>
      {theme === 'handdrawn' && (
        <div className={`absolute -top-1 left-1/2 -translate-x-1/2 w-10 h-4 washi-tape-grid rotate-1 z-10 border-x border-black/5 shadow-sm ${
          label.includes('旅程') || label.includes('成就') ? 'bg-rose-300/40' : 
          label.includes('城市') ? 'bg-sky-300/40' : 
          label.includes('行程') || label.includes('天數') ? 'bg-amber-300/40' : 
          label.includes('消費') ? 'bg-emerald-300/40' : 'bg-slate-300/40'
        }`} />
      )}
      <div className="mb-1">{icon}</div>
      <div className={`text-sm font-black leading-none mb-1 ${theme === 'handdrawn' ? 'text-[#4B3F35]' : theme === 'watercolor' ? 'text-sky-900/70' : 'text-slate-800'}`}>{value}</div>
      <div className={`text-[8px] font-bold uppercase tracking-tighter ${theme === 'handdrawn' ? 'text-[#8B5E3C]' : theme === 'watercolor' ? 'text-sky-400/60' : 'text-slate-400'}`}>{label}</div>
    </div>
  );
};

const SettingItem: React.FC<{ icon: React.ReactNode, label: string, subLabel: string, color?: string, colorStyle?: React.CSSProperties, onClick?: () => void, isLast?: boolean, theme?: string }> = ({ icon, label, subLabel, color, colorStyle, onClick, isLast, theme }) => {
  const fontClass = theme === 'hipster' ? 'font-hipster' : theme === 'handdrawn' ? 'font-handdrawn' : 'font-sans';
  
  const getButtonClass = () => {
    if (theme === 'handdrawn') {
      return `w-full flex items-center gap-3 p-4 hover:bg-stone-50 transition-colors ${!isLast ? 'border-b border-[#4B3F35]/10' : ''} ${fontClass}`;
    }
    if (theme === 'scrapbook') {
      return `w-full flex items-center gap-3 p-4 hover:bg-stone-50 transition-colors ${!isLast ? 'border-b border-stone-200/30' : ''} ${fontClass}`;
    }
    return `w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors ${!isLast ? 'border-b border-slate-50' : ''} ${fontClass}`;
  };

  return (
    <button onClick={onClick} className={getButtonClass()}>
      <div className={`w-8 h-8 flex items-center justify-center ${color} ${theme === 'handdrawn' ? 'rounded-lg border border-[#4B3F35]/10 bg-stone-50' : theme === 'scrapbook' ? 'rounded-none border border-stone-200 bg-white' : 'rounded-xl bg-slate-50'}`} style={colorStyle}>
        {icon}
      </div>
      <div className="flex-1 text-left">
        <p className={`text-xs font-black ${theme === 'handdrawn' ? 'text-[#4B3F35]' : theme === 'watercolor' ? 'text-sky-900/70' : 'text-slate-800'}`}>{label}</p>
        <p className={`text-[9px] font-bold ${theme === 'handdrawn' ? 'text-[#8B5E3C]' : theme === 'watercolor' ? 'text-sky-400/60' : 'text-slate-400'}`}>{subLabel}</p>
      </div>
      <ChevronRight size={14} className={theme === 'handdrawn' ? 'text-[#4B3F35]' : theme === 'watercolor' ? 'text-sky-300' : 'text-slate-200'} />
    </button>
  );
};
