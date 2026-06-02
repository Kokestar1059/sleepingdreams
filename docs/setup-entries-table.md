# entries テーブル + RLS セットアップ手順（#12）

`useEntries` を localStorage から Supabase に切り替えるための **DB 側の一度きりの設定**。
Supabase ダッシュボードの **SQL Editor** に下の SQL を貼って実行する。

> 設計方針（[[project-phase2-progress]] で確定済み）:
> - `user_id` は **`default auth.uid()`** にして、クライアントから送らなくても自動で「今ログイン中の人」が入る。
> - RLS は **`authenticated` ロールにだけ** 許可。`anon`（未ログイン）には一切権限を渡さない（多層防御）。
> - ポリシー条件は `(select auth.uid()) = user_id`。`select` で包むのは Supabase 公式のパフォーマンス推奨形
>   （行ごとに関数を呼ばず 1 回で済む）。`to authenticated` を付けると anon では評価自体スキップされる。

---

## 1. SQL Editor で実行する

```sql
-- ① テーブル作成 -----------------------------------------------------------
create table public.entries (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  entry_date date        not null,
  title      text        not null default '',
  body       text        not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 日付フィルタ（その日の一覧）と、ユーザー単位の取得を速くする索引。
create index entries_user_date_idx on public.entries (user_id, entry_date);

-- ② RLS を有効化 -----------------------------------------------------------
-- これを有効にすると「ポリシーで明示的に許可した行」以外は読めも書けもできなくなる。
alter table public.entries enable row level security;

-- ③ authenticated ロールにだけテーブル権限を付与（anon には付けない） ----------
-- RLS はあくまで「行」の制御。テーブルに触れる前提の GRANT は別途必要。
grant select, insert, update, delete on public.entries to authenticated;

-- ④ ポリシー：自分の行だけ select / insert / update / delete できる ----------
-- select: 自分の user_id の行だけ見える
create policy "entries_select_own" on public.entries
  for select to authenticated
  using ( (select auth.uid()) = user_id );

-- insert: 挿入する行の user_id が自分であること（with check は「書き込む値」の検証）
create policy "entries_insert_own" on public.entries
  for insert to authenticated
  with check ( (select auth.uid()) = user_id );

-- update: 対象行が自分のもので（using）、更新後も自分のままであること（with check）
create policy "entries_update_own" on public.entries
  for update to authenticated
  using ( (select auth.uid()) = user_id )
  with check ( (select auth.uid()) = user_id );

-- delete: 自分の行だけ削除できる
create policy "entries_delete_own" on public.entries
  for delete to authenticated
  using ( (select auth.uid()) = user_id );
```

---

## 2. Data API に公開する（テーブルを REST/JS から触れるようにする）

メモリの方針で「Automatically expose new tables = OFF」にしているため、
新規テーブルは手動で公開する必要がある。

- 「Project Settings」→「Data API」→ **Exposed schemas** に `public` が含まれていることを確認。
- もし「テーブル単位の公開設定」がある UI なら `entries` を公開対象にする。
  （多くの場合 `public` スキーマ公開 + 上の GRANT で JS クライアントから触れるようになる）

> public スキーマを公開しても、未ログイン(anon)には GRANT も RLS ポリシーも無いので
> entries は読めない。公開＝誰でも読める、ではない点に注意（守りは GRANT + RLS の二重）。

---

## 3. 動作確認チェックリスト

- [ ] ログイン後、カレンダーが表示される（初回は空）
- [ ] エントリーを作成 → 即座にカレンダーにドットが付く（楽観的更新）
- [ ] リロードしても残っている（= Supabase に保存されている）
- [ ] 編集・削除が反映される
- [ ] Supabase ダッシュボードの「Table Editor」→ entries に行が見える（user_id が自分のIDで入っている）
- [ ] （任意）別アカウントでログインすると、相手のエントリーは一切見えない（RLS が効いている証拠）

---

## やり直したい場合（開発中のリセット）

```sql
-- テーブルを丸ごと作り直す（中のデータも消える点に注意）
drop table if exists public.entries cascade;
-- そのあと上の ①〜④ を再実行
```
