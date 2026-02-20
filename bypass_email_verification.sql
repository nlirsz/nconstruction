create or replace function public.auto_confirm_invited_users()
returns trigger as $$
declare
  is_invited boolean := false;
begin
  -- Check unit_permissions
  if exists (select 1 from public.unit_permissions where email = new.email) then
    is_invited := true;
  end if;

  -- Check project_invites
  if exists (select 1 from public.project_invites where email = new.email) then
    is_invited := true;
  end if;

  -- Check organization_invites
  if exists (select 1 from public.organization_invites where email = new.email) then
    is_invited := true;
  end if;

  if is_invited then
    new.email_confirmed_at = now();
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created_auto_confirm on auth.users;
create trigger on_auth_user_created_auto_confirm
  before insert on auth.users
  for each row execute function public.auto_confirm_invited_users();
