
import React, { useState, useCallback, useMemo, useEffect, useRef, memo } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { X, Search, MapPin, Check, Loader2, Info } from 'lucide-react';

interface LocationPickerProps {
  initialLocation?: string;
  onSelect: (coords: { lat: number; lng: number }, name: string) => void;
  onClose: () => void;
}

const MapHandler = ({ center }: { center: { lat: number, lng: number } }) => {
  const map = useMap();
  useEffect(() => {
    if (map && center) {
      map.panTo(center);
    }
  }, [map, center]);
  return null;
};

const LocationPickerContent: React.FC<LocationPickerProps> = ({ initialLocation, onSelect, onClose }) => {
  const [searchText, setSearchText] = useState(initialLocation || '');
  const [center, setCenter] = useState({ lat: 25.0330, lng: 121.5654 }); // 預設台北
  const [markerPos, setMarkerPos] = useState<{ lat: number, lng: number } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<{msg: string, code: string} | null>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  
  const geocodingLib = useMapsLibrary('geocoding');
  const placesLib = useMapsLibrary('places');
  
  const geocoder = useMemo(() => geocodingLib ? new geocodingLib.Geocoder() : null, [geocodingLib]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchText.trim() || !geocoder) return;

    setIsSearching(true);
    setError(null);
    setCandidates([]);

    geocoder.geocode({ address: searchText }, (results, status) => {
      setIsSearching(false);
      if (status === 'OK' && results && results.length > 0) {
        if (results.length === 1) {
          const { lat, lng } = results[0].geometry.location;
          const newPos = { lat: lat(), lng: lng() };
          setCenter(newPos);
          setMarkerPos(newPos);
        } else {
          setCandidates(results);
          // 預設先看第一個
          const { lat, lng } = results[0].geometry.location;
          setCenter({ lat: lat(), lng: lng() });
        }
      } else {
        let msg = "找不到此地點，請嘗試輸入更詳細的名稱 (例如：首爾市)。";
        if (status === 'REQUEST_DENIED') msg = "搜尋服務未授權。您仍可直接在地圖上點擊位置來標記。";
        setError({ msg, code: status });
      }
    });
  };

  const selectCandidate = (result: any) => {
    const { lat, lng } = result.geometry.location;
    const newPos = { lat: lat(), lng: lng() };
    setCenter(newPos);
    setMarkerPos(newPos);
    setCandidates([]);
  };

  const onMapClick = useCallback((e: any) => {
    if (e.detail.latLng) {
      setMarkerPos(e.detail.latLng);
      setCenter(e.detail.latLng);
      setCandidates([]);
    }
  }, []);

  const handleConfirm = () => {
    if (markerPos) {
      onSelect(markerPos, searchText);
    }
  };

  return (
    <div className="fixed inset-0 z-[1200] bg-white flex flex-col animate-in slide-in-from-bottom duration-300">
      <div className="p-4 flex items-center justify-between border-b border-slate-100 bg-white z-10">
        <div className="flex-1 mr-4">
          <form onSubmit={handleSearch} className="relative">
            <input
              ref={inputRef}
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="搜尋地點，例如：首爾 弘大"
              className="w-full pl-10 pr-10 py-2.5 bg-slate-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <button 
              type="submit"
              disabled={!geocoder || isSearching}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            </button>
          </form>
        </div>
        <button onClick={onClose} className="p-2 bg-slate-50 text-slate-400 rounded-full active:scale-90 transition-transform">
          <X size={20} />
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 bg-rose-50 border-b border-rose-100">
          <div className="flex items-start gap-2">
            <Info size={14} className="text-rose-500 mt-0.5" />
            <p className="text-[10px] text-rose-600 font-bold leading-relaxed">
              {error.msg} <span className="opacity-50">({error.code})</span>
            </p>
          </div>
        </div>
      )}

      {candidates.length > 0 && (
        <div className="bg-white border-b border-slate-100 max-h-48 overflow-y-auto z-20">
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">發現多個地點，請選擇：</p>
            <button onClick={() => setCandidates([])} className="text-[10px] font-bold text-blue-500">關閉</button>
          </div>
          {candidates.map((res, i) => (
            <button
              key={i}
              onClick={() => selectCandidate(res)}
              className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 flex gap-3"
            >
              <MapPin size={14} className="text-slate-300 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">{res.formatted_address}</p>
                <p className="text-[10px] text-slate-400 truncate">{res.types.join(', ')}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {!geocodingLib && !error && (
        <div className="px-4 py-2 bg-blue-50 text-blue-500 text-[10px] font-bold text-center">
          正在準備地圖服務...
        </div>
      )}

      <div className="flex-1 relative bg-slate-100">
        <Map
          center={center}
          onCenterChanged={(e) => setCenter(e.detail.center)}
          zoom={15}
          gestureHandling={'greedy'}
          disableDefaultUI={true}
          onClick={onMapClick}
          mapId="schedule_picker_map"
        >
          <MapHandler center={center} />
          {markerPos && (
            <AdvancedMarker 
              position={markerPos} 
              draggable={true} 
              onDragEnd={(e) => {
                if (e.latLng) {
                  const newPos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
                  setMarkerPos(newPos);
                  setCenter(newPos);
                }
              }}
            >
              <Pin background={'#3b82f6'} borderColor={'#FFFFFF'} glyphColor={'#FFFFFF'} />
            </AdvancedMarker>
          )}
        </Map>

        <div className="absolute top-4 left-4 right-4 flex flex-col gap-2 pointer-events-none">
          <div className="bg-white/90 backdrop-blur-md px-4 py-3 rounded-2xl shadow-lg border border-slate-200">
            <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wider mb-1 flex items-center gap-1">
              <MapPin size={12} className="text-blue-500" /> 設定位置說明
            </h4>
            <ul className="text-[10px] text-slate-500 font-bold space-y-1">
              <li>• 此功能若搜尋失敗，可能是 API 限制</li>
              <li>• <span className="text-blue-600">直接單擊地圖區域</span> 即可快速插旗</li>
              <li>• 按住旗幟可進行拖動微調</li>
            </ul>
          </div>
        </div>

        <div className="absolute bottom-10 left-6 right-6">
          <button
            onClick={handleConfirm}
            disabled={!markerPos}
            className={`w-full py-4 rounded-2xl font-black flex items-center justify-center gap-2 shadow-xl transition-all active:scale-95 ${
              markerPos ? 'bg-blue-500 text-white shadow-blue-200' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Check size={20} />
            確認此地點座標
          </button>
        </div>
      </div>
    </div>
  );
};

export const LocationPicker: React.FC<LocationPickerProps> = (props) => {
  const apiKey = (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyBhZtrsN7V57zWxZ6aKzvoYrtU4hh5MV1M';
  return (
    <APIProvider apiKey={apiKey} libraries={['geocoding', 'places', 'marker']}>
      <LocationPickerContent {...props} />
    </APIProvider>
  );
};

