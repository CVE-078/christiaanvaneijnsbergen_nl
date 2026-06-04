alter table profiles add column if not exists sex text check (sex in ('male','female'));
