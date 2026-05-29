create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  provider_id uuid references public.profiles on delete cascade not null,
  created_at timestamp with time zone default timezone('utc', now()) not null,
  unique (user_id, provider_id)
);

create index if not exists favorites_user_id_idx on public.favorites (user_id);
create index if not exists favorites_provider_id_idx on public.favorites (provider_id);

alter table public.favorites enable row level security;

create policy "Users can view their own favorites"
  on public.favorites for select
  using (auth.uid() = user_id);

create policy "Users can add favorites"
  on public.favorites for insert
  with check (auth.uid() = user_id);

create policy "Users can remove their favorites"
  on public.favorites for delete
  using (auth.uid() = user_id);

grant select, insert, delete on public.favorites to authenticated;
