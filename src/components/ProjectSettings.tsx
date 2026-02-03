
import React, { useState, useEffect } from 'react';
import { Project, ProjectInvite, UserProfile, Organization, LevelConfig, UnitConfig, LevelType, PhaseConfig, Task, TaskStatus } from '../types';
import { Calendar, Save, Building, MapPin, Layout, Loader2, Users, Mail, Trash2, ShieldCheck, UserPlus, Clock, X, Crown, Building2, ArrowDown, ArrowUp, Edit3, Settings2, Plus, GripVertical, Home, Car, Coffee, Warehouse, AlertTriangle, Copy, PlusCircle, ArrowRight, Dumbbell, Wine, PartyPopper, Gamepad2, Waves, Anchor, Component, Cylinder, Bike, Box, Triangle, ListTodo, MoreVertical, Grip, Trash, CheckSquare, Square, Ruler, Layers, Database, RefreshCcw, CalendarDays, GanttChartSquare, GitMerge, ChevronDownCircle } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { DEFAULT_PHASES, getPhaseIcon, getPhaseColor } from '../constants';

interface ProjectSettingsProps {
  project: Project;
  onUpdateProject: (project: Project) => void;
  organizations?: Organization[];
  currentUser?: any;
}

// ... PRESETS CONFIGURATION ... (kept same)
const UNIT_PRESETS = [
    { category: 'Unidades Privativas', options: [
        { label: 'Apartamento', value: 'Apto', type: 'unit' },
        { label: 'Apartamento Garden', value: 'Garden', type: 'unit' },
        { label: 'Cobertura (Unidade)', value: 'Cobertura', type: 'unit' },
        { label: 'Studio', value: 'Studio', type: 'unit' },
        { label: 'Loja Comercial', value: 'Loja', type: 'commercial' },
        { label: 'Box Garagem', value: 'Box', type: 'garage' },
    ]},
    { category: 'Lazer & Convivência', options: [
        { label: 'Salão de Festas', value: 'Salão de Festas', type: 'common' },
        { label: 'Espaço Gourmet', value: 'Espaço Gourmet', type: 'common' },
        { label: 'Churrasqueira', value: 'Churrasqueira', type: 'common' },
        { label: 'Academia / Fitness', value: 'Academia', type: 'common' },
        { label: 'Piscina', value: 'Piscina', type: 'common' },
        { label: 'Brinquedoteca', value: 'Brinquedoteca', type: 'common' },
        { label: 'Playground', value: 'Playground', type: 'common' },
        { label: 'Sala de Jogos', value: 'Sala de Jogos', type: 'common' },
        { label: 'Cinema / Media', value: 'Cinema', type: 'common' },
        { label: 'Coworking', value: 'Coworking', type: 'common' },
        { label: 'Pet Place', value: 'Pet Place', type: 'common' },
    ]},
    { category: 'Áreas Comuns & Serviço', options: [
        { label: 'Hall de Entrada', value: 'Hall', type: 'common' },
        { label: 'Corredor / Circulação', value: 'Circulação', type: 'common' },
        { label: 'Escadaria', value: 'Escadaria', type: 'common' },
        { label: 'Elevador', value: 'Elevador', type: 'common' },
        { label: 'Guarita', value: 'Guarita', type: 'common' },
        { label: 'Lixeira', value: 'Lixeira', type: 'common' },
        { label: 'Bicicletário', value: 'Bicicletário', type: 'common' },
        { label: 'Depósito', value: 'Depósito', type: 'common' },
        { label: 'Vestiário', value: 'Vestiário', type: 'common' },
    ]},
    { category: 'Técnico & Infra', options: [
        { label: 'Caixa D\'água', value: 'Caixa D\'água', type: 'common' },
        { label: 'Casa de Máquinas', value: 'Casa de Máquinas', type: 'common' },
        { label: 'Barrilete', value: 'Barrilete', type: 'common' },
        { label: 'Gerador', value: 'Gerador', type: 'common' },
        { label: 'Centrais de Medição', value: 'Centrais', type: 'common' },
    ]}
];

