import React from 'react';
import { Heart, Compass, Plane, Tent, Camera, Sparkles, Ticket, Star, Footprints, MapPin, Pencil } from 'lucide-react';
import { UserProfile } from '../types';

interface BackgroundDoodlesProps {
  user: UserProfile;
}

export const BackgroundDoodles: React.FC<BackgroundDoodlesProps> = ({ user }) => {
  if (user.profileTheme !== 'handdrawn' && user.profileTheme !== 'scrapbook') return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 bg-[var(--bg-color)]">
      {/* Background paper texture/dots */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ 
        backgroundImage: 'radial-gradient(rgba(var(--brand-color-rgb), 0.3) 1px, transparent 1px)', 
        backgroundSize: '24px 24px' 
      }} />

      {/* Distributed color doodles - Averaged out across screen space */}
      <div className="absolute top-[8%] left-[15%] rotate-[-15deg] text-rose-500 opacity-20">
        <Heart size={42} strokeWidth={2.5} fill="currentColor" />
      </div>
      <div className="absolute top-[15%] right-[20%] rotate-[12deg] text-sky-500 opacity-20">
        <Compass size={48} strokeWidth={2.5} />
      </div>

      <div className="absolute top-[35%] left-[25%] rotate-[10deg] text-amber-500 opacity-15">
        <Star size={38} strokeWidth={2.5} fill="currentColor" />
      </div>
      <div className="absolute top-[42%] right-[15%] rotate-[-10deg] text-rose-400 opacity-15">
        <Heart size={40} strokeWidth={2.5} />
      </div>

      <div className="absolute top-[58%] left-[18%] rotate-[-12deg] text-emerald-500 opacity-20">
        <Footprints size={50} strokeWidth={2.5} />
      </div>
      <div className="absolute top-[52%] right-[30%] rotate-[-10deg] text-sky-400 opacity-15">
        <Plane size={44} strokeWidth={2.5} />
      </div>

      <div className="absolute bottom-[25%] right-[20%] rotate-[10deg] text-rose-400 opacity-20">
        <Ticket size={48} strokeWidth={2.5} />
      </div>

      <div className="absolute bottom-[12%] left-[28%] rotate-[15deg] text-amber-600 opacity-20">
        <Camera size={42} strokeWidth={2.5} />
      </div>
    </div>
  );
};
