
import React from 'react';
import { loginWithGoogle } from '../services/firebase';
import { motion } from 'motion/react';

import { Loader2 } from 'lucide-react';

export const Login: React.FC = () => {
  const [loading, setLoading] = React.useState(false);

  const handleLogin = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await loginWithGoogle();
    } catch (error: any) {
      // Error handling is inside loginWithGoogle, but we need to reset loading
      console.log("Login error caught in component:", error.code);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FCFBF7] flex flex-col items-center justify-center p-8">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm text-center"
      >
        <div className="mb-12">
          <div className="w-32 h-32 mx-auto mb-6 flex items-center justify-center">
            <img src="https://i.ibb.co/Y7bFp8jC/trippic.png" alt="GoGoTrip Icon" className="w-full h-full object-contain" />
          </div>

          <h1 className="text-4xl font-black text-slate-800 tracking-tight mb-2">GoGoTrip</h1>
        </div>

        <button 
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-white border-2 border-slate-100 p-4 rounded-3xl flex items-center justify-center gap-3 shadow-soft hover:bg-slate-50 transition-all active:scale-95 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          ) : (
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
          )}
          <span className="text-slate-700 font-black text-sm">
            {loading ? '正在連結 Google...' : '使用 Google 帳號登入'}
          </span>
        </button>

        <p className="mt-8 text-[10px] text-slate-300 font-bold uppercase tracking-widest leading-relaxed">
          登入即代表您同意我們的<br/>服務條款與隱私權政策
        </p>
      </motion.div>
    </div>
  );
};
