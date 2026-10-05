-- PrintWithQR application baseline, recovered from live catalog metadata on 2026-10-05.

-- Fresh Supabase databases only. No users, documents, credentials or cron jobs are copied.

-- Existing production already has these objects; do not apply this baseline there.

begin;

create extension if not exists pgcrypto with schema extensions;

create extension if not exists pg_cron with schema pg_catalog;

create extension if not exists pg_net with schema extensions;

create extension if not exists supabase_vault with schema vault;

create table public."shops" (
  "id" text not null,
  "name" text not null,
  "address" text not null,
  "bw_rate" numeric default 2.0,
  "color_rate" numeric default 10.0,
  "color_enabled" integer default 1,
  "is_paid" integer default 0,
  "is_admin" boolean default false,
  "subscription_status" text default 'active'::text,
  "subscription_expires_at" timestamp with time zone default (now() + '30 days'::interval),
  "razorpay_order_id" text,
  "razorpay_payment_id" text,
  "created_at" timestamp with time zone default timezone('utc'::text, now()) not null,
  "phone" text,
  "printer_model" text,
  "subscription_plan" text default 'free'::text,
  "free_prints_allowed" integer default 10,
  "free_prints_used" integer default 0,
  "trial_completed" boolean default false,
  "device_hash" text,
  "ip_hash" text,
  "registration_device_risk" text,
  "registration_ip_risk" text,
  "subscription_started_at" timestamp with time zone
);

create table public."orders" (
  "id" text not null,
  "shop_id" text,
  "file_path" text not null,
  "file_name" text not null,
  "pages_to_print" integer default 1,
  "print_type" text default 'bw'::text,
  "paper_size" text default 'A4'::text,
  "duplex" integer default 0,
  "total_amount" numeric default 0,
  "status" text default 'Pending'::text,
  "created_at" timestamp with time zone default timezone('utc'::text, now()) not null,
  "customer_access_hash" text,
  "completed_at" timestamp with time zone,
  "file_deleted_at" timestamp with time zone,
  "print_options" jsonb default '{}'::jsonb not null
);

