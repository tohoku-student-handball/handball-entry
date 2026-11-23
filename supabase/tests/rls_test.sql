-- 権限設定（RLS）と提出・承認の流れのテスト。
-- stub_supabase.sql → migrations → seed のあとに実行する。本番では実行しない。
\set ON_ERROR_STOP 1
\set QUIET 1

create schema test;
grant usage on schema test to authenticated, anon;
-- 失敗するはずの操作が、本当に失敗するかを確かめる
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
grant execute on all functions in schema test to authenticated, anon;

create function test.login(email text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('email', email)::text, false);
$$;
grant execute on function test.login(text) to authenticated;

-- 準備（管理者として）
insert into universities (id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '東北テスト大学'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '関東テスト大学');
insert into tournament_universities (tournament_id, university_id, region_id)
select t.id, 'aaaaaaaa-0000-0000-0000-000000000001', r.id from tournaments t join regions r on r.tournament_id = t.id and r.code = 'tohoku';
insert into tournament_universities (tournament_id, university_id, region_id)
select t.id, 'bbbbbbbb-0000-0000-0000-000000000002', r.id from tournaments t join regions r on r.tournament_id = t.id and r.code = 'kanto';
insert into memberships (tournament_id, email, role, university_id)
select id, 'team-a@example.com', 'team', 'aaaaaaaa-0000-0000-0000-000000000001' from tournaments;
insert into memberships (tournament_id, email, role, university_id)
select id, 'team-b@example.com', 'team', 'bbbbbbbb-0000-0000-0000-000000000002' from tournaments;
insert into memberships (tournament_id, email, role, region_id)
select t.id, 'region-tohoku@example.com', 'region', r.id from tournaments t join regions r on r.tournament_id = t.id and r.code = 'tohoku';
insert into memberships (tournament_id, email, role, region_id)
select t.id, 'region-kanto@example.com', 'region', r.id from tournaments t join regions r on r.tournament_id = t.id and r.code = 'kanto';

set role authenticated;

\echo '--- チームAの担当者'
select test.login('team-a@example.com');
insert into teams (id, tournament_id, university_id, gender, region_id)
select '11111111-0000-0000-0000-000000000001', t.id, 'aaaaaaaa-0000-0000-0000-000000000001', 'men', r.id
from tournaments t join regions r on r.tournament_id = t.id and r.code = 'kanto';  -- わざと違う地区を指定
select test.expect_count('チームAの地区は登録済みの東北に自動で直る',
  $q$select 1 from teams t join regions r on r.id = t.region_id where r.code = 'tohoku'$q$, 1);
select test.expect_fail('他大学（関東テスト大学）のチームを作る',
  $q$insert into teams (tournament_id, university_id, gender, region_id)
     select tournament_id, 'bbbbbbbb-0000-0000-0000-000000000002', 'men', region_id from teams limit 1$q$);
insert into members (team_id, kind, name, is_entry, number) values
  ('11111111-0000-0000-0000-000000000001', 'staff', '監督', true, null),
  ('11111111-0000-0000-0000-000000000001', 'player', '選手1', true, 7),
  ('11111111-0000-0000-0000-000000000001', 'player', '選手2', true, 7);
select test.expect_count('名簿を入れるとチームは「入力中」', $q$select 1 from teams where status = 'in_progress'$q$, 1);
select test.expect_fail('チームが自分で状態を「承認済」にする',
  $q$update teams set status = 'region_approved'$q$);
select test.expect_fail('背番号が重複したまま提出',
  $q$select submit_team('11111111-0000-0000-0000-000000000001')$q$);
update members set number = 8 where name = '選手2';
insert into storage.objects (bucket_id, name) values ('team-files', '11111111-0000-0000-0000-000000000001/photo1.jpg');
select submit_team('11111111-0000-0000-0000-000000000001');
select test.expect_count('提出後は「提出済」', $q$select 1 from teams where status = 'submitted'$q$, 1);
select test.expect_count('提出後は名簿を変更できない（0件更新）', $q$select 1 from members where false$q$, 0);
update members set name = '変更' where name = '選手1';
select test.expect_count('提出後の名簿変更は反映されない', $q$select 1 from members where name = '変更'$q$, 0);
select test.expect_fail('提出後に写真を追加',
  $q$insert into storage.objects (bucket_id, name) values ('team-files', '11111111-0000-0000-0000-000000000001/photo2.jpg')$q$);
select test.expect_count('自分の所属だけ見える', $q$select 1 from memberships$q$, 1);
select test.expect_count('変更履歴は見えない', $q$select 1 from audit_logs$q$, 0);

\echo '--- チームBの担当者'
select test.login('team-b@example.com');
select test.expect_count('チームAは見えない', $q$select 1 from teams$q$, 0);
select test.expect_count('チームAの名簿は見えない', $q$select 1 from members$q$, 0);
select test.expect_count('チームAの写真は見えない', $q$select 1 from storage.objects$q$, 0);
select test.expect_fail('チームAに写真を入れる',
  $q$insert into storage.objects (bucket_id, name) values ('team-files', '11111111-0000-0000-0000-000000000001/x.jpg')$q$);
