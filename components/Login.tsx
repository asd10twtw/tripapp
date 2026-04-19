
import React from 'react';
import { loginWithGoogle } from '../services/firebase';
import { motion } from 'motion/react';

export const Login: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#FCFBF7] flex flex-col items-center justify-center p-8">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm text-center"
      >
        <div className="mb-12">
          <div className="w-24 h-24 mx-auto mb-6 overflow-hidden flex items-center justify-center">
            <img src="https://cdn.imgchest.com/files/304395563b1e.png" alt="GoGoTrip Icon" className="w-full h-full object-contain" />
          </div>

          <h1 className="text-3xl font-black text-slate-800 tracking-tight mb-2">GoGoTrip</h1>
        </div>

        <button 
          onClick={loginWithGoogle}
          className="w-full bg-white border-2 border-slate-100 p-4 rounded-3xl flex items-center justify-center gap-3 shadow-soft hover:bg-slate-50 transition-all active:scale-95"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
          <span className="text-slate-700 font-black text-sm">使用 Google 帳號登入</span>
        </button>

        <p className="mt-8 text-[10px] text-slate-300 font-bold uppercase tracking-widest leading-relaxed">
          登入即代表您同意我們的<br/>服務條款與隱私權政策
        </p>
      </motion.div>
    </div>
  );
};
