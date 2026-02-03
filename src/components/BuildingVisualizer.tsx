import React, { useMemo, useState } from 'react';
import { Project } from '../types';
import { DEFAULT_PHASES } from '../constants';

interface BuildingVisualizerProps {
  project: Project;
  data: any[]; 
  onUnitClick: (e: React.MouseEvent, floorIndex: number, unitIndex: number, unitName: string) => void;
}

const STROKE_WIDTH = 4;

export const BuildingVisualizer: React.FC<BuildingVisualizerProps> = ({ project, data, onUnitClick }) => {
  const [hoveredUnit, setHoveredUnit] = useState<string | null>(null);
  
  const layout = useMemo(() => {
      if (!data || data.length === 0) return null;

      const floorHeight = 160; 
      const floorSpacing = 30; 
      // Definimos uma largura total fixa para o bloco do prédio para que todos os andares alinhem
      const totalFloorWidth = 1400; 
      const unitGap = 15;
      
      const totalWidth = totalFloorWidth + 200;
      const totalHeight = data.length * (floorHeight + floorSpacing) + 300;

      // ViewBox focado no prédio com margem controlada para labels
      const viewBox = `-900 -50 ${totalWidth + 1000} ${totalHeight + 100}`;

      return {
          floorHeight,
          floorSpacing,
          totalFloorWidth,
          unitGap,
          viewBox,
          totalHeight
      };
  }, [data]);

  const getStyleAttributes = (avgProgress: number) => {
      if (avgProgress === 100) return { fill: "#dcfce7", stroke: "#16a34a" };
      if (avgProgress > 0) return { fill: "#fef3c7", stroke: "#d97706" };
      return { fill: "#ffffff", stroke: "#cbd5e1" };
  };

  const getFloorDisplayName = (floorData: any) => {
      if (floorData.label) return floorData.label;
      const f = floorData.floor;
      if (f === 1) return 'TÉRREO';
      if (f === 2) return 'G1';
      if (f === 3) return 'G2';
      return `${f}º PAV.`;
  };

  if (!layout || !data) return null;

  const allProjectPhases = project.phases && project.phases.length > 0 ? project.phases : DEFAULT_PHASES;

  return (
    <div className="w-full h-full flex items-center justify-center overflow-visible p-2">
      <svg viewBox={layout.viewBox} className="w-full h-full max-h-[95vh] overflow-visible select-none drop-shadow-xl">
            <defs>
                <filter id="blockShadow" x="-10%" y="-10%" width="120%" height="120%">
                    <feDropShadow dx="0" dy="6" stdDeviation="5" floodOpacity="0.12"/>
                </filter>
            </defs>
            
            {data.map((floorData, i) => {
                const invertedIndex = data.length - 1 - i;
                const y = invertedIndex * (layout.floorHeight + layout.floorSpacing) + 100;
                const label = getFloorDisplayName(floorData);
                
                // Cálculo proporcional: cada unidade ocupa uma fração da largura total do pavimento
                const numUnits = floorData.units.length;
                const unitWidth = (layout.totalFloorWidth - (numUnits - 1) * layout.unitGap) / numUnits;

                const levelConfig = project.structure?.levels?.find(l => l.order === floorData.floor);
                const applicablePhases = (levelConfig?.activePhases && levelConfig.activePhases.length > 0)
                    ? allProjectPhases.filter(p => levelConfig.activePhases!.includes(p.id))
                    : allProjectPhases;

                return (
                    <g key={`floor-${floorData.floor}-${i}`}>
                        {/* Label do Andar - 90px */}
                        <text 
                            x={-120} 
                            y={y + (layout.floorHeight / 2)} 
                            dominantBaseline="middle" 
                            textAnchor="end" 
                            fontSize="90" 
                            fontWeight="900" 
                            fill="#334155" 
                            className="tracking-tighter"
                        >
                            {label}
                        </text>
                        <line x1={-100} y1={y + (layout.floorHeight / 2)} x2={0} y2={y + (layout.floorHeight / 2)} stroke="#e2e8f0" strokeWidth="6" strokeLinecap="round" />

                        {floorData.units.map((unit: any, uIdx: number) => {
                            let totalP = 0;
                            applicablePhases.forEach(phase => {
                                const phaseProgress = unit.phases?.[phase.id]?.percentage || 0;
                                totalP += phaseProgress;
                            });
                            const avgProgress = applicablePhases.length > 0 ? Math.round(totalP / applicablePhases.length) : 0;
                            const styles = getStyleAttributes(avgProgress);
                            const isHovered = hoveredUnit?.startsWith(unit.name);
                            const rectX = uIdx * (unitWidth + layout.unitGap);

                            return (
                                <g 
                                    key={unit.id} 
                                    onClick={(e) => onUnitClick(e, i, uIdx, unit.name)} 
                                    onMouseEnter={() => setHoveredUnit(`${unit.name} (${avgProgress}%)`)} 
                                    onMouseLeave={() => setHoveredUnit(null)} 
                                    className="cursor-pointer"
                                >
                                    <rect 
                                        x={rectX} 
                                        y={y} 
                                        width={unitWidth} 
                                        height={layout.floorHeight} 
                                        rx={12} 
                                        ry={12} 
                                        fill={styles.fill} 
                                        stroke={isHovered ? '#2563eb' : styles.stroke} 
                                        strokeWidth={isHovered ? 12 : STROKE_WIDTH} 
                                        filter="url(#blockShadow)" 
                                        className="transition-all duration-200"
                                    />
                                    
                                    {/* Texto Unidade - 42px centralizado proporcionalmente */}
                                    <text 
                                        x={rectX + unitWidth / 2} 
                                        y={y + layout.floorHeight / 2 - 5} 
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        fontSize="42" 
                                        fontWeight="900" 
                                        fill="#0f172a" 
                                        className="uppercase tracking-tight"
                                    >
                                        {unit.name}
                                    </text>
                                    
                                    {/* Badge de Progresso */}
                                    {avgProgress > 0 && avgProgress < 100 && (
                                      <g transform={`translate(${rectX + unitWidth/2 - 50}, ${y + layout.floorHeight - 50})`}>
                                        <rect width="100" height="35" rx="8" fill={avgProgress > 50 ? "#fef3c7" : "#fee2e2"} opacity="0.9" />
                                        <text x="50" y="25" textAnchor="middle" fontSize="24" fontWeight="900" fill="#1e293b">{avgProgress}%</text>
                                      </g>
                                    )}

                                    {avgProgress === 100 && (
                                      <g transform={`translate(${rectX + unitWidth - 55}, ${y + layout.floorHeight - 55})`}>
                                        <circle cx="25" cy="25" r="22" fill="#16a34a" />
                                        <text x="25" y="32" textAnchor="middle" fontSize="30" fill="white" fontWeight="900">✓</text>
                                      </g>
                                    )}
                                </g>
                            );
                        })}
                    </g>
                );
            })}
            
            {/* Solo reforçado */}
            <rect 
                x="-900" 
                y={layout.totalHeight + 40} 
                width="4000" 
                height="30" 
                fill="#1e293b" 
                rx="15"
            />
      </svg>
    </div>
  );
};