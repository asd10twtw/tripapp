import React from 'react';
import { Heart, Compass, Plane, Tent, Camera, Sparkles, Ticket, Star, Footprints, MapPin, Pencil } from 'lucide-react';
import { UserProfile } from '../types';

interface BackgroundDoodlesProps {
  user: UserProfile;
}

export const BackgroundDoodles: React.FC<BackgroundDoodlesProps> = ({ user }) => {
  if (user.profileTheme !== 'handdrawn' && user.profileTheme !== 'scrapbook') return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 bg-[#F9F5E6]">
      {/* Background paper texture/dots */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ 
        backgroundImage: 'radial-gradient(#4B3F35 1px, transparent 1px)', 
        backgroundSize: '24px 24px' 
      }} />

      {/* Spaced out color doodles - No central overlaps or black-and-white icons */}
      <div className="absolute top-[8%] left-[6%] rotate-[-15deg] text-rose-500 opacity-25">
        <Heart size={42} strokeWidth={2.5} fill="currentColor" />
      </div>
      <div className="absolute top-[12%] right-[8%] rotate-[12deg] text-sky-500 opacity-25">
        <Compass size={48} strokeWidth={2.5} />
      </div>

      <div className="absolute top-[28%] left-[10%] rotate-[10deg] text-amber-500 opacity-20">
        <Star size={38} strokeWidth={2.5} fill="currentColor" />
      </div>
      <div className="absolute top-[45%] right-[10%] rotate-[-10deg] text-rose-400 opacity-20">
        <Heart size={40} strokeWidth={2.5} />
      </div>

      <div className="absolute top-[65%] left-[8%] rotate-[-12deg] text-emerald-500 opacity-25">
        <Footprints size={50} strokeWidth={2.5} />
      </div>
      <div className="absolute top-[48%] left-[12%] rotate-[-10deg] text-sky-400 opacity-20">
        <Plane size={44} strokeWidth={2.5} />
      </div>

      <div className="absolute bottom-[20%] right-[12%] rotate-[10deg] text-rose-400 opacity-25">
        <Ticket size={48} strokeWidth={2.5} />
      </div>

      <div className="absolute bottom-[8%] left-[10%] rotate-[15deg] text-amber-600 opacity-25">
        <Camera size={42} strokeWidth={2.5} />
      </div>
    </div>
  );
};
