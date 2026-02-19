-- =============================================
-- SCRIPT DE CORREÇÃO: TABELAS E ACESSOS (RLS)
-- Resolve: Erro de 1º Acesso, Daily Reports e Fotos
-- =============================================

-- 1. Garante que a tabela daily_reports exista
CREATE TABLE IF NOT EXISTS public.daily_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    weather TEXT NOT NULL DEFAULT 'ensolarado',
    workforce_count INTEGER DEFAULT 0,
    observations TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    UNIQUE(project_id, date)
);

-- 2. Habilita RLS em todas as tabelas críticas
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_photos ENABLE ROW LEVEL SECURITY;

-- 3. CORREÇÃO CRÍTICA: Permissão para usuários NÃO LOGADOS (anon) verificarem convite
-- Sem isso, o "Primeiro Acesso" sempre diz que não há convites
DROP POLICY IF EXISTS "Allow anon to verify email existence" ON public.unit_permissions;
CREATE POLICY "Allow anon to verify email existence" 
ON public.unit_permissions FOR SELECT 
TO anon 
USING (true);

-- 4. Políticas para usuários LOGADOS (authenticated) em unit_permissions
DROP POLICY IF EXISTS "Users can view own unit permissions" ON public.unit_permissions;
CREATE POLICY "Users can view own unit permissions" 
ON public.unit_permissions FOR SELECT 
TO authenticated 
USING (
    auth.uid() = user_id 
    OR 
    email = (auth.jwt() ->> 'email')
);

-- 5. Políticas para DAILY REPORTS
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.daily_reports;
CREATE POLICY "Enable read access for authenticated users"
ON public.daily_reports FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM project_members WHERE project_id = daily_reports.project_id AND user_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM unit_permissions WHERE project_id = daily_reports.project_id AND (user_id = auth.uid() OR email = (auth.jwt() ->> 'email'))
  ) OR
  EXISTS (
    SELECT 1 FROM projects WHERE id = daily_reports.project_id AND user_id = auth.uid()
  )
);

-- 6. Políticas para TASKS (Cronograma)
DROP POLICY IF EXISTS "Ensure users can see tasks for their projects" ON public.tasks;
CREATE POLICY "Ensure users can see tasks for their projects"
ON public.tasks FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM project_members WHERE project_id = tasks.project_id AND user_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM unit_permissions WHERE project_id = tasks.project_id AND (user_id = auth.uid() OR email = (auth.jwt() ->> 'email'))
  ) OR
  EXISTS (
    SELECT 1 FROM projects WHERE id = tasks.project_id AND user_id = auth.uid()
  )
);

-- 7. Políticas para FOTOS
DROP POLICY IF EXISTS "Ensure users can see photos for their projects" ON public.project_photos;
CREATE POLICY "Ensure users can see photos for their projects"
ON public.project_photos FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM project_members WHERE project_id = project_photos.project_id AND user_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM unit_permissions WHERE project_id = project_photos.project_id AND (user_id = auth.uid() OR email = (auth.jwt() ->> 'email'))
  ) OR
  EXISTS (
    SELECT 1 FROM projects WHERE id = project_photos.project_id AND user_id = auth.uid()
  )
);
