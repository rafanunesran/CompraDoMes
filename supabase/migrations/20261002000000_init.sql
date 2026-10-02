-- CompraDoMes — esquema inicial (fase 1)
-- Tudo é separado por "casa" (household); cada tabela tem household_id e RLS
-- que só libera acesso para membros da casa.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Casas e membros
-- ---------------------------------------------------------------------------
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default upper(substr(md5(random()::text), 1, 6)),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  display_name text,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create or replace function public.is_member(h uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from household_members where household_id = h and user_id = auth.uid()
  );
$$;

create or replace function public.is_admin(h uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from household_members
    where household_id = h and user_id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.create_household(p_name text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into households (name, created_by) values (p_name, auth.uid()) returning id into new_id;
  insert into household_members (household_id, user_id, role, display_name)
  values (new_id, auth.uid(), 'admin', p_display_name);
  return new_id;
end;
$$;

create or replace function public.join_household(p_code text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  h_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select id into h_id from households where invite_code = upper(trim(p_code));
  if h_id is null then
    raise exception 'código de convite inválido';
  end if;
  insert into household_members (household_id, user_id, role, display_name)
  values (h_id, auth.uid(), 'member', p_display_name)
  on conflict (household_id, user_id) do nothing;
  return h_id;
end;
$$;

alter table public.households enable row level security;
alter table public.household_members enable row level security;

create policy "membros veem a casa" on public.households
  for select using (public.is_member(id));
create policy "admin edita a casa" on public.households
  for update using (public.is_admin(id)) with check (public.is_admin(id));
create policy "admin apaga a casa" on public.households
  for delete using (public.is_admin(id));

create policy "membros veem membros" on public.household_members
  for select using (public.is_member(household_id));
create policy "membro edita o próprio nome" on public.household_members
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "sair ou admin remove" on public.household_members
  for delete using (user_id = auth.uid() or public.is_admin(household_id));

-- ---------------------------------------------------------------------------
-- Mercados e produtos
-- ---------------------------------------------------------------------------
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  cnpj text,
  address text,
  created_at timestamptz not null default now(),
  unique (household_id, cnpj)
);

-- Produto genérico: é o que vai na lista ("Arroz branco tipo 1").
create table public.products (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  category text not null default 'Outros',
  base_unit text not null default 'un' check (base_unit in ('un', 'kg', 'l')),
  created_at timestamptz not null default now()
);
create unique index products_household_name_idx on public.products (household_id, lower(name));

-- Produto específico (marca + embalagem + EAN): "Arroz Camil 5kg".
create table public.skus (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  brand text,
  ean text,
  package_qty numeric,
  package_unit text check (package_unit in ('un', 'g', 'kg', 'ml', 'l')),
  created_at timestamptz not null default now()
);
create index skus_product_idx on public.skus (product_id);

-- ---------------------------------------------------------------------------
-- Listas do mês
-- ---------------------------------------------------------------------------
create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  month date not null, -- sempre o dia 1 do mês
  created_at timestamptz not null default now(),
  unique (household_id, month)
);

create table public.list_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  list_id uuid not null references public.shopping_lists (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  quantity numeric not null default 1,
  note text,
  checked boolean not null default false,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (list_id, product_id)
);

-- ---------------------------------------------------------------------------
-- Compras
-- ---------------------------------------------------------------------------
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete restrict,
  list_id uuid references public.shopping_lists (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'done')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_by uuid references auth.users (id) on delete set null default auth.uid()
);
create index purchases_household_idx on public.purchases (household_id, started_at desc);

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  purchase_id uuid not null references public.purchases (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  sku_id uuid references public.skus (id) on delete set null,
  list_item_id uuid references public.list_items (id) on delete set null,
  quantity numeric not null default 1,
  unit_price numeric not null check (unit_price >= 0),
  package_qty numeric,
  package_unit text check (package_unit in ('un', 'g', 'kg', 'ml', 'l')),
  created_at timestamptz not null default now()
);
create index purchase_items_purchase_idx on public.purchase_items (purchase_id);

