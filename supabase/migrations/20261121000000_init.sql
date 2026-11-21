-- =====================================================================
-- 全日本学生ハンドボール選手権大会 申込システム：データベースの初期設定
--
-- Supabase の「SQL Editor」に全文を貼り付けて「Run」で実行します（1回だけ）。
-- 何度実行しても壊れないようにはしていません。2回目以降は実行しないでください。
--
-- 考え方（docs/03_データ設計.md）
--  * 大会（tournaments）ごとにデータを分ける。
--  * 誰が何を見られるかは memberships（メールアドレス×ロール×対象）で決め、
--    データベース自体の「行レベルセキュリティ（RLS）」で制限する。
--  * 提出・承認・差し戻し・ロック解除は専用の関数からしか行えない。
--  * 主要なデータの変更はすべて audit_logs に自動で記録する。
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 表
-- ---------------------------------------------------------------------

create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  year int not null,
  status text not null default 'preparing'
    check (status in ('preparing', 'open', 'closed', 'finished', 'archived')),
  start_date date not null,
  entry_deadline timestamptz not null,
  -- 金額・人数の上限・画像条件など（src/lib/types.ts の TournamentSettings と同じ形）
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.regions (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments on delete cascade,
  code text not null,
  name text not null,
  sort_order int not null default 0,
  -- 振込先口座 {bank, branch, type, number, holder}
  bank_account jsonb not null default '{}'::jsonb,
  unique (tournament_id, code)
);

-- 大学（年度をまたいで使う）
create table public.universities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  kana text not null default '',
  created_at timestamptz not null default now()
);

-- その年度に参加する大学と、所属地区
create table public.tournament_universities (
  tournament_id uuid not null references public.tournaments on delete cascade,
  university_id uuid not null references public.universities on delete restrict,
  region_id uuid not null references public.regions on delete restrict,
  primary key (tournament_id, university_id)
);

-- 所属（ログインしたメールアドレスごとの役割）
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments on delete cascade,
  email text not null check (email = lower(email)),
  role text not null check (role in ('team', 'region', 'office', 'agency')),
  university_id uuid references public.universities on delete cascade,
  region_id uuid references public.regions on delete cascade,
  display_name text not null default '',
  invited_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (role = 'team' and university_id is not null and region_id is null) or
    (role = 'region' and region_id is not null and university_id is null) or
    (role in ('office', 'agency') and university_id is null and region_id is null)
  )
);
create unique index memberships_unique on public.memberships
  (tournament_id, email, role, coalesce(university_id, '00000000-0000-0000-0000-000000000000'::uuid),
   coalesce(region_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index memberships_email on public.memberships (email);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments on delete cascade,
  university_id uuid not null references public.universities on delete restrict,
  gender text not null check (gender in ('men', 'women')),
  region_id uuid not null references public.regions on delete restrict,
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'submitted', 'region_approved', 'office_confirmed', 'returned')),
  display_name text not null default '',
  contact_name text not null default '',
  contact_phone text not null default '',
  contact_email text not null default '',
  jha_number text not null default '',
  student_fed_number text not null default '',
  registration_confirmed boolean not null default false,
  escort jsonb not null default '{"name":"","title":"","qualified":false,"staffMemberId":null}'::jsonb,
  comment text not null default '',
  paper_status text not null default 'not_sent'
    check (paper_status in ('not_sent', 'sent', 'received')),
  unlocked_until timestamptz,
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (tournament_id, university_id, gender)
);
create index teams_region on public.teams (region_id);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams on delete cascade,
  kind text not null check (kind in ('player', 'staff')),
  name text not null default '',
  kana text not null default '',
  birth_date date,
  is_entry boolean not null default true,
  number int check (number is null or number between 0 and 999),
  grade int,
  faculty text not null default '',
  position text not null default '',
  high_school text not null default '',
  height_cm numeric(5,1),
  weight_kg numeric(5,1),
  handedness text not null default '',
  foreign_status text not null default 'none' check (foreign_status in ('none', 'foreign', 'short_term')),
  bench boolean not null default false,
  title text not null default '',
  is_student boolean not null default false,
  insurance_opt_in boolean not null default false,
  photo_path text,
  photo_consent boolean not null default false,
  doping_consent_checked boolean not null default false,
  updated_at timestamptz not null default now()
);
create index members_team on public.members (team_id);

