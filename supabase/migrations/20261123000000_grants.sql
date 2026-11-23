-- =====================================================================
-- ログインした人（authenticated）に、表と関数を使う許可を与える。
-- 新しい Supabase プロジェクトでは、SQL で作った表にこの許可が自動でつかない場合があるため。
-- 実際に「誰がどの行を見られるか」は、初期設定の行レベルセキュリティ（RLS）で制限されている。
-- 何度実行しても問題ない。
-- =====================================================================

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- 今後この設定文で追加する表・関数にも、同じ許可をつける
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant usage, select on sequences to authenticated;
alter default privileges in schema public grant execute on functions to authenticated;

-- 最初の事務局担当者の登録（bootstrap_office）は、ログインした人には使わせない
revoke execute on function public.bootstrap_office(uuid, text, text) from public, anon, authenticated;

-- ログインしていない人（anon）には、表を一切使わせない
revoke all on all tables in schema public from anon;