-- ---------------------------------------------------------------------------
-- Observações de preço: base de toda comparação.
-- Geradas automaticamente a partir de purchase_items, ou registradas à mão.
-- ---------------------------------------------------------------------------
create table public.price_observations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  sku_id uuid references public.skus (id) on delete set null,
  store_id uuid not null references public.stores (id) on delete cascade,
  price numeric not null check (price >= 0),
  package_qty numeric,
  package_unit text check (package_unit in ('un', 'g', 'kg', 'ml', 'l')),
  unit_price_normalized numeric,
  observed_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'purchase', 'nfce', 'ocr')),
  purchase_item_id uuid unique references public.purchase_items (id) on delete cascade
);
create index price_obs_product_idx on public.price_observations (product_id, store_id, observed_at desc);

-- Preço por kg / litro / unidade, para comparar embalagens diferentes.
-- Mantenha em sincronia com src/lib/units.ts.
create or replace function public.normalize_unit_price(
  p_price numeric, p_qty numeric, p_unit text, p_base text
) returns numeric
language sql
immutable
as $$
  select case
    when p_qty is null or p_qty <= 0 or p_unit is null then p_price
    when p_base = 'kg' and p_unit = 'g' then p_price / (p_qty / 1000)
    when p_base = 'kg' and p_unit = 'kg' then p_price / p_qty
    when p_base = 'l' and p_unit = 'ml' then p_price / (p_qty / 1000)
    when p_base = 'l' and p_unit = 'l' then p_price / p_qty
    when p_base = 'un' and p_unit = 'un' then p_price / p_qty
    else null
  end;
$$;

create or replace function public.set_price_normalized()
returns trigger
language plpgsql
as $$
begin
  new.unit_price_normalized := public.normalize_unit_price(
    new.price, new.package_qty, new.package_unit,
    (select base_unit from public.products where id = new.product_id)
  );
  return new;
end;
$$;

create trigger price_observations_normalize
  before insert or update on public.price_observations
  for each row execute function public.set_price_normalized();

-- Se a unidade de comparação do produto mudar, recalcula os preços normalizados.
create or replace function public.renormalize_product_prices()
returns trigger
language plpgsql
as $$
begin
  update public.price_observations set price = price where product_id = new.id;
  return new;
end;
$$;

create trigger products_base_unit_changed
  after update of base_unit on public.products
  for each row when (old.base_unit is distinct from new.base_unit)
  execute function public.renormalize_product_prices();

create or replace function public.sync_price_from_purchase_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
begin
  select store_id, started_at into p from purchases where id = new.purchase_id;
  insert into price_observations (
    household_id, product_id, sku_id, store_id, price, package_qty, package_unit,
    observed_at, source, purchase_item_id
  ) values (
    new.household_id, new.product_id, new.sku_id, p.store_id, new.unit_price,
    new.package_qty, new.package_unit, p.started_at, 'purchase', new.id
  )
  on conflict (purchase_item_id) do update set
    product_id = excluded.product_id,
    sku_id = excluded.sku_id,
    price = excluded.price,
    package_qty = excluded.package_qty,
    package_unit = excluded.package_unit;
  return new;
end;
$$;

create trigger purchase_items_price
  after insert or update on public.purchase_items
  for each row execute function public.sync_price_from_purchase_item();

-- Último preço de cada produto em cada mercado.
create view public.latest_prices with (security_invoker = true) as
select distinct on (o.product_id, o.store_id)
  o.household_id, o.product_id, o.store_id, o.sku_id, o.price,
  o.package_qty, o.package_unit, o.unit_price_normalized, o.observed_at, o.source
from public.price_observations o
order by o.product_id, o.store_id, o.observed_at desc;

-- Totais de cada compra.
create view public.purchase_summaries with (security_invoker = true) as
select
  p.id, p.household_id, p.store_id, p.list_id, p.status, p.started_at, p.finished_at, p.created_by,
  coalesce(sum(i.quantity * i.unit_price), 0) as total,
  count(i.id) as item_count
from public.purchases p
left join public.purchase_items i on i.purchase_id = p.id
group by p.id;

-- ---------------------------------------------------------------------------
-- RLS para tabelas de dados da casa
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'stores', 'products', 'skus', 'shopping_lists', 'list_items',
    'purchases', 'purchase_items', 'price_observations'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "membros da casa" on public.%I for all using (public.is_member(household_id)) with check (public.is_member(household_id))',
      t
    );
  end loop;
end;
$$;

-- Lista compartilhada em tempo real.
alter publication supabase_realtime add table public.list_items, public.purchase_items;
