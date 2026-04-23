
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { X, MapPin, Award, Calendar, Sparkles, Heart, Compass, Plane, Tent, Ticket, Camera, Footprints, Flag, Loader2, Image as ImageIcon, Check, Scissors } from 'lucide-react';
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import Cropper from 'react-easy-crop';

interface MemberProfileModalProps {
  memberId: string;
  onClose: () => void;
  // Fallback data if needed
  initialName?: string;
  initialAvatar?: string;
}

export const MemberProfileModal: React.FC<MemberProfileModalProps> = ({ memberId, onClose, initialName, initialAvatar }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tripCount, setTripCount] = useState(0);
  const [totalDays, setTotalDays] = useState(0);
  const [topCity, setTopCity] = useState("尚未探索");
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cropping State
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [isCropping, setIsCropping] = useState(false);

  const isOwnProfile = auth.currentUser?.uid === memberId;

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        // Fetch User Profile
        const userDocRef = doc(db, 'users', memberId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          setProfile(userDocSnap.data() as UserProfile);
        }

        // Fetch Real Trip Data
        const tripsQuery = query(
          collection(db, 'trips'),
          where('memberUids', 'array-contains', memberId)
        );
        const tripsSnap = await getDocs(tripsQuery);
        setTripCount(tripsSnap.size);

        let days = 0;
        const now = new Date().getTime();
        const cityStats: Record<string, { count: number, latestCompletedDate: number }> = {};

        tripsSnap.docs.forEach(doc => {
          const trip = doc.data();
          // Calculate Days
          if (trip.startDate && trip.endDate) {
            const start = new Date(trip.startDate);
            const end = new Date(trip.endDate);
            const diff = Math.abs(end.getTime() - start.getTime());
            days += (Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
          }
          // Process Cities
          if (trip.city) {
            const cities = trip.city.split('+').map((c: string) => c.trim()).filter(Boolean);
            const tripEndDate = trip.endDate ? new Date(trip.endDate).getTime() : 0;
            const isCompleted = tripEndDate > 0 && tripEndDate <= now;
            
            cities.forEach((city: string) => {
              if (!cityStats[city]) {
                cityStats[city] = { count: 0, latestCompletedDate: 0 };
              }
              cityStats[city].count += 1;
              if (isCompleted && tripEndDate > cityStats[city].latestCompletedDate) {
                cityStats[city].latestCompletedDate = tripEndDate;
              }
            });
          }
        });

        setTotalDays(days);
        const sortedCities = Object.entries(cityStats).sort((a, b) => {
          if (b[1].count !== a[1].count) {
            return b[1].count - a[1].count;
          }
          return b[1].latestCompletedDate - a[1].latestCompletedDate;
        });

        if (sortedCities.length > 0) {
          setTopCity(sortedCities[0][0]);
        }

      } catch (err) {
        console.error("Failed to fetch member data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [memberId]);

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isOwnProfile) return;

    // Basic size check (e.g., 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert("圖片太大了！請上傳小於 2MB 的圖片。");
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      setImageToCrop(reader.result as string);
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

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
      const finalImage = await compressImage(croppedImage, 1200, 600, 0.7);
      
      const userRef = doc(db, 'users', memberId);
      await updateDoc(userRef, { profileBg: finalImage });
      setProfile(prev => prev ? { ...prev, profileBg: finalImage } : null);
      setImageToCrop(null);
    } catch (err) {
      console.error("Crop failed:", err);
      alert("裁切儲存失敗，請重試。");
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
            width = maxHeight;
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

  // Handle clicking overlay to close
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const theme = profile?.profileTheme || 'minimalist';
  const brandColor = profile?.themeColor || '#3D74B6';

  // Helper to convert hex to rgb for opacity
  const getBrandColorRGB = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r}, ${g}, ${b}`;
  };

  const brandColorRGB = getBrandColorRGB(brandColor);

  return (
    <div 
      className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm"
      onClick={handleOverlayClick}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 30 }}
        className={`relative w-full max-w-sm overflow-hidden shadow-2xl ${
          theme === 'handdrawn' ? 'bg-[#FCF9F2] rounded-none border-2 border-[#4B3F35]' :
          theme === 'scrapbook' ? 'bg-[#FDFBF7] rounded-[32px] border-4 border-white shadow-xl' :
          theme === 'hipster' ? 'bg-white rounded-none border border-stone-200' :
          'bg-white rounded-[40px]'
        }`}
        style={theme === 'handdrawn' ? { clipPath: 'polygon(1% 1%, 99% 2%, 98% 98%, 2% 99%)' } : {}}
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          className={`absolute top-4 right-4 z-10 p-2 rounded-full active:scale-95 transition-all ${
            theme === 'handdrawn' ? 'bg-stone-100 text-[#4B3F35]' : 'bg-slate-100/50 text-slate-400'
          }`}
        >
          <X size={18} strokeWidth={2.5} />
        </button>

        {loading ? (
          <div className="h-80 flex items-center justify-center">
            <Loader2 className={`animate-spin ${theme === 'handdrawn' ? 'text-[#4B3F35]' : 'text-slate-200'}`} size={32} />
          </div>
        ) : (
          <div className="flex flex-col">
            {/* Header / Topographic Art Background */}
            <div className={`h-48 w-full relative overflow-hidden group/bg ${
              theme === 'handdrawn' ? 'bg-[#FCF9F2]' : 'bg-slate-50'
            }`}>
              {/* Actual Background Image */}
              {profile?.profileBg ? (
                <div 
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover/bg:scale-110"
                  style={{ backgroundImage: `url(${profile.profileBg})` }}
                />
              ) : (
                <>
                  {/* Artistic Topographic Lines (SVG pattern) */}
                  <div className="absolute inset-0 opacity-[0.08]" style={{ 
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='400' height='400' viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 100 Q 50 80 100 100 T 200 100 T 300 100 T 400 100 M 0 150 Q 50 130 100 150 T 200 150 T 300 150 T 400 150 M 0 200 Q 50 180 100 200 T 200 200 T 300 200 T 400 200 M 0 250 Q 50 230 100 250 T 200 250 T 300 250 T 400 250' fill='none' stroke='${encodeURIComponent(brandColor)}' stroke-width='1'/%3E%3C/svg%3E")`,
                    backgroundSize: '200px 200px'
                  }} />

                  {/* Glowing Orbs */}
                  <motion.div 
                    animate={{ 
                      scale: [1, 1.2, 1],
                      x: [0, 30, 0],
                      y: [0, 20, 0]
                    }}
                    transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute -top-10 -right-10 w-48 h-48 rounded-full blur-[60px] opacity-20"
                    style={{ backgroundColor: brandColor }}
                  />
                  <motion.div 
                    animate={{ 
                      scale: [1.2, 1, 1.2],
                      x: [0, -20, 0],
                      y: [0, -10, 0]
                    }}
                    transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full blur-[50px] opacity-15"
                    style={{ backgroundColor: brandColor }}
                  />
                </>
              )}

              {/* Upload Button */}
              {isOwnProfile && (
                <div className="absolute top-4 left-4 z-10">
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleBgUpload} 
                  />
                  <button 
                    disabled={isUploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 bg-black/20 hover:bg-black/40 backdrop-blur-md text-white rounded-full transition-all border border-white/20 active:scale-95 flex items-center justify-center"
                    title="更換封面照片"
                  >
                    {isUploading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Camera size={16} />
                    )}
                  </button>
                </div>
              )}

              {/* Decorative Compass Rose (Subtle) */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03]">
                <Compass size={160} strokeWidth={0.5} />
              </div>

              {/* Modern Frosted Overlay at the bottom */}
              <div className="absolute bottom-0 left-0 w-full h-16 bg-gradient-to-t from-white via-white/80 to-transparent" />
            </div>

            {/* Avatar & Basic Info */}
            <div className="px-8 pb-10 flex flex-col items-center -mt-24 relative z-10 text-center">
              <div className={`w-32 h-32 rounded-full border-4 overflow-hidden shadow-2xl mb-5 p-1 ${
                 theme === 'handdrawn' ? 'border-[#4B3F35] bg-white' : 'border-white bg-slate-50'
              }`}>
                <img 
                  src={profile?.photoURL || initialAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${memberId}`} 
                  alt={profile?.displayName} 
                  className="w-full h-full object-cover rounded-full"
                  referrerPolicy="no-referrer"
                />
              </div>

              <h2 className={`text-4xl font-black mb-1.5 ${
                theme === 'handdrawn' ? 'text-[#4B3F35] font-handdrawn' :
                theme === 'hipster' ? 'text-stone-700 font-hipster tracking-tight' :
                'text-slate-800'
              }`}>
                {profile?.displayName || initialName || '探索者'}
              </h2>

              <p className={`text-[13px] font-bold uppercase tracking-[0.25em] mb-8 ${
                theme === 'handdrawn' ? 'text-stone-400' : 'text-slate-400'
              }`}>
                Adventure Awaits
              </p>

              {/* Stats Bar - NEW METRICS */}
              <div className="w-full grid grid-cols-3 gap-0 mb-10 divide-x divide-slate-100 border-y border-slate-100 py-6">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">旅行足跡</span>
                  <div className="flex items-center gap-1.5">
                    <Footprints size={14} style={{ color: brandColor }} />
                    <span className={`text-[18px] font-black ${theme === 'handdrawn' ? 'text-[#4B3F35]' : 'text-slate-800'}`}>
                      {tripCount} 趟
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">累積天數</span>
                  <div className="flex items-center gap-1.5">
                    <Calendar size={14} style={{ color: brandColor }} />
                    <span className={`text-[18px] font-black ${theme === 'handdrawn' ? 'text-[#4B3F35]' : 'text-slate-800'}`}>
                      {totalDays} 天
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-center px-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">常去城市</span>
                  <div className="flex items-center gap-1.5">
                    <MapPin size={14} style={{ color: brandColor }} />
                    <span className={`text-[15px] font-black truncate max-w-[80px] ${theme === 'handdrawn' ? 'text-[#4B3F35]' : 'text-slate-800'}`}>
                      {topCity}
                    </span>
                  </div>
                </div>
              </div>

              {/* Motto Box */}
              {profile?.motto && (
                <div className={`w-full p-8 mb-10 relative ${
                  theme === 'handdrawn' ? 'bg-white border-2 border-[#4B3F35] rounded-xl' :
                  theme === 'scrapbook' ? 'bg-[#FEFAF3] rounded-3xl border border-stone-200 shadow-sm' :
                  theme === 'hipster' ? 'bg-stone-50 border border-stone-100' :
                  'bg-slate-50 rounded-[32px] border border-slate-100/50'
                }`}
                  style={theme === 'handdrawn' ? { clipPath: 'polygon(0% 1%, 100% 0%, 99% 100%, 1% 99%)' } : {}}
                >
                  <Sparkles className="absolute -top-3 -left-1 text-amber-400" size={24} />
                  <p className={`text-[15px] leading-relaxed font-bold ${
                    theme === 'handdrawn' ? 'text-stone-600' : 'text-slate-600 italic'
                  }`}>
                    {profile.motto}
                  </p>
                </div>
              )}

              {/* Interests / Tags */}
              <div className="w-full">
                 <div className="flex flex-wrap justify-center gap-2 pt-2">
                   {(profile?.interests || ["愛旅遊", "美食家", "生活美學"]).map((interest, i) => (
                     <span 
                      key={i} 
                      className={`px-3 py-1.5 text-[10px] font-black rounded-xl border transition-all ${
                        theme === 'handdrawn' ? 'bg-white border-[#4B3F35] text-[#4B3F35]' : 'bg-white border-slate-100'
                      }`}
                      style={theme !== 'handdrawn' ? { color: brandColor, borderColor: `rgba(${brandColorRGB}, 0.2)`, backgroundColor: `rgba(${brandColorRGB}, 0.03)` } : {}}
                    >
                       #{interest}
                     </span>
                   ))}
                 </div>
              </div>
            </div>            
            {/* Footer decoration */}
            <div className={`h-2 w-full mt-auto ${theme === 'handdrawn' ? 'bg-[#4B3F35]' : ''}`}
                 style={theme !== 'handdrawn' ? { backgroundColor: brandColor } : {}} />
          </div>
        )}

        {/* Cropping Modal */}
        <AnimatePresence>
          {imageToCrop && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[1100] bg-black flex flex-col"
            >
              <div className="flex-1 relative">
                <Cropper
                  image={imageToCrop}
                  crop={crop}
                  zoom={zoom}
                  aspect={1200 / 600}
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                />
              </div>
              <div className="bg-slate-900 p-6 flex items-center justify-between gap-4">
                <button 
                  onClick={() => setImageToCrop(null)}
                  className="px-6 py-3 bg-white/10 text-white rounded-2xl text-sm font-black active:scale-95 transition-all"
                >
                  取消
                </button>
                <div className="flex-1 px-4">
                  <input
                    type="range"
                    value={zoom}
                    min={1}
                    max={3}
                    step={0.1}
                    aria-labelledby="Zoom"
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white"
                  />
                </div>
                <button 
                  onClick={handleCropSave}
                  disabled={isCropping}
                  className="px-8 py-3 bg-white text-slate-900 rounded-2xl text-sm font-black active:scale-95 transition-all flex items-center gap-2"
                >
                  {isCropping ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                  確定
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
