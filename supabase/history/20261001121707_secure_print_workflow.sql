-- Additive phase: deploy the compatible API/frontend before the policy cutover.
create table public.shop_members (
  shop_id text not null references public.shops(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check(role in ('owner','agent')),
  active boolean not null default true,
  primary key(shop_id,user_id)
);
create index shop_members_user_idx on public.shop_members(user_id,shop_id) where active;
alter table public.shop_members enable row level security;
revoke all on public.shop_members from public,anon,authenticated;
grant select on public.shop_members to authenticated;
grant all on public.shop_members to service_role;
create policy members_read_self on public.shop_members for select to authenticated using(user_id=(select auth.uid()) and active);
insert into public.shop_members(shop_id,user_id,role)
select s.id,u.id,'owner' from public.shops s join auth.users u on s.id=u.id::text;

create table public.platform_admins(user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from public,anon,authenticated;
grant all on public.platform_admins to service_role;
-- Preserve the sole existing admin explicitly authorized by the proprietor.
do $$ begin
  if (select count(*) from public.shops where is_admin=true) <> 1 or
     (select count(*) from public.shops s join auth.users u on s.id=u.id::text where is_admin=true) <> 1 then
    raise exception 'Expected exactly one verified existing administrator';
  end if;
end $$;
insert into public.platform_admins select u.id from public.shops s join auth.users u on s.id=u.id::text where s.is_admin=true;

alter table public.orders add column customer_access_hash text;
alter table public.orders add column completed_at timestamptz;
alter table public.orders add column file_deleted_at timestamptz;
alter table public.orders add column print_options jsonb not null default '{}'::jsonb;
create index orders_shop_created_idx on public.orders(shop_id,created_at desc);
create index orders_cleanup_idx on public.orders(completed_at) where file_deleted_at is null and status in ('Completed','Cancelled');

create table public.print_upload_intents (
  id uuid primary key,
  shop_id text not null references public.shops(id) on delete cascade,
  object_key text not null unique,
  token_hash text not null,
  file_name text not null,
  mime_type text not null check(mime_type in ('application/pdf','image/png','image/jpeg')),
  byte_size bigint not null check(byte_size>0 and byte_size<=104857600),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '2 hours',
  order_id text references public.orders(id) on delete set null,
  cleaned_at timestamptz
);
create index upload_intents_cleanup_idx on public.print_upload_intents(expires_at) where cleaned_at is null;
alter table public.print_upload_intents enable row level security;
revoke all on public.print_upload_intents from public,anon,authenticated;
grant all on public.print_upload_intents to service_role;

create table public.print_request_limits(key text primary key,window_started timestamptz not null,hits int not null);
alter table public.print_request_limits enable row level security;
revoke all on public.print_request_limits from public,anon,authenticated;
grant all on public.print_request_limits to service_role;
create function public.print_rate_limit(p_key text,p_limit int) returns boolean
language plpgsql security invoker set search_path='' as $$
declare v_hits int;
begin
  insert into public.print_request_limits as r values(p_key,now(),1)
  on conflict(key) do update set
    hits=case when r.window_started < now()-interval '10 minutes' then 1 else r.hits+1 end,
    window_started=case when r.window_started < now()-interval '10 minutes' then now() else r.window_started end
  returning hits into v_hits;
  return v_hits<=p_limit;
end $$;
revoke execute on function public.print_rate_limit(text,int) from public,anon,authenticated;
grant execute on function public.print_rate_limit(text,int) to service_role;

create function public.commit_print_orders(p_shop_id text,p_items jsonb,p_access_hash text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare s public.shops%rowtype; u public.print_upload_intents%rowtype; item jsonb;
  result jsonb='[]'; v_id text; requested int=0; n int; rate numeric; paid boolean; consumed int=0;
begin
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 10 or length(p_access_hash)<>64 then raise exception 'Invalid request'; end if;
  select * into s from public.shops where id=p_shop_id for update;
  if not found then raise exception 'Shop unavailable.'; end if;
  for item in select value from jsonb_array_elements(p_items) loop
    select * into u from public.print_upload_intents where id=(item->>'intent_id')::uuid and shop_id=p_shop_id and token_hash=item->>'token_hash' for update;
    if not found then raise exception 'Invalid upload'; end if;
    if u.order_id is not null then
      if not exists(select 1 from public.orders where id=u.order_id and customer_access_hash=p_access_hash) then raise exception 'Upload already used.'; end if;
      consumed=consumed+1; result=result||jsonb_build_array(u.order_id);
    elsif u.expires_at<now() or not exists(select 1 from storage.objects where bucket_id='print-jobs' and name=u.object_key) then
      raise exception 'Upload authorization expired.';
    end if;
    n=(item->>'pages')::int;
    if n not between 1 and 2000 then raise exception 'Invalid pages'; end if;
    requested=requested+n;
  end loop;
  if consumed=jsonb_array_length(p_items) then return result; end if;
  if consumed>0 then raise exception 'Upload already used.'; end if;
  paid=s.is_paid=1 and s.subscription_status='active' and (s.subscription_expires_at is null or s.subscription_expires_at>now());
  if not paid and s.subscription_status<>'free' then raise exception 'Shop unavailable.'; end if;
  if not paid and requested>coalesce(s.free_prints_allowed,10)-coalesce(s.free_prints_used,0) then raise exception 'Not enough trial pages.'; end if;
  for item in select value from jsonb_array_elements(p_items) loop
    select * into u from public.print_upload_intents where id=(item->>'intent_id')::uuid;
    if item->>'print_type' not in ('bw','color') or item->>'paper_size' not in ('A4','Letter','16:9') then raise exception 'Invalid print settings'; end if;
    if item->>'print_type'='color' and coalesce(s.color_enabled,1)=0 then raise exception 'Color printing unavailable.'; end if;
    rate=case when item->>'print_type'='color' then s.color_rate else s.bw_rate end;
    if rate is null or rate<0 then raise exception 'Invalid rate.'; end if;
    v_id=gen_random_uuid()::text;
    insert into public.orders(id,shop_id,file_path,file_name,pages_to_print,print_type,paper_size,duplex,total_amount,status,customer_access_hash,print_options)
    values(v_id,p_shop_id,u.object_key,u.file_name,(item->>'pages')::int,item->>'print_type',item->>'paper_size',(item->>'duplex')::int,round((item->>'pages')::int*rate,2),'Pending',p_access_hash,item->'print_options');
    update public.print_upload_intents set order_id=v_id where id=u.id;
    result=result||jsonb_build_array(v_id);
  end loop;
  if not paid then update public.shops set free_prints_used=coalesce(free_prints_used,0)+requested where id=p_shop_id; end if;
  return result;
end $$;
revoke execute on function public.commit_print_orders(text,jsonb,text) from public,anon,authenticated;
grant execute on function public.commit_print_orders(text,jsonb,text) to service_role;

-- The old metadata-delete function is unused by the application and blocked by Storage.
revoke execute on function public.delete_old_print_jobs() from public,anon,authenticated;
alter function public.delete_old_print_jobs() set search_path='';

create extension if not exists pg_net with schema extensions;
create function public.configure_print_cleanup(p_secret text) returns void
language plpgsql security definer set search_path='' as $configure$
declare v_secret_id uuid; v_job bigint;
begin
  if length(p_secret)<20 then raise exception 'Invalid cleanup secret'; end if;
  select id into v_secret_id from vault.secrets where name='printwithqr_cleanup_authorization';
  if v_secret_id is null then perform vault.create_secret(p_secret,'printwithqr_cleanup_authorization','Vercel cleanup worker');
  else perform vault.update_secret(v_secret_id,p_secret); end if;
  for v_job in select jobid from cron.job where jobname in ('cleanup-print-jobs-5min','printwithqr-storage-cleanup') loop
    perform cron.unschedule(v_job);
  end loop;
  perform cron.schedule('printwithqr-storage-cleanup','* * * * *', $job$
    select net.http_post(
      url:='https://www.printwithqr.in/api/cleanup',
      headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='printwithqr_cleanup_authorization')),
      body:='{}'::jsonb,timeout_milliseconds:=10000);
  $job$);
end $configure$;
revoke execute on function public.configure_print_cleanup(text) from public,anon,authenticated;
grant execute on function public.configure_print_cleanup(text) to service_role;
