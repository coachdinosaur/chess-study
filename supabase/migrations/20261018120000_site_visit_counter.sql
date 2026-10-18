begin;

-- Anonymous, privacy-preserving visit counters for the public site.
-- Each row is an hourly bucket per page and referring site. No IP addresses,
-- user agents, cookies, or visitor identifiers are stored.
create table if not exists public.site_traffic_hourly (
  bucket_start timestamptz not null,
  path text not null,
  referrer_host text not null default '',
  page_views integer not null default 0,
  visits integer not null default 0,
  new_visitors integer not null default 0,
  primary key (bucket_start, path, referrer_host),
  constraint site_traffic_hourly_path_check
    check (path ~ '^/' and char_length(path) <= 200),
  constraint site_traffic_hourly_referrer_check
    check (char_length(referrer_host) <= 100),
  constraint site_traffic_hourly_counts_check
    check (page_views >= 0 and visits >= 0 and new_visitors >= 0)
);

comment on table public.site_traffic_hourly is
  'Anonymous hourly page-view, visit, and new-visitor counters. Stores no IP addresses, user agents, or visitor identifiers.';

alter table public.site_traffic_hourly enable row level security;
revoke all on table public.site_traffic_hourly from public, anon, authenticated;

create or replace function public.record_site_visit(
  p_path text,
  p_referrer_host text default '',
  p_is_visit boolean default false,
  p_is_new_visitor boolean default false
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_path text := btrim(coalesce(p_path, ''));
  v_referrer text := lower(btrim(coalesce(p_referrer_host, '')));
  v_is_new boolean := coalesce(p_is_new_visitor, false);
  v_is_visit boolean := coalesce(p_is_visit, false) or v_is_new;
begin
  -- Only plain site paths are stored, so arbitrary text cannot be written.
  if v_path !~ '^/[A-Za-z0-9._~/%-]{0,199}$' then
    return;
  end if;

  -- A referring site is only meaningful for the first page of a visit.
  if not v_is_visit or v_referrer !~ '^[a-z0-9.-]{1,100}$' then
    v_referrer := '';
  end if;

  insert into public.site_traffic_hourly as traffic (
    bucket_start,
    path,
    referrer_host,
    page_views,
    visits,
    new_visitors
  )
  values (
    date_trunc('hour', now(), 'UTC'),
    v_path,
    v_referrer,
    1,
    v_is_visit::integer,
    v_is_new::integer
  )
  on conflict (bucket_start, path, referrer_host) do update
    set page_views = traffic.page_views + 1,
        visits = traffic.visits + excluded.visits,
        new_visitors = traffic.new_visitors + excluded.new_visitors;
end;
$$;

comment on function public.record_site_visit(text, text, boolean, boolean) is
  'Increments anonymous hourly counters for one public page view.';

revoke all on function public.record_site_visit(text, text, boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.record_site_visit(text, text, boolean, boolean)
  to anon, authenticated;

create or replace function public.admin_site_traffic_summary(
  p_time_zone text default 'UTC',
  p_days integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_time_zone text := coalesce(nullif(btrim(p_time_zone), ''), 'UTC');
  v_days integer := greatest(7, least(coalesce(p_days, 30), 365));
  v_today date;
  v_range_start timestamptz;
  v_totals jsonb;
  v_daily jsonb;
  v_pages jsonb;
  v_referrers jsonb;
  v_direct_visits bigint;
  v_tracking_since timestamptz;
begin
  if auth.uid() is null or not private.is_platform_admin() then
    raise exception 'Platform administrator access is required.';
  end if;

  if not exists (select 1 from pg_timezone_names where name = v_time_zone) then
    v_time_zone := 'UTC';
  end if;

  v_today := (now() at time zone v_time_zone)::date;
  v_range_start := (v_today - (v_days - 1))::timestamp at time zone v_time_zone;

  select
    jsonb_build_object(
      'today', jsonb_build_object(
        'page_views', coalesce(sum(page_views) filter (where day = v_today), 0),
        'visits', coalesce(sum(visits) filter (where day = v_today), 0),
        'new_visitors', coalesce(sum(new_visitors) filter (where day = v_today), 0)
      ),
      'last_7_days', jsonb_build_object(
        'page_views', coalesce(sum(page_views) filter (where day > v_today - 7), 0),
        'visits', coalesce(sum(visits) filter (where day > v_today - 7), 0),
        'new_visitors', coalesce(sum(new_visitors) filter (where day > v_today - 7), 0)
      ),
      'last_30_days', jsonb_build_object(
        'page_views', coalesce(sum(page_views) filter (where day > v_today - 30), 0),
        'visits', coalesce(sum(visits) filter (where day > v_today - 30), 0),
        'new_visitors', coalesce(sum(new_visitors) filter (where day > v_today - 30), 0)
      ),
      'all_time', jsonb_build_object(
        'page_views', coalesce(sum(page_views), 0),
        'visits', coalesce(sum(visits), 0),
        'new_visitors', coalesce(sum(new_visitors), 0)
      )
    ),
    min(bucket_start)
  into v_totals, v_tracking_since
  from (
    select
      traffic.bucket_start,
      traffic.page_views,
      traffic.visits,
      traffic.new_visitors,
      (traffic.bucket_start at time zone v_time_zone)::date as day
    from public.site_traffic_hourly traffic
  ) traffic;

  select coalesce(jsonb_agg(jsonb_build_object(
    'day', series.day,
    'page_views', coalesce(daily.page_views, 0),
    'visits', coalesce(daily.visits, 0),
    'new_visitors', coalesce(daily.new_visitors, 0)
  ) order by series.day), '[]'::jsonb)
  into v_daily
  from (
    select v_today - (v_days - 1) + offset_days as day
    from generate_series(0, v_days - 1) as offset_days
  ) series
  left join (
    select
      (traffic.bucket_start at time zone v_time_zone)::date as day,
      sum(traffic.page_views) as page_views,
      sum(traffic.visits) as visits,
      sum(traffic.new_visitors) as new_visitors
    from public.site_traffic_hourly traffic
    where traffic.bucket_start >= v_range_start
    group by 1
  ) daily on daily.day = series.day;

  select coalesce(jsonb_agg(jsonb_build_object(
    'path', top.path,
    'page_views', top.page_views,
    'visits', top.visits
  ) order by top.page_views desc, top.path), '[]'::jsonb)
  into v_pages
  from (
    select traffic.path, sum(traffic.page_views) as page_views, sum(traffic.visits) as visits
    from public.site_traffic_hourly traffic
    where traffic.bucket_start >= v_range_start
    group by traffic.path
    order by sum(traffic.page_views) desc, traffic.path
    limit 15
  ) top;

  select coalesce(jsonb_agg(jsonb_build_object(
    'referrer_host', top.referrer_host,
    'visits', top.visits
  ) order by top.visits desc, top.referrer_host), '[]'::jsonb)
  into v_referrers
  from (
    select traffic.referrer_host, sum(traffic.visits) as visits
    from public.site_traffic_hourly traffic
    where traffic.bucket_start >= v_range_start
      and traffic.referrer_host <> ''
    group by traffic.referrer_host
    order by sum(traffic.visits) desc, traffic.referrer_host
    limit 10
  ) top;

  select coalesce(sum(traffic.visits), 0)
  into v_direct_visits
  from public.site_traffic_hourly traffic
  where traffic.bucket_start >= v_range_start
    and traffic.referrer_host = '';

  return jsonb_build_object(
    'time_zone', v_time_zone,
    'days', v_days,
    'tracking_since', v_tracking_since,
    'totals', v_totals,
    'daily', v_daily,
    'top_pages', v_pages,
    'top_referrers', v_referrers,
    'direct_visits', v_direct_visits
  );
end;
$$;

comment on function public.admin_site_traffic_summary(text, integer) is
  'Summarizes anonymous site traffic for platform administrators in the requested time zone.';

revoke all on function public.admin_site_traffic_summary(text, integer)
  from public, anon, authenticated;
grant execute on function public.admin_site_traffic_summary(text, integer)
  to authenticated;

commit;
