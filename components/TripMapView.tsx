
import React, { useState, useMemo, useCallback, memo } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow, useMap, Polyline, useMapsLibrary } from '@vis.gl/react-google-maps';
import { ScheduleEvent } from '../types';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../constants';
import { X, Navigation, MapPin, ChevronRight, Edit2, Loader2, Search } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

interface TripMapViewProps {
  tripId: string;
  events: ScheduleEvent[];
  selectedDate: string;
  startDate: string;
  onClose: () => void;
  dates?: { val: string; display: string }[];
  onDateChange?: (date: string) => void;
}

const MemoizedMarker = memo(({ 
  event, 
  index, 
  onClick, 
  onDragEnd 
}: { 
  event: ScheduleEvent, 
  index: number, 
  onClick: (e: any) => void,
  onDragEnd: (e: any) => void
}) => {
  const catColor = CATEGORY_COLORS[event.category]?.split(' ')[0].replace('bg-', '') || '#475569';
  
  return (
    <AdvancedMarker
      position={event.coordinates}
      onClick={onClick}
      draggable={true}
      onDragEnd={onDragEnd}
    >
      <div className="relative group flex flex-col items-center">
        {/* Circle Pin Body - Dark background for extreme contrast */}
        <div 
          className="w-6 h-6 rounded-full flex items-center justify-center border-[2.5px] shadow-[0_8px_20px_-4px_rgba(0,0,0,0.5)] transition-all group-hover:scale-110 z-10 bg-slate-900" 
          style={{ borderColor: catColor }}
        >
          <span className="text-white text-[12px] font-black leading-none">{index + 1}</span>
        </div>
        {/* Pin Tail - Matches category color for quick identification */}
        <div 
          className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] -mt-1 shadow-lg z-0"
          style={{ borderTopColor: catColor }}
        />
      </div>
    </AdvancedMarker>
  );
});