create table public.uniforms (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams on delete cascade,
  use text not null check (use in ('CP', 'GK')),
  color text not null default '',
  tone text not null check (tone in ('dark', 'light')),
  sponsor boolean not null default false,
  updated_at timestamptz not null default now()
);
create index uniforms_team on public.uniforms (team_id);

create table public.team_assets (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams on delete cascade,
  kind text not null check (kind in ('group', 'logo')),
  path text not null,
  width int,
  height int,
  updated_at timestamptz not null default now(),
  unique (team_id, kind)
);

create table public.review_comments (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams on delete cascade,
  author_email text not null,
  author_role text not null,
  action text not null check (action in ('submit', 'approve', 'return', 'confirm', 'unlock', 'note')),
  body text not null default '',
  created_at timestamptz not null default now()
);
create index review_comments_team on public.review_comments (team_id, created_at);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_email text,
  table_name text not null,
  row_id uuid,
  action text not null,
  old_data jsonb,
  new_data jsonb
);
create index audit_logs_at on public.audit_logs (at desc);

-- ---------------------------------------------------------------------
-- 権限を判定する関数
-- ---------------------------------------------------------------------

create or replace function public.current_email() returns text
language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create or replace function public.is_office(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    where m.tournament_id = t and m.email = current_email() and m.role = 'office'
  )
$$;

create or replace function public.is_any_office() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships m where m.email = current_email() and m.role = 'office')
$$;

create or replace function public.is_tournament_member(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships m where m.tournament_id = t and m.email = current_email())
$$;

-- そのチームの大学の担当者か
create or replace function public.is_team_user(team uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from teams tm join memberships m
      on m.tournament_id = tm.tournament_id and m.university_id = tm.university_id
    where tm.id = team and m.email = current_email() and m.role = 'team'
  )
$$;

-- そのチームの地区の地区学連担当者か
create or replace function public.is_region_user(team uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from teams tm join memberships m
      on m.tournament_id = tm.tournament_id and m.region_id = tm.region_id
    where tm.id = team and m.email = current_email() and m.role = 'region'
  )
$$;

