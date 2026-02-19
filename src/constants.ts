import { PhaseConfig } from './types';
import { Box, GripHorizontal, ShieldAlert, Droplets, Zap, Layers, LayoutGrid, PaintBucket, Sparkles, Flame, Cable, CheckCircle } from 'lucide-react';
import React from 'react';

export const APP_LOGO_URL = "https://zozohlwhjqxittkpgikv.supabase.co/storage/v1/object/public/avatars/logo.png";

export const DEFAULT_PHASES: PhaseConfig[] = [
  {
    id: 'structure',
    label: 'ESTRUTURA',
    code: '#STR',
    color: 'stone',
    icon: 'Box',
    subtasks: ["Concretagem Laje", "Vigas e Pilares", "Escadaria", "Cura do Concreto"]
  },
  {
    id: 'masonry',
    label: 'ALVENARIA',
    code: '#MAS',
    color: 'orange',
    icon: 'GripHorizontal',
    subtasks: ["Marcação (1ª fiada)", "Levantamento Paredes", "Vergas e Contravergas", "Encunhamento", "Fechamento Shafts"]
  },
  {
    id: 'waterproofing',
    label: 'IMPERMEAB.',
    code: '#WAT',
    color: 'cyan',
    icon: 'ShieldAlert',
    subtasks: ["Impermeabilização Box", "Impermeabilização Sacada", "Teste Estanqueidade (72h)", "Manta Asfáltica"]
  },
  {
    id: 'hydraulic_infra',
    label: 'HIDRÁULICA (INFRA)',
    code: '#HYD',
    color: 'blue',
    icon: 'Droplets',
    subtasks: ["Prumadas (Água/Esgoto)", "Ramais Internos", "Teste de Pressão (Água/Esgoto)", "Infra de Ar Condicionado (Drenos)", "Proteção de Pontos (Vedação)"]
  },
  {
    id: 'gas',
    label: 'GÁS',
    code: '#GAS',
    color: 'red',
    icon: 'Flame',
    subtasks: ["Tubulação de Gás", "Teste de Pressão Gás"]
  },
  {
    id: 'electrical_infra',
    label: 'ELÉTRICA (INFRA)',
    code: '#ELE',
    color: 'yellow',
    icon: 'Zap',
    subtasks: ["Tubulação Laje", "Rasgo e Tubulação Parede", "Instalação e Chumbamento de Caixinhas", "Tubulação de Piso"]
  },
  {
    id: 'plaster',
    label: 'REBOCO / GESSO',
    code: '#PLA',
    color: 'amber',
    icon: 'Layers',
    subtasks: ["Chapisco", "Mestras e Taliscamento", "Reboco Interno", "Reboco Fachada", "Forro de Gesso"]
  },
  {
    id: 'flooring',
    label: 'CONTRAPISO',
    code: '#FLO',
    color: 'slate',
    icon: 'LayoutGrid',
    subtasks: ["Limpeza da Laje", "Instalação Manta Acústica", "Nivelamento e Execução Massa"]
  },
  {
    id: 'electrical_wiring',
    label: 'ELÉTRICA (FIAÇÃO)',
    code: '#WIR',
    color: 'orange',
    icon: 'Cable',
    subtasks: ["Limpeza de Caixinhas", "Passagem de Fios (Elétrica)", "Cabeamento Estruturado (TV/Internet)", "Montagem do Quadro de Distribuição (QDC)", "Teste de Continuidade"]
  },
  {
    id: 'coating',
    label: 'REVESTIMENTOS',
    code: '#COA',
    color: 'emerald',
    icon: 'Box',
    subtasks: ["Assentamento Piso", "Azulejo Paredes", "Rejunte", "Soleiras e Peitoris"]
  },
  {
    id: 'painting',
    label: 'PINTURA',
    code: '#PAI',
    color: 'rose',
    icon: 'PaintBucket',
    subtasks: ["Lixamento e Selador", "Massa Corrida", "Pintura Teto", "Pintura Paredes"]
  },
  {
    id: 'final_finishing',
    label: 'ACABAMENTOS FINAIS',
    code: '#FIN',
    color: 'violet',
    icon: 'Sparkles',
    subtasks: ["Instalação de Louças (Vasos/Pias)", "Instalação de Metais (Torneiras/Registros)", "Acabamentos Elétricos (Tomadas/Luminárias)", "Teste Final (Carga e Estanqueidade)"]
  },
];

export const getPhaseIcon = (iconName: string, size = 18) => {
  const icons: Record<string, React.ReactNode> = {
    'Box': React.createElement(Box, { size }),
    'GripHorizontal': React.createElement(GripHorizontal, { size }),
    'ShieldAlert': React.createElement(ShieldAlert, { size }),
    'Droplets': React.createElement(Droplets, { size }),
    'Flame': React.createElement(Flame, { size }),
    'Zap': React.createElement(Zap, { size }),
    'Layers': React.createElement(Layers, { size }),
    'LayoutGrid': React.createElement(LayoutGrid, { size }),
    'PaintBucket': React.createElement(PaintBucket, { size }),
    'Sparkles': React.createElement(Sparkles, { size }),
    'Cable': React.createElement(Cable, { size }),
    'CheckCircle': React.createElement(CheckCircle, { size }),
  };
  return icons[iconName] || React.createElement(Box, { size });
};

export const getPhaseColor = (colorName: string) => {
  const colors: Record<string, string> = {
    'stone': 'bg-stone-500',
    'orange': 'bg-orange-500',
    'cyan': 'bg-cyan-500',
    'blue': 'bg-blue-500',
    'red': 'bg-red-600',
    'yellow': 'bg-yellow-500',
    'amber': 'bg-amber-500',
    'slate': 'bg-slate-500',
    'emerald': 'bg-emerald-500',
    'rose': 'bg-rose-500',
    'violet': 'bg-violet-500',
  };
  return colors[colorName] || 'bg-slate-500';
};