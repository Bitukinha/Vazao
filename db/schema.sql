-- Esquema do banco (Neon / Postgres). Idempotente: pode rodar várias vezes.
create table if not exists cadastros (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('dhz', 'moinho', 'responsavel')),
  nome text not null,
  created_at timestamptz not null default now(),
  unique (tipo, nome)
);

create table if not exists registros_producao (
  id uuid primary key default gen_random_uuid(),
  data date not null default current_date,
  hora time not null default current_time,
  dhz numeric,
  dhz_nome text,
  dureza_milho numeric,
  agua_adicionada numeric,
  amp numeric,
  vazao_canjica numeric,
  vazao_germen numeric,
  vazao_milho numeric,
  pct_germen numeric,
  prod_final text,
  nome_resp text not null,
  created_at timestamptz not null default now()
);

create table if not exists registros_moinho (
  id uuid primary key default gen_random_uuid(),
  data date not null default current_date,
  hora time not null default current_time,
  moinho text not null,
  set_point numeric,
  vazao numeric,
  produto text,
  nome_resp text not null,
  created_at timestamptz not null default now()
);

create index if not exists registros_producao_data_idx on registros_producao (data desc, hora desc);
create index if not exists registros_moinho_data_idx on registros_moinho (data desc, hora desc);