create or replace function public.can_view_team(team uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_team_user(team) or is_region_user(team)
      or exists (select 1 from teams tm where tm.id = team and is_office(tm.tournament_id))
$$;

-- 締切前（またはロック解除中）で、提出前・差し戻し中のチームか
create or replace function public.team_is_editable(team uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from teams tm join tournaments t on t.id = tm.tournament_id
    where tm.id = team
      and tm.status in ('not_started', 'in_progress', 'returned')
      and (now() <= t.entry_deadline or (tm.unlocked_until is not null and now() <= tm.unlocked_until))
  )
$$;

create or replace function public.can_edit_team(team uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select (is_team_user(team) and team_is_editable(team))
      or exists (select 1 from teams tm where tm.id = team and is_office(tm.tournament_id))
$$;

-- 保存ファイルのパス（先頭のフォルダ名がチームID）からチームIDを取り出す
create or replace function public.team_id_from_path(p text) returns uuid
language plpgsql immutable as $$
begin
  return split_part(p, '/', 1)::uuid;
exception when others then
  return null;
end
$$;

-- ---------------------------------------------------------------------
-- 自動処理（トリガー）
-- ---------------------------------------------------------------------

-- 更新日時
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end
$$;
create trigger teams_touch before update on public.teams for each row execute function public.touch_updated_at();
create trigger members_touch before update on public.members for each row execute function public.touch_updated_at();
create trigger uniforms_touch before update on public.uniforms for each row execute function public.touch_updated_at();
create trigger team_assets_touch before update on public.team_assets for each row execute function public.touch_updated_at();

-- チームを作るとき：所属地区は事務局が登録した地区に自動で合わせる
create or replace function public.teams_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare r uuid;
begin
  select region_id into r from tournament_universities
   where tournament_id = new.tournament_id and university_id = new.university_id;
  if r is null then
    raise exception 'この大学は今年度の参加大学として登録されていません。事務局にお問い合わせください。';
  end if;
  new.region_id := r;
  new.status := 'not_started';
  new.unlocked_until := null;
  new.submitted_at := null;
  new.registration_confirmed := false;
  new.paper_status := 'not_sent';
  return new;
end
$$;
create trigger teams_insert before insert on public.teams for each row execute function public.teams_before_insert();

-- チームの更新：状態・ロック・確認済みなどの項目は、専用の関数か事務局しか変えられない
create or replace function public.teams_before_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('app.trusted', true), '') = 'on' or is_office(old.tournament_id) then
    return new;
  end if;
  if new.status is distinct from old.status
     or new.unlocked_until is distinct from old.unlocked_until
     or new.submitted_at is distinct from old.submitted_at
     or new.registration_confirmed is distinct from old.registration_confirmed
     or new.paper_status is distinct from old.paper_status
     or new.region_id is distinct from old.region_id
     or new.university_id is distinct from old.university_id
     or new.tournament_id is distinct from old.tournament_id
     or new.gender is distinct from old.gender then
    raise exception 'この項目は変更できません。';
  end if;
  -- チームが入力を始めたら「入力中」にする
  if old.status = 'not_started' then
    new.status := 'in_progress';
  end if;
  return new;
end
$$;
create trigger teams_update before update on public.teams for each row execute function public.teams_before_update();

-- 名簿などを変えたら、チームを「入力中」にする
create or replace function public.mark_team_in_progress() returns trigger
language plpgsql security definer set search_path = public as $$
declare tid uuid := coalesce(new.team_id, old.team_id);
begin
  perform set_config('app.trusted', 'on', true);
  update teams set status = 'in_progress' where id = tid and status = 'not_started';
  perform set_config('app.trusted', '', true);
  return coalesce(new, old);
end
$$;
create trigger members_progress after insert or update on public.members for each row execute function public.mark_team_in_progress();

-- 変更履歴
create or replace function public.write_audit_log() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into audit_logs (actor_email, table_name, row_id, action, old_data, new_data)
  values (
    nullif(current_email(), ''),
    tg_table_name,
    coalesce((to_jsonb(new) ->> 'id')::uuid, (to_jsonb(old) ->> 'id')::uuid),
    lower(tg_op),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end
$$;
create trigger audit_teams after insert or update or delete on public.teams for each row execute function public.write_audit_log();
create trigger audit_members after insert or update or delete on public.members for each row execute function public.write_audit_log();
create trigger audit_uniforms after insert or update or delete on public.uniforms for each row execute function public.write_audit_log();
create trigger audit_team_assets after insert or update or delete on public.team_assets for each row execute function public.write_audit_log();
create trigger audit_memberships after insert or update or delete on public.memberships for each row execute function public.write_audit_log();
create trigger audit_review_comments after insert on public.review_comments for each row execute function public.write_audit_log();
create trigger audit_tournaments after insert or update or delete on public.tournaments for each row execute function public.write_audit_log();

-- ---------------------------------------------------------------------
-- 行レベルセキュリティ（RLS）：誰がどの行を見られる・変えられるか
-- ---------------------------------------------------------------------

alter table public.tournaments enable row level security;
alter table public.regions enable row level security;
alter table public.universities enable row level security;
alter table public.tournament_universities enable row level security;
alter table public.memberships enable row level security;
alter table public.teams enable row level security;
alter table public.members enable row level security;
alter table public.uniforms enable row level security;
alter table public.team_assets enable row level security;
alter table public.review_comments enable row level security;
alter table public.audit_logs enable row level security;

-- 大会・地区：その大会に所属している人は閲覧可、事務局は変更可
create policy tournaments_select on public.tournaments for select to authenticated using (is_tournament_member(id));
create policy tournaments_update on public.tournaments for update to authenticated using (is_office(id)) with check (is_office(id));
create policy regions_select on public.regions for select to authenticated using (is_tournament_member(tournament_id));
create policy regions_write on public.regions for all to authenticated using (is_office(tournament_id)) with check (is_office(tournament_id));

-- 大学：自分に関係する大学（担当大学・自地区・事務局は全部）
create policy universities_select on public.universities for select to authenticated using (
  is_any_office()
  or exists (select 1 from memberships m where m.email = current_email() and m.university_id = universities.id)
  or exists (
    select 1 from tournament_universities tu join memberships m
      on m.tournament_id = tu.tournament_id and m.region_id = tu.region_id
    where tu.university_id = universities.id and m.email = current_email() and m.role = 'region')
);
create policy universities_write on public.universities for all to authenticated using (is_any_office()) with check (is_any_office());

create policy tu_select on public.tournament_universities for select to authenticated using (
  is_office(tournament_id)
  or exists (select 1 from memberships m where m.email = current_email() and m.tournament_id = tournament_universities.tournament_id
             and (m.university_id = tournament_universities.university_id or m.region_id = tournament_universities.region_id))
);
create policy tu_write on public.tournament_universities for all to authenticated using (is_office(tournament_id)) with check (is_office(tournament_id));

-- 所属：自分の所属は自分で見られる。事務局は全員分を管理
create policy memberships_select on public.memberships for select to authenticated using (email = current_email() or is_office(tournament_id));
create policy memberships_write on public.memberships for all to authenticated using (is_office(tournament_id)) with check (is_office(tournament_id));

-- チーム
create policy teams_select on public.teams for select to authenticated using (can_view_team(id));
create policy teams_insert on public.teams for insert to authenticated with check (
  is_office(tournament_id)
  or exists (select 1 from memberships m join tournaments t on t.id = m.tournament_id
             where m.email = current_email() and m.role = 'team'
               and m.tournament_id = teams.tournament_id and m.university_id = teams.university_id
               and now() <= t.entry_deadline)
);
create policy teams_update on public.teams for update to authenticated using (can_edit_team(id)) with check (can_edit_team(id));
create policy teams_delete on public.teams for delete to authenticated using (is_office(tournament_id));

-- 名簿・ユニフォーム・チーム画像
create policy members_select on public.members for select to authenticated using (can_view_team(team_id));
create policy members_insert on public.members for insert to authenticated with check (can_edit_team(team_id));
create policy members_update on public.members for update to authenticated using (can_edit_team(team_id)) with check (can_edit_team(team_id));
create policy members_delete on public.members for delete to authenticated using (can_edit_team(team_id));

create policy uniforms_select on public.uniforms for select to authenticated using (can_view_team(team_id));
create policy uniforms_insert on public.uniforms for insert to authenticated with check (can_edit_team(team_id));
create policy uniforms_update on public.uniforms for update to authenticated using (can_edit_team(team_id)) with check (can_edit_team(team_id));
create policy uniforms_delete on public.uniforms for delete to authenticated using (can_edit_team(team_id));

create policy assets_select on public.team_assets for select to authenticated using (can_view_team(team_id));
create policy assets_insert on public.team_assets for insert to authenticated with check (can_edit_team(team_id));
create policy assets_update on public.team_assets for update to authenticated using (can_edit_team(team_id)) with check (can_edit_team(team_id));
create policy assets_delete on public.team_assets for delete to authenticated using (can_edit_team(team_id));

-- コメント：閲覧はチームを見られる人。書き込みは関数経由のみ
create policy comments_select on public.review_comments for select to authenticated using (can_view_team(team_id));

-- 変更履歴：事務局のみ閲覧
create policy audit_select on public.audit_logs for select to authenticated using (is_any_office());

-- ---------------------------------------------------------------------
-- 提出・承認・差し戻し・ロック解除（専用の関数）
-- ---------------------------------------------------------------------

-- チームが提出する。人数・背番号の重複・留学生の上限はここでも確認する
create or replace function public.submit_team(p_team uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  tm teams;
  s jsonb;
  n_entry int; n_staff int; n_foreign int; n_foreign_bench int; n_bench_p int; n_bench_s int; n_short int; n_dup int;
  problems text[] := '{}';
begin
  select * into tm from teams where id = p_team for update;
  if tm.id is null or not is_team_user(p_team) then
    raise exception 'このチームを提出する権限がありません。';
  end if;
  if not team_is_editable(p_team) then
    raise exception '締切を過ぎているか、すでに提出済みのため提出できません。';
  end if;
  select settings -> 'limits' into s from tournaments where id = tm.tournament_id;

  select count(*) filter (where kind = 'player' and is_entry),
         count(*) filter (where kind = 'staff'),
         count(*) filter (where kind = 'player' and is_entry and foreign_status = 'foreign'),
         count(*) filter (where kind = 'player' and is_entry and foreign_status = 'foreign' and bench),
         count(*) filter (where kind = 'player' and is_entry and bench),
         count(*) filter (where kind = 'staff' and bench),
         count(*) filter (where kind = 'player' and is_entry and foreign_status = 'short_term')
    into n_entry, n_staff, n_foreign, n_foreign_bench, n_bench_p, n_bench_s, n_short
    from members where team_id = p_team;
  select count(*) into n_dup from (
    select number from members where team_id = p_team and kind = 'player' and is_entry and number is not null
    group by number having count(*) > 1) d;

  if n_entry = 0 or n_entry > coalesce((s ->> 'playerEntryMax')::int, 25) then problems := array_append(problems, 'エントリー選手の人数'); end if;
  if n_staff = 0 or n_staff > coalesce((s ->> 'staffMax')::int, 6) then problems := array_append(problems, '役員の人数'); end if;
  if n_foreign > coalesce((s ->> 'foreignEntryMax')::int, 3) then problems := array_append(problems, '留学生のエントリー人数'); end if;
  if n_foreign_bench > coalesce((s ->> 'foreignGameEntryMax')::int, 2) then problems := array_append(problems, '留学生のベンチ登録人数'); end if;
  if n_bench_p > coalesce((s ->> 'benchPlayerMax')::int, 16) then problems := array_append(problems, 'ベンチ登録の選手の人数'); end if;
  if n_bench_s > coalesce((s ->> 'benchStaffMax')::int, 5) then problems := array_append(problems, 'ベンチ登録の役員の人数'); end if;
  if n_short > 0 then problems := array_append(problems, '短期留学生のエントリー'); end if;
  if n_dup > 0 then problems := array_append(problems, '背番号の重複'); end if;
  if exists (select 1 from members where team_id = p_team and kind = 'player' and is_entry
             and (number is null or number < coalesce((s ->> 'numberMin')::int, 1) or number > coalesce((s ->> 'numberMax')::int, 99))) then
    problems := array_append(problems, '背番号の範囲');
  end if;
  if array_length(problems, 1) > 0 then
    raise exception '提出できません。次の点を確認してください：%', array_to_string(problems, '、');
  end if;

  perform set_config('app.trusted', 'on', true);
  update teams set status = 'submitted', submitted_at = now() where id = p_team;
  perform set_config('app.trusted', '', true);
  insert into review_comments (team_id, author_email, author_role, action, body)
  values (p_team, current_email(), 'team', 'submit', '');
end
$$;

-- 地区学連・事務局の確認：approve（地区承認）／return（差し戻し）／confirm（事務局確認）
create or replace function public.review_team(p_team uuid, p_action text, p_comment text default '') returns void
language plpgsql security definer set search_path = public as $$
declare
  tm teams;
  office boolean;
  region boolean;
  new_status text;
begin
  select * into tm from teams where id = p_team for update;
  if tm.id is null then raise exception 'チームが見つかりません。'; end if;
  office := is_office(tm.tournament_id);
  region := is_region_user(p_team);
  if not (office or region) then raise exception 'このチームを確認する権限がありません。'; end if;

  if p_action = 'approve' then
    if tm.status <> 'submitted' then raise exception '提出済みのチームだけ承認できます。'; end if;
    new_status := 'region_approved';
  elsif p_action = 'return' then
    if tm.status not in ('submitted', 'region_approved', 'office_confirmed') then
      raise exception '提出済みのチームだけ差し戻せます。';
    end if;
    if not office and tm.status <> 'submitted' then
      raise exception '地区承認後の差し戻しは事務局が行います。';
    end if;
    if coalesce(trim(p_comment), '') = '' then raise exception '差し戻しの理由を入力してください。'; end if;
    new_status := 'returned';
  elsif p_action = 'confirm' then
    if not office then raise exception '事務局確認は事務局だけが行えます。'; end if;
    if tm.status <> 'region_approved' then raise exception '地区承認済みのチームだけ確認できます。'; end if;
    new_status := 'office_confirmed';
  else
    raise exception '不明な操作です：%', p_action;
  end if;

  perform set_config('app.trusted', 'on', true);
  update teams set status = new_status where id = p_team;
  -- 締切後に差し戻した場合は、直せるように7日間ロックを解除する
  if new_status = 'returned' then
    update teams t set unlocked_until = greatest(coalesce(t.unlocked_until, now()), now() + interval '7 days')
      from tournaments tr where tr.id = t.tournament_id and t.id = p_team and now() > tr.entry_deadline;
  end if;
  perform set_config('app.trusted', '', true);

  insert into review_comments (team_id, author_email, author_role, action, body)
  values (p_team, current_email(), case when office then 'office' else 'region' end, p_action, coalesce(p_comment, ''));
end
$$;

-- 事務局：締切後のロックを一時的に解除する（p_until が null なら解除を取り消す）
create or replace function public.unlock_team(p_team uuid, p_until timestamptz, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare tm teams;
begin
  select * into tm from teams where id = p_team;
  if tm.id is null or not is_office(tm.tournament_id) then raise exception '事務局だけが操作できます。'; end if;
  if p_until is not null and coalesce(trim(p_reason), '') = '' then raise exception '解除の理由を入力してください。'; end if;
  update teams set unlocked_until = p_until where id = p_team;
  insert into review_comments (team_id, author_email, author_role, action, body)
  values (p_team, current_email(), 'office', 'unlock',
          case when p_until is null then 'ロック解除を取り消し' else to_char(p_until at time zone 'Asia/Tokyo', 'YYYY-MM-DD HH24:MI') || ' までロック解除：' || p_reason end);
end
$$;

-- 申込書原本の郵送・到着の記録（チーム：郵送済にする／地区学連・事務局：到着確認）
create or replace function public.set_paper_status(p_team uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare tm teams;
begin
  select * into tm from teams where id = p_team;
  if tm.id is null then raise exception 'チームが見つかりません。'; end if;
  if p_status not in ('not_sent', 'sent', 'received') then raise exception '不明な状態です：%', p_status; end if;
  if not (is_office(tm.tournament_id) or is_region_user(p_team)
          or (is_team_user(p_team) and p_status in ('not_sent', 'sent') and tm.paper_status <> 'received')) then
    raise exception 'この操作を行う権限がありません。';
  end if;
  perform set_config('app.trusted', 'on', true);
  update teams set paper_status = p_status where id = p_team;
  perform set_config('app.trusted', '', true);
end
$$;

-- 最初の事務局担当者を登録する（設定のときに1回だけ使う。事務局が1人でもいれば使えない）
create or replace function public.bootstrap_office(p_tournament uuid, p_email text, p_name text default '') returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from memberships where tournament_id = p_tournament and role = 'office') then
    raise exception 'すでに事務局担当者が登録されています。追加は管理画面から行ってください。';
  end if;
  insert into memberships (tournament_id, email, role, display_name) values (p_tournament, lower(trim(p_email)), 'office', p_name);
end
$$;
revoke execute on function public.bootstrap_office(uuid, text, text) from public, anon, authenticated;

grant execute on function public.submit_team(uuid) to authenticated;
grant execute on function public.review_team(uuid, text, text) to authenticated;
grant execute on function public.unlock_team(uuid, timestamptz, text) to authenticated;
grant execute on function public.set_paper_status(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 写真の保存場所（Storage）
-- 保存先：team-files/{チームID}/{ファイル名}
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('team-files', 'team-files', false, 20971520, array['image/jpeg', 'image/png']);

create policy team_files_select on storage.objects for select to authenticated
  using (bucket_id = 'team-files' and can_view_team(team_id_from_path(name)));
create policy team_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'team-files' and can_edit_team(team_id_from_path(name)));
create policy team_files_update on storage.objects for update to authenticated
  using (bucket_id = 'team-files' and can_edit_team(team_id_from_path(name)));
create policy team_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'team-files' and can_edit_team(team_id_from_path(name)));
