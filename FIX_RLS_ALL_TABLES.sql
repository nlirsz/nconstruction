-- =====================================================================
-- SCRIPT DEFINITIVO V2: CORREÇÃO COMPLETA DO RLS (ERROS 500)
-- =====================================================================
-- EXECUTE ESTE SCRIPT INTEIRO NO SQL EDITOR DO SUPABASE.
-- Ele vai dropar TODAS as políticas existentes e recriar do zero.
-- =====================================================================


-- =============================================
-- ETAPA 0: DROPAR TODAS AS POLÍTICAS EXISTENTES
-- =============================================
-- Isso garante que nenhuma política velha fique pra trás causando loop.

DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Dropar todas as policies de organizations
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'organizations' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.organizations', r.policyname);
    END LOOP;
    
    -- Dropar todas as policies de organization_members
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'organization_members' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.organization_members', r.policyname);
    END LOOP;
    
    -- Dropar todas as policies de organization_invites
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'organization_invites' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.organization_invites', r.policyname);
    END LOOP;
    
    -- Dropar todas as policies de projects
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'projects' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.projects', r.policyname);
    END LOOP;
    
    -- Dropar todas as policies de unit_permissions
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'unit_permissions' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.unit_permissions', r.policyname);
    END LOOP;
    
    -- Dropar todas as policies de project_invites
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'project_invites' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.project_invites', r.policyname);
    END LOOP;
    
    -- Dropar todas as policies de project_units
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'project_units' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.project_units', r.policyname);
    END LOOP;
    
    -- Dropar todas as policies de unit_progress
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'unit_progress' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.unit_progress', r.policyname);
    END LOOP;
    
    -- Dropar todas as policies de project_members
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'project_members' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.project_members', r.policyname);
    END LOOP;
    
    -- Dropar todas as policies de project_levels
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'project_levels' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.project_levels', r.policyname);
    END LOOP;
    
    -- Dropar todas as policies de tasks
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'tasks' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.tasks', r.policyname);
    END LOOP;

    -- Dropar todas as policies de project_photos
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'project_photos' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.project_photos', r.policyname);
    END LOOP;

    -- Dropar todas as policies de project_documents
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'project_documents' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.project_documents', r.policyname);
    END LOOP;

    -- Dropar todas as policies de profiles
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', r.policyname);
    END LOOP;
END $$;


-- =============================================
-- ETAPA 1: CRIAR/ATUALIZAR FUNÇÕES SECURITY DEFINER
-- =============================================

-- 1A) Verifica se é membro de uma organização (para org policies)
CREATE OR REPLACE FUNCTION public.is_org_member(_org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- 1B) Verifica se é staff do projeto (dono OU membro da org do projeto)
CREATE OR REPLACE FUNCTION public.check_is_staff(proj_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = proj_id 
    AND (
      p.user_id = auth.uid() 
      OR p.organization_id IN (
        SELECT om.organization_id FROM public.organization_members om
        WHERE om.user_id = auth.uid()
      )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1C) Verifica se é membro direto do projeto (project_members)
CREATE OR REPLACE FUNCTION public.check_is_project_member(proj_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = proj_id AND pm.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1D) Verifica se é guest (cliente/arquiteto) do projeto
CREATE OR REPLACE FUNCTION public.check_is_guest(proj_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.unit_permissions up
    WHERE up.project_id = proj_id 
    AND (up.user_id = auth.uid() OR up.email = (auth.jwt() ->> 'email'))
    AND up.is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1E) Combina staff + project_member
CREATE OR REPLACE FUNCTION public.check_has_project_access(proj_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.check_is_staff(proj_id) 
    OR public.check_is_project_member(proj_id) 
    OR public.check_is_guest(proj_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================
-- ETAPA 2: ORGANIZAÇÕES
-- =============================================
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_select" ON public.organizations
FOR SELECT USING (
    owner_id = auth.uid() OR public.is_org_member(id)
);

CREATE POLICY "org_insert" ON public.organizations
FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "org_update" ON public.organizations
FOR UPDATE USING (
    owner_id = auth.uid() OR public.is_org_member(id)
);

CREATE POLICY "org_delete" ON public.organizations
FOR DELETE USING (owner_id = auth.uid());


-- =============================================
-- ETAPA 3: ORGANIZATION MEMBERS
-- =============================================
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orgmem_select" ON public.organization_members 
FOR SELECT USING (
    user_id = auth.uid() 
    OR public.is_org_member(organization_id)
    OR EXISTS (SELECT 1 FROM public.organizations WHERE id = organization_id AND owner_id = auth.uid())
);

CREATE POLICY "orgmem_insert" ON public.organization_members 
FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.organizations WHERE id = organization_id AND owner_id = auth.uid())
    OR user_id = auth.uid()
);

CREATE POLICY "orgmem_delete" ON public.organization_members 
FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.organizations WHERE id = organization_id AND owner_id = auth.uid())
);


