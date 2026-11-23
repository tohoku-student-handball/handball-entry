-- 権限設定（RLS）と提出・承認の流れのテスト。
-- stub_supabase.sql → schema.sql → seed.sql のあとに実行する。本番では実行しない。
\set ON_ERROR_STOP 1
\set QUIET 1

create schema test;
grant usage on schema test to authenticated, anon;
create function test.expect_fail(label text, q text) returns void language plpgsql as $$
begin
  begin
    execute q;
  exception when others then
    raise notice 'OK（拒否された）: % → %', label, sqlerrm;
    return;
  end;
  raise exception 'NG: 「%」が拒否されませんでした', label;
end $$;
create function test.expect_count(label text, q text, n int) returns void language plpgsql as $$
declare c int;
begin
  execute 'select count(*) from (' || q || ') x' into c;
  if c <> n then raise exception 'NG: % → % 件（期待 % 件）', label, c, n; end if;
  raise notice 'OK: % → % 件', label, c;
end $$;
create function test.login(email text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('email', email)::text, false);
$$;
grant execute on all functions in schema test to authenticated, anon;

-- 準備（管理者として）
create temp table ids as
select
  (select id from tournaments where kind = 'national') as nat,
  (select id from tournaments where kind = 'league') as lg;
grant select on ids to authenticated;

insert into universities (id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '東北テスト大学'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '関東テスト大学');
insert into tournament_universities (tournament_id, university_id, region_id)
select t.id, 'aaaaaaaa-0000-0000-0000-000000000001', r.id from tournaments t join regions r on r.tournament_id = t.id and r.code = 'tohoku' where t.kind = 'national';
insert into tournament_universities (tournament_id, university_id, region_id)
select t.id, 'bbbbbbbb-0000-0000-0000-000000000002', r.id from tournaments t join regions r on r.tournament_id = t.id and r.code = 'kanto' where t.kind = 'national';
insert into tournament_universities (tournament_id, university_id, region_id, men_division_id)
select t.id, 'aaaaaaaa-0000-0000-0000-000000000001', r.id, d.id
from tournaments t join regions r on r.tournament_id = t.id join divisions d on d.tournament_id = t.id and d.name = '男子2部' where t.kind = 'league';

insert into memberships (tournament_id, email, role, university_id)
select id, 'team-a@example.com', 'team', 'aaaaaaaa-0000-0000-0000-000000000001' from tournaments;  -- 両方の大会
insert into memberships (tournament_id, email, role, university_id)
select nat, 'team-b@example.com', 'team', 'bbbbbbbb-0000-0000-0000-000000000002' from ids;
insert into memberships (tournament_id, email, role, region_id)
select t.id, 'region-tohoku@example.com', 'region', r.id from tournaments t join regions r on r.tournament_id = t.id and r.code = 'tohoku' where t.kind = 'national';
insert into memberships (tournament_id, email, role, region_id)
select t.id, 'region-kanto@example.com', 'region', r.id from tournaments t join regions r on r.tournament_id = t.id and r.code = 'kanto' where t.kind = 'national';
insert into memberships (tournament_id, email, role)
select lg, 'league-office@example.com', 'office' from ids;  -- リーグの主催者（東北学連）

set role authenticated;

