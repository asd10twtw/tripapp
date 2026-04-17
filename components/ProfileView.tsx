
import React, { useEffect, useState } from 'react';
import { UserProfile, Trip, Expense } from '../types';
import { Settings, Bell, Moon, LogOut, ChevronRight, Award, Calendar, MapPin, Github, Pencil, X, Image as ImageIcon, Loader2, Check, Scissors, Wallet, Clock, Heart, Star, Sparkles, Compass, Plane, Tent, Ticket, Camera, Footprints } from 'lucide-react';
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
  const [editInterests, setEditInterests] = useState(user.interests?.join('/') || '');
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [annualSpending, setAnnualSpending] = useState(0);
  const [topCityStat, setTopCityStat] = useState("尚未設定");
  const [totalTravelDays, setTotalTravelDays] = useState(0);

  useEffect(() => {
    // Calculate total travel days for all trips
    const days = trips.reduce((acc, trip) => {
      if (!trip.startDate || !trip.endDate) return acc;
      const start = new Date(trip.startDate);
      const end = new Date(trip.endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return acc + (isNaN(diffDays) ? 0 : diffDays);
    }, 0);
    setTotalTravelDays(days);

    // Calculate top city (Most visited destination) - now supporting split cities with '+'
    const cityCounts: Record<string, number> = {};
    trips.forEach(t => {
      if (t.city) {
        const individualCities = t.city.split(/[\+]+/).filter(Boolean);
        individualCities.forEach(city => {
          const trimmedCity = city.trim();
          if (trimmedCity) {
            cityCounts[trimmedCity] = (cityCounts[trimmedCity] || 0) + 1;
          }
        });
      }
    });
    const sortedCities = Object.entries(cityCounts).sort((a, b) => b[1] - a[1]);
    if (sortedCities.length > 0) {
      setTopCityStat(sortedCities[0][0]);
    }

    // Calculate personal annual spending - Sync logic with ExpenseView.tsx for absolute accuracy
    const fetchSpending = async () => {
      let grandTotal = 0;
      try {
        const spendingResults = await Promise.all(trips.map(async (trip) => {
          let tripTotalShare = 0;
          
          // Only count spending for completed trips
          const isCompleted = new Date(trip.endDate) < new Date();
          if (!isCompleted) return 0;

          // Fetch the latest exchange rate from trip settings (same as ExpenseView)
          const settingsSnap = await getDoc(doc(db, 'trips', trip.id, 'config', 'settings'));
          const exchangeRateNum = settingsSnap.exists() ? Number(settingsSnap.data().exchangeRate || 0.0245) : 0.0245;

          const expensesSnap = await getDocs(collection(db, 'trips', trip.id, 'expenses'));
          expensesSnap.forEach(doc => {
            const exp = doc.data() as Expense;
            const myUid = user.uid;
            
            // 1. Calculate the TWD value of the expense (Same as ExpenseView settlement)
            const amtKRW = Number(exp.amountKRW || 0);
            const amtTWD = Number(exp.amountTWD || 0);
            const currentTWD = exp.currency === 'KRW' 
              ? amtKRW * exchangeRateNum 
              : amtTWD;

            // 2. Identify participants (Normalizing generic m1/m2/m3 to actual UIDs if needed)
            // In these apps, m2 often refers to the primary user if legacy
            // We'll check if myUid or 'm2' represents me in this trip context
            const splitWithIds = (exp.splitWithIds || []).map(id => id === 'm2' ? myUid : id);
            const customSplits: Record<string, number> = {};
            if (exp.customSplits) {
              Object.entries(exp.customSplits).forEach(([id, val]) => {
                customSplits[id === 'm2' ? myUid : id] = val;
              });
            }

            // 3. Determine My Share
            if (exp.customSplits && Object.keys(customSplits).length > 0) {
              // Custom split: direct amount
              const myPartRaw = customSplits[myUid];
              if (myPartRaw !== undefined) {
                const shareTWD = exp.currency === 'KRW' 
                  ? Number(myPartRaw) * exchangeRateNum 
                  : Number(myPartRaw);
                tripTotalShare += shareTWD;
              }
            } else {
              // Simple split or 100% if empty
              const participants = splitWithIds.length > 0 ? splitWithIds : [exp.payerId === 'm2' ? myUid : exp.payerId];
              if (participants.includes(myUid)) {
                tripTotalShare += currentTWD / participants.length;
              }
            }
          });
          return tripTotalShare;
        }));
        
        grandTotal = spendingResults.reduce((acc, val) => acc + val, 0);
        setAnnualSpending(Math.round(grandTotal));
      } catch (err) {
        console.error('Failed to fetch spending:', err);
      }
    };
    
    fetchSpending();
  }, [trips, user.uid]);

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [isCropping, setIsCropping] = useState(false);

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const getCroppedImg = async (imageSrc: string, pixelCrop: any) => {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.addEventListener('load', () => resolve(img));
      img.addEventListener('error', (error) => reject(error));
      img.src = imageSrc;
    });

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

  const handleProfileThemeSelect = async (themeId: 'minimalist' | 'hipster' | 'handdrawn') => {
    const updates: any = { profileTheme: themeId };
    
    // Automatically set a suitable color based on theme
    if (themeId === 'hipster') {
      updates.themeColor = '#8BA88E'; // Morandi Green
    } else if (themeId === 'handdrawn') {
      updates.themeColor = '#8B5E3C'; // Hand-drawn Brown
    } else {
      updates.themeColor = '#3D74B6'; // Classic Blue
    }

    await updateDoc(doc(db, 'users', user.uid), updates);
  };

  const profileThemes = [
    { id: 'minimalist', name: '極簡風', icon: '✨' },
    { id: 'hipster', name: '文青風', icon: '🌿' },
    { id: 'handdrawn', name: '手繪風', icon: '🎨' },
  ] as const;

  const themeColors = [
    { name: '經典藍', value: '#3D74B6' },
    { name: '莫蘭迪灰', value: '#94A3B8' },
    { name: '莫蘭迪灰綠', value: '#8BA88E' },
    { name: '莫蘭迪粉', value: '#C9A9A6' },
    { name: '莫蘭迪藍', value: '#7D9BB0' },
    { name: '莫蘭迪紫', value: '#A696C1' },
    { name: '手繪粉', value: '#FFB7B2' },
    { name: '手繪棕', value: '#8B5E3C' },
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
      case 'handdrawn':
        return {
          container: 'bg-transparent',
          header: 'bg-[#F9F5E6]/80 backdrop-blur-sm border-b border-[#4B3F35]/10',
          card: 'bg-white border-[1.5px] border-[#4B3F35]/10 shadow-[4px_4px_0_0_rgba(75,63,53,0.03)]',
          font: 'font-handdrawn',
          accent: 'text-[#8B5E3C]',
          badge: 'bg-[#FDFCF8] text-[#8B5E3C] border border-[#4B3F35]/10 rounded-none px-2 py-0.5 text-[9px]',
          brandColor: '#8B5E3C'
        };
      case 'minimalist':
      default:
        return {
          container: 'bg-[#F1F5F9]',
          header: 'bg-[#F1F5F9] border-b border-slate-200/50',
          card: 'bg-white rounded-[32px] border border-slate-100 shadow-soft',
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
        interests: editInterests.split(/[\/]+/).map(s => s.trim()).filter(Boolean)
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

  const completedTripsCount = trips.filter(t => new Date(t.endDate) < new Date()).length;
  
  const cityCounts: Record<string, number> = {};
  trips.forEach(t => {
    if (t.city) {
      cityCounts[t.city] = (cityCounts[t.city] || 0) + 1;
    }
  });
  const sortedCities = Object.entries(cityCounts).sort((a, b) => b[1] - a[1]);
  const topCity = sortedCities.length > 0 ? sortedCities[0][0] : "尚未設定";

  return (
    <div className={`flex-1 min-h-0 overflow-y-auto no-scrollbar pb-32 pt-12 relative ${styles.container} ${styles.font}`}>
      <div className="px-6 pt-12 pb-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`relative transition-all duration-500 ${styles.card} ${
            user.profileTheme === 'handdrawn' ? 'rotate-[0.5deg] p-6 pb-8' : 
            user.profileTheme === 'hipster' ? 'rounded-none border border-stone-200 !p-8 bg-[#FDFCF8] shadow-sm' :
            'rounded-[32px] p-6'
          }`}
        >
          {user.profileTheme === 'handdrawn' && (
            <>
              <div className="absolute top-4 right-6 text-rose-400 rotate-12 opacity-60"><Heart size={22} fill="currentColor" /></div>
              <div className="absolute bottom-6 right-8 text-sky-400 rotate-6 opacity-60"><Sparkles size={20} /></div>
              
              {/* Horizontal Map Route Doodle - Left to Right zig-zag */}
              <div className="absolute inset-0 pointer-events-none opacity-20 overflow-hidden">
                <svg className="w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none" fill="none">
                  <path 
                    d="M30,160 C100,160 150,40 200,40 S300,140 370,140" 
                    stroke="#8B5E3C" 
                    strokeWidth="2.5" 
                    strokeDasharray="6 6" 
                    strokeLinecap="round"
                    className="opacity-40"
                  />
                  <circle cx="30" cy="160" r="3.5" fill="#8B5E3C" />
                  <circle cx="370" cy="140" r="3.5" fill="#8B5E3C" />
                </svg>
              </div>
            </>
          )}

          {user.profileTheme === 'hipster' && (
            <>
              <div className="absolute top-0 left-0 w-full h-1 bg-stone-100" />
              <div className="absolute top-8 right-8 text-[8px] font-hipster text-stone-300 uppercase tracking-[0.3em] vertical-text transform rotate-0" style={{ writingMode: 'vertical-rl' }}>
                TRAVELER RECORD / VOL. {new Date().getFullYear()}
              </div>
              <div className="absolute bottom-4 left-8 text-[7px] font-hipster text-stone-200 uppercase tracking-[0.2em]">
                {user.uid.substring(0, 8)} — EST. {new Date().toLocaleDateString()}
              </div>
              
              {/* Extra icons to fill space */}
              <div className="absolute top-4 left-4 text-stone-200/60"><Compass size={48} strokeWidth={1} /></div>
              <div className="absolute top-12 left-12 text-stone-200/40 rotate-12"><MapPin size={32} strokeWidth={1} /></div>
              <div className="absolute bottom-12 right-6 text-stone-200/60"><Camera size={40} strokeWidth={1} /></div>
              <div className="absolute bottom-24 right-12 text-stone-200/40 -rotate-12"><Plane size={36} strokeWidth={1} /></div>
              <div className="absolute top-1/2 left-8 -translate-y-1/2 text-stone-200/30 rotate-90"><Ticket size={44} strokeWidth={1} /></div>
              <div className="absolute bottom-8 right-24 text-stone-200/30"><Footprints size={32} strokeWidth={1} /></div>
              
              {/* More Hipster Details to fill whitespace */}
              <div className="absolute top-[20%] right-[15%] text-stone-200/20 rotate-45"><Scissors size={28} strokeWidth={1} /></div>
              <div className="absolute bottom-[15%] left-[15%] text-stone-200/20 -rotate-12"><ImageIcon size={44} strokeWidth={1} /></div>
              <div className="absolute top-[60%] right-[10%] text-stone-200/10"><Star size={50} strokeWidth={1} /></div>
              <div className="absolute top-[10%] left-[30%] text-stone-200/30"><Sparkles size={18} /></div>
              <div className="absolute bottom-[40%] left-[10%] text-stone-200/10 rotate-12"><Tent size={40} strokeWidth={1} /></div>
              
              <div className="absolute top-1/2 right-4 -translate-y-1/2 flex flex-col gap-2">
                <div className="w-1 h-1 rounded-full bg-stone-200" />
                <div className="w-1 h-12 bg-stone-100 rounded-full" />
                <div className="w-1 h-1 rounded-full bg-stone-200" />
                <div className="w-1 h-4 bg-stone-100 rounded-full" />
                <div className="w-1 h-1 rounded-full bg-stone-200" />
              </div>
              
              <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-4 text-stone-100/20">
                <Sparkles size={12} />
                <Sparkles size={16} />
                <Sparkles size={12} />
              </div>
            </>
          )}
          
          <div className={`flex relative z-10 ${user.profileTheme === 'hipster' ? 'flex-row items-center gap-6' : 'items-center gap-6'}`}>
            <div className="relative shrink-0">
              {user.profileTheme === 'handdrawn' && (
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-16 h-6 washi-tape-grid bg-amber-200/60 rotate-[-2deg] z-20 border-x border-amber-300/20 shadow-sm" />
              )}
              <div className={`
                ${user.profileTheme === 'handdrawn' ? 'w-36 h-auto aspect-[3/4] rounded-none border-[1.5px] border-[#4B3F35]/10 p-2 pb-6 bg-white shadow-[4px_4px_15px_rgba(0,0,0,0.05)] overflow-hidden rotate-[-2deg]' :
                  user.profileTheme === 'hipster' ? 'w-28 h-28 rounded-none border-2 border-stone-800 p-0.5 bg-white shadow-[6px_6px_0_0_rgba(28,25,23,0.05)] overflow-hidden' :
                  'w-20 h-20 rounded-3xl p-0.5 bg-gradient-to-br from-sky-100 to-indigo-100 shadow-inner overflow-hidden'}
              `}>
                <img 
                  src={user.photoURL || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + user.uid} 
                  alt={user.displayName} 
                  className={`${
                    user.profileTheme === 'handdrawn' ? 'w-full h-full object-cover border border-[#4B3F35]/5' : 
                    user.profileTheme === 'hipster' ? 'w-full h-full object-cover grayscale-[0.2] contrast-[1.1]' :
                    'w-full h-full rounded-none object-cover'
                  }`}
                />
              </div>
              <button 
                onClick={() => setIsEditingProfile(true)}
                className={`absolute p-1.5 shadow-lg text-white border-2 border-white active:scale-95 transition-all z-30 ${
                  user.profileTheme === 'handdrawn' ? '-bottom-1 -right-1 rounded-none' : 
                  user.profileTheme === 'hipster' ? 'bottom-2 -right-2 bg-stone-700 rounded-none !border-stone-100 p-2' :
                  '-bottom-1 -right-1 rounded-full'
                }`} 
                style={{ backgroundColor: user.profileTheme === 'handdrawn' ? '#4B3F35' : (user.profileTheme === 'hipster' ? undefined : 'var(--brand-color)') }}
              >
                <Pencil size={user.profileTheme === 'hipster' ? 12 : 10} />
              </button>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className={`flex items-center gap-2 ${user.profileTheme === 'handdrawn' ? 'justify-start pt-6' : 'justify-start'}`}>
                <h1 className={`font-black tracking-tight truncate ${
                  user.profileTheme === 'handdrawn' ? 'text-xl text-[#4B3F35] font-handdrawn' : 
                  user.profileTheme === 'hipster' ? 'text-2xl text-stone-800 font-hipster uppercase tracking-[0.05em]' :
                  'text-xl text-slate-800'
                }`}>
                  {user.displayName}
                </h1>
                {user.profileTheme === 'hipster' && <div className="hidden sm:block w-12 h-[1px] bg-stone-200" />}
              </div>
              
              {user.location && (
                <div className={`flex items-center gap-1 mt-1 font-bold ${
                  user.profileTheme === 'handdrawn' ? 'text-[#8B5E3C] text-[10px] justify-start font-handdrawn' : 
                  user.profileTheme === 'hipster' ? 'text-stone-400 text-[8px] font-hipster tracking-[0.2em] uppercase' :
                  'text-slate-400 text-[10px]'
                }`}>
                  <MapPin size={user.profileTheme === 'hipster' ? 10 : 9} />
                  <span className={user.profileTheme === 'handdrawn' ? 'tracking-[0.1em]' : ''}>{user.location}</span>
                </div>
              )}
              
              <p className={`mt-3 text-xs font-medium leading-relaxed ${
                user.profileTheme === 'handdrawn' ? 'text-[10px] text-[#4B3F35]/80 italic font-handdrawn' : 
                user.profileTheme === 'hipster' ? 'text-[10px] text-stone-500 font-hipster italic border-l-2 border-stone-200 pl-3 mt-4' :
                'text-[10px] text-slate-500'
              }`}>
                「{user.motto || '慢行，是最美的風景'}」
              </p>

              {(user.profileTheme === 'minimalist' || !user.profileTheme || user.profileTheme === 'handdrawn') && user.interests && user.interests.length > 0 && (
                <div className={`mt-3 flex flex-wrap gap-1.5 ${user.profileTheme === 'handdrawn' ? 'font-handdrawn' : ''}`}>
                  {user.interests.map((interest, idx) => (
                    <span 
                      key={idx} 
                      className={`px-2 py-0.5 text-[9px] font-bold ${
                        user.profileTheme === 'handdrawn' ? 'bg-[#4B3F35]/5 text-[#4B3F35]/60 border border-[#4B3F35]/10' : 
                        'bg-slate-50 text-slate-400 border border-slate-100 rounded-md'
                      }`}
                    >
                      #{interest}
                    </span>
                  ))}
                </div>
              )}

              {user.profileTheme === 'hipster' && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <div className="px-2 py-0.5 bg-stone-800 text-[7px] font-hipster text-stone-100 uppercase tracking-widest flex items-center gap-1 shrink-0">
                    <Check size={8} /> Verified
                  </div>
                  {user.interests && user.interests.length > 0 ? (
                    user.interests.map((interest, idx) => (
                      <div key={idx} className="px-2 py-0.5 border border-stone-200 text-[7px] font-hipster text-stone-400 uppercase tracking-widest italic shrink-0">
                        {interest}
                      </div>
                    ))
                  ) : (
                    <div className="px-2 py-0.5 border border-stone-200 text-[7px] font-hipster text-stone-400 uppercase tracking-widest italic shrink-0">
                      Adventurer
                    </div>
                  )}
                  <div className="px-2 py-0.5 bg-stone-100 text-[6px] font-hipster text-stone-400 uppercase tracking-widest hidden sm:block shrink-0">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Stats Grid */}
      <div className="px-6 pb-8">
        <div className={`grid ${user.profileTheme === 'handdrawn' ? 'grid-cols-2 gap-4' : 'grid-cols-2 gap-3'}`}>
          <StatCard 
            icon={<Award size={18} className={user.profileTheme === 'handdrawn' ? 'text-amber-500' : user.profileTheme === 'hipster' ? 'text-stone-400' : 'text-sky-400'} />} 
            value={trips.length} 
            label={user.profileTheme === 'handdrawn' ? "已解鎖成就" : "已完成旅程"} 
            theme={user.profileTheme}
          />
          <StatCard 
            icon={<Calendar size={18} className={user.profileTheme === 'handdrawn' ? 'text-rose-400' : user.profileTheme === 'hipster' ? 'text-stone-400' : 'text-indigo-400'} />} 
            value={totalTravelDays} 
            label="累積旅遊天數" 
            theme={user.profileTheme}
          />
          <StatCard 
            icon={<MapPin size={18} className={user.profileTheme === 'handdrawn' ? 'text-sky-400' : user.profileTheme === 'hipster' ? 'text-stone-400' : 'text-emerald-400'} />} 
            value={topCityStat} 
            label={user.profileTheme === 'handdrawn' ? "喜歡的城市" : "常去城市"} 
            theme={user.profileTheme}
          />
          <StatCard 
            icon={<Wallet size={18} className={user.profileTheme === 'handdrawn' ? 'text-emerald-400' : user.profileTheme === 'hipster' ? 'text-stone-400' : 'text-rose-400'} />} 
            value={`$${annualSpending.toLocaleString()}`} 
            label="個人年度消費" 
            theme={user.profileTheme}
          />
        </div>
      </div>

      {/* Settings Section */}
      <div className="px-6 mt-2 pb-32">
        <div className={`${
          user.profileTheme === 'handdrawn' ? 'bg-white border border-[#4B3F35]/10 shadow-sm divide-y divide-[#4B3F35]/10' :
          user.profileTheme === 'hipster' ? 'bg-white border border-stone-100 shadow-sm divide-y divide-stone-50' :
          'rounded-[24px] shadow-soft overflow-hidden bg-white border border-slate-50 divide-y divide-slate-50'
        }`}>
          {/* Theme Style Picker */}
          <div className="relative">
            <button 
              onClick={() => setShowThemePicker(!showThemePicker)}
              className={`w-full flex items-center gap-3 p-4 transition-colors ${
                user.profileTheme === 'handdrawn' ? 'hover:bg-stone-50/50' : 
                user.profileTheme === 'hipster' ? 'hover:bg-stone-50/50' :
                'hover:bg-slate-50'
              }`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                user.profileTheme === 'handdrawn' ? 'bg-[#EEE8D5] text-[#8B5E3C]' : 
                user.profileTheme === 'hipster' ? 'bg-stone-100 text-stone-500 rounded-full' :
                'bg-slate-50 text-amber-500'
              }`}>
                <Award size={16} />
              </div>
              <div className="flex-1 text-left">
                <p className={`text-xs font-black ${
                  user.profileTheme === 'handdrawn' ? 'text-stone-700' : 
                  user.profileTheme === 'hipster' ? 'text-stone-600 font-hipster' :
                  'text-slate-800'
                }`}>頁面風格</p>
                <p className={`text-[9px] font-bold ${
                  user.profileTheme === 'handdrawn' ? 'text-stone-400' : 
                  user.profileTheme === 'hipster' ? 'text-stone-400 font-hipster' :
                  'text-slate-400'
                }`}>切換不同的視覺主題</p>
              </div>
              <span className={`text-xs font-bold mr-1 ${
                user.profileTheme === 'handdrawn' ? 'text-stone-400' : 
                user.profileTheme === 'hipster' ? 'text-stone-400 font-hipster italic' :
                'text-slate-400'
              }`}>
                {profileThemes.find(t => t.id === (user.profileTheme || 'minimalist'))?.name}
              </span>
              <ChevronRight size={14} className={`${
                user.profileTheme === 'handdrawn' ? 'text-stone-300' : 
                user.profileTheme === 'hipster' ? 'text-stone-300' :
                'text-slate-200'
              } transition-transform ${showThemePicker ? 'rotate-90' : ''}`} />
            </button>
            
            <AnimatePresence>
              {showThemePicker && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className={`overflow-hidden px-4 pb-4 ${
                    user.profileTheme === 'handdrawn' ? 'bg-[#F9F5E6]' : 
                    user.profileTheme === 'hipster' ? 'bg-[#FDFCF8]' :
                    'bg-slate-50/50'
                  }`}
                >
                  <div className="grid grid-cols-3 gap-3 pt-2">
                    {profileThemes.map((theme) => (
                      <button
                        key={theme.id}
                        onClick={() => handleProfileThemeSelect(theme.id)}
                        className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-all ${user.profileTheme === theme.id || (!user.profileTheme && theme.id === 'minimalist') ? (user.profileTheme === 'handdrawn' ? 'bg-white shadow-sm ring-1 ring-[#8B5E3C]/20' : user.profileTheme === 'hipster' ? 'bg-white shadow-sm ring-1 ring-stone-200' : 'bg-white shadow-sm ring-1 ring-slate-200') : 'hover:bg-white/50'}`}
                      >
                        <span className="text-xl">{theme.icon}</span>
                        <span className={`text-[10px] font-black text-slate-600 ${user.profileTheme === 'hipster' ? 'font-hipster' : ''}`}>{theme.name}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Theme Color Picker */}
          <div className="relative">
            <button 
              onClick={() => setShowColorPicker(!showColorPicker)}
              className={`w-full flex items-center gap-3 p-4 transition-colors ${
                user.profileTheme === 'handdrawn' ? 'hover:bg-stone-50/50' : 
                user.profileTheme === 'hipster' ? 'hover:bg-stone-50/50' :
                'hover:bg-slate-50'
              }`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                user.profileTheme === 'handdrawn' ? 'bg-[#EEE8D5] text-[#268BD2]' : 
                user.profileTheme === 'hipster' ? 'bg-stone-100 text-stone-400 rounded-full' :
                'bg-slate-50 text-indigo-400'
              }`}>
                <Moon size={16} />
              </div>
              <div className="flex-1 text-left">
                <p className={`text-xs font-black ${
                  user.profileTheme === 'handdrawn' ? 'text-stone-700' : 
                  user.profileTheme === 'hipster' ? 'text-stone-600 font-hipster' :
                  'text-slate-800'
                }`}>主題顏色</p>
                <p className={`text-[9px] font-bold ${
                  user.profileTheme === 'handdrawn' ? 'text-stone-400' : 
                  user.profileTheme === 'hipster' ? 'text-stone-400 font-hipster' :
                  'text-slate-400'
                }`}>自定義您的介面風格</p>
              </div>
              <div 
                className={`w-4 h-4 rounded-full border ${user.profileTheme === 'handdrawn' ? 'border-[#4B3F35]/20' : user.profileTheme === 'hipster' ? 'border-stone-200' : 'border-slate-200'}`} 
                style={{ backgroundColor: user.themeColor || '#3D74B6' }}
              />
              <ChevronRight size={14} className={`${
                user.profileTheme === 'handdrawn' ? 'text-stone-400' : 
                user.profileTheme === 'hipster' ? 'text-stone-300' :
                'text-slate-200'
              } transition-transform ${showColorPicker ? 'rotate-90' : ''}`} />
            </button>
            
            <AnimatePresence>
              {showColorPicker && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className={`overflow-hidden px-4 pb-4 ${
                    user.profileTheme === 'handdrawn' ? 'bg-[#F9F5E6]' : 
                    user.profileTheme === 'hipster' ? 'bg-[#FDFCF8]' :
                    'bg-slate-50/50'
                  }`}
                >
                  <div className="grid grid-cols-4 gap-3 pt-2">
                    {themeColors.map((color) => (
                      <button
                        key={color.value}
                        onClick={() => handleColorSelect(color.value)}
                        className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all ${user.themeColor === color.value || (!user.themeColor && color.value === '#3D74B6') ? (user.profileTheme === 'handdrawn' ? 'bg-white shadow-sm ring-1 ring-[#8B5E3C]/20' : user.profileTheme === 'hipster' ? 'bg-white shadow-sm ring-1 ring-stone-200' : 'bg-white shadow-sm ring-1') : 'hover:bg-white/50'}`}
                      >
                        <div className="w-6 h-6 rounded-full shadow-sm" style={{ backgroundColor: color.value }} />
                        <span className={`text-[8px] font-bold ${user.profileTheme === 'handdrawn' ? 'text-stone-500' : user.profileTheme === 'hipster' ? 'text-stone-500 font-hipster' : 'text-slate-500'}`}>{color.name}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <SettingItem icon={<LogOut size={16} />} label="登出帳號" subLabel="安全退出系統" color="text-rose-400" onClick={logout} isLast theme={user.profileTheme} />
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
                  <label className="text-[8px] font-black text-slate-300 uppercase tracking-widest block ml-1 mb-1">顯示名稱</label>
                  <input 
                    type="text" 
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="w-full p-3 bg-slate-50 rounded-2xl text-sm font-bold border-none outline-none focus:ring-1"
                  />
                </div>
                <div>
                  <label className="text-[8px] font-black text-slate-300 uppercase tracking-widest block ml-1 mb-1">旅行座右銘</label>
                  <input 
                    type="text" 
                    value={editMotto}
                    onChange={e => setEditMotto(e.target.value)}
                    placeholder="例如：慢行，是最美的風景"
                    className="w-full p-3 bg-slate-50 rounded-2xl text-sm font-bold border-none outline-none focus:ring-1"
                  />
                </div>
                <div>
                  <label className="text-[8px] font-black text-slate-300 uppercase tracking-widest block ml-1 mb-1">所在地 (目的地請用+分隔)</label>
                  <input 
                    type="text" 
                    value={editLocation}
                    onChange={e => setEditLocation(e.target.value)}
                    placeholder="例如：台北+首爾+東京"
                    className="w-full p-3 bg-slate-50 rounded-2xl text-sm font-bold border-none outline-none focus:ring-1"
                  />
                </div>
                <div>
                  <label className="text-[8px] font-black text-slate-300 uppercase tracking-widest block ml-1 mb-1">興趣標籤 (以/分隔)</label>
                  <input 
                    type="text" 
                    value={editInterests}
                    onChange={e => setEditInterests(e.target.value)}
                    placeholder="例如：咖啡/攝影/慢跑"
                    className="w-full p-3 bg-slate-50 rounded-2xl text-sm font-bold border-none outline-none focus:ring-1"
                  />
                </div>
                <div>
                  <label className="text-[8px] font-black text-slate-300 uppercase tracking-widest block ml-1 mb-1">大頭貼</label>
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
                    <label className="flex-1 flex items-center justify-center gap-2 p-3 bg-slate-50 rounded-2xl text-xs font-bold text-slate-500 cursor-pointer hover:bg-slate-100 transition-all">
                      <ImageIcon size={14} />
                      <span>上傳照片</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </label>
                  </div>
                </div>
              </div>

              <button 
                onClick={handleUpdateProfile}
                className="w-full py-4 text-white text-sm font-black rounded-2xl shadow-lg active:scale-95 transition-all mt-6"
                style={{ backgroundColor: 'var(--brand-color)' }}
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
        return `bg-white rounded-none border border-stone-100 shadow-sm font-hipster`;
      case 'handdrawn':
        const rotations = ['rotate-[-1.2deg]', 'rotate-[1deg]', 'rotate-[-0.5deg]', 'rotate-[1.2deg]'];
        const colors = ['bg-[#FEF9C3]/50', 'bg-[#FFEDD5]/50', 'bg-[#DBEAFE]/50', 'bg-[#F3E8FF]/50'];
        const randomIndex = Math.abs(label.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 4;
        
        let finalColor = colors[randomIndex];
        if (label.includes('旅程') || label.includes('成就')) finalColor = 'bg-[#FEF9C3]/50'; 
        if (label.includes('行程') || label.includes('天數')) finalColor = 'bg-[#DBEAFE]/50'; 
        if (label.includes('城市')) finalColor = 'bg-[#FFEDD5]/50'; 
        if (label.includes('消費')) finalColor = 'bg-[#F3E8FF]/50'; 
        
        return `${finalColor} rounded-none border-[1.2px] border-[#4B3F35]/15 shadow-[3px_3px_0_0_rgba(75,63,53,0.03)] font-handdrawn ${rotations[randomIndex]}`;
      case 'minimalist':
      default:
        return 'bg-white rounded-2xl border border-slate-100 font-sans shadow-sm';
    }
  };

  return (
    <div className={`${getCardStyle()} p-3 pt-5 flex flex-col items-center text-center relative`}>
      {theme === 'handdrawn' && (
        <div className={`absolute -top-1 left-1/2 -translate-x-1/2 w-10 h-4 washi-tape-grid rotate-1 z-10 border-x border-black/5 shadow-sm opacity-80 ${
          label.includes('旅程') || label.includes('成就') ? 'bg-[#FEF9C3]' : 
          label.includes('城市') ? 'bg-[#FFEDD5]' : 
          label.includes('行程') || label.includes('天數') ? 'bg-[#DBEAFE]' : 
          label.includes('消費') ? 'bg-[#F3E8FF]' : 'bg-slate-300'
        }`} />
      )}
      <div className="mb-1">{icon}</div>
      <div className={`text-sm font-black leading-none mb-1 ${
        theme === 'handdrawn' ? 'text-[#4B3F35]' : 
        theme === 'hipster' ? 'text-stone-700 font-hipster' : 
        'text-slate-800'
      }`}>{value}</div>
      <div className={`text-[8px] font-bold uppercase tracking-normal ${
        theme === 'handdrawn' ? 'text-[#8B5E3C]' : 
        theme === 'hipster' ? 'text-stone-400 font-hipster' : 
        'text-slate-400'
      }`}>{label}</div>
    </div>
  );
};

const SettingItem: React.FC<{ icon: React.ReactNode, label: string, subLabel: string, color?: string, onClick?: () => void, isLast?: boolean, theme?: string }> = ({ icon, label, subLabel, color, onClick, isLast, theme }) => {
  const fontClass = theme === 'hipster' ? 'font-hipster' : theme === 'handdrawn' ? 'font-handdrawn' : 'font-sans';
  
  const getButtonClass = () => {
    if (theme === 'handdrawn') {
      return `w-full flex items-center gap-3 p-4 hover:bg-stone-50 transition-colors ${!isLast ? 'border-b border-[#4B3F35]/10' : ''} ${fontClass}`;
    }
    return `w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors ${!isLast ? 'border-b border-slate-50' : ''} ${fontClass}`;
  };

  return (
    <button onClick={onClick} className={getButtonClass()}>
      <div className={`w-8 h-8 flex items-center justify-center ${color} ${
        theme === 'handdrawn' ? 'rounded-lg border border-[#4B3F35]/10 bg-stone-50' : 
        theme === 'hipster' ? 'rounded-full border border-stone-100 bg-stone-50' :
        'rounded-xl bg-slate-50'
      }`}>
        {icon}
      </div>
      <div className="flex-1 text-left">
        <p className={`text-xs font-black ${
          theme === 'handdrawn' ? 'text-[#4B3F35]' : 
          theme === 'hipster' ? 'text-stone-600 font-hipster' :
          'text-slate-800'
        }`}>{label}</p>
        <p className={`text-[9px] font-bold ${
          theme === 'handdrawn' ? 'text-[#8B5E3C]' : 
          theme === 'hipster' ? 'text-stone-400 font-hipster' :
          'text-slate-400'
        }`}>{subLabel}</p>
      </div>
      <ChevronRight size={14} className={
        theme === 'handdrawn' ? 'text-[#4B3F35]' : 
        theme === 'hipster' ? 'text-stone-300' :
        'text-slate-200'
      } />
    </button>
  );
};