-- =============================================
-- ETAPA 4: ORGANIZATION INVITES
-- =============================================
ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orginv_select" ON public.organization_invites
FOR SELECT USING (
    public.is_org_member(organization_id) 
    OR email = (auth.jwt() ->> 'email')
    OR EXISTS (SELECT 1 FROM public.organizations WHERE id = organization_id AND owner_id = auth.uid())
);

CREATE POLICY "orginv_insert" ON public.organization_invites
FOR INSERT WITH CHECK (
    public.is_org_member(organization_id)
    OR EXISTS (SELECT 1 FROM public.organizations WHERE id = organization_id AND owner_id = auth.uid())
);

CREATE POLICY "orginv_delete" ON public.organization_invites
FOR DELETE USING (
    public.is_org_member(organization_id)
    OR EXISTS (SELECT 1 FROM public.organizations WHERE id = organization_id AND owner_id = auth.uid())
);


-- =============================================
-- ETAPA 5: PROJECTS (SEM LOOP!)
-- =============================================
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Staff tem acesso total
CREATE POLICY "proj_staff_all" ON public.projects
FOR ALL USING (
    user_id = auth.uid()
    OR organization_id IN (
        SELECT om.organization_id FROM public.organization_members om
        WHERE om.user_id = auth.uid()
    )
);

-- Membros diretos do projeto
CREATE POLICY "proj_member_select" ON public.projects
FOR SELECT USING (public.check_is_project_member(id));

-- Clientes/Arquitetos (via função, sem loop!)
CREATE POLICY "proj_guest_select" ON public.projects
FOR SELECT USING (public.check_is_guest(id));


-- =============================================
-- ETAPA 6: UNIT_PERMISSIONS (SEM LOOP!)
-- =============================================
ALTER TABLE public.unit_permissions ENABLE ROW LEVEL SECURITY;

-- Aceitar role 'admin'
DO $$ 
BEGIN
    ALTER TABLE public.unit_permissions DROP CONSTRAINT IF EXISTS unit_permissions_role_check;
    ALTER TABLE public.unit_permissions ADD CONSTRAINT unit_permissions_role_check CHECK (role IN ('client', 'architect', 'admin'));
EXCEPTION WHEN others THEN NULL;
END $$;

-- Colunas extras
ALTER TABLE public.unit_permissions ADD COLUMN IF NOT EXISTS job_title TEXT;
ALTER TABLE public.unit_permissions ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.unit_permissions ADD COLUMN IF NOT EXISTS notes TEXT;

-- Staff gerencia
CREATE POLICY "perms_staff_all" ON public.unit_permissions
FOR ALL USING (
    public.check_is_staff(project_id) OR public.check_is_project_member(project_id)
);

-- Clientes veem seus próprios
CREATE POLICY "perms_guest_select" ON public.unit_permissions
FOR SELECT USING (
    user_id = auth.uid() OR email = (auth.jwt() ->> 'email')
);


-- =============================================
-- ETAPA 7: PROJECT INVITES
-- =============================================
ALTER TABLE public.project_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projinv_all" ON public.project_invites
FOR ALL USING (auth.uid() IS NOT NULL);


-- =============================================
-- ETAPA 8: PROJECT UNITS
-- =============================================
ALTER TABLE public.project_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "units_all" ON public.project_units
FOR ALL USING (public.check_has_project_access(project_id));


-- =============================================
-- ETAPA 9: UNIT PROGRESS
-- =============================================
ALTER TABLE public.unit_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "progress_all" ON public.unit_progress
FOR ALL USING (public.check_has_project_access(project_id));


-- =============================================
-- ETAPA 10: PROJECT MEMBERS
-- =============================================
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projmem_all" ON public.project_members 
FOR ALL USING (
    user_id = auth.uid() OR public.check_is_staff(project_id)
);


-- =============================================
-- ETAPA 11: PROJECT LEVELS
-- =============================================
ALTER TABLE public.project_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "levels_all" ON public.project_levels
FOR ALL USING (public.check_has_project_access(project_id));


-- =============================================
-- ETAPA 12: TASKS
-- =============================================
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_all" ON public.tasks
FOR ALL USING (public.check_has_project_access(project_id));


-- =============================================
-- ETAPA 13: PROJECT PHOTOS
-- =============================================
ALTER TABLE public.project_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "photos_all" ON public.project_photos
FOR ALL USING (public.check_has_project_access(project_id));


-- =============================================
-- ETAPA 14: PROJECT DOCUMENTS
-- =============================================
ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "docs_all" ON public.project_documents
FOR ALL USING (public.check_has_project_access(project_id));


-- =============================================
-- ETAPA 15: PROFILES
-- =============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select" ON public.profiles
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "profiles_update" ON public.profiles
FOR UPDATE USING (id = auth.uid());

CREATE POLICY "profiles_insert" ON public.profiles
FOR INSERT WITH CHECK (id = auth.uid());


-- =============================================
-- FIM! Execute este script inteiro no SQL Editor do Supabase.
-- Depois recarregue o app com Ctrl+F5.
-- =============================================