\echo '--- 部員名簿（チームAの担当者）'
select test.login('team-a@example.com');
insert into roster_people (id, university_id, gender, academic_year, kind, name) values
  ('c0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'men', 2027, 'staff', '監督'),
  ('c0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'men', 2027, 'player', '選手1'),
  ('c0000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'men', 2027, 'player', '選手2'),
  ('c0000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'men', 2027, 'player', '選手3（未エントリー）');
select test.expect_count('自大学の名簿が見える', $q$select 1 from roster_people$q$, 4);
select test.expect_fail('他大学の名簿に人を追加する',
  $q$insert into roster_people (university_id, gender, academic_year, kind, name) values ('bbbbbbbb-0000-0000-0000-000000000002', 'men', 2027, 'player', 'x')$q$);
select test.expect_fail('担当していない年度の名簿に人を追加する',
  $q$insert into roster_people (university_id, gender, academic_year, kind, name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'men', 2028, 'player', 'x')$q$);
insert into storage.objects (bucket_id, name) values ('team-files', 'aaaaaaaa-0000-0000-0000-000000000001/face1.jpg');

\echo '--- 全日本：チームAの申込'
insert into teams (id, tournament_id, university_id, gender, region_id)
select '11111111-0000-0000-0000-000000000001', nat, 'aaaaaaaa-0000-0000-0000-000000000001', 'men', (select id from regions where code = 'kanto' and tournament_id = nat) from ids;
select test.expect_count('チームAの地区は登録済みの東北に自動で直る',
  $q$select 1 from teams t join regions r on r.id = t.region_id where r.code = 'tohoku'$q$, 1);
select test.expect_fail('他大学のチームを作る',
  $q$insert into teams (tournament_id, university_id, gender, region_id) select nat, 'bbbbbbbb-0000-0000-0000-000000000002', 'men', (select id from regions where code='kanto' and tournament_id = nat) from ids$q$);
insert into entries (team_id, person_id, is_entry, number) values
  ('11111111-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', true, null),
  ('11111111-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', true, 7),
  ('11111111-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', true, 7);
select test.expect_count('エントリーするとチームは「入力中」', $q$select 1 from teams where status = 'in_progress'$q$, 1);
select test.expect_fail('チームが自分で状態を「承認済」にする', $q$update teams set status = 'region_approved'$q$);
select test.expect_fail('背番号が重複したまま提出', $q$select submit_team('11111111-0000-0000-0000-000000000001')$q$);
update entries set number = 8 where person_id = 'c0000000-0000-0000-0000-000000000003';
insert into storage.objects (bucket_id, name) values ('team-files', '11111111-0000-0000-0000-000000000001/group.jpg');
select submit_team('11111111-0000-0000-0000-000000000001');
select test.expect_count('提出後は「提出済」', $q$select 1 from teams where status = 'submitted'$q$, 1);
update entries set number = 99 where person_id = 'c0000000-0000-0000-0000-000000000002' and team_id = '11111111-0000-0000-0000-000000000001';
select test.expect_count('提出後は背番号を変更できない', $q$select 1 from entries where number = 99$q$, 0);
select test.expect_fail('提出後にチーム画像を追加',
  $q$insert into storage.objects (bucket_id, name) values ('team-files', '11111111-0000-0000-0000-000000000001/logo.jpg')$q$);
update roster_people set weight_kg = 80 where id = 'c0000000-0000-0000-0000-000000000002';
select test.expect_count('提出後も部員名簿（体重など）は更新できる', $q$select 1 from roster_people where weight_kg = 80$q$, 1);
select test.expect_fail('エントリー済みの人を名簿から削除する（消えない）',
  $q$do $d$ begin delete from roster_people where id = 'c0000000-0000-0000-0000-000000000002'; if not found then raise exception '削除されなかった'; end if; end $d$$q$);
delete from roster_people where id = 'c0000000-0000-0000-0000-000000000004';
select test.expect_count('どこにもエントリーしていない人は削除できる', $q$select 1 from roster_people$q$, 3);
select set_paper_status('11111111-0000-0000-0000-000000000001', 'sent');
select test.expect_fail('チームが自分で「到着確認済」にする',
  $q$select set_paper_status('11111111-0000-0000-0000-000000000001', 'received')$q$);
select test.expect_count('自分の所属だけ見える（2大会分）', $q$select 1 from memberships$q$, 2);
select test.expect_count('変更履歴は見えない', $q$select 1 from audit_logs$q$, 0);

\echo '--- チームBの担当者'
select test.login('team-b@example.com');
select test.expect_count('チームAは見えない', $q$select 1 from teams$q$, 0);
select test.expect_count('チームAのエントリーは見えない', $q$select 1 from entries$q$, 0);
select test.expect_count('東北テスト大学の名簿は見えない', $q$select 1 from roster_people$q$, 0);
select test.expect_count('チームA・名簿の写真は見えない', $q$select 1 from storage.objects$q$, 0);
select test.expect_fail('東北テスト大学の名簿に写真を入れる',
  $q$insert into storage.objects (bucket_id, name) values ('team-files', 'aaaaaaaa-0000-0000-0000-000000000001/x.jpg')$q$);
select test.expect_fail('ファイル名が不正な写真を入れる',
  $q$insert into storage.objects (bucket_id, name) values ('team-files', 'not-a-team/x.jpg')$q$);
insert into roster_people (id, university_id, gender, academic_year, kind, name) values
  ('d0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'men', 2027, 'player', '関東の選手');

\echo '--- 関東の地区学連'
select test.login('region-kanto@example.com');
select test.expect_count('東北のチームは見えない', $q$select 1 from teams$q$, 0);
select test.expect_count('東北テスト大学の名簿は見えない', $q$select 1 from roster_people where university_id = 'aaaaaaaa-0000-0000-0000-000000000001'$q$, 0);
select test.expect_fail('東北のチームを承認する', $q$select review_team('11111111-0000-0000-0000-000000000001', 'approve')$q$);
select test.expect_fail('他地区のチームの原本到着を記録する', $q$select set_paper_status('11111111-0000-0000-0000-000000000001', 'received')$q$);

\echo '--- 東北の地区学連（全日本）'
select test.login('region-tohoku@example.com');
select test.expect_count('自地区のチームが見える', $q$select 1 from teams$q$, 1);
select test.expect_count('自地区のエントリーが見える', $q$select 1 from entries$q$, 3);
select test.expect_count('自地区の大学の名簿が見える', $q$select 1 from roster_people$q$, 3);
select test.expect_count('自地区の写真が見える', $q$select 1 from storage.objects$q$, 2);
select test.expect_fail('地区学連がエントリーを追加する',
  $q$insert into entries (team_id, person_id) values ('11111111-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001')$q$);
select test.expect_fail('理由なしで差し戻す', $q$select review_team('11111111-0000-0000-0000-000000000001', 'return', '')$q$);
select review_team('11111111-0000-0000-0000-000000000001', 'return', '選手2の背番号を確認してください');
select test.expect_fail('地区学連が事務局確認をする', $q$select review_team('11111111-0000-0000-0000-000000000001', 'confirm')$q$);

\echo '--- チームA：差し戻し後に直して再提出'
select test.login('team-a@example.com');
select test.expect_count('差し戻しコメントが見える', $q$select 1 from review_comments where action = 'return'$q$, 1);
update entries set number = 9 where person_id = 'c0000000-0000-0000-0000-000000000003';
select test.expect_count('差し戻し中は背番号を直せる', $q$select 1 from entries where number = 9$q$, 1);
select test.expect_fail('他大学の人をエントリーする',
  $q$insert into entries (team_id, person_id) values ('11111111-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001')$q$);
select submit_team('11111111-0000-0000-0000-000000000001');

\echo '--- 東北の地区学連：承認'
select test.login('region-tohoku@example.com');
select review_team('11111111-0000-0000-0000-000000000001', 'approve');
select set_paper_status('11111111-0000-0000-0000-000000000001', 'received');
select test.expect_count('地区承認済・原本到着', $q$select 1 from teams where status = 'region_approved' and paper_status = 'received'$q$, 1);
select test.expect_fail('承認後に地区学連が差し戻す', $q$select review_team('11111111-0000-0000-0000-000000000001', 'return', '再確認')$q$);

\echo '--- 全日本の事務局'
select test.login('office@example.com');
select review_team('11111111-0000-0000-0000-000000000001', 'confirm');
select test.expect_count('事務局確認済', $q$select 1 from teams where status = 'office_confirmed'$q$, 1);
select test.expect_count('変更履歴に操作した人が記録される', $q$select 1 from audit_logs where actor_email = 'team-a@example.com' limit 1$q$, 1);

\echo '--- 春季リーグ：チームAの申込（同じ名簿から、別の背番号で）'
select test.login('team-a@example.com');
insert into teams (id, tournament_id, university_id, gender, region_id)
select '22222222-0000-0000-0000-000000000001', lg, 'aaaaaaaa-0000-0000-0000-000000000001', 'men', (select id from regions where tournament_id = lg) from ids;
select test.expect_count('部は登録どおり「男子2部」に自動で入る',
  $q$select 1 from teams t join divisions d on d.id = t.division_id where t.id = '22222222-0000-0000-0000-000000000001' and d.name = '男子2部'$q$, 1);
insert into entries (team_id, person_id, is_entry, number) values
  ('22222222-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', true, null),
  ('22222222-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', true, 10),
  ('22222222-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', true, 11);
select test.expect_count('同じ人に大会ごとの背番号（全日本7番・リーグ10番）',
  $q$select 1 from entries where person_id = 'c0000000-0000-0000-0000-000000000002' and number in (7, 10)$q$, 2);
select test.expect_fail('チームが部を自分で変える', $q$update teams set division_id = null where id = '22222222-0000-0000-0000-000000000001'$q$);
select submit_team('22222222-0000-0000-0000-000000000001');

\echo '--- 全日本の東北地区学連からは、リーグは見えない'
select test.login('region-tohoku@example.com');
select test.expect_count('リーグのチームは見えない', $q$select 1 from teams where id = '22222222-0000-0000-0000-000000000001'$q$, 0);
select test.expect_fail('リーグのチームを承認する', $q$select review_team('22222222-0000-0000-0000-000000000001', 'approve')$q$);

\echo '--- リーグの主催者（東北学連）'
select test.login('league-office@example.com');
select test.expect_count('リーグのチームだけが見える', $q$select 1 from teams$q$, 1);
select test.expect_count('全日本の所属者は見えない（リーグの所属だけ）', $q$select 1 from memberships where tournament_id = (select nat from ids)$q$, 0);
select review_team('22222222-0000-0000-0000-000000000001', 'approve');
select test.expect_count('1段階の承認で「事務局確認済」になる', $q$select 1 from teams where status = 'office_confirmed'$q$, 1);
select test.expect_fail('全日本の大会設定を変える（0件でなく拒否）',
  $q$do $d$ begin update tournaments set name = 'x' where id = (select nat from ids); if not found then raise exception '更新されなかった'; end if; end $d$$q$);

\echo '--- 締切後のロック'
reset role;
update tournaments set entry_deadline = now() - interval '1 day' where kind = 'national';
select set_config('app.trusted', 'on', false);
update teams set status = 'in_progress' where id = '11111111-0000-0000-0000-000000000001';
select set_config('app.trusted', '', false);
set role authenticated;
select test.login('team-a@example.com');
update entries set number = 50 where team_id = '11111111-0000-0000-0000-000000000001';
select test.expect_count('締切後は背番号を変更できない', $q$select 1 from entries where number = 50$q$, 0);
select test.expect_fail('締切後に提出', $q$select submit_team('11111111-0000-0000-0000-000000000001')$q$);
select test.expect_fail('チームが自分でロックを解除', $q$select unlock_team('11111111-0000-0000-0000-000000000001', now() + interval '1 day', 'x')$q$);
select test.login('office@example.com');
select test.expect_fail('理由なしでロック解除', $q$select unlock_team('11111111-0000-0000-0000-000000000001', now() + interval '1 day', '')$q$);
select unlock_team('11111111-0000-0000-0000-000000000001', now() + interval '1 day', '大学からの申し出により背番号を修正');
select test.login('team-a@example.com');
update entries set number = 50 where team_id = '11111111-0000-0000-0000-000000000001' and person_id = 'c0000000-0000-0000-0000-000000000002';
select test.expect_count('ロック解除中は背番号を直せる', $q$select 1 from entries where number = 50$q$, 1);

\echo '--- ログインしていない人'
reset role;
set role anon;
select set_config('request.jwt.claims', '', false);
select test.expect_fail('チームの表を読む（表の読み取り自体が拒否される）', $q$select 1 from public.teams$q$);
select test.expect_fail('部員名簿を読む', $q$select 1 from public.roster_people$q$);
reset role;
\echo 'すべてのテストに合格しました'
