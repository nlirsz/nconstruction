
import React, { useState, useEffect, useMemo } from 'react';
import { Project, ProjectDocument } from '../types';
import { supabase } from '../services/supabaseClient';
import { 
    FileJson, FileText, Download, ChevronRight, Zap, Droplets, Layers, 
    ChevronDown, Building2, Home, LayoutDashboard, MapPin, Eye, Monitor, Smartphone,
    Share, Loader2, Grid, PaintBucket, FolderOpen, ArrowDownLeft, AlertCircle, ArrowLeft
} from 'lucide-react';
import { AsBuiltViewer } from './AsBuiltViewer';

interface AsBuiltTabProps {
  project: Project;
  currentUser: any;
}

interface FloorStructure {
    floorNumber: number;
    label: string;
    apartments: string[];
}

export const AsBuiltTab: React.FC<AsBuiltTabProps> = ({ project, currentUser }) => {
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  
  // Sidebar states
  const [generalAreas, setGeneralAreas] = useState<string[]>([]);
  const [floors, setFloors] = useState<FloorStructure[]>([]);
  const [expandedFloors, setExpandedFloors] = useState<number[]>([]);
  
  // Selection states
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [selectedDiscipline, setSelectedDiscipline] = useState<string | null>(null);
  
  // Viewer states
  const [viewingDocUrl, setViewingDocUrl] = useState<string | null>(null);
  const [viewingDocTitle, setViewingDocTitle] = useState<string>('');

  const isMobile = () => {
    return (
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    );
  };

  const handleOpenCAD = (doc: ProjectDocument) => {
    setActionLoadingId(doc.id);
    setTimeout(() => {
        setViewingDocUrl(doc.file_url);
        setViewingDocTitle(doc.title);
        setActionLoadingId(null);
    }, 1200);
  };

  useEffect(() => {
    fetchDocuments();
    generateStructure();
  }, [project.id]);

  const generateStructure = () => {
      const floorsStruct: FloorStructure[] = [];
      const genAreasSet = new Set(['Geral', 'Áreas Externas', 'Garagem', 'Lazer / Térreo', 'Cobertura']);

      if (project.structure?.levels && project.structure.levels.length > 0) {
          // Filtramos apenas pavimentos marcados como 'apartments'
          const apartmentLevels = project.structure.levels.filter(l => l.type === 'apartments');
          const otherLevels = project.structure.levels.filter(l => l.type !== 'apartments');

          // Ordenação descendente (Top to Bottom)
          const sortedApts = [...apartmentLevels].sort((a, b) => b.order - a.order);
          
          sortedApts.forEach(level => {
            floorsStruct.push({
                floorNumber: level.order,
                label: level.label,
                apartments: level.units.map(u => u.name)
            });
          });

          // Adiciona os demais níveis às áreas gerais
          otherLevels.forEach(level => {
              genAreasSet.add(level.label);
          });
      } else {
          // Fallback legacy logic
          const floorCount = project.structure?.floors || 10;
          const unitsPerFloor = project.structure?.unitsPerFloor || 4;
          for (let f = floorCount; f >= 1; f--) {
              const apts = [];
              for (let u = 1; u <= unitsPerFloor; u++) { apts.push(`Apto ${f * 100 + u}`); }
              floorsStruct.push({ floorNumber: f, label: `Pavimento ${f}`, apartments: apts });
          }
      }
      
      setGeneralAreas(Array.from(genAreasSet));
      setFloors(floorsStruct);
      if (floorsStruct.length > 0) setExpandedFloors([floorsStruct[0].floorNumber]);
  };

  const fetchDocuments = async () => {
    setLoading(true);
    const { data } = await supabase.from('project_documents').select('*').eq('project_id', project.id).order('created_at', { ascending: false });
    if (data) setDocuments(data);
    setLoading(false);
  };

  const getParentFloorLabel = (unitName: string): string | null => {
      const floor = floors.find(f => f.apartments.includes(unitName));
      return floor ? floor.label : null;
  };

  const DISCIPLINES = [
    { id: 'electrical', label: 'Elétrica', icon: <Zap size={24}/>, color: 'text-yellow-500 bg-yellow-50 border-yellow-100' },
    { id: 'hydraulic', label: 'Hidráulica', icon: <Droplets size={24}/>, color: 'text-blue-500 bg-blue-50 border-blue-100' },
    { id: 'architectural', label: 'Arquitetura', icon: <Layers size={24}/>, color: 'text-indigo-500 bg-indigo-50 border-indigo-100' },
    { id: 'structural', label: 'Estrutural', icon: <Grid size={24}/>, color: 'text-stone-500 bg-stone-50 border-stone-100' },
    { id: 'finishing', label: 'Acabamentos', icon: <PaintBucket size={24}/>, color: 'text-purple-500 bg-purple-50 border-purple-100' },
    { id: 'others', label: 'Outros', icon: <FolderOpen size={24}/>, color: 'text-slate-500 bg-slate-50 border-slate-100' }
  ];

  const filteredDocs = useMemo(() => {
      if (!selectedUnit) return [];
      const parentFloor = getParentFloorLabel(selectedUnit);

      return documents.filter(doc => {
          const isDirect = doc.context === selectedUnit;
          const isInherited = parentFloor && doc.context === parentFloor;
          const matchDisc = selectedDiscipline ? (doc.category === selectedDiscipline) : true;
          return (isDirect || isInherited) && matchDisc;
      });
  }, [documents, selectedUnit, selectedDiscipline, floors]);

  const availableDisciplinesForUnit = useMemo(() => {
    if (!selectedUnit) return [];
    const parentFloor = getParentFloorLabel(selectedUnit);
    const unitDocs = documents.filter(doc => doc.context === selectedUnit || (parentFloor && doc.context === parentFloor));
    const categoryIds = new Set(unitDocs.map(doc => doc.category));
    return DISCIPLINES.filter(d => categoryIds.has(d.id as any));
  }, [selectedUnit, documents, floors]);

  return (
    <div className="pb-20 animate-in fade-in duration-500 h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-6 relative">
        {/* Sidebar / Unit List */}
        <div className={`w-full lg:w-80 bg-white rounded-2xl border border-slate-200 shadow-sm flex-col overflow-hidden shrink-0 ${selectedUnit ? 'hidden lg:flex' : 'flex'}`}>
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <h3 className="font-bold text-slate-800 flex items-center gap-2"><Building2 size={18} className="text-blue-600" /> Locais</h3>
                <button onClick={fetchDocuments} className="text-slate-400 hover:text-blue-600 transition-colors"><LayoutDashboard size={16}/></button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="p-2 border-b border-slate-100">
                    <p className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Áreas Gerais</p>
                    <div className="space-y-1">
                        {generalAreas.map(area => (
                            <button key={area} onClick={() => { setSelectedUnit(area); setSelectedDiscipline(null); }} className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold rounded-xl transition-all ${selectedUnit === area ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}><MapPin size={14} />{area}</button>
                        ))}
                    </div>
                </div>
                <div className="p-2">
                    <p className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pavimentos e Unidades</p>
                    <div className="space-y-1">
                        {floors.map(floor => (
                            <div key={floor.floorNumber} className="rounded-xl overflow-hidden mb-1">
                                <div className="flex items-center">
                                    <button 
                                        onClick={() => { setSelectedUnit(floor.label); setSelectedDiscipline(null); }}
                                        className={`flex-1 text-left px-4 py-2.5 text-xs font-bold transition-all ${selectedUnit === floor.label ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-blue-50'}`}
                                    >
                                        {floor.label}
                                    </button>
                                    <button 
                                        onClick={() => setExpandedFloors(p => p.includes(floor.floorNumber) ? p.filter(f => f !== floor.floorNumber) : [...p, floor.floorNumber])}
                                        className={`px-3 py-2.5 text-slate-400 hover:text-blue-600 ${expandedFloors.includes(floor.floorNumber) ? 'bg-blue-50' : ''}`}
                                    >
                                        {expandedFloors.includes(floor.floorNumber) ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                                    </button>
                                </div>
                                {expandedFloors.includes(floor.floorNumber) && (
                                    <div className="p-2 grid grid-cols-2 gap-1 bg-slate-50/50 border-t border-slate-100">
                                        {floor.apartments.map(apt => (
                                            <button key={apt} onClick={() => { setSelectedUnit(apt); setSelectedDiscipline(null); }} className={`px-2 py-2 text-[10px] font-bold rounded-lg border transition-all ${selectedUnit === apt ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-500 hover:border-blue-400'}`}>{apt.replace('Apto ', '')}</button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>

        {/* Main Content Area */}
        <div className={`flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex-col overflow-hidden ${!selectedUnit ? 'hidden lg:flex' : 'flex'}`}>
            <div className="p-6 border-b border-slate-100 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <span className="hover:text-blue-600 cursor-pointer hidden lg:inline" onClick={() => {setSelectedUnit(null); setSelectedDiscipline(null);}}>AS-BUILT</span>
                        {/* Mobile Back Button */}
                        <button onClick={() => {setSelectedUnit(null); setSelectedDiscipline(null);}} className="lg:hidden flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-1 rounded">
                            <ArrowLeft size={12} /> Voltar
                        </button>
                        {selectedUnit && <span className="hidden lg:flex items-center gap-1"><ChevronRight size={12}/> <span className="text-slate-800">{selectedUnit}</span></span>}
                    </div>
                </div>
                <h2 className="text-xl font-black text-slate-800">{selectedDiscipline ? `Arquivos - ${selectedDiscipline.toUpperCase()}` : selectedUnit ? selectedUnit : 'Selecione um local'}</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/20">
                {!selectedUnit ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300">
                        <LayoutDashboard size={80} className="mb-4 opacity-10" />
                        <p className="font-bold uppercase tracking-widest text-xs">Selecione uma Unidade ou Pavimento para ver as plantas</p>
                    </div>
                ) : !selectedDiscipline ? (
                    availableDisciplinesForUnit.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center">
                            <AlertCircle size={48} className="mb-4 opacity-20" />
                            <p className="font-bold uppercase tracking-widest text-xs">Nenhum projeto vinculado a este local ainda</p>
                            <p className="text-[10px] mt-1">Faça o upload na aba "Documentos" e selecione "{selectedUnit}" no campo local.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                            {availableDisciplinesForUnit.map(d => (
                                <div key={d.id} onClick={() => setSelectedDiscipline(d.id as any)} className={`p-8 rounded-[2rem] border-2 cursor-pointer transition-all hover:shadow-2xl hover:scale-[1.02] flex flex-col items-center text-center bg-white ${selectedDiscipline === d.id ? 'border-blue-500 ring-4 ring-blue-50' : 'border-slate-100'}`}>
                                    <div className={`p-5 rounded-2xl mb-4 ${d.color}`}>{d.icon}</div>
                                    <h3 className="font-black text-slate-800 uppercase tracking-tight">{d.label}</h3>
                                    <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">
                                        {documents.filter(doc => (doc.context === selectedUnit || (getParentFloorLabel(selectedUnit) === doc.context)) && doc.category === d.id).length} ARQUIVOS
                                    </p>
                                </div>
                            ))}
                        </div>
                    )
                ) : (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center mb-4">
                            <button onClick={() => setSelectedDiscipline(null)} className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 flex items-center gap-1 uppercase transition-all">← Voltar para disciplinas</button>
                        </div>
                        {filteredDocs.length === 0 ? (
                            <div className="py-20 text-center border-4 border-dashed border-slate-100 rounded-[2rem]">
                                <p className="text-xs font-black text-slate-300 uppercase tracking-widest">Nenhum arquivo para esta disciplina.</p>
                            </div>
                        ) : (
                            filteredDocs.map(doc => {
                                const type = doc.file_type?.toLowerCase() || 'unknown';
                                const isPDF = type === 'pdf';
                                const isDWG = type === 'dwg';
                                const isImg = ['jpg','jpeg','png','webp'].includes(type);
                                const isInherited = doc.context !== selectedUnit;
                                const mobile = isMobile();
                                const isActionLoading = actionLoadingId === doc.id;

                                return (
                                    <div key={doc.id} className="bg-white p-5 rounded-[1.5rem] border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-blue-300 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-slate-50 text-slate-400 rounded-xl group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors"><FileText size={24}/></div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-bold text-slate-800 text-sm leading-tight">{doc.title}</h4>
                                                    {isInherited && (
                                                        <span className="flex items-center gap-1 text-[8px] font-black bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded uppercase border border-blue-100 shadow-sm">
                                                            <ArrowDownLeft size={8} /> Pavimento
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[10px] font-black text-slate-400 uppercase mt-0.5">{type} • {new Date(doc.created_at).toLocaleDateString('pt-BR')}</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {(isPDF || isImg) && (
                                                <a href={doc.file_url} target="_blank" rel="noreferrer" className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase hover:bg-blue-600 transition-all shadow-md">
                                                    <Eye size={14}/> Ver Plano
                                                </a>
                                            )}
                                            {isDWG && (
                                                <button 
                                                    onClick={() => handleOpenCAD(doc)} 
                                                    disabled={isActionLoading}
                                                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase hover:bg-amber-600 transition-all shadow-md disabled:opacity-70"
                                                >
                                                    {isActionLoading ? <Loader2 size={14} className="animate-spin" /> : (mobile ? <Share size={14}/> : <Monitor size={14}/>)}
                                                    {isActionLoading ? 'Preparando...' : 'AutoCAD'}
                                                </button>
                                            )}
                                            <a href={doc.file_url} download className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all border border-slate-100"><Download size={18}/></a>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>
        </div>

        {viewingDocUrl && (
            <AsBuiltViewer drawingId="" imageUrl={viewingDocUrl} title={viewingDocTitle} context={selectedUnit || ''} onClose={() => setViewingDocUrl(null)} />
        )}
    </div>
  );
};
