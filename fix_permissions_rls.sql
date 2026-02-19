-- =============================================
-- CRIAÇÃO DA TABELA DAILY_REPORTS (RDO)
-- Necessária para a Automação Inteligente
-- =============================================

CREATE TABLE IF NOT EXISTS daily_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    weather TEXT NOT NULL DEFAULT 'ensolarado',
    workforce_count INTEGER DEFAULT 0,
    observations TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    
    -- Garantir que só exista um RDO por projeto por dia
    UNIQUE(project_id, date)
);

-- Habilitar RLS na tabela daily_reports
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas para evitar conflitos
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON daily_reports;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON daily_reports;
DROP POLICY IF EXISTS "Enable update for users based on project_id" ON daily_reports;

-- Política de Leitura: Permitir que usuários autenticados leiam relatórios dos projetos onde são membros ou têm permissão
CREATE POLICY "Enable read access for authenticated users"
ON daily_reports FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM project_members
    WHERE project_members.project_id = daily_reports.project_id
    AND project_members.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM unit_permissions
    WHERE unit_permissions.project_id = daily_reports.project_id
    AND (unit_permissions.user_id = auth.uid() OR unit_permissions.email = (auth.jwt() ->> 'email'))
    AND unit_permissions.is_active = true
  )
  OR
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = daily_reports.project_id
    AND projects.user_id = auth.uid()
  )
);

-- Política de Inserção: Staff e Membros podem criar RDO (não clientes)
CREATE POLICY "Enable insert for project staff"
ON daily_reports FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_id
    AND projects.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM project_members
    WHERE project_members.project_id = daily_reports.project_id
    AND project_members.user_id = auth.uid()
  )
);

-- Política de Atualização
CREATE POLICY "Enable update for project staff"
ON daily_reports FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_id
    AND projects.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM project_members
    WHERE project_members.project_id = daily_reports.project_id
    AND project_members.user_id = auth.uid()
  )
);

-- =============================================
-- ATUALIZAÇÃO DE PERMISSÕES PARA OUTRAS TABELAS
-- =============================================

-- Habilitar RLS na tabela tasks
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ensure users can see tasks for their projects" ON tasks;
CREATE POLICY "Ensure users can see tasks for their projects"
ON tasks FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM project_members
    WHERE project_members.project_id = tasks.project_id
    AND project_members.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM unit_permissions
    WHERE unit_permissions.project_id = tasks.project_id
    AND (unit_permissions.user_id = auth.uid() OR unit_permissions.email = (auth.jwt() ->> 'email'))
    AND unit_permissions.is_active = true
  )
  OR
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = tasks.project_id
    AND projects.user_id = auth.uid()
  )
);

-- Habilitar RLS na tabela project_photos
ALTER TABLE project_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ensure users can see photos for their projects" ON project_photos;
CREATE POLICY "Ensure users can see photos for their projects"
ON project_photos FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM project_members
    WHERE project_members.project_id = project_photos.project_id
    AND project_members.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM unit_permissions
    WHERE unit_permissions.project_id = project_photos.project_id
    AND (unit_permissions.user_id = auth.uid() OR unit_permissions.email = (auth.jwt() ->> 'email'))
    AND unit_permissions.is_active = true
  )
  OR
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_photos.project_id
    AND projects.user_id = auth.uid()
  )
);
