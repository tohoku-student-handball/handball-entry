-- =====================================================================
-- 令和9年度大会の初期データ（初期設定 20261121000000_init.sql のあとに1回だけ実行）
--
-- 実行する前に、いちばん下の「ここにメールアドレス」「ここに氏名」を
-- 最初の事務局担当者のものに書き換えてください。
-- ※ 書き換えたこのファイルは、GitHub に保存（コミット）しないでください。
--
-- 日程・金額はR8年度要項の値の仮置きです。あとで管理画面から変更できます。
-- =====================================================================

with t as (
  insert into public.tournaments (name, year, status, start_date, entry_deadline, settings)
  values (
    '令和9年度 全日本学生ハンドボール選手権大会',
    2027,
    'preparing',
    '2027-11-06',
    '2027-10-01 23:59:59+09',
    '{"limits":{"staffMax":6,"playerEntryMax":25,"benchStaffMax":5,"benchPlayerMax":16,"foreignEntryMax":3,"foreignGameEntryMax":2,"numberMin":1,"numberMax":99},"fees":{"entry":75000,"insurancePerPerson":500,"sponsorUniform":10000},"adultAge":18,"images":{"face":{"types":["image/jpeg","image/png"],"minShortSide":600,"aspect":{"w":3,"h":4},"maxMB":10,"storeLongSide":1600},"group":{"types":["image/jpeg","image/png"],"minShortSide":1200,"aspect":null,"maxMB":20,"storeLongSide":3000},"logo":{"types":["image/jpeg","image/png"],"minShortSide":600,"aspect":null,"maxMB":10,"storeLongSide":2000}},"textLimits":{"name":10,"highSchool":14,"faculty":10,"teamComment":120}}'::jsonb
  )
  returning id
)
insert into public.regions (tournament_id, code, name, sort_order)
select t.id, r.code, r.name, r.sort_order
from t, (values
  ('hokkaido', '北海道', 1),
  ('tohoku', '東北', 2),
  ('kanto', '関東', 3),
  ('hokushinetsu', '北信越', 4),
  ('tokai', '東海', 5),
  ('kansai', '関西', 6),
  ('chushikoku', '中四国', 7),
  ('kyushu', '九州', 8)
) as r(code, name, sort_order);

-- 最初の事務局担当者（このメールアドレスでログインすると事務局の画面が開きます）
select public.bootstrap_office(
  (select id from public.tournaments where year = 2027),
  'ここにメールアドレス',
  'ここに氏名'
);
