-- Create project_photos table
create table if not exists public.project_photos (
    id uuid default gen_random_uuid() primary key,
    project_id uuid references public.projects(id) on delete cascade not null,
    url text not null,
    description text,
    category text check (category in ('evolution', 'structural', 'installations', 'finishing', 'inspection', 'other')),
    location_label text,
    created_by text,
    created_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.project_photos enable row level security;

-- Create basic policies (adjust as needed for your auth model)
create policy "Enable read access for all users" on public.project_photos
    for select using (true);

create policy "Enable insert access for all users" on public.project_photos
    for insert with check (true);

create policy "Enable update access for all users" on public.project_photos
    for update using (true);

create policy "Enable delete access for all users" on public.project_photos
    for delete using (true);

-- Create indexes for performance
create index if not exists idx_project_photos_project_id on public.project_photos(project_id);
create index if not exists idx_project_photos_category on public.project_photos(category);