export const ProjectSettings: React.FC<ProjectSettingsProps> = ({ project, onUpdateProject, organizations, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'team' | 'structure' | 'phases'>('general');
  const [formData, setFormData] = useState<Project>(project);
  const [saving, setSaving] = useState(false);
  const [migrating, setMigrating] = useState(false);

  // --- STRUCTURE CONFIG STATE ---
  const [genFoundation, setGenFoundation] = useState(false);
  const [genBasements, setGenBasements] = useState(0); 
  const [genGarages, setGenGarages] = useState(0);     
  const [genCommon, setGenCommon] = useState(1);       
  const [genAptFloors, setGenAptFloors] = useState(10);
  const [genUnitsPerFloor, setGenUnitsPerFloor] = useState(4);
  const [genRoof, setGenRoof] = useState(true);        

  // Custom Unit Creator State
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitType, setNewUnitType] = useState<'unit' | 'common' | 'garage' | 'commercial'>('unit');

  // Detailed Structure (The Source of Truth)
  const [levels, setLevels] = useState<LevelConfig[]>([]);
  const [expandedLevelId, setExpandedLevelId] = useState<string | null>(null);

  // Phases State
  const [activePhases, setActivePhases] = useState<PhaseConfig[]>([]);
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null);
  const [newSubtask, setNewSubtask] = useState('');
  
  // Schedule Generator State
  const [scheduleDaysPerUnit, setScheduleDaysPerUnit] = useState(2);
  const [generatingSchedule, setGeneratingSchedule] = useState(false);

  // Team State
  const [inviteEmail, setInviteEmail] = useState('');
  const [invites, setInvites] = useState<ProjectInvite[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);

  useEffect(() => {
    setFormData(project);
    loadStructureFromDB();
    
    // Load Phases
    setActivePhases(project.phases && project.phases.length > 0 ? project.phases : DEFAULT_PHASES);

    if (activeTab === 'team') {
        fetchTeamData();
    }
  }, [project, activeTab]);

  const loadStructureFromDB = async () => {
      try {
          // Try to load from new normalized tables first
          const { data: dbLevels, error } = await supabase
            .from('project_levels')
            .select('*, units:project_units(*)')
            .eq('project_id', project.id)
            .order('display_order', { ascending: true });

          if (dbLevels && dbLevels.length > 0) {
              const formattedLevels: LevelConfig[] = dbLevels.map((l: any) => ({
                  id: l.id,
                  label: l.label,
                  type: l.level_type as LevelType,
                  order: l.display_order,
                  activePhases: l.active_phases || [],
                  units: (l.units || []).sort((a: any, b: any) => a.display_order - b.display_order).map((u: any) => ({
                      id: u.id,
                      name: u.name,
                      type: u.type as any
                  }))
              }));
              setLevels(formattedLevels);
              return;
          }

          // Fallback to legacy structure in project object or matrix if new tables empty
          if (project.structure?.levels && project.structure.levels.length > 0) {
              const sortedLevels = [...project.structure.levels].sort((a, b) => a.order - b.order);
              setLevels(sortedLevels);
          } 
      } catch (err) {
          console.error("Error loading structure:", err);
      }
  };

  const fetchTeamData = async () => {
      setLoadingTeam(true);
      try {
        const { data: invitesData } = await supabase.from('project_invites').select('*').eq('project_id', project.id);
        if (invitesData) setInvites(invitesData);

        const { data: membersRows } = await supabase.from('project_members').select('*').eq('project_id', project.id);
        const membersList = membersRows || [];
        const allUserIds = new Set(membersList.map((m: any) => m.user_id));
        if (project.user_id) allUserIds.add(project.user_id);

        const { data: profilesData } = await supabase.from('profiles').select('*').in('id', Array.from(allUserIds));
        const profilesMap = new Map(profilesData?.map((p: any) => [p.id, p]) || []);

        const finalMembersList: any[] = [];
        if (project.user_id) {
            const ownerProfile = profilesMap.get(project.user_id);
            finalMembersList.push({ id: 'owner-placeholder', user_id: project.user_id, role: 'owner', profiles: ownerProfile || { full_name: 'Dono da Obra', email: 'Proprietário' } });
        }
        membersList.forEach((m: any) => { if (m.user_id !== project.user_id) finalMembersList.push({ ...m, profiles: profilesMap.get(m.user_id) }); });
        setMembers(finalMembersList);
      } catch (error) { console.error("Erro ao carregar equipe:", error); } finally { setLoadingTeam(false); }
  };

  // --- PRESET HANDLER ---
  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      setSelectedPreset(val);
      
      if (val === 'custom') {
          setNewUnitName('');
          setNewUnitType('unit');
          return;
      }

      if (val) {
          // Find selected option data
          let foundOption: any = null;
          for (const group of UNIT_PRESETS) {
              const opt = group.options.find(o => o.value === val);
              if (opt) { foundOption = opt; break; }
          }

          if (foundOption) {
              setNewUnitName(foundOption.value);
              setNewUnitType(foundOption.type as any);
          }
      } else {
          setNewUnitName('');
      }
  };

  // --- PHASE MANAGEMENT ---
  const handleAddPhase = () => {
      // Fix: Added missing 'code' property to fix PhaseConfig typing error
      const newPhase: PhaseConfig = {
          id: `custom_phase_${Date.now()}`,
          label: 'Nova Fase',
          code: '#NEW',
          color: 'blue',
          icon: 'Box',
          subtasks: ['Item de verificação 1']
      };
      setActivePhases(prev => [...prev, newPhase]);
      setEditingPhaseId(newPhase.id);
  };

  const handleUpdatePhase = (id: string, field: keyof PhaseConfig, value: any) => {
      setActivePhases(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleDeletePhase = (id: string) => {
      if(!confirm("Tem certeza? Isso pode afetar dados históricos se já existirem apontamentos nesta fase.")) return;
      setActivePhases(prev => prev.filter(p => p.id !== id));
      if(editingPhaseId === id) setEditingPhaseId(null);
  };

  const handleAddSubtask = (phaseId: string) => {
      if(!newSubtask.trim()) return;
      setActivePhases(prev => prev.map(p => p.id === phaseId ? { ...p, subtasks: [...p.subtasks, newSubtask.trim()] } : p));
      setNewSubtask('');
  };

  const handleRemoveSubtask = (phaseId: string, idx: number) => {
      setActivePhases(prev => prev.map(p => p.id === phaseId ? { ...p, subtasks: p.subtasks.filter((_, i) => i !== idx) } : p));
  };

  const handleMovePhase = (idx: number, direction: 'up'|'down') => {
      if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === activePhases.length - 1)) return;
      const newPhases = [...activePhases];
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      [newPhases[idx], newPhases[targetIdx]] = [newPhases[targetIdx], newPhases[idx]];
      setActivePhases(newPhases);
  };

  const handleToggleLevelPhase = (levelId: string, phaseId: string) => {
      setLevels(prev => prev.map(l => {
          if (l.id === levelId) {
              const currentPhases = l.activePhases || activePhases.map(p => p.id);
              const newPhases = currentPhases.includes(phaseId) 
                  ? currentPhases.filter(p => p !== phaseId)
                  : [...currentPhases, phaseId];
              return { ...l, activePhases: newPhases };
          }
          return l;
      }));
  };

  const handleBulkLevelPhases = (levelId: string, action: 'all' | 'none') => {
      setLevels(prev => prev.map(l => {
          if (l.id === levelId) {
              return { 
                  ...l, 
                  activePhases: action === 'all' ? activePhases.map(p => p.id) : [] 
              };
          }
          return l;
      }));
  };

  const handleGenerateSchedule = async () => {
      if (levels.length === 0) {
          alert("Defina a estrutura de pavimentos primeiro na aba 'Estrutura'.");
          return;
      }
      if (!window.confirm("Isso criará automaticamente tarefas no cronograma respeitando a sequência definida. Deseja continuar?")) return;

      setGeneratingSchedule(true);
      try {
          const startDate = project.startDate ? new Date(project.startDate) : new Date();
          let currentDate = new Date(startDate);
          
          const tasksToInsert: any[] = [];
          const fmt = (d: Date) => d.toISOString().split('T')[0];
          const addDays = (d: Date, days: number) => {
              const res = new Date(d);
              res.setDate(res.getDate() + days);
              return res;
          };

          const sortedLevels = [...levels].sort((a,b) => a.order - b.order);

          sortedLevels.forEach((level) => {
              // Only consider levels that have units or are relevant
              if (level.units.length === 0) return;

              let floorStartDate = new Date(currentDate); 
              // Stagger floors by a fixed amount (e.g., 5 days) to simulate line of balance
              currentDate = addDays(currentDate, 5); 

              let previousPhaseEndDate = floorStartDate;

              // The sequence of phases in 'activePhases' dictates the dependency chain
              activePhases.forEach((phase) => {
                  // Check if this phase is active for this level
                  if (level.activePhases && !level.activePhases.includes(phase.id)) return;

                  const duration = Math.max(1, level.units.length * scheduleDaysPerUnit);
                  const taskStart = previousPhaseEndDate;
                  const taskEnd = addDays(taskStart, duration);

                  tasksToInsert.push({
                      id: crypto.randomUUID(),
                      project_id: project.id,
                      name: `${phase.label} - ${level.label}`,
                      description: `Execução de ${phase.label} em ${level.units.length} unidades.`,
                      start: fmt(taskStart),
                      end: fmt(taskEnd),
                      progress: 0,
                      status: TaskStatus.NOT_STARTED,
                      custom_id: `${level.order}-${phase.label.substring(0,3).toUpperCase()}`
                  });

                  // The next phase on this floor starts when this one ends (Sequential within floor)
                  previousPhaseEndDate = taskEnd;
              });
          });

          if (tasksToInsert.length > 0) {
              const { error } = await supabase.from('tasks').insert(tasksToInsert);
              if (error) throw error;
              alert(`Cronograma gerado com sucesso! ${tasksToInsert.length} tarefas sequenciais criadas.`);
          } else {
              alert("Nenhuma tarefa gerada. Verifique se os pavimentos possuem fases ativas.");
          }

      } catch (error: any) {
          console.error("Error generating schedule:", error);
          alert("Erro ao gerar cronograma: " + error.message);
      } finally {
          setGeneratingSchedule(false);
      }
  };

  // --- GENERATOR LOGIC ---
  const handleGenerateStructure = () => {
      if (!window.confirm("CUIDADO: Isso irá sobrescrever a estrutura atual. O progresso de unidades existentes poderá ser perdido se os IDs mudarem. Deseja continuar?")) return;

      const newLevels: LevelConfig[] = [];
      let orderCounter = 0;
      let uniqueIdCounter = 0;
      const getUniqueId = (prefix: string) => `${prefix}_${Date.now()}_${uniqueIdCounter++}`;

      // Default active phases for simplicity (all)
      const allPhaseIds = activePhases.map(p => p.id);

      // 1. Foundation
      if (genFoundation) {
          newLevels.push({
              id: getUniqueId('L_FND'), label: 'Fundação', type: 'foundation', order: orderCounter++,
              units: [{ id: getUniqueId('U_FND_BLK'), name: 'Blocos & Estacas', type: 'common' }],
              activePhases: allPhaseIds 
          });
      }

      // 2. Basements
      for (let i = genBasements; i >= 1; i--) {
          newLevels.push({
              id: getUniqueId(`L_SUB_${i}`), label: `Subsolo ${i}`, type: 'basement', order: orderCounter++,
              units: [
                  { id: getUniqueId(`U_S${i}_GAR`), name: `Garagem Subsolo ${i}`, type: 'garage' },
                  { id: getUniqueId(`U_S${i}_HAL`), name: `Hall Acesso ${i}`, type: 'common' }
              ],
              activePhases: allPhaseIds
          });
      }

      // 3. Garages (Podium)
      for (let i = 1; i <= genGarages; i++) {
          newLevels.push({
              id: getUniqueId(`L_GAR_${i}`), label: `Garagem G${i}`, type: 'garage', order: orderCounter++,
              units: [
                  { id: getUniqueId(`U_G${i}_VAG`), name: `Box Garagens G${i}`, type: 'garage' },
                  { id: getUniqueId(`U_G${i}_RAM`), name: 'Rampas de Acesso', type: 'common' }
              ],
              activePhases: allPhaseIds
          });
      }

      // 4. Ground / Common Floors
      for (let i = 1; i <= genCommon; i++) {
          const label = genCommon === 1 ? 'Térreo' : `Pavimento Comum ${i}`;
          newLevels.push({
              id: getUniqueId(`L_COM_${i}`), label: label, type: 'common', order: orderCounter++,
              units: [
                  { id: getUniqueId(`U_C${i}_HAL`), name: 'Hall de Entrada', type: 'common' },
                  { id: getUniqueId(`U_C${i}_LAZ`), name: 'Área de Lazer', type: 'common' }
              ],
              activePhases: allPhaseIds
          });
      }

      // 5. Apartment Floors
      for (let i = 1; i <= genAptFloors; i++) {
          const floorUnits: UnitConfig[] = [];
          for (let u = 1; u <= genUnitsPerFloor; u++) {
              const unitNum = i * 100 + u;
              floorUnits.push({ id: getUniqueId(`U_APT_${unitNum}`), name: `Apto ${unitNum}`, type: 'unit' });
          }
          // Add Hall
          floorUnits.push({ id: getUniqueId(`U_APT_HAL_${i}`), name: `Hall Pav. ${i}`, type: 'common' });

          newLevels.push({
              id: getUniqueId(`L_APT_${i}`), label: `${i}º Pavimento`, type: 'apartments', order: orderCounter++,
              units: floorUnits,
              activePhases: allPhaseIds
          });
      }

      // 6. Roof
      if (genRoof) {
          newLevels.push({
              id: getUniqueId('L_ROOF'), label: 'Cobertura / Ático', type: 'roof', order: orderCounter++,
              units: [
                  { id: getUniqueId('U_ROOF_RES'), name: 'Reservatório Superior', type: 'common' },
                  { id: getUniqueId('U_ROOF_MAC'), name: 'Casa de Máquinas', type: 'common' }
              ],
              activePhases: allPhaseIds
          });
      }

      setLevels(newLevels);
  };

  // --- MIGRATION LOGIC ---
  const handleMigrateLegacyData = async () => {
      if(!window.confirm("Isso irá LER o JSON antigo 'matrix_data' e recriar toda a estrutura nas novas tabelas. Dados atuais nas tabelas novas podem ser duplicados se não estiverem limpos. Deseja continuar?")) return;
      
      setMigrating(true);
      try {
          // 1. Fetch Legacy Data
          const { data: matrixRow, error: matrixError } = await supabase
              .from('project_matrices')
              .select('matrix_data')
              .eq('project_id', project.id)
              .single();

          if (matrixError || !matrixRow?.matrix_data) {
              throw new Error("Dados legados não encontrados ou erro ao buscar.");
          }

          const legacyData = matrixRow.matrix_data;
          
          // Clear current levels to avoid duplication (Optional - risky but cleaner for migration)
          await supabase.from('project_levels').delete().eq('project_id', project.id);

          // 2. Iterate Floors
          if (legacyData.floors) {
              for (const floor of legacyData.floors) {
                  // Determine Level Type based on label/content
                  let type: LevelType = 'apartments';
                  const lowerLabel = floor.label.toLowerCase();
                  
                  if (lowerLabel.includes('fundação') || floor.floor === 0) type = 'foundation';
                  else if (lowerLabel.includes('subsolo')) type = 'basement';
                  else if (lowerLabel.includes('garagem') || lowerLabel.includes('g1') || lowerLabel.includes('g2')) type = 'garage';
                  else if (lowerLabel.includes('térreo') || lowerLabel.includes('lazer')) type = 'common';
                  else if (lowerLabel.includes('cobertura') || lowerLabel.includes('caixa')) type = 'roof';

                  // Insert Level
                  const { data: savedLevel, error: lError } = await supabase
                      .from('project_levels')
                      .insert({
                          project_id: project.id,
                          label: floor.label,
                          level_type: type,
                          display_order: floor.floor, // Using existing floor number as order
                          active_phases: activePhases.map(p => p.id) // Default all active
                      })
                      .select()
                      .single();

                  if (lError) {
                      console.error(`Erro ao criar nível ${floor.label}:`, lError);
                      continue;
                  }

                  // 3. Iterate Units
                  if (floor.units) {
                      for (let uIdx = 0; uIdx < floor.units.length; uIdx++) {
                          const unit = floor.units[uIdx];
                          
                          // Determine Unit Type
                          let uType = 'unit';
                          const lowerName = unit.name.toLowerCase();
                          if (lowerName.includes('hall') || lowerName.includes('escada') || lowerName.includes('lazer')) uType = 'common';
                          else if (lowerName.includes('box') || lowerName.includes('vaga') || lowerName.includes('garagem')) uType = 'garage';
                          else if (lowerName.includes('loja')) uType = 'commercial';

                          // Insert Unit
                          // Force using the ID from JSON if valid, else let DB generate or use temp
                          const unitId = unit.id && unit.id.length > 5 ? unit.id : `${savedLevel.id}_U${uIdx}`;

                          const { error: uError } = await supabase
                              .from('project_units')
                              .insert({
                                  id: unitId,
                                  project_id: project.id,
                                  level_id: savedLevel.id,
                                  name: unit.name,
                                  type: uType,
                                  display_order: uIdx
                              });

                          if (uError) console.error(`Erro ao criar unidade ${unit.name}:`, uError);

                          // 4. Iterate Phases (Progress)
                          if (unit.phases) {
                              const progressInserts = [];
                              for (const [phaseId, phaseData] of Object.entries(unit.phases)) {
                                  const pData = phaseData as any;
                                  if (pData) {
                                      progressInserts.push({
                                          unit_id: unitId,
                                          project_id: project.id,
                                          phase_id: phaseId,
                                          percentage: pData.percentage || 0,
                                          subtasks: pData.subtasks || {},
                                          image_url: pData.imageUrl || null,
                                          updated_at: pData.lastUpdated || new Date().toISOString()
                                      });
                                  }
                              }
                              if (progressInserts.length > 0) {
                                  await supabase.from('unit_progress').upsert(progressInserts);
                              }
                          }
                      }
                  }
              }
          }

          // 5. Migrate Logs
          if (legacyData.logs && legacyData.logs.length > 0) {
              const logInserts = legacyData.logs.map((log: any) => ({
                  project_id: project.id,
                  category: log.category || 'unit',
                  title: log.title,
                  details: log.details,
                  previous_value: log.previous_value,
                  new_value: log.new_value,
                  observation: log.observation,
                  user_name: log.user_name,
                  user_avatar: log.user_avatar,
                  image_url: log.image_url,
                  date: log.date
              }));
              // Batch insert logs
              await supabase.from('project_logs').insert(logInserts);
          }

          alert("Migração concluída com sucesso! Recarregue a página para ver os dados.");
          await loadStructureFromDB();

      } catch (error: any) {
          console.error("Erro na migração:", error);
          alert("Falha na migração: " + error.message);
      } finally {
          setMigrating(false);
      }
  };

  // --- ADVANCED EDITOR LOGIC ---
  const handleAddUnit = (levelId: string) => {
      if (!newUnitName.trim()) return;
      
      setLevels(prev => prev.map(l => {
          if (l.id === levelId) {
              const newUnit: UnitConfig = {
                  id: `U_${levelId}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                  name: newUnitName,
                  type: newUnitType
              };
              return { ...l, units: [...l.units, newUnit] };
          }
          return l;
      }));
  };

  const handleRemoveUnit = (levelId: string, unitId: string) => {
      setLevels(prev => prev.map(l => {
          if (l.id === levelId) {
              return { ...l, units: l.units.filter(u => u.id !== unitId) };
          }
          return l;
      }));
  };

  const handleUpdateUnit = (levelId: string, unitId: string, field: keyof UnitConfig, value: string) => {
      setLevels(prev => prev.map(l => {
          if (l.id === levelId) {
              return {
                  ...l,
                  units: l.units.map(u => u.id === unitId ? { ...u, [field]: value } : u)
              };
          }
          return l;
      }));
  };

  const handleAddLevel = (index: number) => {
        const newLevel: LevelConfig = {
            id: `L_${Date.now()}_NEW`,
            label: 'Novo Pavimento',
            type: 'apartments',
            order: 0,
            units: [],
            activePhases: activePhases.map(p => p.id)
        };
        
        const newLevels = [...levels];
        newLevels.splice(index + 1, 0, newLevel);
        const reordered = newLevels.map((l, i) => ({ ...l, order: i }));
        setLevels(reordered);
        setExpandedLevelId(newLevel.id);
  };

  const handleDeleteLevel = (id: string) => {
        if (!confirm("Tem certeza? Isso apagará todas as unidades deste andar.")) return;
        const newLevels = levels.filter(l => l.id !== id);
        const reordered = newLevels.map((l, i) => ({ ...l, order: i }));
        setLevels(reordered);
  };

  const handleDuplicateLevel = (id: string) => {
        const index = levels.findIndex(l => l.id === id);
        if (index === -1) return;

        const source = levels[index];
        const newLevelId = `L_${Date.now()}_COPY_${Math.random().toString(36).substr(2, 5)}`;

        // Deep copy units with new IDs to prevent reference issues and DB primary key conflicts
        const newUnits = source.units.map(u => ({
            ...u,
            id: `U_${newLevelId}_${Math.random().toString(36).substr(2, 5)}`,
            // Preserve name and type
        }));

        const newLevel: LevelConfig = {
            ...source,
            id: newLevelId,
            label: `${source.label} (Cópia)`,
            units: newUnits,
            activePhases: [...(source.activePhases || [])]
        };

        const newLevelsList = [...levels];
        newLevelsList.splice(index + 1, 0, newLevel); // Insert right after original

        const reordered = newLevelsList.map((l, i) => ({ ...l, order: i }));
        setLevels(reordered);
        setExpandedLevelId(newLevelId);
  };

  const handleMoveLevel = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === levels.length - 1) return;
        const newLevels = [...levels];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        [newLevels[index], newLevels[targetIndex]] = [newLevels[targetIndex], newLevels[index]];
        const reordered = newLevels.map((l, i) => ({ ...l, order: i }));
        setLevels(reordered);
  };

  // --- SMART SAVE & SYNC ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    // Legacy mapping for project overview
    const derivedHasFoundation = levels.some(l => l.type === 'foundation');
    const derivedBasements = levels.filter(l => l.type === 'basement').length;
    const derivedFloors = levels.filter(l => ['apartments', 'common', 'garage'].includes(l.type)).length;

    const updatedProject = {
        ...formData,
        phases: activePhases,
        structure: {
            ...formData.structure,
            levels: levels, 
            floors: derivedFloors,
            unitsPerFloor: 4, 
            hasFoundation: derivedHasFoundation,
            basements: derivedBasements
        }
    };

    try {
        // 1. Save Relational Structure (Levels & Units)
        // We will upsert Levels.
        for (const level of levels) {
            // Check if level ID is a valid UUID, if not (legacy/temp id), let Postgres generate it
            const levelPayload: any = {
                project_id: project.id,
                label: level.label,
                level_type: level.type,
                display_order: level.order,
                active_phases: level.activePhases
            };
            
            // Basic UUID check regex
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(level.id);
            if (isUUID) levelPayload.id = level.id;

            const { data: savedLevel, error: lError } = await supabase
                .from('project_levels')
                .upsert(levelPayload, { onConflict: 'id' }) // Only works if we supply ID
                .select()
                .single();
            
            if (lError) throw lError;

            // SYNC UNITS: Delete removed units before upserting new ones
            if (savedLevel) {
                const currentUnitIds = level.units.map(u => u.id);
                
                if (currentUnitIds.length > 0) {
                    // Safe delete: Remove units in DB that are NOT in the current list
                    const idsFormatted = `(${currentUnitIds.map(id => `"${id}"`).join(',')})`;
                    await supabase
                        .from('project_units')
                        .delete()
                        .eq('level_id', savedLevel.id)
                        .not('id', 'in', idsFormatted);
                } else {
                    // If no units in UI for this level, clear all units in DB for this level
                    await supabase
                        .from('project_units')
                        .delete()
                        .eq('level_id', savedLevel.id);
                }

                // Now upsert Units for this level
                if (level.units.length > 0) {
                    const unitsPayload = level.units.map((u, uIdx) => {
                        const uPayload: any = {
                            project_id: project.id,
                            level_id: savedLevel.id,
                            name: u.name,
                            type: u.type,
                            display_order: uIdx
                        };
                        // Use ID if it's not a temp ID to preserve history
                        if (!u.id.includes('_')) uPayload.id = u.id; // Assuming generated IDs have underscores or temp markers
                        else uPayload.id = u.id; // We can use text IDs for units if we want to preserve exact mapping

                        return uPayload;
                    });

                    const { error: uError } = await supabase.from('project_units').upsert(unitsPayload);
                    if (uError) throw uError;
                }
            }
        }

        // 2. Update Project Metadata
        await onUpdateProject(updatedProject);
        alert("Estrutura e Fases salvas com sucesso!");

    } catch (error: any) {
        console.error("Erro ao salvar:", error);
        alert("Erro ao salvar alterações: " + error.message);
    } finally {
        setSaving(false);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!inviteEmail) return;
      const { error } = await supabase.from('project_invites').insert({ project_id: project.id, email: inviteEmail.trim().toLowerCase(), role: 'member', status: 'pending', invited_by: (await supabase.auth.getUser()).data.user?.email });
      if (error) alert('Erro ao enviar convite: ' + error.message); else { setInviteEmail(''); fetchTeamData(); }
  };

  const handleRemoveInvite = async (id: string) => { if(!window.confirm("Cancelar este convite?")) return; await supabase.from('project_invites').delete().eq('id', id); fetchTeamData(); };
  const handleRemoveMember = async (memberId: string) => { if(!window.confirm("Remover este membro do projeto?")) return; await supabase.from('project_members').delete().eq('id', memberId); fetchTeamData(); };

  const isOwner = project.user_id === currentUser?.id;

  const getUnitIcon = (type: string) => {
      switch(type) {
          case 'garage': return <Car size={14} className="text-slate-400"/>;
          case 'unit': return <Home size={14} className="text-blue-500"/>;
          case 'common': return <Coffee size={14} className="text-orange-500"/>;
          case 'commercial': return <Warehouse size={14} className="text-purple-500"/>;
          default: return <Warehouse size={14} className="text-slate-400"/>;
      }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <header className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800">Configurações da Obra</h2>
        <p className="text-slate-500">Gerencie informações, fases, estrutura predial e equipe.</p>
      </header>

      <div className="flex gap-2 mb-6 border-b border-slate-200 overflow-x-auto">
          <button onClick={() => setActiveTab('general')} className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'general' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}><Building size={16} /> Geral</button>
          <button onClick={() => setActiveTab('phases')} className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'phases' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}><GitMerge size={16} /> Fluxo Executivo (Sequência)</button>
          <button onClick={() => setActiveTab('structure')} className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'structure' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}><Layout size={16} /> Estrutura & Pavimentos</button>
          <button onClick={() => setActiveTab('team')} className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'team' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}><Users size={16} /> Equipe & Acesso</button>
      </div>

      <form onSubmit={handleSubmit}>
        {/* ... (Keep General Tab content same) ... */}
        {activeTab === 'general' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden p-6 space-y-6">
                <div className="border-b border-slate-100 pb-6">
                    <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800 mb-4"><Building2 className="text-blue-600" size={20} /> Organização</h3>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">Empresa Proprietária</label>
                        <select value={formData.organization_id || ''} onChange={e => setFormData({...formData, organization_id: e.target.value || undefined})} disabled={!isOwner} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 bg-white text-sm">
                            <option value="">Pessoal (Sem empresa vinculada)</option>
                            {organizations?.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
                        </select>
                    </div>
                </div>
                {/* ... Rest of General Form ... */}
                <div className="border-b border-slate-100 pb-6">
                    <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800 mb-4"><Building className="text-blue-600" size={20} /> Informações Básicas</h3>
                    <div className="grid gap-4">
                        <div><label className="block text-sm font-bold text-slate-700 mb-1.5">Nome da Obra</label><input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-slate-800 bg-white" /></div>
                        <div><label className="block text-sm font-bold text-slate-700 mb-1.5">Endereço</label><input required type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-slate-800 bg-white" /></div>
                        <div><label className="block text-sm font-bold text-slate-700 mb-1.5">Engenheiro Responsável</label><input required type="text" value={formData.residentEngineer} onChange={e => setFormData({...formData, residentEngineer: e.target.value})} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-slate-800 bg-white" /></div>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'phases' && (
            <div className="flex flex-col gap-6">
                
                {/* New: Generator Tool */}
                <div className="bg-indigo-50 border border-indigo-100 p-5 rounded-xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                        <h4 className="text-indigo-900 font-bold text-lg flex items-center gap-2">
                            <GanttChartSquare size={20}/> Automação de Cronograma
                        </h4>
                        <p className="text-indigo-700/80 text-sm mt-1">O gerador criará tarefas sequenciais para cada pavimento, seguindo a ordem definida abaixo.</p>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="flex items-center bg-white rounded-lg border border-indigo-200 px-3 py-2">
                            <span className="text-xs font-bold text-slate-500 mr-2 uppercase">Ritmo:</span>
                            <input type="number" min="1" max="30" value={scheduleDaysPerUnit} onChange={e => setScheduleDaysPerUnit(parseInt(e.target.value))} className="w-12 text-center font-bold text-indigo-700 outline-none border-b border-indigo-200 focus:border-indigo-500 bg-white" />
                            <span className="text-xs font-bold text-slate-500 ml-2">dias/unid.</span>
                        </div>
                        <button 
                            type="button" 
                            onClick={handleGenerateSchedule}
                            disabled={generatingSchedule}
                            className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-md disabled:opacity-70 flex items-center gap-2 whitespace-nowrap"
                        >
                            {generatingSchedule ? <Loader2 size={16} className="animate-spin"/> : <CalendarDays size={16}/>}
                            Gerar Cronograma
                        </button>
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-6 h-[800px]">
                    {/* List of Phases */}
                    <div className="lg:w-1/3 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-slate-800 text-sm">Sequência de Execução</h3>
                                <p className="text-[10px] text-slate-400">Esta ordem define a dependência das tarefas</p>
                            </div>
                            <button type="button" onClick={handleAddPhase} className="text-blue-600 hover:text-blue-700 bg-blue-50 p-1.5 rounded-lg"><Plus size={16}/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-0 relative bg-slate-50/30">
                            {/* Vertical Flow Line */}
                            <div className="absolute left-[31px] top-6 bottom-6 w-0.5 bg-slate-300 -z-0 border-l border-dashed border-slate-300"></div>
                            
                            {activePhases.map((phase, idx) => (
                                <div key={phase.id} className="relative z-10 mb-2 last:mb-0">
                                    <div onClick={() => setEditingPhaseId(phase.id)} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-all relative ${editingPhaseId === phase.id ? 'bg-blue-50 border-blue-200 shadow-md translate-x-1' : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-sm'}`}>
                                        
                                        <div className="flex flex-col gap-1 items-center mr-1">
                                            <button type="button" onClick={(e) => { e.stopPropagation(); handleMovePhase(idx, 'up'); }} className="text-slate-300 hover:text-blue-600 p-0.5"><ArrowUp size={8}/></button>
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${getPhaseColor(phase.color)} shadow-sm border-2 border-white ring-1 ring-slate-100`}>{idx + 1}</div>
                                            <button type="button" onClick={(e) => { e.stopPropagation(); handleMovePhase(idx, 'down'); }} className="text-slate-300 hover:text-blue-600 p-0.5"><ArrowDown size={8}/></button>
                                        </div>

                                        <div className={`p-2 rounded-lg text-white ${getPhaseColor(phase.color)} shadow-sm`}>{getPhaseIcon(phase.icon, 16)}</div>
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-slate-700">{phase.label}</p>
                                            <p className="text-[10px] text-slate-400">{phase.subtasks.length} verificações</p>
                                        </div>
                                    </div>
                                    
                                    {/* Visual Connector Arrow */}
                                    {idx < activePhases.length - 1 && (
                                        <div className="flex justify-start ml-[23px] h-4 items-center">
                                            <ChevronDownCircle size={14} className="text-slate-300 bg-white rounded-full relative z-20" />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Phase Editor */}
                    <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 p-6 overflow-y-auto">
                        {editingPhaseId ? (() => {
                            const phase = activePhases.find(p => p.id === editingPhaseId);
                            if (!phase) return null;
                            return (
                                <div className="space-y-6">
                                    <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg text-white ${getPhaseColor(phase.color)}`}>{getPhaseIcon(phase.icon)}</div>
                                            <h3 className="text-lg font-bold text-slate-800">Editar Etapa</h3>
                                        </div>
                                        <button type="button" onClick={() => handleDeletePhase(phase.id)} className="text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 border border-red-100"><Trash2 size={14}/> Excluir</button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome da Etapa</label>
                                            <input type="text" value={phase.label} onChange={e => handleUpdatePhase(phase.id, 'label', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700 bg-white" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cor do Tema</label>
                                            <select value={phase.color} onChange={e => handleUpdatePhase(phase.id, 'color', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none bg-white text-slate-800">
                                                {['stone','orange','cyan','blue','red','yellow','amber','slate','emerald','rose','violet'].map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Checklist de Verificação (Subetapas)</label>
                                        <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-inner">
                                            <div className="divide-y divide-slate-200">
                                                {phase.subtasks.map((task, idx) => (
                                                    <div key={idx} className="flex items-center gap-3 p-3 bg-white">
                                                        <span className="text-slate-300 font-mono text-xs font-bold">{idx + 1}.</span>
                                                        <span className="flex-1 text-sm font-medium text-slate-700">{task}</span>
                                                        <button type="button" onClick={() => handleRemoveSubtask(phase.id, idx)} className="text-slate-300 hover:text-red-500 p-1"><X size={14}/></button>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="p-3 bg-slate-100 flex gap-2">
                                                <input 
                                                    type="text" 
                                                    placeholder="Adicionar item de verificação..." 
                                                    value={newSubtask} 
                                                    onChange={e => setNewSubtask(e.target.value)} 
                                                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddSubtask(phase.id))}
                                                    className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none focus:bg-white transition-all text-slate-800" 
                                                />
                                                <button type="button" onClick={() => handleAddSubtask(phase.id)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-xs uppercase hover:bg-blue-700 shadow-sm">Adicionar</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })() : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-xl border-2 border-dashed border-slate-200">
                                <ListTodo size={48} className="mb-4 opacity-20"/>
                                <p className="font-medium">Selecione uma fase na lista ao lado para editar.</p>
                                <p className="text-xs mt-1 opacity-70">Ou crie uma nova para expandir o fluxo.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* ... (Structure and Team Tabs remain mostly unchanged but need dark text enforcement in inputs) ... */}
        {activeTab === 'structure' && (
            <div className="flex flex-col lg:flex-row gap-6">
                
                {/* --- GERADOR ROBUSTO --- */}
                <div className="lg:w-1/3 space-y-6">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Settings2 size={20} className="text-blue-600"/> Gerador de Estrutura</h3>
                        
                        <div className="space-y-6">
                            {/* Infraestrutura */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1"><Anchor size={12}/> Infraestrutura</h4>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200">
                                        <span className="text-xs font-bold text-slate-700 ml-1">Fundação</span>
                                        <input type="checkbox" checked={genFoundation} onChange={e => setGenFoundation(e.target.checked)} className="accent-blue-600 h-4 w-4 mr-1" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Subsolos</label>
                                            <input type="number" min="0" max="10" value={genBasements} onChange={e => setGenBasements(parseInt(e.target.value))} className="w-full px-2 py-1.5 rounded border text-sm font-bold text-center bg-white text-slate-800" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Garagens</label>
                                            <input type="number" min="0" max="10" value={genGarages} onChange={e => setGenGarages(parseInt(e.target.value))} className="w-full px-2 py-1.5 rounded border text-sm font-bold text-center bg-white text-slate-800" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Superestrutura */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1"><Building size={12}/> Superestrutura</h4>
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Pav. Comuns</label>
                                            <input type="number" min="1" max="10" value={genCommon} onChange={e => setGenCommon(parseInt(e.target.value))} className="w-full px-2 py-1.5 rounded border text-sm font-bold text-center bg-white text-slate-800" title="Térreo + Mezanino, etc." />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cobertura</label>
                                            <div className="h-[34px] flex items-center justify-center bg-white rounded border border-slate-200">
                                                <input type="checkbox" checked={genRoof} onChange={e => setGenRoof(e.target.checked)} className="accent-blue-600 h-4 w-4" />
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="bg-white p-3 rounded-lg border border-slate-200">
                                        <label className="block text-[10px] font-bold text-blue-600 uppercase mb-2">Torre (Pavimentos Tipo)</label>
                                        <div className="flex items-center gap-2">
                                            <input type="number" min="1" max="100" value={genAptFloors} onChange={e => setGenAptFloors(parseInt(e.target.value))} className="flex-1 px-2 py-2 rounded border text-sm font-bold text-center bg-white text-slate-800" />
                                            <span className="text-xs text-slate-400 font-medium">andares x</span>
                                            <input type="number" min="1" max="20" value={genUnitsPerFloor} onChange={e => setGenUnitsPerFloor(parseInt(e.target.value))} className="w-16 px-2 py-2 rounded border text-sm font-bold text-center bg-white text-slate-800" />
                                            <span className="text-xs text-slate-400 font-medium">aptos</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button type="button" onClick={handleGenerateStructure} className="w-full py-3 bg-slate-800 text-white font-bold text-xs uppercase rounded-xl hover:bg-slate-900 transition-colors shadow-lg flex items-center justify-center gap-2">
                                <Ruler size={16}/> Gerar Estrutura Completa
                            </button>
                        </div>
                    </div>

                    <div className="bg-amber-50 rounded-xl border border-amber-100 p-4">
                        <h3 className="text-xs font-bold text-amber-800 mb-2 flex items-center gap-2 uppercase tracking-wide"><Database size={14}/> Migração de Dados (Avançado)</h3>
                        <p className="text-[10px] text-amber-600 mb-3 leading-relaxed">
                            Se você migrou do sistema antigo e suas unidades (incluindo Fundação) sumiram, use esta ferramenta para restaurar a estrutura a partir do histórico JSON.
                        </p>
                        <button 
                            type="button" 
                            onClick={handleMigrateLegacyData}
                            disabled={migrating}
                            className="w-full py-2 bg-amber-600 text-white font-bold text-xs rounded-lg hover:bg-amber-700 transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-70"
                        >
                            {migrating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
                            Importar do Histórico JSON
                        </button>
                    </div>
                </div>

                {/* --- EDITOR DETALHADO (VISUAL) --- */}
                <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col h-[800px]">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Layout size={20} className="text-blue-600"/> Editor de Pavimentos</h3>
                            <p className="text-xs text-slate-500">Configure o escopo (fases) e o inventário (unidades) de cada pavimento.</p>
                        </div>
                        <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full">{levels.length} Níveis</span>
                    </div>
                    
                    {levels.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-8 text-center bg-slate-50/50">
                            <Building2 className="text-slate-300 mb-4" size={48} />
                            <p className="text-slate-500 text-sm mb-4">Nenhuma estrutura definida.</p>
                            <button type="button" onClick={handleGenerateStructure} className="text-blue-600 font-bold text-sm hover:underline">Usar Gerador da Esquerda</button>
                            <span className="text-slate-400 text-xs my-2">ou</span>
                            <button type="button" onClick={() => handleAddLevel(-1)} className="bg-slate-800 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2"><PlusCircle size={16} /> Criar Primeiro Nível</button>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/30 rounded-xl border border-slate-200 p-4 space-y-4">
                            {[...levels].reverse().map((level, reverseIndex) => {
                                const originalIndex = levels.length - 1 - reverseIndex;
                                return (
                                    <div key={level.id} className="relative group/level">
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 opacity-0 group-hover/level:opacity-100 transition-opacity">
                                            <button type="button" onClick={() => handleAddLevel(originalIndex)} className="bg-blue-600 text-white p-1 rounded-full shadow-sm hover:scale-110 transition-transform" title="Inserir nível aqui"><Plus size={12} /></button>
                                        </div>

                                        <div className={`rounded-xl border shadow-sm overflow-hidden transition-all ${expandedLevelId === level.id ? 'ring-2 ring-blue-100 border-blue-200 bg-white' : 'border-slate-200 bg-white hover:border-blue-300'}`}>
                                            {/* Header do Nível */}
                                            <div className="p-3 flex items-center gap-3 cursor-pointer" onClick={() => setExpandedLevelId(expandedLevelId === level.id ? null : level.id)}>
                                                <div className="flex flex-col gap-0.5">
                                                    <button type="button" onClick={(e) => { e.stopPropagation(); handleMoveLevel(originalIndex, 'up'); }} disabled={originalIndex === levels.length - 1} className="text-slate-300 hover:text-blue-600 disabled:opacity-0"><ArrowUp size={12}/></button>
                                                    <button type="button" onClick={(e) => { e.stopPropagation(); handleMoveLevel(originalIndex, 'down'); }} disabled={originalIndex === 0} className="text-slate-300 hover:text-blue-600 disabled:opacity-0"><ArrowDown size={12}/></button>
                                                </div>
                                                
                                                <div className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold border ${level.type === 'apartments' ? 'bg-blue-50 text-blue-600 border-blue-100' : level.type === 'garage' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                                    {level.type === 'foundation' ? 'FN' : level.type === 'roof' ? 'CB' : (originalIndex + 1)}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <input 
                                                        type="text" 
                                                        value={level.label} 
                                                        onChange={(e) => { const newLevels = [...levels]; newLevels[originalIndex].label = e.target.value; setLevels(newLevels); }}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="font-bold text-sm text-slate-800 bg-transparent border-b border-transparent focus:border-blue-400 focus:bg-blue-50 outline-none w-full"
                                                    />
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[10px] text-slate-400">{level.units.length} unidades</span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-1">
                                                    <button type="button" onClick={(e) => { e.stopPropagation(); handleDuplicateLevel(level.id); }} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Duplicar Pavimento"><Copy size={16}/></button>
                                                    <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteLevel(level.id); }} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16}/></button>
                                                </div>
                                            </div>

                                            {/* Conteúdo Expandido */}
                                            {expandedLevelId === level.id && (
                                                <div className="p-4 bg-slate-50 border-t border-slate-100 animate-in slide-in-from-top-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    
                                                    {/* COLUMN 1: SCOPE / PHASES */}
                                                    <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col h-full">
                                                        <div className="flex justify-between items-center mb-3">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><ListTodo size={12}/> Escopo de Trabalho (Fases)</span>
                                                            <div className="flex gap-1">
                                                                <button type="button" onClick={() => handleBulkLevelPhases(level.id, 'all')} className="text-[9px] font-bold bg-slate-50 border border-slate-100 px-2 py-1 rounded hover:bg-blue-50 hover:text-blue-600 transition-colors">Marcar Todas</button>
                                                                <button type="button" onClick={() => handleBulkLevelPhases(level.id, 'none')} className="text-[9px] font-bold bg-slate-50 border border-slate-100 px-2 py-1 rounded hover:bg-red-50 hover:text-red-600 transition-colors">Nenhuma</button>
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2 overflow-y-auto max-h-[300px] custom-scrollbar">
                                                            {activePhases.map(phase => {
                                                                const isActive = level.activePhases ? level.activePhases.includes(phase.id) : true;
                                                                return (
                                                                    <button 
                                                                        key={phase.id} 
                                                                        type="button"
                                                                        onClick={() => handleToggleLevelPhase(level.id, phase.id)}
                                                                        className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${isActive ? 'bg-blue-50/50 border-blue-200 shadow-sm' : 'bg-slate-50 border-transparent opacity-60 grayscale hover:grayscale-0 hover:bg-white hover:border-slate-200'}`}
                                                                    >
                                                                        <div className={`w-3 h-3 rounded flex items-center justify-center border ${isActive ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'}`}>
                                                                            {isActive && <CheckSquare size={10} className="text-white" />}
                                                                        </div>
                                                                        <span className={`text-[10px] font-bold ${isActive ? 'text-blue-900' : 'text-slate-500'}`}>{phase.label}</span>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    {/* COLUMN 2: INVENTORY / UNITS */}
                                                    <div className="flex flex-col gap-3">
                                                        <div className="bg-white p-3 rounded-xl border border-slate-200 flex-1 flex flex-col">
                                                            <div className="flex justify-between items-center mb-3">
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><Home size={12}/> Unidades / Ambientes</span>
                                                            </div>
                                                            
                                                            {/* Custom Unit Creator */}
                                                            <div className="flex flex-col gap-2 mb-3 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                                <span className="text-[10px] font-bold text-slate-500 uppercase">Adicionar Ambiente</span>
                                                                <div className="flex flex-col gap-2">
                                                                    <select 
                                                                        value={selectedPreset}
                                                                        onChange={handlePresetChange}
                                                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-700 font-medium"
                                                                    >
                                                                        <option value="">Selecione um tipo...</option>
                                                                        {UNIT_PRESETS.map((group, idx) => (
                                                                            <optgroup key={idx} label={group.category}>
                                                                                {group.options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                                            </optgroup>
                                                                        ))}
                                                                        <option value="custom">✨ Personalizado (Outro)</option>
                                                                    </select>

                                                                    <div className="flex gap-2">
                                                                        <input 
                                                                            type="text" 
                                                                            placeholder={selectedPreset === 'custom' ? "Nome do ambiente" : "Nome / Número (Ex: 101)"} 
                                                                            value={newUnitName}
                                                                            onChange={e => setNewUnitName(e.target.value)}
                                                                            className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-800"
                                                                        />
                                                                        
                                                                        {selectedPreset === 'custom' && (
                                                                            <select 
                                                                                value={newUnitType}
                                                                                onChange={e => setNewUnitType(e.target.value as any)}
                                                                                className="px-2 py-2 rounded-lg border border-slate-200 text-xs bg-white text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                                                                            >
                                                                                <option value="unit">Unidade</option>
                                                                                <option value="common">Comum</option>
                                                                                <option value="garage">Garagem</option>
                                                                                <option value="commercial">Comercial</option>
                                                                            </select>
                                                                        )}

                                                                        <button 
                                                                            type="button" 
                                                                            onClick={() => handleAddUnit(level.id)} 
                                                                            disabled={!newUnitName.trim()}
                                                                            className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
                                                                        >
                                                                            <Plus size={16} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="flex-1 overflow-y-auto max-h-[200px] custom-scrollbar space-y-2 pr-1">
                                                                {level.units.map((unit) => (
                                                                    <div key={unit.id} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100 group/unit hover:border-blue-200 transition-colors">
                                                                        <GripVertical size={14} className="text-slate-300 cursor-grab shrink-0" />
                                                                        <div className="w-6 flex justify-center shrink-0">{getUnitIcon(unit.type)}</div>
                                                                        <input type="text" value={unit.name} onChange={(e) => handleUpdateUnit(level.id, unit.id, 'name', e.target.value)} className="flex-1 text-xs font-bold text-slate-700 bg-transparent outline-none border-b border-transparent focus:border-blue-400 px-1" />
                                                                        <button type="button" onClick={() => handleRemoveUnit(level.id, unit.id)} className="text-slate-300 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors"><Trash2 size={14}/></button>
                                                                    </div>
                                                                ))}
                                                                {level.units.length === 0 && (
                                                                    <p className="text-[10px] text-slate-400 text-center py-4 italic">Nenhuma unidade.</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        )}

        {activeTab === 'team' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
                    <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2"><UserPlus size={20} className="text-blue-600"/> Convidar Membros</h3>
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <p className="text-sm text-blue-800 mb-4">Adicione engenheiros, arquitetos ou mestres de obra para colaborar neste projeto.</p>
                        <div className="flex gap-2">
                            <input 
                                type="email" 
                                placeholder="email@exemplo.com" 
                                value={inviteEmail}
                                onChange={e => setInviteEmail(e.target.value)}
                                className="flex-1 px-4 py-2 border border-blue-200 rounded-lg outline-none text-sm bg-white text-slate-800"
                            />
                            <button type="button" onClick={handleSendInvite} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-700">Enviar</button>
                        </div>
                    </div>
                    
                    {invites.length > 0 && (
                        <div>
                            <h4 className="font-bold text-slate-700 text-sm mb-3 flex items-center gap-2"><Mail size={16}/> Convites Pendentes</h4>
                            <div className="space-y-2">
                                {invites.map(invite => (
                                    <div key={invite.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                                        <span className="text-sm text-slate-600">{invite.email}</span>
                                        <button type="button" onClick={() => handleRemoveInvite(invite.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded"><X size={16}/></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2"><ShieldCheck size={20} className="text-emerald-600"/> Membros Ativos</h3>
                        {loadingTeam && <Loader2 className="animate-spin text-slate-400" size={16} />}
                    </div>
                    <div className="space-y-3">
                        {members.map(member => (
                            <div key={member.id} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center font-bold text-slate-600 overflow-hidden">
                                        {member.profiles?.avatar_url ? <img src={member.profiles.avatar_url} className="w-full h-full object-cover"/> : (member.profiles?.full_name?.[0] || 'U')}
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm text-slate-800 flex items-center gap-1">
                                            {member.profiles?.full_name || 'Usuário'}
                                            {member.role === 'owner' && <Crown size={12} className="text-amber-500 fill-current" />}
                                        </p>
                                        <p className="text-xs text-slate-500 capitalize">{member.role === 'owner' ? 'Proprietário' : member.role}</p>
                                    </div>
                                </div>
                                {member.role !== 'owner' && isOwner && (
                                    <button type="button" onClick={() => handleRemoveMember(member.id)} className="text-slate-400 hover:text-red-600 p-2"><Trash2 size={16}/></button>
                                )}
                            </div>
                        ))}
                        {members.length === 0 && !loadingTeam && <p className="text-center text-slate-400 text-sm py-4">Nenhum membro encontrado.</p>}
                    </div>
                </div>
            </div>
        )}

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 flex justify-end gap-4 z-40 md:pl-72">
            <button type="submit" disabled={saving} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 shadow-lg flex items-center gap-2 disabled:opacity-70 transition-all">
                {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                Salvar Alterações
            </button>
        </div>
      </form>
    </div>
  );
};