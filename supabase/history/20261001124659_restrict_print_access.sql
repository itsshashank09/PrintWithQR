-- Cut over only after the compatible application has been promoted.
do $$ declare p record; begin
  for p in select schemaname,tablename,policyname from pg_policies
    where (schemaname='public' and tablename in ('shops','orders'))
       or (schemaname='storage' and tablename='objects' and policyname in ('Allow public uploads','Allow public deletes','Allow signed url access'))
  loop execute format('drop policy %I on %I.%I',p.policyname,p.schemaname,p.tablename); end loop;
end $$;
alter table public.shops enable row level security;
alter table public.orders enable row level security;
revoke all on public.shops,public.orders from public,anon,authenticated;
grant select on public.shops,public.orders to authenticated;
grant all on public.shops,public.orders to service_role;
create policy shops_member_read on public.shops for select to authenticated
  using(exists(select 1 from public.shop_members m where m.shop_id=shops.id and m.user_id=(select auth.uid()) and m.active));
create policy orders_member_read on public.orders for select to authenticated
  using(exists(select 1 from public.shop_members m where m.shop_id=orders.shop_id and m.user_id=(select auth.uid()) and m.active));
-- No public storage policies: only server-signed exact-object capabilities.
alter table public.print_upload_intents add constraint authorized_upload_size_limit check(byte_size<=52428800);
update public.orders set completed_at=now() where status in ('Completed','Cancelled') and completed_at is null;