select test.expect_fail('ファイル名が不正な写真を入れる',
  $q$insert into storage.objects (bucket_id, name) values ('team-files', 'not-a-team/x.jpg')$q$);

\echo '--- 関東の地区学連'
select test.login('region-kanto@example.com');
select test.expect_count('東北のチームは見えない', $q$select 1 from teams$q$, 0);
select test.expect_fail('他地区のチームの原本到着を記録する',
  $q$select set_paper_status('11111111-0000-0000-0000-000000000001', 'received')$q$);
select test.expect_fail('東北のチームを承認する',
  $q$select review_team('11111111-0000-0000-0000-000000000001', 'approve')$q$);

\echo '--- 東北の地区学連'
select test.login('region-tohoku@example.com');
select test.expect_count('自地区のチームが見える', $q$select 1 from teams$q$, 1);
select test.expect_count('自地区の名簿が見える', $q$select 1 from members$q$, 3);
select test.expect_count('自地区の写真が見える', $q$select 1 from storage.objects$q$, 1);
select test.expect_fail('地区学連が名簿を書き換える（0件でなく拒否されるか）',
  $q$insert into members (team_id, kind, name) values ('11111111-0000-0000-0000-000000000001', 'player', 'x')$q$);
select test.expect_fail('理由なしで差し戻す',
  $q$select review_team('11111111-0000-0000-0000-000000000001', 'return', '')$q$);
select review_team('11111111-0000-0000-0000-000000000001', 'return', '選手2の背番号を確認してください');
select test.expect_fail('地区学連が事務局確認をする',
  $q$select review_team('11111111-0000-0000-0000-000000000001', 'confirm')$q$);

\echo '--- チームA：差し戻し後に直して再提出'
select test.login('team-a@example.com');
select test.expect_count('差し戻しコメントが見える', $q$select 1 from review_comments where action = 'return'$q$, 1);
update members set number = 9 where name = '選手2';
select test.expect_count('差し戻し中は名簿を直せる', $q$select 1 from members where number = 9$q$, 1);
select submit_team('11111111-0000-0000-0000-000000000001');

select set_paper_status('11111111-0000-0000-0000-000000000001', 'sent');
select test.expect_fail('チームが自分で「到着確認済」にする',
  $q$select set_paper_status('11111111-0000-0000-0000-000000000001', 'received')$q$);

\echo '--- 東北の地区学連：承認'
select test.login('region-tohoku@example.com');
select review_team('11111111-0000-0000-0000-000000000001', 'approve');
select set_paper_status('11111111-0000-0000-0000-000000000001', 'received');
select test.expect_count('地区学連が原本の到着を記録できる', $q$select 1 from teams where paper_status = 'received'$q$, 1);
select test.expect_fail('承認後に地区学連が差し戻す',
  $q$select review_team('11111111-0000-0000-0000-000000000001', 'return', '再確認')$q$);

\echo '--- 事務局'
select test.login('office@example.com');
select test.expect_count('全チームが見える', $q$select 1 from teams$q$, 1);
select test.expect_count('全員の所属が見える', $q$select 1 from memberships$q$, 5);
select review_team('11111111-0000-0000-0000-000000000001', 'confirm');
select test.expect_count('事務局確認済', $q$select 1 from teams where status = 'office_confirmed'$q$, 1);
select test.expect_count('変更履歴が見える（1件以上）', $q$select 1 from audit_logs limit 1$q$, 1);
select test.expect_count('変更履歴に操作した人が記録される', $q$select 1 from audit_logs where actor_email = 'team-a@example.com' limit 1$q$, 1);

\echo '--- 締切後のロック'
reset role;
update tournaments set entry_deadline = now() - interval '1 day';
update teams set status = 'in_progress';
set role authenticated;
select test.login('team-a@example.com');
update members set name = '締切後' where name = '選手1';
select test.expect_count('締切後は名簿を変更できない', $q$select 1 from members where name = '締切後'$q$, 0);
select test.expect_fail('締切後に提出', $q$select submit_team('11111111-0000-0000-0000-000000000001')$q$);
select test.login('team-a@example.com');
select test.expect_fail('チームが自分でロックを解除', $q$select unlock_team('11111111-0000-0000-0000-000000000001', now() + interval '1 day', 'x')$q$);
select test.login('office@example.com');
select test.expect_fail('理由なしでロック解除', $q$select unlock_team('11111111-0000-0000-0000-000000000001', now() + interval '1 day', '')$q$);
select unlock_team('11111111-0000-0000-0000-000000000001', now() + interval '1 day', '大学からの申し出により背番号を修正');
select test.login('team-a@example.com');
update members set name = '解除中に修正' where name = '選手1';
select test.expect_count('ロック解除中は名簿を直せる', $q$select 1 from members where name = '解除中に修正'$q$, 1);

\echo '--- ログインしていない人'
reset role;
set role anon;
select set_config('request.jwt.claims', '', false);
select test.expect_fail('チームの表を読む（表の読み取り自体が拒否される）', $q$select 1 from public.teams$q$);
reset role;
\echo 'すべてのテストに合格しました'
