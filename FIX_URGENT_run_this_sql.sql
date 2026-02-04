-- EXECUTE ESTE SQL NO SUPABASE PARA CORRIGIR O ERRO!

-- Primeiro, remova a coluna antiga se existir (com tipo uuid)
alter table public.project_photos drop column if exists unit_id;

-- Agora adicione as colunas corretas com tipo TEXT
alter table public.project_photos 
add column if not exists phase text,
add column if not exists subtask text,
add column if not exists unit_id text;

-- Criar índices para performance
create index if not exists idx_project_photos_phase on public.project_photos(phase);
create index if not exists idx_project_photos_unit_id on public.project_photos(unit_id);
