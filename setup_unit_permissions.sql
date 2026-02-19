-- Drop table if exists to allow clean retry
DROP TABLE IF EXISTS public.unit_permissions;

-- Create unit_permissions table
CREATE TABLE public.unit_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Nullable for pending invites
    email TEXT NOT NULL, -- To track invites before user signup
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    unit_id TEXT REFERENCES public.project_units(id) ON DELETE CASCADE,
    common_areas TEXT[] DEFAULT '{}',
    scopes TEXT[] DEFAULT ARRAY['detalhamento', 'calendario', 'galeria', 'documentos', 'comunicacao'],
    role TEXT CHECK (role IN ('client', 'architect', 'admin')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, unit_id, email) -- One invite/permission per unit per email
);

-- Enable RLS
ALTER TABLE public.unit_permissions ENABLE ROW LEVEL SECURITY;

-- Grant access to authenticated users (essential for some Supabase setups)
GRANT ALL ON public.unit_permissions TO authenticated;
GRANT ALL ON public.unit_permissions TO service_role;

-- Policies for unit_permissions
-- FIX: Use auth.jwt() instead of selecting from auth.users (which is restricted)
CREATE POLICY "Users can view own unit permissions" 
ON public.unit_permissions FOR SELECT 
USING (
    auth.uid() = user_id 
    OR 
    email = (auth.jwt() ->> 'email')
);

-- Policy to allow users to update their own user_id if email matches
CREATE POLICY "Users can claim their permissions"
ON public.unit_permissions FOR UPDATE
USING (email = (auth.jwt() ->> 'email'))
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Project owners can manage unit permissions" 
ON public.unit_permissions FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.projects 
        WHERE id = unit_permissions.project_id 
        AND user_id = auth.uid()
    )
);

-- Allow admins/team to view all permissions for their projects
CREATE POLICY "Team members can view unit permissions" 
ON public.unit_permissions FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.project_members 
        WHERE project_id = unit_permissions.project_id 
        AND user_id = auth.uid()
    )
);

-- Allow unauthenticated users to check if their email has permission (needed for signup verification)
CREATE POLICY "Allow anon to verify email existence" 
ON public.unit_permissions FOR SELECT 
TO anon 
USING (true); 

-- ==========================================
-- POLICIES FOR OTHER TABLES TO ALLOW CLIENT ACCESS
-- ==========================================

-- Allow clients/architects to view the project details
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'projects' AND policyname = 'Clients can view their projects'
    ) THEN
        CREATE POLICY "Clients can view their projects" ON public.projects
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.unit_permissions 
                WHERE project_id = projects.id 
                AND (user_id = auth.uid() OR email = (auth.jwt() ->> 'email'))
            )
        );
    END IF;
END $$;

-- Allow clients/architects to view units
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'project_units' AND policyname = 'Clients can view units'
    ) THEN
        CREATE POLICY "Clients can view units" ON public.project_units
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.unit_permissions 
                WHERE project_id = project_units.project_id 
                AND (user_id = auth.uid() OR email = (auth.jwt() ->> 'email'))
            )
        );
    END IF;
END $$;

-- Allow clients/architects to view progress
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'unit_progress' AND policyname = 'Clients can view progress'
    ) THEN
        CREATE POLICY "Clients can view progress" ON public.unit_progress
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.unit_permissions 
                WHERE project_id = unit_progress.project_id 
                AND (user_id = auth.uid() OR email = (auth.jwt() ->> 'email'))
            )
        );
    END IF;
END $$;
