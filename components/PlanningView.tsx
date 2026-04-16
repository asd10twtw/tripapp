
import React, { useState, useEffect } from 'react';
import { TodoItem, Member } from '../types';
import { User } from 'firebase/auth';
import { Check, Plus, ShoppingBasket, Trash2, MapPin, Image as ImageIcon, Camera, X, Loader2 } from 'lucide-react';
import { db } from '../services/firebase';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, deleteDoc, orderBy } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';

interface PlanningViewProps {
  members: Member[];
  tripId: string;
  currentUser: User;
  theme?: string;
}

export const PlanningView: React.FC<PlanningViewProps> = ({ members, tripId, currentUser, theme }) => {
  const activeTab = 'shopping';
  const [activeMemberId, setActiveMemberId] = useState<string>('');
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [newItemText, setNewItemText] = useState('');
  const [newItemLocation, setNewItemLocation] = useState('');
  const [newItemImage, setNewItemImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  useEffect(() => {
    if (members.length > 0 && !activeMemberId) {
        setActiveMemberId(currentUser.uid);
    }
  }, [members, activeMemberId, currentUser.uid]);

  useEffect(() => {
    const q = query(collection(db, 'trips', tripId, 'todos'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTodos(snapshot.docs.map(doc => {
        const data = doc.data() as any;
        // Normalize legacy IDs: Map m2 to current user UID
        if (data.ownerId === 'm2') data.ownerId = currentUser.uid;
        return { id: doc.id, ...data } as TodoItem;
      }));
    });
    return () => unsubscribe();
  }, [tripId, currentUser.uid]);

  const activeMember = members.find(m => m.id === activeMemberId);
  // Be more flexible with legacy data: include items with missing type or different ownerId if they match the current member
  const filteredTodos = todos.filter(t => {
    const isOwner = t.ownerId === activeMemberId;
    const isType = t.type === activeTab || !t.type || t.type === 'todo';
    return isOwner && isType;
  });

  const toggleTodo = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'trips', tripId, 'todos', id), { completed: !currentStatus });
    } catch (err) {
      console.error("Update failed:", err);
    }
  };

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemText.trim() || !activeMemberId) return;
    
    try {
      await addDoc(collection(db, 'trips', tripId, 'todos'), { 
        text: newItemText, 
        location: newItemLocation,
        image: newItemImage,
        completed: false, 
        ownerId: activeMemberId, 
        type: activeTab, 
        createdAt: new Date().toISOString() 
      });
      setNewItemText('');
      setNewItemLocation('');
      setNewItemImage(null);
      setShowAddModal(false);
    } catch (err) {
      console.error("Add failed:", err);
      alert("新增失敗，請檢查網路連線");
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      alert('圖片太大囉！請選擇小於 1MB 的圖片。');
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      setNewItemImage(reader.result as string);
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDoc(doc(db, 'trips', tripId, 'todos', itemToDelete));
      setItemToDelete(null);
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  return (
    <div className="h-full flex flex-col p-6 overflow-y-auto no-scrollbar bg-transparent">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--brand-color)', opacity: 0.1 }}>
            <ShoppingBasket size={20} style={{ color: 'var(--brand-color)' }} />
          </div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight">購物清單</h2>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg active:scale-95 transition-all"
          style={{ backgroundColor: 'var(--brand-color)', boxShadow: '0 10px 15px -3px rgba(var(--brand-color-rgb), 0.3)' }}
        >
          <Plus size={24} strokeWidth={3} />
        </button>
      </div>

      <div className="mb-6">
        <label className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] ml-2 mb-3 block">是誰想買？</label>
        <div className="flex gap-3 overflow-x-auto no-scrollbar py-1 px-1">
          {members.map(m => (
            <button
              key={m.id}
              onClick={() => setActiveMemberId(m.id)}
              className="flex flex-col items-center gap-1.5 shrink-0 transition-all"
            >
              <div 
                className={`w-11 h-11 rounded-full border-2 p-0.5 transition-all ${activeMemberId === m.id ? 'scale-105 shadow-md' : 'border-transparent opacity-40 grayscale'}`}
                style={{ borderColor: (activeMemberId === m.id && theme !== 'handdrawn') ? 'var(--brand-color)' : 'transparent' }}
              >
                <img src={m.avatar} alt={m.name} className="w-full h-full rounded-full object-cover" />
              </div>
              <span className={`text-[9px] font-black transition-colors ${activeMemberId === m.id ? '' : 'text-slate-400'}`} style={{ color: activeMemberId === m.id ? 'var(--brand-color)' : undefined }}>{m.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={`flex-1 backdrop-blur-sm p-6 flex flex-col ${
        theme === 'handdrawn' ? 'bg-white border-2 border-[#4B3F35]/10 shadow-[4px_4px_0_0_rgba(75,63,53,0.05)]' : 
        'bg-white/80 rounded-[32px] shadow-soft border border-slate-50'
      }`}>
        <h3 className="text-base font-black text-slate-800 mb-4">{activeMember?.name} 的願望</h3>
        
        <div className="space-y-3 overflow-y-auto no-scrollbar pb-10">
          {filteredTodos.map(item => (
            <div 
              key={item.id} 
              className={`flex flex-col p-4 transition-all ${
                theme === 'handdrawn' ? 'bg-white border border-[#4B3F35]/10 shadow-[2px_2px_0_0_rgba(75,63,53,0.02)]' : 
                'bg-white rounded-[24px] border border-slate-100 shadow-sm'
              } ${item.completed ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start gap-3">
                <div 
                  onClick={() => toggleTodo(item.id, item.completed)}
                  className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all cursor-pointer ${item.completed ? 'border-transparent' : 'border-slate-200 bg-white'}`}
                  style={{ backgroundColor: item.completed ? 'var(--brand-color)' : undefined }}
                >
                  {item.completed && <Check size={14} style={{ color: 'var(--brand-text)' }} strokeWidth={4} />}
                </div>
                
                <div className="flex-1 min-w-0" onClick={() => toggleTodo(item.id, item.completed)}>
                  <h4 className={`text-sm font-black break-all ${item.completed ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                    {item.text}
                  </h4>
                  {item.location && (
                    <div className="flex items-center gap-1 mt-1 text-slate-400">
                      <MapPin size={10} />
                      <span className="text-[10px] font-bold truncate">{item.location}</span>
                    </div>
                  )}
                </div>

                <button 
                  onClick={(e) => { e.stopPropagation(); setItemToDelete(item.id); }} 
                  className={`${theme === 'handdrawn' ? 'text-stone-300' : 'text-slate-200'} p-1 hover:text-rose-400 transition-colors shrink-0`}
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {item.image && (
                <div 
                  className="mt-3 rounded-2xl overflow-hidden aspect-video bg-slate-50 border border-slate-100 cursor-zoom-in"
                  onClick={(e) => { e.stopPropagation(); setZoomedImage(item.image!); }}
                >
                  <img src={item.image} alt={item.text} className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          ))}
          {filteredTodos.length === 0 && (
            <div className="text-center py-10">
              <div className="w-20 h-20 bg-slate-50 rounded-[24px] flex items-center justify-center mx-auto mb-4 border border-slate-100 shadow-sm">
                <ShoppingBasket size={32} className="text-slate-200" />
              </div>
              <p className="text-slate-300 font-bold text-xs">還沒有心願項目 ✨</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Item Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-xs bg-white rounded-[32px] p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black text-slate-800">新增購物項目</h3>
                <button onClick={() => setShowAddModal(false)} className="text-slate-300">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={addItem} className="space-y-4">
                <div>
                  <label className="text-[8px] font-black text-slate-300 uppercase tracking-widest block ml-1 mb-1">商品名稱</label>
                  <input 
                    type="text" 
                    value={newItemText}
                    onChange={(e) => setNewItemText(e.target.value)}
                    placeholder="例如：首爾限定咖啡豆"
                    className="w-full p-3 bg-slate-50 rounded-2xl text-sm font-bold border-none outline-none focus:ring-1"
                    required
                  />
                </div>

                <div>
                  <label className="text-[8px] font-black text-slate-300 uppercase tracking-widest block ml-1 mb-1">購買地點</label>
                  <input 
                    type="text" 
                    value={newItemLocation}
                    onChange={(e) => setNewItemLocation(e.target.value)}
                    placeholder="例如：聖水洞 Blue Bottle"
                    className="w-full p-3 bg-slate-50 rounded-2xl text-sm font-bold border-none outline-none focus:ring-1"
                  />
                </div>

                <div>
                  <label className="text-[8px] font-black text-slate-300 uppercase tracking-widest block ml-1 mb-1">商品照片</label>
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 overflow-hidden flex-shrink-0">
                      {isUploading ? (
                        <div className="w-full h-full flex items-center justify-center">
                          <Loader2 size={16} className="animate-spin text-slate-300" />
                        </div>
                      ) : newItemImage ? (
                        <img src={newItemImage} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-200">
                          <ImageIcon size={20} />
                        </div>
                      )}
                    </div>
                    <label className="flex-1 flex items-center justify-center gap-2 p-3 bg-slate-50 rounded-2xl text-xs font-bold text-slate-500 cursor-pointer hover:bg-slate-100 transition-colors">
                      <Camera size={14} />
                      <span>上傳照片</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </label>
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full py-4 text-white text-sm font-black rounded-2xl shadow-lg active:scale-95 transition-all mt-4"
                  style={{ backgroundColor: 'var(--brand-color)', color: 'var(--brand-text)' }}
                >
                  加入清單
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                <Trash2 size={32} />
              </div>
              <h3 className="text-lg font-black text-slate-800 mb-2">確定刪除？</h3>
              <p className="text-slate-400 text-xs font-bold mb-8 leading-relaxed">
                刪除後將無法復原此購物項目。
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setItemToDelete(null)}
                  className="flex-1 py-3.5 rounded-2xl bg-slate-100 text-slate-500 text-xs font-black active:scale-95 transition-all"
                >
                  取消
                </button>
                <button 
                  onClick={handleDeleteItem}
                  className="flex-1 py-3.5 rounded-2xl bg-rose-500 text-white text-xs font-black shadow-lg active:scale-95 transition-all shadow-rose-200"
                >
                  確定刪除
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Image Zoom Modal */}
      <AnimatePresence>
        {zoomedImage && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md" onClick={() => setZoomedImage(null)}>
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
    </div>
  );
};