create table public."registration_attempts" (
  "id" uuid default gen_random_uuid() not null,
  "type" text,
  "phone_hash" text,
  "device_hash" text,
  "ip_hash" text,
  "is_success" boolean,
  "details" jsonb,
  "created_at" timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public."shop_members" (
  "shop_id" text not null,
  "user_id" uuid not null,
  "role" text not null,
  "active" boolean default true not null
);

create table public."platform_admins" (
  "user_id" uuid not null
);

create table public."print_upload_intents" (
  "id" uuid not null,
  "shop_id" text not null,
  "object_key" text not null,
  "token_hash" text not null,
  "file_name" text not null,
  "mime_type" text not null,
  "byte_size" bigint not null,
  "created_at" timestamp with time zone default now() not null,
  "expires_at" timestamp with time zone default (now() + '02:00:00'::interval) not null,
  "order_id" text,
  "cleaned_at" timestamp with time zone
);

create table public."print_request_limits" (
  "key" text not null,
  "window_started" timestamp with time zone not null,
  "hits" integer not null
);

alter table public."orders" add constraint "orders_pkey" PRIMARY KEY (id);

alter table public."orders" add constraint "orders_status_check" CHECK (status = ANY (ARRAY['Pending'::text, 'Printing'::text, 'Completed'::text, 'Cancelled'::text]));

alter table public."platform_admins" add constraint "platform_admins_pkey" PRIMARY KEY (user_id);

alter table public."print_request_limits" add constraint "print_request_limits_pkey" PRIMARY KEY (key);

alter table public."print_upload_intents" add constraint "authorized_upload_size_limit" CHECK (byte_size <= 52428800);

alter table public."print_upload_intents" add constraint "print_upload_intents_byte_size_check" CHECK (byte_size > 0 AND byte_size <= 104857600);

alter table public."print_upload_intents" add constraint "print_upload_intents_mime_type_check" CHECK (mime_type = ANY (ARRAY['application/pdf'::text, 'image/png'::text, 'image/jpeg'::text, 'application/zip'::text]));

alter table public."print_upload_intents" add constraint "print_upload_intents_object_key_key" UNIQUE (object_key);

alter table public."print_upload_intents" add constraint "print_upload_intents_pkey" PRIMARY KEY (id);

alter table public."registration_attempts" add constraint "registration_attempts_pkey" PRIMARY KEY (id);

alter table public."shop_members" add constraint "shop_members_pkey" PRIMARY KEY (shop_id, user_id);

alter table public."shop_members" add constraint "shop_members_role_check" CHECK (role = ANY (ARRAY['owner'::text, 'agent'::text]));

alter table public."shops" add constraint "shops_pkey" PRIMARY KEY (id);

alter table public."orders" add constraint "orders_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

alter table public."platform_admins" add constraint "platform_admins_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public."print_upload_intents" add constraint "print_upload_intents_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

alter table public."print_upload_intents" add constraint "print_upload_intents_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

alter table public."shop_members" add constraint "shop_members_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

alter table public."shop_members" add constraint "shop_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX shop_members_user_idx ON public.shop_members USING btree (user_id, shop_id) WHERE active;

CREATE INDEX upload_intents_cleanup_idx ON public.print_upload_intents USING btree (expires_at) WHERE (cleaned_at IS NULL);

CREATE INDEX orders_shop_created_idx ON public.orders USING btree (shop_id, created_at DESC);

CREATE INDEX orders_cleanup_idx ON public.orders USING btree (completed_at) WHERE ((file_deleted_at IS NULL) AND (status = ANY (ARRAY['Completed'::text, 'Cancelled'::text])));

CREATE OR REPLACE FUNCTION public.print_rate_limit(p_key text, p_limit integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_hits int;
begin
  insert into public.print_request_limits as r values(p_key,now(),1)
  on conflict(key) do update set
    hits=case when r.window_started < now()-interval '10 minutes' then 1 else r.hits+1 end,
    window_started=case when r.window_started < now()-interval '10 minutes' then now() else r.window_started end
  returning hits into v_hits;
  return v_hits<=p_limit;
end $function$;

CREATE OR REPLACE FUNCTION public.delete_old_print_jobs()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  -- Delete document files older than 5 minutes from Storage
  DELETE FROM storage.objects
  WHERE bucket_id = 'print-jobs'
  AND created_at < (now() - interval '5 minutes');
END;
$function$;

CREATE OR REPLACE FUNCTION public.configure_print_cleanup(p_secret text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$;

CREATE OR REPLACE FUNCTION public.commit_print_orders(p_shop_id text, p_items jsonb, p_access_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
    -- Each ZIP consumes one trial submission unit; its document pages stay unknown.
    n=case when u.mime_type='application/zip' then 1 else (item->>'pages')::int end;
    if n is null or n not between 1 and 2000 then raise exception 'Invalid pages'; end if;
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
    values(v_id,p_shop_id,u.object_key,u.file_name,
      case when u.mime_type='application/zip' then null else (item->>'pages')::int end,
      item->>'print_type',item->>'paper_size',(item->>'duplex')::int,
      case when u.mime_type='application/zip' then null else round((item->>'pages')::int*rate,2) end,
      'Pending',p_access_hash,
      case when u.mime_type='application/zip' then coalesce(item->'print_options','{}'::jsonb)||jsonb_build_object('fileKind','zip','pricePending',true) else item->'print_options' end);
    update public.print_upload_intents set order_id=v_id where id=u.id;
    result=result||jsonb_build_array(v_id);
  end loop;
  if not paid then update public.shops set free_prints_used=coalesce(free_prints_used,0)+requested where id=p_shop_id; end if;
  return result;
end $function$;

alter table public."shop_members" enable row level security;

revoke all on public."shop_members" from public, anon, authenticated, service_role;

alter table public."platform_admins" enable row level security;

revoke all on public."platform_admins" from public, anon, authenticated, service_role;

alter table public."print_upload_intents" enable row level security;

revoke all on public."print_upload_intents" from public, anon, authenticated, service_role;

alter table public."shops" enable row level security;

revoke all on public."shops" from public, anon, authenticated, service_role;

alter table public."print_request_limits" enable row level security;

revoke all on public."print_request_limits" from public, anon, authenticated, service_role;

alter table public."orders" enable row level security;

revoke all on public."orders" from public, anon, authenticated, service_role;

alter table public."registration_attempts" enable row level security;

revoke all on public."registration_attempts" from public, anon, authenticated, service_role;

grant INSERT on public."shop_members" to "service_role";

grant SELECT on public."shop_members" to "service_role";

grant UPDATE on public."shop_members" to "service_role";

grant DELETE on public."shop_members" to "service_role";

grant TRUNCATE on public."shop_members" to "service_role";

grant REFERENCES on public."shop_members" to "service_role";

grant TRIGGER on public."shop_members" to "service_role";

grant SELECT on public."shop_members" to "authenticated";

grant INSERT on public."platform_admins" to "service_role";

grant SELECT on public."platform_admins" to "service_role";

grant UPDATE on public."platform_admins" to "service_role";

grant DELETE on public."platform_admins" to "service_role";

grant TRUNCATE on public."platform_admins" to "service_role";

grant REFERENCES on public."platform_admins" to "service_role";

grant TRIGGER on public."platform_admins" to "service_role";

grant INSERT on public."print_upload_intents" to "service_role";

grant SELECT on public."print_upload_intents" to "service_role";

grant UPDATE on public."print_upload_intents" to "service_role";

grant DELETE on public."print_upload_intents" to "service_role";

grant TRUNCATE on public."print_upload_intents" to "service_role";

grant REFERENCES on public."print_upload_intents" to "service_role";

grant TRIGGER on public."print_upload_intents" to "service_role";

grant INSERT on public."shops" to "service_role";

grant SELECT on public."shops" to "service_role";

grant UPDATE on public."shops" to "service_role";

grant DELETE on public."shops" to "service_role";

grant TRUNCATE on public."shops" to "service_role";

grant REFERENCES on public."shops" to "service_role";

grant TRIGGER on public."shops" to "service_role";

grant SELECT on public."shops" to "authenticated";

grant INSERT on public."print_request_limits" to "service_role";

grant SELECT on public."print_request_limits" to "service_role";

grant UPDATE on public."print_request_limits" to "service_role";

grant DELETE on public."print_request_limits" to "service_role";

grant TRUNCATE on public."print_request_limits" to "service_role";

grant REFERENCES on public."print_request_limits" to "service_role";

grant TRIGGER on public."print_request_limits" to "service_role";

grant INSERT on public."orders" to "service_role";

grant SELECT on public."orders" to "service_role";

grant UPDATE on public."orders" to "service_role";

grant DELETE on public."orders" to "service_role";

grant TRUNCATE on public."orders" to "service_role";

grant REFERENCES on public."orders" to "service_role";

grant TRIGGER on public."orders" to "service_role";

grant SELECT on public."orders" to "authenticated";

grant INSERT on public."registration_attempts" to "anon";

grant SELECT on public."registration_attempts" to "anon";

grant UPDATE on public."registration_attempts" to "anon";

grant DELETE on public."registration_attempts" to "anon";

grant TRUNCATE on public."registration_attempts" to "anon";

grant REFERENCES on public."registration_attempts" to "anon";

grant TRIGGER on public."registration_attempts" to "anon";

grant INSERT on public."registration_attempts" to "authenticated";

grant SELECT on public."registration_attempts" to "authenticated";

grant UPDATE on public."registration_attempts" to "authenticated";

grant DELETE on public."registration_attempts" to "authenticated";

grant TRUNCATE on public."registration_attempts" to "authenticated";

grant REFERENCES on public."registration_attempts" to "authenticated";

grant TRIGGER on public."registration_attempts" to "authenticated";

grant INSERT on public."registration_attempts" to "service_role";

grant SELECT on public."registration_attempts" to "service_role";

grant UPDATE on public."registration_attempts" to "service_role";

grant DELETE on public."registration_attempts" to "service_role";

grant TRUNCATE on public."registration_attempts" to "service_role";

grant REFERENCES on public."registration_attempts" to "service_role";

grant TRIGGER on public."registration_attempts" to "service_role";

create policy "members_read_self" on "public"."shop_members" as PERMISSIVE for SELECT to "authenticated" using (((user_id = ( SELECT auth.uid() AS uid)) AND active));

create policy "shops_member_read" on "public"."shops" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM shop_members m
  WHERE ((m.shop_id = shops.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND m.active))));

create policy "orders_member_read" on "public"."orders" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM shop_members m
  WHERE ((m.shop_id = orders.shop_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND m.active))));

revoke all on function public."print_rate_limit"(text, integer) from public, anon, authenticated, service_role;

grant execute on function public."print_rate_limit"(text, integer) to "service_role";

revoke all on function public."delete_old_print_jobs"() from public, anon, authenticated, service_role;

grant execute on function public."delete_old_print_jobs"() to "service_role";

revoke all on function public."configure_print_cleanup"(text) from public, anon, authenticated, service_role;

grant execute on function public."configure_print_cleanup"(text) to "service_role";

revoke all on function public."commit_print_orders"(text, jsonb, text) from public, anon, authenticated, service_role;

grant execute on function public."commit_print_orders"(text, jsonb, text) to "service_role";

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('print-jobs','print-jobs',false,52428800,array['application/pdf','image/png','image/jpeg','application/zip']::text[]);

alter publication "supabase_realtime" add table "public"."shops";

alter publication "supabase_realtime" add table "public"."orders";

commit;