const TripMapViewContent: React.FC<TripMapViewProps> = ({ tripId, events, selectedDate, startDate, onClose, dates = [], onDateChange }) => {
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSearching, setIsSearching] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [candidates, setCandidates] = useState<any[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  const map = useMap();
  const geocodingLib = useMapsLibrary('geocoding');
  const geocoder = useMemo(() => geocodingLib ? new geocodingLib.Geocoder() : null, [geocodingLib]);

  const filteredEvents = useMemo(() => {
    return events
      .filter(e => e.date === selectedDate && e.coordinates && typeof e.coordinates.lat === 'number')
      .sort((a, b) => {
        const orderA = a.sortOrder ?? 999;
        const orderB = b.sortOrder ?? 999;
        if (orderA !== orderB) return orderA - orderB;
        if (a.time && b.time) return a.time.localeCompare(b.time);
        if (a.time) return -1;
        if (b.time) return 1;
        return (a.createdAt || '').localeCompare(b.createdAt || '');
      });
  }, [events, selectedDate]);

  const handleEventClick = (event: ScheduleEvent) => {
    setSelectedEvent(event);
    if (map && event.coordinates) {
      map.panTo(event.coordinates);
      map.setZoom(16);
    }
  };

  const handleMarkerDragEnd = useCallback(async (event: ScheduleEvent, e: any) => {
    if (!e.latLng) return;
    const newCoords = { lat: e.latLng.lat(), lng: e.latLng.lng() };
    
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, 'trips', tripId, 'events', event.id), {
        coordinates: newCoords
      });
    } catch (err) {
      console.error("Failed to update marker location:", err);
    } finally {
      setIsUpdating(false);
    }
  }, [tripId]);

  const startSearch = (event: ScheduleEvent) => {
    setIsSearching(event.id);
    setSearchText(event.location);
    setCandidates([]);
    setSearchError(null);
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!geocoder || !searchText.trim() || !isSearching || isUpdating) return;

    setIsUpdating(true);
    setSearchError(null);
    setCandidates([]);

    geocoder.geocode({ address: searchText }, async (results, status) => {
      setIsUpdating(false);
      if (status === 'OK' && results && results.length > 0) {
        if (results.length === 1) {
          await performUpdate(isSearching, results[0]);
        } else {
          setCandidates(results);
        }
      } else {
        setSearchError("找不到該地點。");
      }
    });
  };

  const performUpdate = async (eventId: string, result: any) => {
    const { lat, lng } = result.geometry.location;
    const newCoords = { lat: lat(), lng: lng() };
    
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, 'trips', tripId, 'events', eventId), {
        coordinates: newCoords
      });
      setIsSearching(null);
      setCandidates([]);
      if (selectedEvent?.id === eventId && map) {
        map.panTo(newCoords);
      }
    } catch (err) {
      setSearchError("更新失敗。");
    } finally {
      setIsUpdating(false);
    }
  };

  const displayHeader = useMemo(() => {
    if (selectedDate === 'PRE_TRIP') return '行前準備';
    
    try {
      const start = new Date(startDate);
      const current = new Date(selectedDate);
      const diffTime = current.getTime() - start.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      const dateStr = `${current.getMonth() + 1}/${current.getDate()}`;
      return `Day ${diffDays} · ${dateStr}`;
    } catch (e) {
      return selectedDate;
    }
  }, [selectedDate, startDate]);

  const center = useMemo(() => {
    if (filteredEvents.length > 0) {
      return filteredEvents[0].coordinates;
    }
    return { lat: 25.0330, lng: 121.5654 }; // Default to Taipei
  }, [filteredEvents]);

  const polylinePath = useMemo(() => {
    return filteredEvents.map(e => e.coordinates!);
  }, [filteredEvents]);

  // Center map on day change
  React.useEffect(() => {
    if (map && filteredEvents.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      filteredEvents.forEach(e => {
        if (e.coordinates) bounds.extend(e.coordinates);
      });
      map.fitBounds(bounds, { top: 40, bottom: 40, left: 40, right: 40 });
      if (filteredEvents.length === 1) {
        map.setZoom(15);
      }
    }
  }, [selectedDate, map, filteredEvents]);

  return (
    <div className="fixed inset-0 z-[1100] bg-white flex flex-col md:flex-row">
      {/* Sidebar List (Mobile: Bottom, Desktop: Left) */}
      <div className="order-2 md:order-1 h-[40vh] md:h-full md:w-80 bg-white border-t md:border-t-0 md:border-r border-slate-100 flex flex-col shadow-2xl z-10">
        <div className="py-2.5 px-6 border-b border-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {onDateChange && dates.length > 0 && (
              <button 
                onClick={() => {
                  const idx = dates.findIndex(d => d.val === selectedDate);
                  if (idx > 0) onDateChange(dates[idx - 1].val);
                }}
                disabled={dates.findIndex(d => d.val === selectedDate) <= 0}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 disabled:opacity-20 transition-colors"
              >
                {/* Actually let's use Lucide's ChevronLeft or something */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </button>
            )}
            <h3 className="font-black text-slate-800 text-lg tracking-tight leading-none italic uppercase">
              {displayHeader}
            </h3>
            {onDateChange && dates.length > 0 && (
              <button 
                onClick={() => {
                  const idx = dates.findIndex(d => d.val === selectedDate);
                  if (idx !== -1 && idx < dates.length - 1) onDateChange(dates[idx + 1].val);
                }}
                disabled={dates.findIndex(d => d.val === selectedDate) >= dates.length - 1}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 disabled:opacity-20 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            )}
          </div>
          <button onClick={onClose} className="hidden md:flex p-2 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-100 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto px-4 pt-1.5 pb-6 custom-scrollbar">
          {filteredEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 opacity-40">
              <MapPin size={40} className="mb-3 text-slate-300" />
              <p className="text-[10px] font-black uppercase tracking-[0.1em]">目前沒有座標</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredEvents.map((event, i) => (
                <div key={event.id} className="relative">
                  <div 
                    className={`flex items-start gap-4 p-4 rounded-2xl transition-all cursor-pointer group border ${
                      selectedEvent?.id === event.id 
                        ? 'bg-blue-50 border-blue-100 shadow-lg shadow-blue-500/10' 
                        : 'bg-white border-slate-50 hover:border-slate-200 hover:shadow-md'
                    }`}
                    onClick={() => handleEventClick(event)}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 transition-colors ${
                      selectedEvent?.id === event.id ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-800 group-hover:text-white'
                    }`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <p className={`text-sm font-black truncate ${selectedEvent?.id === event.id ? 'text-blue-900' : 'text-slate-800'}`}>
                        {event.location}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase transition-colors ${
                          CATEGORY_COLORS[event.category]?.split(' ')[0] || 'bg-slate-100'
                        } ${CATEGORY_COLORS[event.category]?.split(' ')[1] || 'text-slate-500'}`}>
                          {event.category}
                        </span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); startSearch(event); }}
                          className="p-1 hover:bg-blue-100 rounded text-blue-400 transition-colors"
                          title="修正座標"
                        >
                          <Search size={10} />
                        </button>
                      </div>
                    </div>
                    <ChevronRight size={14} className={`mt-1.5 transition-transform ${selectedEvent?.id === event.id ? 'text-blue-400 translate-x-1' : 'text-slate-200 group-hover:text-slate-400'}`} />
                  </div>

                  {/* Inline Search UI */}
                  {isSearching === event.id && (
                    <div className="absolute inset-0 z-20 bg-white/98 backdrop-blur-sm rounded-2xl border-2 border-blue-400 p-3 shadow-2xl flex flex-col">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest leading-none">搜尋正確座標</p>
                        <button onClick={() => setIsSearching(null)}><X size={14} className="text-slate-400" /></button>
                      </div>
                      <form onSubmit={handleSearchSubmit} className="relative mb-2">
                        <input 
                          autoFocus
                          type="text" 
                          value={searchText}
                          onChange={(e) => setSearchText(e.target.value)}
                          className="w-full bg-slate-100 border-none rounded-xl px-3 py-2.5 text-xs font-bold focus:ring-2 focus:ring-blue-500 pr-9 shadow-inner"
                          placeholder="重新搜尋地點..."
                        />
                        <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center bg-blue-500 text-white rounded-lg shadow-sm">
                          <Search size={14} />
                        </button>
                      </form>
                      {searchError && <p className="text-[9px] text-rose-500 font-bold px-1 mb-2">{searchError}</p>}
                      <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar pr-1">
                        {candidates.map((res, ci) => (
                          <button 
                            key={ci} 
                            onClick={() => performUpdate(event.id, res)}
                            className="w-full text-left p-2.5 rounded-xl hover:bg-blue-50 border border-transparent hover:border-blue-100 transition-all flex gap-3 group"
                          >
                            <MapPin size={12} className="text-slate-300 mt-0.5 group-hover:text-blue-400" />
                            <p className="text-[10px] font-bold text-slate-700 leading-snug">{res.formatted_address}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 relative order-1 md:order-2">
        <Map
          defaultCenter={center}
          defaultZoom={13}
          gestureHandling={'greedy'}
          disableDefaultUI={true}
          mapId="trip_full_map"
        >
          {filteredEvents.map((event, index) => (
            <MemoizedMarker
              key={event.id}
              event={event}
              index={index}
              onClick={() => handleEventClick(event)}
              onDragEnd={(e) => handleMarkerDragEnd(event, e)}
            />
          ))}

          <Polyline
            path={polylinePath}
            options={{
              strokeColor: '#3b82f6',
              strokeOpacity: 0.3,
              strokeWeight: 4,
            }}
          />

          {selectedEvent && selectedEvent.coordinates && (
            <InfoWindow
              position={selectedEvent.coordinates}
              onCloseClick={() => setSelectedEvent(null)}
              headerDisabled={true}
              // Adjust InfoWindow styles to minimize blank space
            >
              <div className="p-2 min-w-[140px] bg-white rounded-lg">
                <div className="flex items-center gap-1.5 mb-1">
                   <div className={`w-1.5 h-1.5 rounded-full ${CATEGORY_COLORS[selectedEvent.category]?.split(' ')[0] || 'bg-slate-400'}`} />
                   <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">{selectedEvent.category}</span>
                </div>
                <h4 className="font-black text-slate-900 text-sm leading-tight">{selectedEvent.location}</h4>
                {selectedEvent.time && (
                  <p className="text-[10px] font-bold text-blue-500 mt-0.5">{selectedEvent.time}</p>
                )}
              </div>
            </InfoWindow>
          )}
        </Map>

        <button 
          onClick={onClose} 
          className="absolute top-4 left-4 p-3 bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200 active:scale-95 transition-all md:hidden"
        >
          <X size={20} className="text-slate-800" />
        </button>

        {isUpdating && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-2xl flex items-center gap-2 z-50">
            <Loader2 size={12} className="animate-spin" />
            更新中...
          </div>
        )}
      </div>
    </div>
  );
};

export const TripMapView: React.FC<TripMapViewProps> = (props) => {
  const apiKey = (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyBhZtrsN7V57zWxZ6aKzvoYrtU4hh5MV1M';
  return (
    <APIProvider apiKey={apiKey} libraries={['marker', 'geocoding']}>
      <TripMapViewContent {...props} />
    </APIProvider>
  );
};

// Simple Haversine distance
function calculateDistance(point1: {lat: number, lng: number}, point2: {lat: number, lng: number}) {
  const R = 6371; // km
  const dLat = (point2.lat - point1.lat) * Math.PI / 180;
  const dLng = (point2.lng - point1.lng) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const d = R * c;
  if (d < 1) return `${(d * 1000).toFixed(0)}m`;
  return `${d.toFixed(1)}km`;
}
