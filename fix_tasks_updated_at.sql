-- EXECUTE ESTE SQL NO SUPABASE PARA ADICIONAR A COLUNA updated_at NA TABELA tasks

-- Adiciona a coluna updated_at se não existir
alter table public.tasks 
add column if not exists updated_at timestamptz default now();

-- Atualiza os registros existentes que não têm updated_at
update public.tasks 
set updated_at = created_at 
where updated_at is null;

-- Cria um índice para performance
create index if not exists idx_tasks_updated_at on public.tasks(updated_at);

-- Opcional: Criar trigger para atualizar automaticamente o updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

-- Criar trigger se não existir
drop trigger if exists update_tasks_updated_at on public.tasks;
create trigger update_tasks_updated_at
    before update on public.tasks
    for each row
    execute function update_updated_at_column();
