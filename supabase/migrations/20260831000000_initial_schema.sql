create extension if not exists "pgcrypto";

create type public.trip_role as enum ('OWNER', 'MEMBER');
create type public.message_type as enum ('TEXT', 'NOTE_SHARE', 'PLACE_SHARE', 'PROPOSAL', 'POLL', 'DECISION', 'SYSTEM');
create type public.proposal_status as enum ('OPEN', 'APPROVED', 'REJECTED', 'CANCELLED');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  destination text not null,
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  emoji text not null default '✈️',
  invite_code text not null unique check (invite_code ~ '^[A-Z0-9]{6}$'),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trip_members (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.trip_role not null default 'MEMBER',
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create table public.trip_invites (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  code text not null unique,
  created_by uuid not null references public.profiles(id),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.note_pages (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  title text not null default '새 페이지',
  position integer not null default 0,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.note_blocks (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.note_pages(id) on delete cascade,
  type text not null,
  content jsonb not null default '{}',
  position integer not null default 0,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.itinerary_days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  day_index integer not null check (day_index >= 0),
  date date not null,
  unique (trip_id, day_index)
);

create table public.itinerary_places (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  day_id uuid references public.itinerary_days(id) on delete cascade,
  provider_place_id text,
  name text not null,
  address text,
  latitude double precision not null,
  longitude double precision not null,
  start_time time,
  end_time time,
  notes text,
  link text,
  category text,
  sort_order integer not null default 0,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.transport_segments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  source_place_id uuid not null references public.itinerary_places(id) on delete cascade,
  destination_place_id uuid not null references public.itinerary_places(id) on delete cascade,
  mode text not null default 'walk',
  duration_minutes integer,
  distance_km numeric(8,2),
  notes text,
  route_geojson jsonb,
  updated_at timestamptz not null default now(),
  unique (source_place_id, destination_place_id)
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  type public.message_type not null default 'TEXT',
  body text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  title text not null,
  description text,
  status public.proposal_status not null default 'OPEN',
  referenced_note_page_id uuid references public.note_pages(id) on delete set null,
  referenced_place_id uuid references public.itinerary_places(id) on delete set null,
  proposed_place jsonb,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.poll_options (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  label text not null,
  position integer not null default 0
);

create table public.poll_votes (
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  option_id uuid not null references public.poll_options(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (proposal_id, user_id)
);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name) values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), '여행자')) on conflict (id) do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.is_trip_member(check_trip_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.trip_members where trip_id = check_trip_id and user_id = auth.uid());
$$;
create or replace function public.is_trip_owner(check_trip_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.trip_members where trip_id = check_trip_id and user_id = auth.uid() and role = 'OWNER');
$$;

create or replace function public.join_trip_by_code(invite_code_input text) returns uuid language plpgsql security definer set search_path = public as $$
declare target_trip uuid;
begin
  select id into target_trip from public.trips where invite_code = upper(invite_code_input);
  if target_trip is null then raise exception 'INVALID_INVITE'; end if;
  insert into public.trip_members (trip_id, user_id, role) values (target_trip, auth.uid(), 'MEMBER') on conflict do nothing;
  return target_trip;
end; $$;
grant execute on function public.join_trip_by_code(text) to authenticated;

alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.trip_invites enable row level security;
alter table public.note_pages enable row level security;
alter table public.note_blocks enable row level security;
alter table public.itinerary_days enable row level security;
alter table public.itinerary_places enable row level security;
alter table public.transport_segments enable row level security;
alter table public.chat_messages enable row level security;
alter table public.proposals enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;

create policy "profiles readable by authenticated users" on public.profiles for select to authenticated using (true);
create policy "users update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "members read trips" on public.trips for select to authenticated using (public.is_trip_member(id) or created_by = auth.uid());
create policy "users create trips" on public.trips for insert to authenticated with check (created_by = auth.uid());
create policy "members update trips" on public.trips for update to authenticated using (public.is_trip_member(id)) with check (public.is_trip_member(id));
create policy "owners delete trips" on public.trips for delete to authenticated using (public.is_trip_owner(id));
create policy "members read membership" on public.trip_members for select to authenticated using (public.is_trip_member(trip_id) or user_id = auth.uid());
create policy "creator adds owner membership" on public.trip_members for insert to authenticated with check (user_id = auth.uid() or public.is_trip_owner(trip_id));
create policy "owners update membership" on public.trip_members for update to authenticated using (public.is_trip_owner(trip_id));
create policy "owners remove members" on public.trip_members for delete to authenticated using (public.is_trip_owner(trip_id));

do $$ declare table_name text; begin
  foreach table_name in array array['trip_invites','note_pages','itinerary_days','itinerary_places','transport_segments','chat_messages','proposals'] loop
    execute format('create policy "members read %1$s" on public.%1$I for select to authenticated using (public.is_trip_member(trip_id))', table_name);
    execute format('create policy "members create %1$s" on public.%1$I for insert to authenticated with check (public.is_trip_member(trip_id))', table_name);
    execute format('create policy "members update %1$s" on public.%1$I for update to authenticated using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id))', table_name);
    execute format('create policy "members delete %1$s" on public.%1$I for delete to authenticated using (public.is_trip_member(trip_id))', table_name);
  end loop;
end $$;

create policy "members read note blocks" on public.note_blocks for select to authenticated using (exists(select 1 from public.note_pages p where p.id = page_id and public.is_trip_member(p.trip_id)));
create policy "members create note blocks" on public.note_blocks for insert to authenticated with check (exists(select 1 from public.note_pages p where p.id = page_id and public.is_trip_member(p.trip_id)));
create policy "members update note blocks" on public.note_blocks for update to authenticated using (exists(select 1 from public.note_pages p where p.id = page_id and public.is_trip_member(p.trip_id)));
create policy "members delete note blocks" on public.note_blocks for delete to authenticated using (exists(select 1 from public.note_pages p where p.id = page_id and public.is_trip_member(p.trip_id)));
create policy "members read poll options" on public.poll_options for select to authenticated using (exists(select 1 from public.proposals p where p.id = proposal_id and public.is_trip_member(p.trip_id)));
create policy "members create poll options" on public.poll_options for insert to authenticated with check (exists(select 1 from public.proposals p where p.id = proposal_id and public.is_trip_member(p.trip_id)));
create policy "members update poll options" on public.poll_options for update to authenticated using (exists(select 1 from public.proposals p where p.id = proposal_id and public.is_trip_member(p.trip_id)));
create policy "members delete poll options" on public.poll_options for delete to authenticated using (exists(select 1 from public.proposals p where p.id = proposal_id and public.is_trip_member(p.trip_id)));
create policy "members read votes" on public.poll_votes for select to authenticated using (exists(select 1 from public.proposals p where p.id = proposal_id and public.is_trip_member(p.trip_id)));
create policy "members vote" on public.poll_votes for insert to authenticated with check (user_id = auth.uid() and exists(select 1 from public.proposals p where p.id = proposal_id and public.is_trip_member(p.trip_id)));
create policy "members change own vote" on public.poll_votes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "members remove own vote" on public.poll_votes for delete to authenticated using (user_id = auth.uid());

alter publication supabase_realtime add table public.trip_members, public.note_pages, public.note_blocks, public.itinerary_places, public.transport_segments, public.chat_messages, public.proposals, public.poll_votes;
create index trips_invite_code_idx on public.trips(invite_code);
create index trip_members_user_idx on public.trip_members(user_id);
create index chat_messages_trip_created_idx on public.chat_messages(trip_id, created_at);
create index itinerary_places_trip_day_sort_idx on public.itinerary_places(trip_id, day_id, sort_order);
