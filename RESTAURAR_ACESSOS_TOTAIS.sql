-- SCRIPT DE RESTAURAÇÃO DE ACESSOS (CORREÇÃO TOTAL)
-- Este script garante que todos os tipos de usuários (Donos, Equipe e Clientes) 
-- tenham os acessos corretos sem um interferir no outro.

-- 1. GARANTIR QUE A TABELA DE PERMISSÕES ACEITE O CARGO 'admin'
DO $$ 
BEGIN
    ALTER TABLE public.unit_permissions DROP CONSTRAINT IF EXISTS unit_permissions_role_check;
    ALTER TABLE public.unit_permissions ADD CONSTRAINT unit_permissions_role_check CHECK (role IN ('client', 'architect', 'admin'));
EXCEPTION
    WHEN others THEN NULL;
END $$;

-- 2. LIMPEZA E RECONSTRUÇÃO DAS POLÍTICAS DE PROJETOS (A TABELA PRINCIPAL)
-- Isso resolve o problema de "obras sumindo"
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can see everything" ON public.projects;
DROP POLICY IF EXISTS "Clients can view their projects" ON public.projects;
DROP POLICY IF EXISTS "Team members can view projects" ON public.projects;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.projects;

-- A) Donos: Acesso total às suas próprias obras
CREATE POLICY "Owners total access" ON public.projects
FOR ALL USING (auth.uid() = user_id);

-- B) Equipe: Acesso de leitura para quem está na tabela project_members
CREATE POLICY "Team members read access" ON public.projects
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.project_members 
        WHERE project_id = projects.id AND user_id = auth.uid()
    )
);

-- C) Clientes/Convidados: Acesso de leitura baseado na nova tabela de permissões unitárias
CREATE POLICY "Guests read access" ON public.projects
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.unit_permissions 
        WHERE project_id = projects.id 
        AND (user_id = auth.uid() OR email = (auth.jwt() ->> 'email'))
    )
);

-- 3. AJUSTE NA TABELA DE UNIDADES (PROJECT_UNITS)
-- Garante que clientes vejam apenas as unidades permitidas (ou todas se for admin)
ALTER TABLE public.project_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients can view units" ON public.project_units;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.project_units;

CREATE POLICY "Standard access for projects_units" ON public.project_units
FOR SELECT USING (
    -- É o dono da obra?
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_units.project_id AND user_id = auth.uid())
    OR
    -- É da equipe?
    EXISTS (SELECT 1 FROM public.project_members WHERE project_id = project_units.project_id AND user_id = auth.uid())
    OR
    -- É um cliente convidado?
    EXISTS (SELECT 1 FROM public.unit_permissions WHERE project_id = project_units.project_id AND (user_id = auth.uid() OR email = (auth.jwt() ->> 'email')))
);

-- 4. AJUSTE NA TABELA DE PROGRESSO (UNIT_PROGRESS)
ALTER TABLE public.unit_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients can view progress" ON public.unit_progress;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.unit_progress;

CREATE POLICY "Standard access for unit_progress" ON public.unit_progress
FOR SELECT USING (
    -- Dono ou Equipe
    EXISTS (SELECT 1 FROM public.projects WHERE id = unit_progress.project_id AND user_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM public.project_members WHERE project_id = unit_progress.project_id AND user_id = auth.uid())
    OR
    -- É um cliente convidado para ESTA unidade específica
    EXISTS (
        SELECT 1 FROM public.unit_permissions 
        WHERE project_id = unit_progress.project_id 
        AND (unit_id = unit_progress.unit_id OR unit_id IS NULL) -- NULL significa admin
        AND (user_id = auth.uid() OR email = (auth.jwt() ->> 'email'))
    )
);
