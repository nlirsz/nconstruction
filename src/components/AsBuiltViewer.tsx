
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { Drawing, Measurement } from '../types';
import { Ruler, CheckCircle2, AlertTriangle, Loader2, Save, X } from 'lucide-react';

interface AsBuiltViewerProps {
  drawingId: string;
  imageUrl?: string;
  title?: string;
  context?: string;
  onClose: () => void;
}

const TOLERANCE = 2.0; // 2cm de tolerância

export const AsBuiltViewer: React.FC<AsBuiltViewerProps> = ({ drawingId, imageUrl, title, context, onClose }) => {
  const [drawing, setDrawing] = useState<Drawing | null>(null);
  const [measurements, setMeasurements] = useState<Record<string, Measurement>>({});
  const [loading, setLoading] = useState(true);
  
  // Interaction State
  const [selectedSegment, setSelectedSegment] = useState<any | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 1000, h: 1000 });
  const [isPanning, setIsPanning] = useState(false);
  const startPan = useRef({ x: 0, y: 0 });

  // Handle Image Loading for Dimensions
  useEffect(() => {
      if (imageUrl) {
          const img = new Image();
          img.src = imageUrl;
          img.onload = () => {
              setViewBox({
                  x: 0,
                  y: 0,
                  w: img.naturalWidth,
                  h: img.naturalHeight
              });
              setLoading(false);
          };
          img.onerror = () => {
              console.error("Failed to load image");
              setLoading(false);
          };
      }
  }, [imageUrl]);

  // Fetch Data (Only if drawingId is present and no image URL override)
  useEffect(() => {
    if (imageUrl) return; // Skip DB fetch if showing raw image

    const loadData = async () => {
      setLoading(true);
      
      // 1. Fetch Drawing Geometry
      const { data: drawData, error: drawError } = await supabase
        .from('drawings')
        .select('*')
        .eq('id', drawingId)
        .single();
      
      if (drawError || !drawData) {
        console.error("Erro ao carregar planta:", drawError);
        setLoading(false);
        return;
      }
      
      setDrawing(drawData);
      if (drawData.geometry_data?.meta) {
          setViewBox({
              x: -50,
              y: -50,
              w: drawData.geometry_data.meta.width + 100,
              h: drawData.geometry_data.meta.height + 100
          });
      }

      // 2. Fetch Existing Measurements
      const { data: measData } = await supabase
        .from('measurements')
        .select('*')
        .eq('drawing_id', drawingId);
      
      if (measData) {
        const measMap: Record<string, Measurement> = {};
        measData.forEach(m => {
            measMap[m.segment_id] = m;
        });
        setMeasurements(measMap);
      }

      setLoading(false);
    };

    if (drawingId) {
        loadData();

        const channel = supabase
        .channel(`drawing-${drawingId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'measurements', filter: `drawing_id=eq.${drawingId}` }, 
        (payload) => {
            const newM = payload.new as Measurement;
            if (newM) {
                setMeasurements(prev => ({ ...prev, [newM.segment_id]: newM }));
            }
        })
        .subscribe();

        return () => { supabase.removeChannel(channel); };
    }
  }, [drawingId, imageUrl]);

  const handleSaveMeasurement = async () => {
      if (!selectedSegment || !inputValue) return;
      
      const realVal = parseFloat(inputValue);
      const diff = Math.abs(selectedSegment.length - realVal);
      const status = diff <= TOLERANCE ? 'ok' : 'error';

      // Optimistic Update
      const tempId = Math.random().toString();
      const newMeas: Measurement = {
          id: tempId,
          drawing_id: drawingId,
          segment_id: selectedSegment.id,
          real_value: realVal,
          status: status,
          updated_at: new Date().toISOString()
      };
      setMeasurements(prev => ({ ...prev, [selectedSegment.id]: newMeas }));

      // DB Upsert
      const { error } = await supabase.from('measurements').upsert({
          drawing_id: drawingId,
          segment_id: selectedSegment.id,
          real_value: realVal,
          status: status
      }, { onConflict: 'drawing_id, segment_id' });

      if (error) {
          alert("Erro ao salvar medição.");
          console.error(error);
      } else {
          setSelectedSegment(null);
          setInputValue('');
      }
  };

  // Pan & Zoom Logic
  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    const scale = e.deltaY > 0 ? 1.1 : 0.9;
    setViewBox(prev => ({
      x: prev.x - (e.clientX * (1 - scale) * 0.1), // zoom towards mouse approx
      y: prev.y - (e.clientY * (1 - scale) * 0.1),
      w: prev.w * scale,
      h: prev.h * scale,
    }));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
      if (e.button === 0) { // Left click only
          setIsPanning(true);
          startPan.current = { x: e.clientX, y: e.clientY };
      }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (!isPanning) return;
      e.preventDefault();
      const dx = e.clientX - startPan.current.x;
      const dy = e.clientY - startPan.current.y;
      
      const svg = e.currentTarget.closest('svg');
      if (!svg) return;
      
      const ratioX = viewBox.w / svg.clientWidth;
      const ratioY = viewBox.h / svg.clientHeight;

      setViewBox(prev => ({
          ...prev,
          x: prev.x - (dx * ratioX),
          y: prev.y - (dy * ratioY)
      }));
      startPan.current = { x: e.clientX, y: e.clientY };
  };

  if (loading) return <div className="fixed inset-0 z-[300] bg-white flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={48} /></div>;

  const displayTitle = title || drawing?.title;
  const displayContext = context || drawing?.context;

  return (
    <div className="fixed inset-0 z-[300] bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="h-16 bg-slate-800 border-b border-slate-700 flex justify-between items-center px-6 shadow-md z-10">
          <div className="text-white">
              <h2 className="font-bold text-lg flex items-center gap-2">
                  <Ruler className="text-blue-400" /> 
                  As-Built: {displayTitle}
              </h2>
              <p className="text-xs text-slate-400">Contexto: {displayContext}</p>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-full text-white transition-colors">
              <X size={24} />
          </button>
      </div>

      {/* Main Area */}
      <div className="flex-1 relative overflow-hidden">
          <svg
              viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
              className="w-full h-full cursor-grab active:cursor-grabbing touch-none bg-[#1e1e1e]"
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={() => setIsPanning(false)}
              onMouseLeave={() => setIsPanning(false)}
          >
              <defs>
                <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
                    <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#333" strokeWidth="1"/>
                </pattern>
              </defs>
              <rect x={viewBox.x - 5000} y={viewBox.y - 5000} width={10000} height={10000} fill="url(#grid)" />

              {/* Render Image Background if provided */}
              {imageUrl && (
                  <image 
                    href={imageUrl} 
                    x="0" y="0" 
                    width={viewBox.w} height={viewBox.h} 
                    preserveAspectRatio="xMidYMid meet"
                  />
              )}

              {/* Render Vector Geometry (Only if drawing object exists) */}
              {drawing && drawing.geometry_data.geometry.map((seg) => {
                  const meas = measurements[seg.id];
                  let stroke = "#555"; // Default
                  let strokeWidth = 2;

                  if (selectedSegment?.id === seg.id) {
                      stroke = "#3b82f6"; // Selected (Blue)
                      strokeWidth = 4;
                  } else if (meas) {
                      stroke = meas.status === 'ok' ? '#22c55e' : '#ef4444'; // Green or Red
                      strokeWidth = 3;
                  }

                  return (
                      <g key={seg.id} onClick={(e) => { e.stopPropagation(); if(!isPanning) { setSelectedSegment(seg); setInputValue(meas?.real_value?.toString() || ''); } }}>
                          <line x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2} stroke="transparent" strokeWidth={15} vectorEffect="non-scaling-stroke" className="cursor-pointer" />
                          <line 
                            x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2} 
                            stroke={stroke} 
                            strokeWidth={strokeWidth} 
                            vectorEffect="non-scaling-stroke"
                            strokeLinecap="round"
                            className={`transition-colors duration-200 ${meas?.status === 'error' ? 'animate-pulse' : ''}`}
                          />
                      </g>
                  );
              })}
          </svg>

          {/* Controls Overlay */}
          <div className="absolute bottom-6 left-6 flex gap-2">
               <div className="bg-slate-800/90 text-white px-4 py-2 rounded-lg backdrop-blur-sm text-xs border border-slate-700">
                   Scroll para Zoom • Arraste para Mover {imageUrl ? '' : '• Clique na Parede'}
               </div>
          </div>
      </div>

      {/* Measurement Modal (Floating) - Only for Drawing Mode */}
      {selectedSegment && !imageUrl && (
          <div className="absolute top-20 right-6 w-80 bg-white rounded-xl shadow-2xl p-5 border border-slate-200 animate-in slide-in-from-right duration-200">
              <div className="flex justify-between items-start mb-4">
                  <h3 className="font-bold text-slate-800">Verificar Medida</h3>
                  <button onClick={() => setSelectedSegment(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
              </div>

              <div className="space-y-4">
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <p className="text-xs text-slate-500 uppercase font-bold">Valor em Projeto</p>
                      <p className="text-xl font-bold text-slate-800">{selectedSegment.length} cm</p>
                  </div>

                  <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">Medição Real (in loco)</label>
                      <div className="flex gap-2">
                          <input 
                              autoFocus
                              type="number" 
                              value={inputValue}
                              onChange={e => setInputValue(e.target.value)}
                              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800"
                              placeholder="0.00"
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveMeasurement()}
                          />
                          <button onClick={handleSaveMeasurement} className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700">
                              <Save size={20} />
                          </button>
                      </div>
                  </div>
                  
                  {measurements[selectedSegment.id] && (
                      <div className={`p-3 rounded-lg border flex items-center gap-3 ${measurements[selectedSegment.id].status === 'ok' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                          {measurements[selectedSegment.id].status === 'ok' ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
                          <div>
                              <p className="font-bold text-sm">{measurements[selectedSegment.id].status === 'ok' ? 'Dentro da Tolerância' : 'Fora da Tolerância'}</p>
                              <p className="text-xs opacity-80">Diferença: {Math.abs(selectedSegment.length - measurements[selectedSegment.id].real_value).toFixed(2)} cm</p>
                          </div>
                      </div>
                  )}
              </div>
          </div>
      )}
    </div>
  );
};
