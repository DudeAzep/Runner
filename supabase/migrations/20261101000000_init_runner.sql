-- ============================================================================
-- RUNNER — initial schema
-- Curated Solana memecoin rewards ecosystem.
--
-- Money is stored as integer USDC cents (bigint). Token quantities use
-- numeric(38, 9) / numeric(38, 0) so nothing is lost to floating point.
-- Campaign allocations (70 / 20 / 10) are GENERATED columns, so the database
-- itself guarantees they are always consistent with the campaign fee.
-- ============================================================================

-- gen_random_uuid() is built into PostgreSQL 13+ (Supabase runs 15+); no extension required.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('holder', 'project', 'admin');
create type public.application_status as enum ('submitted', 'under_review', 'approved', 'rejected');
create type public.campaign_package as enum ('starter', 'growth', 'featured');
create type public.campaign_status as enum ('upcoming', 'active', 'completed', 'cancelled');
create type public.risk_level as enum ('low', 'moderate', 'elevated', 'high');
create type public.screening_recommendation as enum ('approve', 'reject', 'needs_info');
create type public.distribution_status as enum ('simulated', 'pending', 'confirmed', 'failed');
create type public.purchase_status as enum ('simulated', 'pending', 'confirmed');
create type public.payment_status as enum ('test_mode_simulated', 'unpaid');

-- ---------------------------------------------------------------------------
-- Validation helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_solana_address(v text)
returns boolean language sql immutable parallel safe as $$
  select v is not null and v ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
$$;

create or replace function public.is_solana_signature(v text)
returns boolean language sql immutable parallel safe as $$
  select v is not null and v ~ '^[1-9A-HJ-NP-Za-km-z]{64,88}$'
$$;

create or replace function public.campaign_package_fee_cents(p public.campaign_package)
returns bigint language sql immutable parallel safe as $$
  select case p
    when 'starter'  then 50000::bigint   -- $500 USDC
    when 'growth'   then 100000::bigint  -- $1,000 USDC
    when 'featured' then 250000::bigint  -- $2,500 USDC
  end
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- USERS
-- ---------------------------------------------------------------------------
create table public.users (
  id              uuid primary key default gen_random_uuid(),
  auth_user_id    uuid unique references auth.users (id) on delete set null,
  wallet_address  text unique check (wallet_address is null or public.is_solana_address(wallet_address)),
  role            public.user_role not null default 'holder',
  created_at      timestamptz not null default now(),
  constraint users_identity_present check (auth_user_id is not null or wallet_address is not null)
);
comment on table public.users is 'Platform users. Admin role is granted only via SQL / service role, never from the client.';

create index users_role_idx on public.users (role);

