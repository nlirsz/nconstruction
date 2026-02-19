
import React, { useState, useEffect, useMemo } from 'react';
import { Project, ProjectPhoto, PhotoCategory } from '../types';
import { supabase, uploadImage } from '../services/supabaseClient';
import {
    Image as ImageIcon, Filter, MapPin, Tag, Search, X, Loader2,
    Upload, Camera, Trash2, Calendar, User, CheckCircle2, Edit2, Save, Building2, Home
} from 'lucide-react';

interface GalleryTabProps {
    project: Project;
    currentUser?: any;
}

const CATEGORIES: { id: PhotoCategory; label: string; color: string }[] = [
    { id: 'evolution', label: 'Evolução da Obra', color: 'bg-blue-100 text-blue-700' },
    { id: 'structural', label: 'Estrutura', color: 'bg-stone-100 text-stone-700' },
    { id: 'installations', label: 'Instalações', color: 'bg-yellow-100 text-yellow-700' },
    { id: 'finishing', label: 'Acabamentos', color: 'bg-purple-100 text-purple-700' },
    { id: 'inspection', label: 'Vistorias / RNC', color: 'bg-red-100 text-red-700' },
    { id: 'other', label: 'Outros', color: 'bg-slate-100 text-slate-700' },
];

export const GalleryTab: React.FC<GalleryTabProps> = ({ project, currentUser }) => {
    const [photos, setPhotos] = useState<ProjectPhoto[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Filter States
    const [filterCategory, setFilterCategory] = useState<PhotoCategory | 'all'>('all');
    const [filterPhase, setFilterPhase] = useState<string>('all');
    const [filterSubtask, setFilterSubtask] = useState<string>('all');
    const [filterLocation, setFilterLocation] = useState<string>('all');
    const [filterFloor, setFilterFloor] = useState<string>('all');
    const [filterUnit, setFilterUnit] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');

    // Derived Lists for Filters
    const availablePhases = useMemo(() => project.phases || [], [project.phases]);
    const availableSubtasks = useMemo(() => {
        if (filterPhase === 'all') {
            return Array.from(new Set(availablePhases.flatMap(p => p.subtasks || [])));
        }
        const selectedPhase = availablePhases.find(p => p.id === filterPhase);
        return selectedPhase?.subtasks || [];
    }, [availablePhases, filterPhase]);

    const availableFloors = useMemo(() => {
        const floors = new Set<string>();
        project.structure?.levels?.forEach(l => floors.add(l.label));
        return Array.from(floors);
    }, [project.structure]);

    const availableUnits = useMemo(() => {
        const units = new Set<string>();
        project.structure?.levels?.forEach(l => {
            l.units?.forEach(u => units.add(u.name));
        });
        return Array.from(units);
    }, [project.structure]);

    // Extended Type for Local State
    type EnhancedPhoto = ProjectPhoto & {
        phaseId?: string;
        subtask?: string;
        floor?: string;
        unit?: string;
    };

    // Upload Form State
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [newDesc, setNewDesc] = useState('');
    const [newCategory, setNewCategory] = useState<PhotoCategory>('evolution');
    const [newLocation, setNewLocation] = useState('Geral');

    // Lightbox & Edit State
    const [lightboxPhoto, setLightboxPhoto] = useState<ProjectPhoto | null>(null);
    const [isEditingPhoto, setIsEditingPhoto] = useState(false);
    const [editDesc, setEditDesc] = useState('');
    const [editCategory, setEditCategory] = useState<PhotoCategory>('evolution');

    useEffect(() => {
        fetchPhotos();
    }, [project.id]);

    const fetchPhotos = async () => {
        setLoading(true);
        try {
            // 1. Fetch "Official" Gallery Photos
            const { data: galleryData, error } = await supabase
                .from('project_photos')
                .select('*')
                .eq('project_id', project.id)
                .order('created_at', { ascending: false });

            // 2. Fetch "Execution" Photos (from unit_progress)
            // We need to fetch details to construct valid gallery items:
            // - unit_id -> unit name (we need project_units for this)
            // - phase_id -> category mapping
            // - subtasks -> photos extraction
            const { data: executionData } = await supabase
                .from('unit_progress')
                .select('phase_id, subtasks, unit_id, updated_at')
                .eq('project_id', project.id);

            // To map unit_id to a readable name, we need all units.
            // Assuming `project.structure` is populated, we can look it up there.
            // If `project.structure` is lightweight, we might need to fetch `project_units`...
            // Let's rely on `project.structure.levels[].units[]` which is usually available in the context.
            // Helper to find unit name:
            const findUnitName = (uid: string) => {
                let name = 'Unidade Desconhecida';
                let floor = '';
                project.structure?.levels?.forEach(l => {
                    const u = l.units?.find((un: any) => un.id === uid);
                    if (u) {
                        name = u.name;
                        floor = l.label;
                    }
                });
                return { name, floor };
            };

            const categoryMap: Record<string, PhotoCategory> = {
                'structure': 'structural', 'structural': 'structural', 'masonry': 'structural',
                'installations': 'installations', 'hydraulic': 'installations', 'electrical': 'installations',
                'finishing': 'finishing', 'painting': 'finishing', 'flooring': 'finishing'
            };

            const executionPhotos: ProjectPhoto[] = [];

            executionData?.forEach((row: any) => {
                const { name: unitName, floor } = findUnitName(row.unit_id);
                // Heuristic category mapping
                let cat: PhotoCategory = categoryMap[row.phase_id?.toLowerCase() || ''] || 'inspection';
                if (cat === 'inspection' && row.phase_id) {
                    const pLower = row.phase_id.toLowerCase();
                    if (pLower.includes('estrut')) cat = 'structural';
                    else if (pLower.includes('instal') || pLower.includes('hidr') || pLower.includes('elet')) cat = 'installations';
                    else if (pLower.includes('acab') || pLower.includes('pint') || pLower.includes('revest')) cat = 'finishing';
                }

                // Extract Subtask Photos
                if (row.subtasks) {
                    Object.entries(row.subtasks).forEach(([key, val]: [string, any]) => {
                        // Extract "photos" array if it exists
                        if (typeof val === 'object' && val.photos && Array.isArray(val.photos)) {
                            val.photos.forEach((p: any) => {
                                executionPhotos.push({
                                    id: `exec-${p.id || Math.random().toString(36)}`, // Prefix to avoid collision if ID is simple
                                    project_id: project.id,
                                    url: p.url,
                                    description: p.description || `${key} - ${unitName}`,
                                    category: cat,
                                    location_label: `${floor} • ${unitName}`,
                                    created_at: p.created_at || row.updated_at || new Date().toISOString(),
                                    created_by: 'Execução'
                                });
                            });
                        }
                        // Legacy single image URL?
                        else if (typeof val === 'object' && val.imageUrl) {
                            executionPhotos.push({
                                id: `exec-legacy-${key}-${row.unit_id}`,
                                project_id: project.id,
                                url: val.imageUrl,
                                description: `${key} - Foto Antiga`,
                                category: cat,
                                location_label: `${floor} • ${unitName}`,
                                created_at: row.updated_at || new Date().toISOString(),
                                created_by: 'Execução'
                            });
                        }
                    });
                }
            });

            // 3. Merge & Deduplicate
            // We want to combine the "Official" gallery records with the rich metadata from "Execution" records.
            // If a photo exists in both, we use the ProjectPhoto ID from the official table but the Metadata (Phase/Subtask) from the Execution data.

            // Create a lookup map for execution metadata by URL
            const metadataMap = new Map<string, { phaseId: string; subtask: string }>();
            executionPhotos.forEach(ep => {
                const e = ep as EnhancedPhoto;
                metadataMap.set(e.url, {
                    phaseId: e.phaseId || '',
                    subtask: e.subtask || ''
                });
            });

            const mergedPhotos: EnhancedPhoto[] = (galleryData || []).map((p: any) => {
                const meta = metadataMap.get(p.url);

                // Extract floor and unit from location_label (format: "Floor • Unit")
                let floor = '';
                let unit = '';
                if (p.location_label) {
                    const parts = p.location_label.split('•').map((s: string) => s.trim());
                    if (parts.length >= 2) {
                        floor = parts[0];
                        unit = parts[1];
                    }
                }

                return {
                    ...p,
                    // Priority: 1. DB Columns (new), 2. Merge Metadata (legacy sync), 3. Default
                    phaseId: p.phase || meta?.phaseId || 'general',
                    subtask: p.subtask || meta?.subtask || 'general',
                    floor: floor,
                    unit: unit
                };
            });

            const existingUrls = new Set(mergedPhotos.map(p => p.url));
            const legacyExecutionPhotos = executionPhotos.filter(p => !existingUrls.has(p.url));

            const allPhotos = [...mergedPhotos, ...legacyExecutionPhotos].sort((a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );

            setPhotos(allPhotos);

        } catch (err) {
            console.error("Error fetching photos", err);
        } finally {
            setLoading(false);
        }
    };

    // Derive Locations from Project Structure
    const projectLocations = useMemo(() => {
        const locs = ['Geral', 'Áreas Externas', 'Subsolo', 'Térreo', 'Cobertura'];
        if (project.structure?.levels) {
            project.structure.levels.forEach(l => {
                if (!locs.includes(l.label)) locs.push(l.label);
                // Add units for granular filtering
                if (l.units) {
                    l.units.forEach((u: any) => {
                        // We format it to match how it's saved: "Floor • Unit"
                        // But usually users search by unit name. 
                        // Let's add just the Unit Name so filtering by "Apt 101" works if the label contains it.
                        // But the saved label is "Floor - Unit". 
                        // If I filter by "Apt 101", and the label is "1º Pav - Apt 101", .includes("Apt 101") works.
                        locs.push(u.name);
                    });
                }
            });
        }
        return Array.from(new Set(locs));
    }, [project.structure]);

    const filteredPhotos = useMemo(() => {
        return photos.filter(p => {
            const matchSearch = p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.location_label.toLowerCase().includes(searchTerm.toLowerCase());

            const matchCat = filterCategory === 'all' || p.category === filterCategory;
            const matchLoc = filterLocation === 'all' || p.location_label.toLowerCase().includes(filterLocation.toLowerCase());

            // New Filters Logic
            const matchPhase = filterPhase === 'all' || (p.phaseId === filterPhase);
            const matchSubtask = filterSubtask === 'all' || (p.subtask === filterSubtask);
            const matchFloor = filterFloor === 'all' || (p.floor === filterFloor);
            const matchUnit = filterUnit === 'all' || (p.unit === filterUnit);

            return matchSearch && matchCat && matchLoc && matchPhase && matchSubtask && matchFloor && matchUnit;
        });
    }, [photos, searchTerm, filterCategory, filterLocation, filterPhase, filterSubtask, filterFloor, filterUnit]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedFile || !newDesc) return;

        setUploading(true);
        try {
            const publicUrl = await uploadImage(selectedFile, `gallery/${project.id}`);

            if (publicUrl) {
                const { data, error } = await supabase.from('project_photos').insert({
                    project_id: project.id,
                    url: publicUrl,
                    description: newDesc,
                    category: newCategory,
                    location_label: newLocation,
                    created_by: currentUser?.email
                }).select().single();

                if (error) {
                    throw error;
                } else if (data) {
                    setPhotos(prev => [data, ...prev]);
                    setIsModalOpen(false);
                    resetForm();
                }
            }
        } catch (err) {
            console.error("Upload error:", err);
            alert("Erro ao enviar foto.");
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id: string, url?: string) => {
        if (!confirm("Tem certeza que deseja excluir esta foto da galeria?")) return;

        // 1. Delete from Storage (if URL is provided)
        if (url) {
            try {
                // Extract relative path from public URL
                // Example: .../project-images/gallery/project_id/filename.webp
                // We need: gallery/project_id/filename.webp
                const urlObj = new URL(url);
                const pathParts = urlObj.pathname.split('/project-images/');
                if (pathParts.length > 1) {
                    const storagePath = decodeURIComponent(pathParts[1]);
                    await supabase.storage.from('project-images').remove([storagePath]); // Use list for removal
                }
            } catch (err) {
                console.warn("Could not delete from storage, proceeding to DB delete.", err);
            }
        }

        // 2. Delete from Database
        if (id.startsWith('exec-')) {
            // These are virtual IDs from unit_progress
            // We need to find and remove the photo from the unit_progress JSONB
            // For now, just remove from local state - it will resync on next load
            // TODO: Implement proper deletion from unit_progress.subtasks JSONB
            setPhotos(prev => prev.filter(p => p.id !== id));
            if (lightboxPhoto?.id === id) setLightboxPhoto(null);
            alert("Foto removida da visualização. Para exclusão permanente, remova pela aba Execução.");
            return;
        }

        const { error } = await supabase.from('project_photos').delete().eq('id', id);
        if (!error) {
            setPhotos(prev => prev.filter(p => p.id !== id));
            if (lightboxPhoto?.id === id) setLightboxPhoto(null);
        } else {
            console.error("Delete error:", error);
            alert('Erro ao excluir do banco de dados');
        }
    };

    const handleUpdatePhoto = async () => {
        if (!lightboxPhoto) return;

        const { error } = await supabase.from('project_photos').update({
            description: editDesc,
            category: editCategory
        }).eq('id', lightboxPhoto.id);

        if (!error) {
            const updated = { ...lightboxPhoto, description: editDesc, category: editCategory };
            setPhotos(prev => prev.map(p => p.id === lightboxPhoto.id ? updated : p));
            setLightboxPhoto(updated);
            setIsEditingPhoto(false);
        } else {
            alert("Erro ao atualizar foto.");
        }
    };

    const openLightbox = (photo: ProjectPhoto) => {
        setLightboxPhoto(photo);
        setEditDesc(photo.description);
        setEditCategory(photo.category);
        setIsEditingPhoto(false);
    };

    const resetForm = () => {
        setSelectedFile(null);
        setPreviewUrl(null);
        setNewDesc('');
        setNewCategory('evolution');
        setNewLocation('Geral');
    };

    return (
        <div className="pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-screen flex flex-col">
            {/* Header & Controls */}
            <div className="flex flex-col gap-6 mb-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <ImageIcon className="text-blue-600" size={24} /> Galeria de Obra
                        </h2>
                        <p className="text-slate-500 mt-1">Acervo fotográfico organizado por etapas e locais.</p>
                    </div>
                    <button onClick={() => setIsModalOpen(true)} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg hover:bg-slate-800 transition-all flex items-center gap-2">
                        <Camera size={18} /> Adicionar Foto
                    </button>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-start gap-4">
                    <div className="w-full relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar na descrição..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-slate-700"
                        />
                    </div>

                    <div className="w-full flex flex-wrap gap-2">
                        {/* Location Filter */}
                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg min-w-fit">
                            <MapPin size={14} className="text-slate-400" />
                            <select
                                value={filterLocation}
                                onChange={e => setFilterLocation(e.target.value)}
                                className="bg-transparent text-sm font-bold text-slate-600 outline-none cursor-pointer max-w-[150px] truncate"
                            >
                                <option value="all">Locais</option>
                                {projectLocations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                            </select>
                        </div>

                        {/* Phase Filter - NEW */}
                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg min-w-fit">
                            <Filter size={14} className="text-slate-400" />
                            <select
                                value={filterPhase}
                                onChange={e => { setFilterPhase(e.target.value); setFilterSubtask('all'); }}
                                className="bg-transparent text-sm font-bold text-slate-600 outline-none cursor-pointer max-w-[150px] truncate"
                            >
                                <option value="all">Setores</option>
                                {availablePhases.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                            </select>
                        </div>

                        {/* Subtask Filter - NEW */}
                        {availableSubtasks.length > 0 && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg min-w-fit animate-in fade-in duration-300">
                                <CheckCircle2 size={14} className="text-slate-400" />
                                <select
                                    value={filterSubtask}
                                    onChange={e => setFilterSubtask(e.target.value)}
                                    className="bg-transparent text-sm font-bold text-slate-600 outline-none cursor-pointer max-w-[150px] truncate"
                                >
                                    <option value="all">Atividades</option>
                                    {availableSubtasks.map(st => <option key={st} value={st}>{st}</option>)}
                                </select>
                            </div>
                        )}

                        {/* Floor Filter - NEW */}
                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg min-w-fit">
                            <Building2 size={14} className="text-slate-400" />
                            <select
                                value={filterFloor}
                                onChange={e => setFilterFloor(e.target.value)}
                                className="bg-transparent text-sm font-bold text-slate-600 outline-none cursor-pointer max-w-[150px] truncate"
                            >
                                <option value="all">Pavimentos</option>
                                {availableFloors.map(floor => <option key={floor} value={floor}>{floor}</option>)}
                            </select>
                        </div>

                        {/* Unit Filter - NEW */}
                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg min-w-fit">
                            <Home size={14} className="text-slate-400" />
                            <select
                                value={filterUnit}
                                onChange={e => setFilterUnit(e.target.value)}
                                className="bg-transparent text-sm font-bold text-slate-600 outline-none cursor-pointer max-w-[150px] truncate"
                            >
                                <option value="all">Unidades</option>
                                {availableUnits.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                            </select>
                        </div>

                        {/* Category Filter */}
                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg min-w-fit">
                            <Tag size={14} className="text-slate-400" />
                            <select
                                value={filterCategory}
                                onChange={e => setFilterCategory(e.target.value as any)}
                                className="bg-transparent text-sm font-bold text-slate-600 outline-none cursor-pointer max-w-[150px] truncate"
                            >
                                <option value="all">Categorias</option>
                                {CATEGORIES.map(cat => <option key={cat.id} value={cat.id}>{cat.label}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Gallery Grid */}
            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" size={32} /></div>
            ) : filteredPhotos.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 p-10 text-center">
                    <ImageIcon size={48} className="text-slate-300 mb-4" />
                    <h3 className="text-lg font-bold text-slate-600">Nenhuma foto encontrada</h3>
                    <p className="text-sm text-slate-400 mt-1">Tente ajustar os filtros ou adicione uma nova imagem.</p>
                    <div className="mt-4 flex gap-2">
                        <button onClick={() => { setFilterCategory('all'); setFilterLocation('all'); setSearchTerm('') }} className="text-blue-600 text-xs font-bold hover:underline">Limpar Filtros</button>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
                    {filteredPhotos.map(photo => {
                        const catInfo = CATEGORIES.find(c => c.id === photo.category) || CATEGORIES[5];
                        return (
                            <div key={photo.id} onClick={() => openLightbox(photo)} className="group bg-white rounded-xl border border-slate-200 overflow-hidden cursor-pointer shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative">
                                <div className="aspect-[4/3] relative overflow-hidden bg-slate-100">
                                    <img src={photo.url} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                                        <p className="text-white text-sm font-medium line-clamp-2">{photo.description}</p>
                                        <div className="flex items-center gap-2 mt-2 text-white/70 text-xs">
                                            <Calendar size={12} /> {new Date(photo.created_at).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <div className="absolute top-3 left-3">
                                        <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full shadow-sm border ${catInfo.color.replace('bg-', 'bg-opacity-90 bg-').replace('text-', 'border-')}`}>
                                            {catInfo.label}
                                        </span>
                                    </div>
                                </div>
                                <div className="p-3">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-50 px-2 py-1 rounded w-fit max-w-[80%]">
                                            <MapPin size={12} className="text-blue-500 shrink-0" />
                                            <span className="truncate">{photo.location_label}</span>
                                        </div>
                                        <button onClick={(e) => { e.stopPropagation(); handleDelete(photo.id, photo.url); }} className="text-slate-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Upload Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center md:p-4">
                    <div className="bg-white rounded-none md:rounded-2xl shadow-2xl w-full h-full md:h-auto md:max-w-lg overflow-hidden animate-in zoom-in duration-200 flex flex-col max-h-screen md:max-h-[90vh]">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2"><Upload size={18} className="text-blue-600" /> Adicionar Foto</h3>
                            <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                        </div>

                        <form onSubmit={handleUpload} className="flex-1 overflow-y-auto p-6 space-y-5">

                            {/* Image Preview / Input */}
                            <div className="flex justify-center">
                                <label className="w-full aspect-video rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 hover:border-blue-400 transition-all overflow-hidden relative group">
                                    {previewUrl ? (
                                        <>
                                            <img src={previewUrl} className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <span className="text-white font-bold flex items-center gap-2"><Camera size={20} /> Alterar</span>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="bg-blue-50 p-4 rounded-full mb-2 text-blue-500"><ImageIcon size={32} /></div>
                                            <p className="text-sm font-bold text-slate-600">Clique para selecionar</p>
                                            <p className="text-xs text-slate-400">JPG, PNG ou WebP</p>
                                        </>
                                    )}
                                    <input type="file" className="hidden" accept="image/*" onChange={handleFileSelect} />
                                </label>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Descrição do Registro</label>
                                <textarea
                                    required
                                    value={newDesc}
                                    onChange={e => setNewDesc(e.target.value)}
                                    placeholder="Ex: Detalhe da armação do pilar P4..."
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none h-24 text-slate-800"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Local / Pavimento</label>
                                    <select
                                        value={newLocation}
                                        onChange={e => setNewLocation(e.target.value)}
                                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white text-slate-800"
                                    >
                                        {projectLocations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Categoria</label>
                                    <select
                                        value={newCategory}
                                        onChange={e => setNewCategory(e.target.value as any)}
                                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white text-slate-800"
                                    >
                                        {CATEGORIES.map(cat => <option key={cat.id} value={cat.id}>{cat.label}</option>)}
                                    </select>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={uploading || !selectedFile || !newDesc}
                                className="w-full py-3.5 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
                            >
                                {uploading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                                {uploading ? 'Enviando...' : 'Salvar na Galeria'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Lightbox Viewer & Editor */}
            {lightboxPhoto && (
                <div className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-md flex flex-col animate-in fade-in duration-300">
                    <div className="absolute top-4 right-4 z-50 flex gap-3">
                        <button onClick={() => setIsEditingPhoto(!isEditingPhoto)} className={`p-4 md:p-3 rounded-full transition-colors ${isEditingPhoto ? 'bg-blue-600 text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}>
                            <Edit2 size={24} className="md:w-5 md:h-5" />
                        </button>
                        <button onClick={() => handleDelete(lightboxPhoto.id, lightboxPhoto.url)} className="p-4 md:p-3 bg-white/10 hover:bg-red-500/20 text-white/70 hover:text-red-400 rounded-full transition-colors"><Trash2 size={24} className="md:w-5 md:h-5" /></button>
                        <button onClick={() => setLightboxPhoto(null)} className="p-4 md:p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"><X size={28} className="md:w-6 md:h-6" /></button>
                    </div>

                    <div className="flex-1 flex items-center justify-center p-4 md:p-8 relative">
                        <img src={lightboxPhoto.url} className="max-w-full max-h-[80vh] rounded-lg shadow-2xl object-contain" />
                    </div>

                    <div className={`bg-gradient-to-t from-black via-black/90 to-transparent p-6 pb-8 md:px-12 text-white transition-all ${isEditingPhoto ? 'h-auto bg-black border-t border-white/10' : ''}`}>
                        <div className="max-w-4xl mx-auto">
                            {isEditingPhoto ? (
                                <div className="space-y-4 animate-in slide-in-from-bottom-2">
                                    <h3 className="font-bold text-lg text-white mb-2">Editar Informações</h3>
                                    <div>
                                        <label className="text-xs text-white/50 uppercase font-bold block mb-1">Descrição</label>
                                        <input
                                            type="text"
                                            value={editDesc}
                                            onChange={e => setEditDesc(e.target.value)}
                                            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-white/50 uppercase font-bold block mb-1">Categoria</label>
                                        <select
                                            value={editCategory}
                                            onChange={e => setEditCategory(e.target.value as any)}
                                            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500"
                                        >
                                            {CATEGORIES.map(cat => <option key={cat.id} value={cat.id} className="text-black">{cat.label}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex justify-end gap-2 pt-2">
                                        <button onClick={() => setIsEditingPhoto(false)} className="px-4 py-2 text-white/70 hover:text-white font-bold text-sm">Cancelar</button>
                                        <button onClick={handleUpdatePhoto} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm flex items-center gap-2">
                                            <Save size={16} /> Salvar
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid md:grid-cols-[1fr_200px] gap-6">
                                    <div className="space-y-3">
                                        <div className="flex flex-wrap gap-3">
                                            <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full backdrop-blur-sm border border-white/10">
                                                {CATEGORIES.find(c => c.id === lightboxPhoto.category)?.label}
                                            </span>
                                            <span className="bg-blue-500/80 text-white text-xs font-bold px-3 py-1 rounded-full backdrop-blur-sm flex items-center gap-1">
                                                <MapPin size={10} /> {lightboxPhoto.location_label}
                                            </span>
                                        </div>
                                        <h3 className="text-lg md:text-xl font-medium leading-relaxed">{lightboxPhoto.description}</h3>
                                        <div className="flex items-center gap-4 text-white/50 text-sm">
                                            <span className="flex items-center gap-1.5"><Calendar size={14} /> {new Date(lightboxPhoto.created_at).toLocaleDateString('pt-BR', { dateStyle: 'long' })}</span>
                                            {lightboxPhoto.created_by && <span className="flex items-center gap-1.5"><User size={14} /> {lightboxPhoto.created_by.split('@')[0]}</span>}
                                        </div>
                                    </div>

                                    {/* granular details view */}
                                    <div className="border-l border-white/10 pl-6 space-y-3 hidden md:block">
                                        <div>
                                            <label className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Setor</label>
                                            <p className="text-sm font-medium text-white/90">
                                                {(lightboxPhoto as EnhancedPhoto).phaseId ?
                                                    (availablePhases.find(p => p.id === (lightboxPhoto as EnhancedPhoto).phaseId)?.label || (lightboxPhoto as EnhancedPhoto).phaseId)
                                                    : '—'}
                                            </p>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Atividade</label>
                                            <p className="text-sm font-medium text-white/90">
                                                {(lightboxPhoto as EnhancedPhoto).subtask === '_MACRO_' ? 'Visão Geral' : ((lightboxPhoto as EnhancedPhoto).subtask || '—')}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
