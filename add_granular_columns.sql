-- Add granular metadata columns to project_photos
alter table public.project_photos 
add column if not exists phase text,
add column if not exists subtask text,
add column if not exists unit_id text;

-- Optional: Index on these for filtering
create index if not exists idx_project_photos_phase on public.project_photos(phase);
create index if not exists idx_project_photos_unit_id on public.project_photos(unit_id);
