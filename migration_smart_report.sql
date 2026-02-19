-- =============================================
-- SMART REPORTING FEATURES
-- Automação de Relatórios e Insights para nConstruction
-- =============================================

-- 1. Função para calcular resumo mensal de produtividade (Clima x RDO)
-- Retorna: Dias no mês, Dias Úteis (teóricos), Dias Trabalhados (RDO), Dias de Chuva/Impedimento
CREATE OR REPLACE FUNCTION get_monthly_productivity(
    p_project_id UUID,
    p_month INT,
    p_year INT
)
RETURNS TABLE (
    total_days INT,
    work_days_logged INT,
    rainy_days INT,
    workforce_average NUMERIC,
    productivity_score NUMERIC
) AS $$
DECLARE
    start_date DATE;
    end_date DATE;
BEGIN
    start_date := make_date(p_year, p_month, 1);
    end_date := (date_trunc('month', start_date) + interval '1 month - 1 day')::date;

    RETURN QUERY
    SELECT 
        (end_date - start_date + 1)::INT as total_days,
        COUNT(id)::INT as work_days_logged,
        COUNT(CASE WHEN weather IN ('chuvoso', 'tempestade') THEN 1 END)::INT as rainy_days,
        COALESCE(AVG(workforce_count), 0) as workforce_average,
        -- Score simplificado: % de dias úteis (seg-sex) que tiveram RDO preenchido
        (COUNT(id)::NUMERIC / NULLIF((SELECT COUNT(*) FROM generate_series(start_date, end_date, '1 day') d WHERE extract(isodow from d) < 6), 0)) * 100 as productivity_score
    FROM daily_reports
    WHERE project_id = p_project_id
    AND date >= start_date AND date <= end_date;
END;
$$ LANGUAGE plpgsql;

-- 2. Função para buscar Marcos Alcançados (Tasks concluídas no mês)
-- Retorna as tarefas principais concluídas no período
CREATE OR REPLACE FUNCTION get_monthly_milestones(
    p_project_id UUID,
    p_month INT,
    p_year INT
)
RETURNS TABLE (
    task_name TEXT,
    completion_date DATE,
    category TEXT
) AS $$
DECLARE
    start_date DATE;
    end_date DATE;
BEGIN
    start_date := make_date(p_year, p_month, 1);
    end_date := (date_trunc('month', start_date) + interval '1 month - 1 day')::date;

    RETURN QUERY
    SELECT 
        name as task_name,
        end_date::DATE as completion_date, -- Assumindo que a data fim é a data de conclusão para tasks 100%
        status as category
    FROM tasks
    WHERE project_id = p_project_id
    AND progress = 100
    AND end_date >= start_date AND end_date <= end_date
    ORDER BY end_date DESC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- 3. Melhoria na tabela de Fotos: Adicionar flag de 'Destaque' para o relatório
ALTER TABLE project_photos ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;
ALTER TABLE project_photos ADD COLUMN IF NOT EXISTS rating INT DEFAULT 0; -- 0 a 5 auto-avaliado por IA ou manual

-- 4. View de Resumo do Cliente (Simplificada)
-- Agrega dados básicos para o card do dashboard
CREATE OR REPLACE VIEW education_summary_view AS
SELECT 
    p.id as project_id,
    p.name as project_name,
    p.progress as total_progress,
    (SELECT COUNT(*) FROM daily_reports dr WHERE dr.project_id = p.id AND dr.date > (current_date - interval '30 days')) as active_days_last_30,
    (SELECT COUNT(*) FROM project_photos pp WHERE pp.project_id = p.id AND pp.created_at > (current_date - interval '30 days')) as new_photos_last_30
FROM projects p;
