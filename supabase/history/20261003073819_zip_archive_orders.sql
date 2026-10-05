-- Compatible extension; no existing data or access policies changed.
-- Keep the private bucket, exact signed uploads and ten-minute terminal retention.
alter table public.print_upload_intents drop constraint print_upload_intents_mime_type_check;
alter table public.print_upload_intents add constraint print_upload_intents_mime_type_check
  check(mime_type in ('application/pdf','image/png','image/jpeg','application/zip'));

create or replace function public.commit_print_orders(p_shop_id text,p_items jsonb,p_access_hash text) returns jsonb
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
end $$;
revoke execute on function public.commit_print_orders(text,jsonb,text) from public,anon,authenticated;
grant execute on function public.commit_print_orders(text,jsonb,text) to service_role;
