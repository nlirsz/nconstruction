-- Script para migrar donos de projetos para a tabela de permissões unitárias
-- Isso garante que os donos continuem tendo acesso total através das novas camadas de segurança

DO $$ 
DECLARE 
    r RECORD;
BEGIN
    -- Itera sobre todos os projetos existentes
    FOR r IN (
        SELECT p.id as project_id, p.user_id, u.email 
        FROM public.projects p
        JOIN auth.users u ON p.user_id = u.id
    ) LOOP
        -- Insere uma permissão administrativa opcional ou apenas garante o vínculo
        -- Nota: O dono já tem acesso via RLS (user_id = auth.uid()), 
        -- mas adicionar aqui ajuda na integridade de relatórios e dashboards.
        
        INSERT INTO public.unit_permissions (
            user_id, 
            email, 
            project_id, 
            unit_id, 
            role, 
            is_active, 
            scopes
        ) 
        VALUES (
            r.user_id, 
            r.email, 
            r.project_id, 
            NULL, -- NULL unit_id significa acesso ao projeto como um todo (admin)
            'admin', 
            true, 
            ARRAY['detalhamento', 'calendario', 'galeria', 'documentos', 'comunicacao']
        )
        ON CONFLICT (project_id, unit_id, email) DO NOTHING;
        
        RAISE NOTICE 'Dono do projeto % (%) adicionado a unit_permissions.', r.project_id, r.email;
    END LOOP;
END $$;
