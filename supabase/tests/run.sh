#!/usr/bin/env bash
# データベースのテストを、手元の PostgreSQL で実行する（エンジニア向け）。
# 使い方：PGHOST=/tmp PGPORT=5499 PGUSER=postgres bash supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
P="psql -v ON_ERROR_STOP=1 -q"
$P -d postgres -c "drop database if exists hb_test" -c "create database hb_test"
$P -d hb_test -f supabase/tests/stub_supabase.sql
$P -d hb_test -f supabase/schema.sql 2>&1 | grep -v "does not exist, skipping" || true
# 2回実行しても壊れないこと（作り直しの確認）
$P -d hb_test -f supabase/schema.sql 2>&1 | grep -v "does not exist, skipping" || true
sed "s/ここにメールアドレス/office@example.com/; s/ここに氏名/事務局 太郎/" supabase/seed.sql | $P -d hb_test >/dev/null
$P -d hb_test -f supabase/tests/rls_test.sql 2>&1 | grep -E "NOTICE|NG|ERROR|合格|^--- " | sed 's/^psql:[^ ]* //'
