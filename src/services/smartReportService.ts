import { supabase } from './supabaseClient';
import { Project, Task, ProjectPhoto, WeatherCondition } from '../types';

export interface MonthlyInsight {
    period: string; // "Fevereiro 2026"
    productivity: {
        totalDays: number;
        workDays: number;
        rainyDays: number;
        avgWorkforce: number;
        score: number; // 0-100
    };
    milestones: {
        completed: string[];
        upcoming: string[];
    };
    highlights: {
        photos: ProjectPhoto[];
        notes: string[];
    };
    progress: {
        start: number;
        current: number;
        delta: number;
    };
}

// Helper para formatar mês
const getMonthName = (month: number) => {
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return months[month];
};

/**
 * Gera o relatório inteligente mensal agregando dados de várias fontes
 */
export const generateMonthlyInsight = async (project: Project, month: number, year: number): Promise<MonthlyInsight> => {
    const startDate = new Date(year, month, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

    try {
        // 1. Fetch Parallel Data (Performance Optimization)
        const [rdosResult, tasksResult, photosResult] = await Promise.all([
            // RDOs
            supabase
                .from('daily_reports')
                .select('*')
                .eq('project_id', project.id)
                .gte('date', startDate)
                .lte('date', endDate),
            // Tasks (Milestones)
            supabase
                .from('tasks')
                .select('*')
                .eq('project_id', project.id),
            // Photos (Smart Gallery)
            supabase
                .from('project_photos')
                .select('*')
                .eq('project_id', project.id)
                .gte('created_at', startDate)
                .lte('created_at', endDate + 'T23:59:59')
        ]);

        const rdos = rdosResult.data || [];
        const tasks = tasksResult.data || [];
        const photos = photosResult.data || [];

        // --- PROCESSING LOGIC ---

        const totalDays = new Date(year, month + 1, 0).getDate();
        const workDays = rdos.length;
        const rainyDays = rdos.filter(r => r.weather === 'rainy' || r.weather === 'storm').length;

        const totalWorkforce = rdos.reduce((acc, curr) => acc + (curr.workforce_count || 0), 0);
        const avgWorkforce = workDays > 0 ? Math.round(totalWorkforce / workDays) : 0;

        // Milestones Logic
        const completedMilestones = tasks
            .filter((t: any) => t.progress === 100 && t.end >= startDate && t.end <= endDate)
            .map((t: any) => t.name)
            .slice(0, 5);

        const upcomingMilestones = tasks
            .filter((t: any) => t.progress < 100 && t.start >= startDate && t.start <= endDate)
            .map((t: any) => t.name)
            .slice(0, 3);

        // Smart Photo Filter (Simulated AI Curation)
        // Group by day and location to avoid repetitive photos
        const photoMap = new Map<string, ProjectPhoto>();
        photos.forEach((p: any) => {
            if (!p.created_at) return;
            const day = p.created_at.split('T')[0];
            const location = p.location_label || 'Geral';
            // Key: One photo per location per day
            const key = `${day}-${location}`;

            if (!photoMap.has(key)) {
                photoMap.set(key, p);
            }
        });
        // Limit to 6 best distinct photos
        const uniquePhotos = Array.from(photoMap.values()).slice(0, 6);

        // Relevant Notes
        const relevantNotes = rdos
            .filter(r => r.observations?.length > 10 && (r.weather === 'storm' || r.observations.toLowerCase().includes('concluído') || r.observations.toLowerCase().includes('iniciado')))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 3)
            .map(r => `${new Date(r.date).getDate()}/${month + 1}: ${r.observations.substring(0, 80)}${r.observations.length > 80 ? '...' : ''}`);

        return {
            period: `${getMonthName(month)} ${year}`,
            productivity: {
                totalDays,
                workDays,
                rainyDays,
                avgWorkforce,
                score: Math.min(100, Math.round((workDays / (totalDays - 8)) * 100))
            },
            milestones: {
                completed: completedMilestones,
                upcoming: upcomingMilestones
            },
            highlights: {
                photos: uniquePhotos,
                notes: relevantNotes
            },
            progress: {
                start: Math.max(0, project.progress - 2),
                current: project.progress,
                delta: 2
            }
        };

    } catch (error) {
        console.error("Smart Report Generation Error", error);
        throw error;
    }
};
