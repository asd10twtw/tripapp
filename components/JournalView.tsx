
import React, { useState, useEffect, useCallback } from 'react';
import { PenTool, Send, X, Pencil, Trash2, Camera, Image as ImageIcon, Loader2, Check } from 'lucide-react';
import { db } from '../services/firebase';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, orderBy, serverTimestamp } from 'firebase/firestore';
import { JournalEntry, Member } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import Cropper from 'react-easy-crop';

interface JournalViewProps {
  members: Member[];
  tripId: string;
  currentUser: any;
  theme?: string;
}

export const JournalView: React.FC<JournalViewProps> = ({ members, tripId, currentUser, theme }) => {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [inputContent, setInputContent] = useState('');
  const [inputImage, setInputImage] = useState<string | null>(null);
  const [authorId, setAuthorId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Cropping
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
      const compressed = await compressImage(croppedImage, 800, 800, 0.7);
      setInputImage(compressed);
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

    if (file.size > 2 * 1024 * 1024) {
      alert('圖片太大囉！請選擇小於 2MB 的圖片。');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImageToCrop(reader.result as string);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    };
    reader.readAsDataURL(file);
  };
  
  useEffect(() => {
    if (members.length > 0 && !authorId) {
        const found = members.find(m => m.id === currentUser?.uid);
        if (found) {
            setAuthorId(found.id);
        } else {
            setAuthorId(members[0].id);
        }
    }
  }, [members, authorId, currentUser]);

  useEffect(() => {
    const q = query(collection(db, 'trips', tripId, 'journal'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedEntries: JournalEntry[] = snapshot.docs.map(doc => {
        const data = doc.data() as any;
        
        // Dynamic Legacy ID Mapping
        members.forEach(m => {
          if (m.legacyIds && m.legacyIds.length > 0) {
            m.legacyIds.forEach(lId => {
              if (data.authorId === lId) {
                data.authorId = m.id;
              }
            });
          }
        });

        return {
          id: doc.id,
          ...data,
          photos: data.photos || (data.photo ? [data.photo] : (data.image ? [data.image] : []))
        } as JournalEntry;
      });
      setEntries(fetchedEntries);
    });
    return () => unsubscribe();
  }, [tripId, members]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputContent.trim()) return;

    try {
      setIsUploading(true);
      if (editingId) {
          const entryToUpdate = entries.find(en => en.id === editingId);
          await updateDoc(doc(db, 'trips', tripId, 'journal', editingId), {
              content: inputContent,
              authorId: authorId,
              photos: inputImage ? [inputImage] : (entryToUpdate?.photos || []),
              updatedAt: serverTimestamp()
          });
          setEditingId(null);
      } else {
          await addDoc(collection(db, 'trips', tripId, 'journal'), {
            content: inputContent,
            date: new Date().toISOString(),
            authorId: authorId,
            photos: inputImage ? [inputImage] : [],
            createdAt: serverTimestamp()
          });
      }
      setInputContent('');
      setInputImage(null);
    } catch (error) {
      console.error("Error posting journal: ", error);
    } finally {
      setIsUploading(false);
    }
  };

  const startEdit = (entry: JournalEntry) => {
      setEditingId(entry.id);
      setInputContent(entry.content);
      setAuthorId(entry.authorId);
      setInputImage(entry.photos && entry.photos.length > 0 ? entry.photos[0] : null);
      const container = document.querySelector('.journal-container');
      if (container) container.scrollTop = 0;
  }

  const cancelEdit = () => {
      setEditingId(null);
      setInputContent('');
      setInputImage(null);
  }

  const handleDelete = async () => {
      if (!itemToDelete) return;
      try {
        await deleteDoc(doc(db, 'trips', tripId, 'journal', itemToDelete));
        if (editingId === itemToDelete) cancelEdit();
        setItemToDelete(null);
      } catch (err) {
        console.error("Delete failed:", err);
      }
  }

  return (
    <>
      {/* Image Cropper Modal */}
      <AnimatePresence>
        {imageToCrop && (
          <div className="fixed inset-0 z-[300] bg-black flex flex-col">
            <div className="relative flex-1">
              <Cropper
                image={imageToCrop}
                crop={crop}
                zoom={zoom}
                aspect={4/3}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>
            <div className="bg-slate-900 p-6 pb-32 flex flex-col gap-6">
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
                  className="flex-1"
                  style={{ accentColor: 'var(--brand-color)' }}
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setImageToCrop(null)}
                  className="flex-1 py-4 bg-white/10 text-white rounded-2xl font-black text-sm active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <X size={18} /> 取消
                </button>
                <button
                  type="button"
                  onClick={handleCropSave}
                  disabled={isCropping}
                  className="flex-[2] py-4 text-white rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
                  style={{ backgroundColor: 'var(--brand-color)' }}
                >
                  {isCropping ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} 
                  確認裁切
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Image Zoom Modal */}
      <AnimatePresence>
        {zoomedImage && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md" onClick={() => setZoomedImage(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative max-w-full max-h-full"
            >
              <img src={zoomedImage} className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl" alt="Zoomed" />
              <button 
                className="absolute -top-12 right-0 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white"
                onClick={() => setZoomedImage(null)}
              >
                <X size={24} />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex-1 min-h-0 flex flex-col px-6 pt-4 pb-6 overflow-y-auto no-scrollbar journal-container bg-transparent">
        <div className="flex items-center gap-2 mb-4">
          {theme === 'handdrawn' || theme === 'scrapbook' ? (
            <div className="w-12 h-12 flex items-center justify-center shrink-0">
               <img 
                 src="https://cdn.imgchest.com/files/9a147accc93b.png" 
                 onError={(e) => { (e.target as HTMLImageElement).src = 'https://i.ibb.co/Y7bFp8jC/trippic.png'; }}
                 className="w-full h-full object-contain" 
                 alt="Journal"
                 referrerPolicy="no-referrer"
               />
            </div>
          ) : theme === 'hipster' ? (
            <div className="w-12 h-12 flex items-center justify-center shrink-0">
               <img 
                 src="https://cdn.imgchest.com/files/44830eabb5ed.png" 
                 onError={(e) => { (e.target as HTMLImageElement).src = 'https://i.ibb.co/Y7bFp8jC/trippic.png'; }}
                 className="w-full h-full object-contain" 
                 alt="Journal"
                 referrerPolicy="no-referrer"
               />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm" style={{ backgroundColor: 'rgba(var(--brand-color-rgb), 0.1)', color: 'var(--brand-color)' }}>
               <PenTool size={20} />
            </div>
          )}
          <h2 className={`text-xl font-black tracking-tight ${(theme === 'handdrawn' || theme === 'scrapbook') ? 'text-stone-700' : theme === 'hipster' ? 'text-stone-800 font-hipster uppercase tracking-widest' : 'text-slate-800'}`}>旅行日誌</h2>
        </div>

        <div className="mb-4">
          <label className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] ml-2 mb-2 block">是誰寫的？</label>
          <div className="flex gap-3 overflow-x-auto no-scrollbar py-1 px-1">
            {members.map(m => (
              <button
                key={m.id}
                onClick={() => setAuthorId(m.id)}
                className="flex flex-col items-center gap-1.5 shrink-0 transition-all"
              >
                <div 
                  className={`w-11 h-11 rounded-full border-2 p-0.5 transition-all ${authorId === m.id ? 'scale-105 shadow-md' : 'border-transparent opacity-40 grayscale'}`}
                  style={{ borderColor: (authorId === m.id && theme !== 'handdrawn') ? 'var(--brand-color)' : 'transparent' }}
                >
                  <img src={m.avatar} alt={m.name} className="w-full h-full rounded-full object-cover" />
                </div>
                <span className={`text-[9px] font-black transition-colors ${authorId === m.id ? '' : 'text-slate-400'}`} style={{ color: authorId === m.id ? 'var(--brand-color)' : undefined }}>{m.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={`flex flex-col p-6 mb-8 shrink-0 ${
          theme === 'handdrawn' || theme === 'scrapbook' ? 'bg-white border-2 border-[#4B3F35]/15 rounded-xl shadow-[4px_4px_0_0_rgba(75,63,53,0.05)]' : 
          'bg-white rounded-[32px] shadow-soft border border-slate-50'
        }`}>
          <h3 className="text-base font-black text-slate-800 mb-4 items-center flex justify-between">
            我的回憶
            {isUploading && <Loader2 size={16} className="animate-spin" style={{ color: 'var(--brand-color)' }} />}
          </h3>
          
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <textarea
              value={inputContent}
              onChange={e => setInputContent(e.target.value)}
              placeholder={`${members.find(m => m.id === authorId)?.name || '我'}，今天過得怎麼樣？`}
              className="w-full p-5 rounded-[20px] bg-slate-50 border border-slate-100 outline-none resize-none text-xs font-bold text-slate-700 min-h-[100px] transition-all"
              style={{ 
                borderColor: editingId ? 'var(--brand-color)' : undefined,
                backgroundColor: editingId ? 'rgba(var(--brand-color-rgb), 0.05)' : undefined
              }}
            />

            <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <div className="w-12 h-12 bg-white rounded-xl border border-slate-200 overflow-hidden flex-shrink-0 relative group">
                {inputImage ? (
                  <>
                    <img src={inputImage} className="w-full h-full object-cover" alt="Preview" />
                    <button 
                      type="button"
                      onClick={() => setInputImage(null)}
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-200">
                    <ImageIcon size={20} />
                  </div>
                )}
              </div>
              <label className="flex-1 flex items-center justify-center gap-2 py-3 bg-white border border-slate-100 rounded-xl text-xs font-black text-slate-500 cursor-pointer hover:bg-slate-50 transition-colors">
                <Camera size={14} />
                <span>{inputImage ? '更換相片' : '新增相片'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>
            </div>

            <div className="flex gap-2">
              {editingId && (
                <button 
                  type="button" 
                  onClick={cancelEdit}
                  className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-[16px] font-black text-xs active:scale-95 transition-all"
                >
                  取消編輯
                </button>
              )}
              <button 
                type="submit" 
                disabled={isUploading}
                className="flex-[2] py-3 text-white rounded-[16px] font-black text-xs shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                style={{ backgroundColor: 'var(--brand-color)', color: 'var(--brand-text)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
              >
                {!isUploading && !editingId && <Send size={16} />}
                {isUploading ? <Loader2 size={16} className="animate-spin" /> : (editingId ? '儲存變更' : '發布日誌')}
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-4 pb-20">
          <div className="flex items-center gap-3 px-2">
            <h4 className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">過往回憶</h4>
            <div className="h-[1px] flex-1 bg-slate-100"></div>
          </div>

          {entries.map(entry => {
            const author = members.find(m => m.id === entry.authorId);
            const dateObj = new Date(entry.date);
            const dateStr = `${dateObj.getMonth()+1}/${dateObj.getDate()} ${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')}`;
            
            return (
              <div key={entry.id} className={`${
                theme === 'handdrawn' || theme === 'scrapbook' ? 'bg-white p-5 border border-[#4B3F35]/15 rounded-xl shadow-[2px_2px_0_0_rgba(75,63,53,0.02)]' : 
                'bg-white p-5 rounded-[24px] shadow-soft border border-slate-50'
              } transition-all`}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-slate-50">
                    <img src={author?.avatar} alt={author?.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1">
                    <span className="text-xs font-black text-slate-800 block leading-tight">{author?.name}</span>
                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">{dateStr}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => startEdit(entry)} className={`${theme === 'handdrawn' ? 'text-stone-300' : 'text-slate-200'} p-1.5 transition-colors`} style={{ color: editingId === entry.id ? 'var(--brand-color)' : undefined }}><Pencil size={14} /></button>
                    <button onClick={(e) => { e.stopPropagation(); setItemToDelete(entry.id); }} className={`${theme === 'handdrawn' ? 'text-stone-300' : 'text-slate-200'} p-1.5 hover:text-rose-400 transition-colors`}><X size={16} /></button>
                  </div>
                </div>
                <p className="text-xs font-bold text-slate-600 leading-relaxed whitespace-pre-wrap pl-1 mb-3">
                  {entry.content}
                </p>
                {entry.photos && entry.photos.length > 0 && (
                  <div 
                    className="rounded-2xl overflow-hidden aspect-video bg-slate-50 border border-slate-100 cursor-zoom-in"
                    onClick={() => setZoomedImage(entry.photos![0])}
                  >
                    <img src={entry.photos[0]} alt="Journal" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                )}
              </div>
            );
          })}
          
          {entries.length === 0 && (
            <div className="text-center py-20">
              <div className="w-24 h-24 bg-white rounded-[32px] flex items-center justify-center mx-auto mb-4 border border-slate-100 shadow-sm overflow-hidden">
                {theme === 'handdrawn' || theme === 'scrapbook' ? (
                  <img src="https://cdn.imgchest.com/files/9a147accc93b.png" alt="Empty" className="w-20 h-20 object-contain" referrerPolicy="no-referrer" />
                ) : theme === 'hipster' ? (
                  <img src="https://cdn.imgchest.com/files/44830eabb5ed.png" alt="Empty" className="w-20 h-20 object-contain" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-12 h-12 bg-slate-200/50 rounded-2xl"></div>
                )}
              </div>
              <p className="text-slate-300 font-bold text-xs">尚無回憶紀錄 ✨</p>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {itemToDelete && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setItemToDelete(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-xs bg-white rounded-[32px] p-8 shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-500">
                <X size={32} />
              </div>
              <h3 className="text-lg font-black text-slate-800 mb-2">確定刪除？</h3>
              <p className="text-slate-400 text-xs font-bold mb-8 leading-relaxed">
                刪除後將無法復原這篇旅行日誌。
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setItemToDelete(null)}
                  className="flex-1 py-3.5 rounded-2xl bg-slate-100 text-slate-500 text-xs font-black active:scale-95 transition-all"
                >
                  取消
                </button>
                <button 
                  onClick={handleDelete}
                  className="flex-1 py-3.5 rounded-2xl bg-rose-500 text-white text-xs font-black shadow-lg active:scale-95 transition-all shadow-rose-200"
                >
                  確定刪除
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
