# Setup Supabase (โหมดออนไลน์: ทุกคนเพิ่ม/แก้/ลบได้)

> ถ้าไม่ตั้งค่า Supabase เว็บไซต์จะยังใช้งานได้แบบ localStorage (เครื่องใครเครื่องมัน) และจะไม่จอขาว

## 1) สร้าง Project
- Supabase -> New project

## 2) สร้าง Table: recipes (ID เป็น TEXT)
ไปที่ SQL Editor แล้ว Run:

```sql
create table if not exists public.recipes (
  id text primary key,
  title text not null,
  category text not null,
  time int4 not null default 0,
  difficulty text not null default 'ง่าย',
  img text,
  ingredients jsonb not null default '[]'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.recipes enable row level security;

create policy "public read recipes"
on public.recipes for select
to anon
using (true);

create policy "public insert recipes"
on public.recipes for insert
to anon
with check (true);

create policy "public update recipes"
on public.recipes for update
to anon
using (true)
with check (true);

create policy "public delete recipes"
on public.recipes for delete
to anon
using (true);
```

## 3) ใส่ค่าใน supabase-config.js
Supabase -> Project Settings -> API
- Project URL
- anon public key

นำมาใส่ในไฟล์ `supabase-config.js`

## 4) Deploy
- GitHub Pages (หรือ Netlify) ได้เลย
