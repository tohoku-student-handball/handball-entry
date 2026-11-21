# 全日本学生ハンドボール選手権大会 ワンストップ申込システム

参加チーム・地区学連・大会事務局・指定旅行社が、1つのシステムで申込から手配までを完結させるためのシステムです。

## 資料（docs/）

| 資料 | 内容 |
|---|---|
| [01_要件定義書](docs/01_要件定義書.md) | 何を作るか（承認済み） |
| [02_技術選定](docs/02_技術選定.md) | Supabase＋Next.js を選んだ理由と費用（承認済み） |
| [03_データ設計](docs/03_データ設計.md) | データのつながり（ER図）と見られる範囲（承認済み） |
| [04_画面一覧](docs/04_画面一覧.md) | 画面の一覧と画面遷移図（承認済み） |
| [05_実装計画](docs/05_実装計画.md) | M1〜M5 の段階と時期（承認済み） |
| [06_M1_動作確認手順](docs/06_M1_動作確認手順.md) | 試作品の確認のしかた |
| [07_アカウント準備手順](docs/07_アカウント準備手順.md) | GitHub・Supabase・Vercel・Gmailの準備と引き継ぎ |
| [08_M2_本番環境の設定手順](docs/08_M2_本番環境の設定手順.md) | データベースの準備・メール設定・Vercelでの公開 |
| [09_M2_動作確認手順](docs/09_M2_動作確認手順.md) | M2（提出・承認・差し戻し・ロック・申込書）の確認のしかた |

## 開発（エンジニア向け）

```bash
npm install
npm run dev            # 開発用に起動（http://localhost:3000）
npm test               # ルール判定・写真検査の自動テスト
npm run build          # 本番用に書き出し（out/）
npm run preview:build  # デモ版を1つのHTMLにまとめる（preview/index.html）
# データベースの権限テスト（手元の PostgreSQL 16 が必要）
PGHOST=/tmp PGPORT=5432 PGUSER=postgres bash supabase/tests/run.sh
```

| フォルダ | 内容 |
|---|---|
| `src/lib/` | ルール判定・写真検査・データの窓口（デモ版／Supabase版） |
| `src/components/` | 画面 |
| `supabase/migrations/` | データベースの設計（表・権限・提出/承認の関数） |
| `supabase/seed_r9.sql` | 令和9年度大会の初期データ |
| `supabase/tests/` | データベースの権限テスト |
