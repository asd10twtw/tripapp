
import React, { useState, useEffect } from 'react';
import { PenTool, Send, X, Pencil, Trash2 } from 'lucide-react';
import { db } from '../services/firebase';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { JournalEntry, Member } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface JournalViewProps {
  members: Member[];
  tripId: string;
  theme?: string;
}

export const JournalView: React.FC<JournalViewProps> = ({ members, tripId, theme }) => {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [inputContent, setInputContent] = useState('');
  const [authorId, setAuthorId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  
  useEffect(() => {
    if (members.length > 0 && !authorId) {
        setAuthorId(members[0].id);
    }
  }, [members, authorId]);

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
          ...data
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
      if (editingId) {
          await updateDoc(doc(db, 'trips', tripId, 'journal', editingId), {
              content: inputContent,
              authorId: authorId,
          });
          setEditingId(null);
      } else {
          await addDoc(collection(db, 'trips', tripId, 'journal'), {
            content: inputContent,
            date: new Date().toISOString(),
            authorId: authorId,
          });
      }
      setInputContent('');
    } catch (error) {
      console.error("Error posting journal: ", error);
    }
  };

  const startEdit = (entry: JournalEntry) => {
      setEditingId(entry.id);
      setInputContent(entry.content);
      setAuthorId(entry.authorId);
      const container = document.querySelector('.journal-container');
      if (container) container.scrollTop = 0;
  }

  const cancelEdit = () => {
      setEditingId(null);
      setInputContent('');
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
    <div className="flex-1 min-h-0 flex flex-col p-6 overflow-y-auto no-scrollbar journal-container bg-transparent">
      <div className="flex items-center gap-2 mb-6">
        {theme === 'handdrawn' || theme === 'scrapbook' ? (
          <div className="w-12 h-12 flex items-center justify-center shrink-0">
             <img 
               src="/a1.png" 
               className="w-full h-full object-contain" 
               alt="Journal"
               referrerPolicy="no-referrer"
             />
          </div>
        ) : theme === 'hipster' ? (
          <div className="w-12 h-12 flex items-center justify-center shrink-0">
             <img 
               src="/a2.png" 
               className="w-full h-full object-contain" 
               alt="Journal"
               referrerPolicy="no-referrer"
             />
          </div>
        ) : (
          <div className="w-10 h-10 bg-sky-50 rounded-xl flex items-center justify-center text-sky-400 shrink-0 shadow-sm">
             <PenTool size={20} />
          </div>
        )}
        <h2 className={`text-xl font-black tracking-tight ${(theme === 'handdrawn' || theme === 'scrapbook') ? 'text-stone-700' : theme === 'hipster' ? 'text-stone-800 font-hipster uppercase tracking-widest' : 'text-slate-800'}`}>旅行日誌</h2>
      </div>

      <div className="mb-6">
        <label className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] ml-2 mb-3 block">是誰寫的？</label>
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

      <div className={`flex flex-col p-6 flex-1 mb-8 ${
        theme === 'handdrawn' ? 'bg-white border-2 border-[#4B3F35]/10 shadow-[4px_4px_0_0_rgba(75,63,53,0.05)]' : 
        'bg-white rounded-[32px] shadow-soft border border-slate-50'
      }`}>
        <h3 className="text-base font-black text-slate-800 mb-4">我的回憶</h3>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <textarea
            value={inputContent}
            onChange={e => setInputContent(e.target.value)}
            placeholder={`${members.find(m => m.id === authorId)?.name || '我'}，今天過得怎麼樣？`}
            className="w-full p-5 rounded-[20px] bg-slate-50 border border-slate-100 outline-none resize-none text-xs font-bold text-slate-700 min-h-[120px] transition-all"
            style={{ 
              borderColor: editingId ? 'var(--brand-color)' : undefined,
              backgroundColor: editingId ? 'rgba(var(--brand-color-rgb), 0.05)' : undefined
            }}
          />
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
              className="flex-[2] py-3 text-white rounded-[16px] font-black text-xs shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
              style={{ backgroundColor: 'var(--brand-color)', color: 'var(--brand-text)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
            >
              <Send size={16} />
              {editingId ? '儲存變更' : '發布日誌'}
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
              theme === 'handdrawn' ? 'bg-white p-5 border border-[#4B3F35]/10 shadow-[2px_2px_0_0_rgba(75,63,53,0.02)]' : 
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
              <p className="text-xs font-bold text-slate-600 leading-relaxed whitespace-pre-wrap pl-1">
                {entry.content}
              </p>
            </div>
          );
        })}
        
        {entries.length === 0 && (
          <div className="text-center py-20">
            <div className="w-24 h-24 bg-slate-50 rounded-[32px] flex items-center justify-center mx-auto mb-4 border border-slate-100 shadow-sm">
              <div className="w-12 h-12 bg-slate-200/50 rounded-2xl"></div>
            </div>
            <p className="text-slate-300 font-bold text-xs">還沒有日記，來寫下第一篇回憶吧！ ✨</p>
          </div>
        )}
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
    </div>
  );
};
