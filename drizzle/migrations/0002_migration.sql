create or replace function public.meta_ad_totals(_days integer default 30, _client_id uuid default null)
returns table(client_id uuid, account_id text, currency text, campaign_name text, ad_id text, ad_name text,
  spend numeric, impressions numeric, clicks numeric, leads numeric, messaging_conversations numeric,
  spend_recent numeric, spend_prior numeric, last_fecha date)
language sql stable security invoker set search_path to 'public' as $$
  with anchor as (select least(coalesce(max(m.fecha), current_date - 1), current_date - 1) as d from public.meta_datos m)
  select ca.client_id, m.account_id, a.currency, max(m.campaign_name), m.ad_id, max(m.ad_name),
    sum(m.total_cost), sum(m.impressions), sum(m.clicks), sum(m.leads), sum(m.messaging_conversations),
    sum(case when m.fecha > an.d - 3 then m.total_cost else 0 end),
    sum(case when m.fecha <= an.d - 3 and m.fecha > an.d - 6 then m.total_cost else 0 end),
    max(m.fecha)
  from public.meta_datos m join public.ad_accounts a on a.account_id = m.account_id
  left join public.client_accounts ca on ca.account_id = m.account_id, anchor an
  where m.fecha > an.d - _days and m.fecha <= an.d and m.ad_id is not null
    and (_client_id is null or ca.client_id = _client_id)
  group by ca.client_id, m.account_id, a.currency, m.ad_id
  order by sum(m.total_cost) desc nulls last
  limit 200;
$$;

create or replace function public.meta_objective_totals(_days integer default 30, _client_id uuid default null)
returns table(currency text, objective text, spend numeric, impressions numeric, clicks numeric)
language sql stable security invoker set search_path to 'public' as $$
  with anchor as (select least(coalesce(max(m.fecha), current_date - 1), current_date - 1) as d from public.meta_datos m)
  select a.currency, coalesce(m.objective, 'SIN OBJETIVO'), sum(m.total_cost), sum(m.impressions), sum(m.clicks)
  from public.meta_datos m join public.ad_accounts a on a.account_id = m.account_id
  left join public.client_accounts ca on ca.account_id = m.account_id, anchor an
  where m.fecha > an.d - _days and m.fecha <= an.d
    and (_client_id is null or ca.client_id = _client_id)
  group by a.currency, coalesce(m.objective, 'SIN OBJETIVO');
$$;

revoke execute on function public.meta_ad_totals(integer, uuid) from public, anon;
revoke execute on function public.meta_objective_totals(integer, uuid) from public, anon;
grant execute on function public.meta_ad_totals(integer, uuid) to authenticated, service_role;
grant execute on function public.meta_objective_totals(integer, uuid) to authenticated, service_role;