-- Security-definer helper used by RLS policies. search_path pinned to avoid hijacking.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.users u
    where u.auth_user_id = auth.uid() and u.role = 'admin'
  )
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- APPLICATIONS
-- ---------------------------------------------------------------------------
create table public.applications (
  id                  uuid primary key default gen_random_uuid(),
  reference           text not null unique check (reference ~ '^RUN-[A-Z0-9]{6}$'),
  project_name        text not null check (char_length(project_name) between 2 and 60),
  ticker              text not null check (ticker ~ '^[A-Z0-9]{2,10}$'),
  contract_address    text not null check (public.is_solana_address(contract_address)),
  website             text not null check (website ~ '^https://'),
  twitter             text not null check (twitter = '' or twitter ~ '^https://(www\.)?(x|twitter)\.com/'),
  telegram            text not null check (telegram = '' or telegram ~ '^https://(www\.)?(t|telegram)\.me/'),
  discord             text not null check (discord = '' or discord ~ '^https://(www\.)?discord\.(gg|com)/'),
  description         text not null check (char_length(description) between 20 and 2000),
  applicant_wallet    text not null check (public.is_solana_address(applicant_wallet)),
  campaign_package    public.campaign_package not null,
  application_status  public.application_status not null default 'submitted',
  payment_status      public.payment_status not null default 'test_mode_simulated',
  is_demo             boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
comment on column public.applications.payment_status is 'MVP: payments are simulated (TEST MODE). No real funds are collected.';

create index applications_status_idx on public.applications (application_status, created_at desc);
create index applications_created_idx on public.applications (created_at desc);
create index applications_contract_idx on public.applications (contract_address);
-- Only one open application per token at a time.
create unique index applications_one_open_per_contract
  on public.applications (contract_address)
  where application_status in ('submitted', 'under_review');

create trigger applications_updated_at before update on public.applications
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- SCREENING
-- ---------------------------------------------------------------------------
create table public.screening (
  id                          uuid primary key default gen_random_uuid(),
  application_id              uuid not null unique references public.applications (id) on delete cascade,
  liquidity_score             smallint not null check (liquidity_score between 0 and 10),
  holder_distribution_score   smallint not null check (holder_distribution_score between 0 and 10),
  developer_activity_score    smallint not null check (developer_activity_score between 0 and 10),
  community_score             smallint not null check (community_score between 0 and 10),
  trading_activity_score      smallint not null check (trading_activity_score between 0 and 10),
  token_authorities_score     smallint not null check (token_authorities_score between 0 and 10),
  tokenomics_score            smallint not null check (tokenomics_score between 0 and 10),
  manipulation_score          smallint not null check (manipulation_score between 0 and 10),
  market_cap_usd              numeric(20, 2) check (market_cap_usd >= 0),
  liquidity_usd               numeric(20, 2) check (liquidity_usd >= 0),
  holder_count                integer check (holder_count >= 0),
  top10_holder_pct            numeric(5, 2) check (top10_holder_pct between 0 and 100),
  mint_authority_revoked      boolean,
  freeze_authority_revoked    boolean,
  risk_flags                  text[] not null default '{}' check (cardinality(risk_flags) <= 20),
  screening_notes             text not null default '' check (char_length(screening_notes) <= 5000),
  recommendation              public.screening_recommendation not null,
  risk_level                  public.risk_level not null,
  reviewed_by                 uuid references public.users (id) on delete set null,
  reviewer_label              text not null default '',
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index screening_risk_idx on public.screening (risk_level);
create index screening_reviewed_by_idx on public.screening (reviewed_by);

create trigger screening_updated_at before update on public.screening
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- CAMPAIGNS
-- ---------------------------------------------------------------------------
create table public.campaigns (
  id                          uuid primary key default gen_random_uuid(),
  slug                        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  application_id              uuid unique references public.applications (id) on delete restrict,
  project_name                text not null check (char_length(project_name) between 2 and 60),
  ticker                      text not null check (ticker ~ '^[A-Z0-9]{2,10}$'),
  token_address               text not null check (public.is_solana_address(token_address)),
  description                 text not null default '',
  website                     text not null default '',
  twitter                     text not null default '',
  telegram                    text not null default '',
  discord                     text not null default '',
  campaign_package            public.campaign_package not null,
  -- All allocation amounts are USDC cents.
  total_campaign_fee          bigint not null check (total_campaign_fee > 0),
  reward_allocation           bigint generated always as ((total_campaign_fee * 7000) / 10000) stored,
  operations_allocation       bigint generated always as ((total_campaign_fee * 2000) / 10000) stored,
  reserve_allocation          bigint generated always as (
                                total_campaign_fee - (total_campaign_fee * 7000) / 10000 - (total_campaign_fee * 2000) / 10000
                              ) stored,
  campaign_status             public.campaign_status not null default 'upcoming',
  featured                    boolean not null default false,
  risk_level                  public.risk_level not null,
  screening_date              timestamptz not null,
  market_cap_at_screening_usd numeric(20, 2) check (market_cap_at_screening_usd >= 0),
  liquidity_at_screening_usd  numeric(20, 2) check (liquidity_at_screening_usd >= 0),
  holder_count_at_screening   integer check (holder_count_at_screening >= 0),
  snapshot_at                 timestamptz,
  eligible_supply             numeric(38, 0) check (eligible_supply > 0),
  is_demo                     boolean not null default false,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  constraint campaigns_fee_matches_package check (total_campaign_fee = public.campaign_package_fee_cents(campaign_package))
);
comment on column public.campaigns.total_campaign_fee is 'USDC cents. reward/operations/reserve are generated 70/20/10 splits (reserve takes rounding remainder).';
comment on column public.campaigns.eligible_supply is 'Eligible RUNNER supply at the snapshot (whole tokens). Locked once distributions exist.';

create index campaigns_status_idx on public.campaigns (campaign_status, screening_date desc);
create index campaigns_featured_idx on public.campaigns (featured) where featured;
create index campaigns_token_idx on public.campaigns (token_address);

create trigger campaigns_updated_at before update on public.campaigns
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- TREASURY PURCHASES (simulated in MVP)
-- ---------------------------------------------------------------------------
create table public.treasury_purchases (
  id                     uuid primary key default gen_random_uuid(),
  campaign_id            uuid not null references public.campaigns (id) on delete restrict,
  usdc_spent_cents       bigint not null check (usdc_spent_cents > 0),
  token_amount           numeric(38, 9) not null check (token_amount > 0),
  purchase_status        public.purchase_status not null default 'simulated',
  transaction_signature  text check (transaction_signature is null or public.is_solana_signature(transaction_signature)),
  notes                  text not null default '' check (char_length(notes) <= 500),
  is_demo                boolean not null default false,
  executed_at            timestamptz not null default now(),
  created_at             timestamptz not null default now(),
  -- A purchase can only be "confirmed" with a real on-chain signature; simulated ones must not carry one.
  constraint purchases_signature_matches_status check (
    (purchase_status = 'confirmed' and transaction_signature is not null)
    or (purchase_status = 'simulated' and transaction_signature is null)
    or purchase_status = 'pending'
  )
);

create index treasury_purchases_campaign_idx on public.treasury_purchases (campaign_id, executed_at desc);

-- Purchases may never exceed the campaign's 70% reward allocation.
create or replace function public.enforce_purchase_cap()
returns trigger language plpgsql as $$
declare
  cap bigint;
  spent bigint;
begin
  select reward_allocation into cap from public.campaigns where id = new.campaign_id for update;
  select coalesce(sum(usdc_spent_cents), 0) into spent
    from public.treasury_purchases where campaign_id = new.campaign_id and id <> new.id;
  if spent + new.usdc_spent_cents > cap then
    raise exception 'treasury purchases (% cents) would exceed reward allocation (% cents)', spent + new.usdc_spent_cents, cap
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger treasury_purchases_cap before insert or update on public.treasury_purchases
  for each row execute function public.enforce_purchase_cap();

-- ---------------------------------------------------------------------------
-- DISTRIBUTIONS (per-wallet records; simulated in MVP)
-- ---------------------------------------------------------------------------
create table public.distributions (
  id                     uuid primary key default gen_random_uuid(),
  campaign_id            uuid not null references public.campaigns (id) on delete restrict,
  wallet_address         text not null check (public.is_solana_address(wallet_address)),
  runner_balance         numeric(38, 0) not null check (runner_balance > 0),
  eligible_supply        numeric(38, 0) not null check (eligible_supply > 0),
  reward_percentage      numeric(14, 10) not null check (reward_percentage between 0 and 100),
  reward_amount          numeric(38, 9) not null check (reward_amount >= 0),
  distribution_status    public.distribution_status not null default 'simulated',
  transaction_signature  text check (transaction_signature is null or public.is_solana_signature(transaction_signature)),
  is_demo                boolean not null default false,
  created_at             timestamptz not null default now(),
  constraint distributions_balance_le_supply check (runner_balance <= eligible_supply),
  constraint distributions_one_per_wallet unique (campaign_id, wallet_address),
  constraint distributions_signature_matches_status check (
    (distribution_status = 'confirmed' and transaction_signature is not null)
    or (distribution_status in ('simulated', 'failed') and transaction_signature is null)
    or distribution_status = 'pending'
  )
);

create index distributions_wallet_idx on public.distributions (wallet_address, created_at desc);
create index distributions_campaign_idx on public.distributions (campaign_id);

-- ---------------------------------------------------------------------------
-- Public, minimal application-status lookup by reference number.
-- Exposes no wallet or contact data.
-- ---------------------------------------------------------------------------
create or replace function public.get_application_status(p_reference text)
returns table (
  reference text,
  project_name text,
  ticker text,
  campaign_package public.campaign_package,
  application_status public.application_status,
  created_at timestamptz,
  updated_at timestamptz,
  campaign_slug text
)
language sql stable security definer set search_path = public as $$
  select a.reference, a.project_name, a.ticker, a.campaign_package, a.application_status,
         a.created_at, a.updated_at,
         (select c.slug from public.campaigns c where c.application_id = a.id and c.campaign_status <> 'cancelled')
  from public.applications a
  where a.reference = upper(trim(p_reference))
  limit 1
$$;
revoke all on function public.get_application_status(text) from public;
grant execute on function public.get_application_status(text) to anon, authenticated;

-- ============================================================================
-- ROW LEVEL SECURITY
-- The service-role key bypasses RLS and is used ONLY on the server
-- (application intake after server-side validation). Admin actions run with
-- the admin's own session so these policies are a second line of defense.
-- ============================================================================
alter table public.users              enable row level security;
alter table public.applications       enable row level security;
alter table public.screening          enable row level security;
alter table public.campaigns          enable row level security;
alter table public.treasury_purchases enable row level security;
alter table public.distributions      enable row level security;

-- USERS: a user can read their own row; admins can read/manage all.
create policy users_select_self on public.users
  for select to authenticated using (auth_user_id = auth.uid() or public.is_admin());
create policy users_admin_write on public.users
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- APPLICATIONS: never publicly readable (contact + wallet data). Admin only.
-- Public intake happens through the server using the service role after validation.
create policy applications_admin_all on public.applications
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- CAMPAIGNS: public can read non-cancelled campaigns; admin manages.
create policy campaigns_public_read on public.campaigns
  for select to anon, authenticated using (campaign_status <> 'cancelled' or public.is_admin());
create policy campaigns_admin_insert on public.campaigns
  for insert to authenticated with check (public.is_admin());
create policy campaigns_admin_update on public.campaigns
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy campaigns_admin_delete on public.campaigns
  for delete to authenticated using (public.is_admin());

-- SCREENING: public may read screening reports for published campaigns (transparency).
create policy screening_public_read on public.screening
  for select to anon, authenticated using (
    public.is_admin() or exists (
      select 1 from public.campaigns c
      where c.application_id = screening.application_id and c.campaign_status <> 'cancelled'
    )
  );
create policy screening_admin_write on public.screening
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- TREASURY PURCHASES: public transparency for visible campaigns; admin writes.
create policy purchases_public_read on public.treasury_purchases
  for select to anon, authenticated using (
    public.is_admin() or exists (
      select 1 from public.campaigns c where c.id = treasury_purchases.campaign_id and c.campaign_status <> 'cancelled'
    )
  );
create policy purchases_admin_write on public.treasury_purchases
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- DISTRIBUTIONS: public transparency (on-chain data is public); admin writes.
create policy distributions_public_read on public.distributions
  for select to anon, authenticated using (
    public.is_admin() or exists (
      select 1 from public.campaigns c where c.id = distributions.campaign_id and c.campaign_status <> 'cancelled'
    )
  );
create policy distributions_admin_write on public.distributions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Default privileges: anon gets read only on public-facing tables.
revoke all on public.users, public.applications from anon;
grant select on public.campaigns, public.screening, public.treasury_purchases, public.distributions to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
