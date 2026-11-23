-- =====================================================================
-- 令和9年度の大会（全日本学生選手権・春季東北学生リーグ）と、最初の事務局担当者
-- schema.sql のあとに1回だけ実行します。
--
-- 実行する前に、いちばん下の「ここにメールアドレス」「ここに氏名」を書き換えてください。
-- ※ 書き換えたこのファイルは、GitHub に保存（コミット）しないでください。
--
-- 日程・金額・人数の上限は仮の値です。あとで「大会の設定」画面から変更できます。
-- =====================================================================

-- 全日本学生選手権（2段階承認：地区学連 → 事務局）
with t as (
  insert into public.tournaments (name, short_name, kind, academic_year, organizer, review_flow, status, start_date, entry_deadline, settings, features)
  values (
    '令和9年度 全日本学生ハンドボール選手権大会', '全日本学生選手権', 'national', 2027, '全日本学生ハンドボール連盟', 'two_step', 'preparing',
    '2027-11-06', '2027-10-01 23:59:59+09',
    '{"limits":{"staffMax":6,"playerEntryMax":25,"benchStaffMax":5,"benchPlayerMax":16,"foreignEntryMax":3,"foreignGameEntryMax":2,"numberMin":1,"numberMax":99},"fees":{"entry":75000,"insurancePerPerson":500,"sponsorUniform":10000}}'::jsonb,
    '{"pamphlet":true,"insurance":true,"travel":true,"matches":false,"escort":true,"paper":true}'::jsonb
  )
  returning id
)
insert into public.regions (tournament_id, code, name, sort_order)
select t.id, r.code, r.name, r.sort_order
from t, (values
  ('hokkaido', '北海道', 1), ('tohoku', '東北', 2), ('kanto', '関東', 3), ('hokushinetsu', '北信越', 4),
  ('tokai', '東海', 5), ('kansai', '関西', 6), ('chushikoku', '中四国', 7), ('kyushu', '九州', 8)
) as r(code, name, sort_order);

-- 春季東北学生リーグ（1段階承認：東北学連）
with t as (
  insert into public.tournaments (name, short_name, kind, academic_year, season, organizer, review_flow, status, start_date, entry_deadline, settings, features)
  values (
    '令和9年度 春季東北学生ハンドボールリーグ', '春季リーグ', 'league', 2027, 'spring', '東北学生ハンドボール連盟', 'one_step', 'preparing',
    '2027-05-08', '2027-04-09 23:59:59+09',
    '{"limits":{"staffMax":6,"playerEntryMax":25,"benchStaffMax":5,"benchPlayerMax":16,"foreignEntryMax":3,"foreignGameEntryMax":2,"numberMin":1,"numberMax":99},"fees":{"entry":0,"insurancePerPerson":0,"sponsorUniform":0}}'::jsonb,
    '{"pamphlet":false,"insurance":false,"travel":false,"matches":true,"escort":false,"paper":false}'::jsonb
  )
  returning id
), r as (
  insert into public.regions (tournament_id, code, name, sort_order) select t.id, 'tohoku', '東北', 1 from t returning tournament_id
)
insert into public.divisions (tournament_id, gender, name, sort_order)
select r.tournament_id, d.gender, d.name, d.sort_order
from r, (values ('men', '男子1部', 1), ('men', '男子2部', 2), ('women', '女子', 3)) as d(gender, name, sort_order);

-- 最初の事務局担当者（両方の大会の事務局になります）
select public.bootstrap_office(id, 'ここにメールアドレス', 'ここに氏名')
from public.tournaments where academic_year = 2027;
