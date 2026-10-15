-- Security check: two fake users; B must not see/change A's rows. Runs in a transaction that is
-- never committed, so nothing is saved. Run: supabase db query --linked --project-ref wgevgiuhncwczqcvnobf -f supabase/tests/rls_check.sql
-- Expected: A sees own rows => 3, every "B ..." check => 0 or blocked, A profile name => A

begin;
insert into auth.users (id, email, aud, role) values
 ('00000000-0000-0000-0000-0000000000a1','rls-a@test.invalid','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000b2','rls-b@test.invalid','authenticated','authenticated');
create temp table results (check_name text, value text) on commit drop;
grant all on results to authenticated;
-- act as user A
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',true);
insert into public.profiles (user_id, display_name, answers) values ('00000000-0000-0000-0000-0000000000a1','A','{"pace":"5"}');
insert into public.read_books (book_id) values ('OL82563W');
insert into public.group_members (name, answers) values ('Friend of A','{}');
insert into results select 'A sees own rows', (select count(*) from profiles)+(select count(*) from read_books)+(select count(*) from group_members);
-- act as user B
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}',true);
insert into results select 'B sees A rows', (select count(*) from profiles)+(select count(*) from read_books)+(select count(*) from group_members);
with u as (update public.profiles set display_name='hacked' returning 1) insert into results select 'B updates A profile', count(*) from u;
with d as (delete from public.read_books returning 1) insert into results select 'B deletes A read_books', count(*) from d;
do $$ begin
  insert into public.read_books (user_id, book_id) values ('00000000-0000-0000-0000-0000000000a1','OL1W');
  insert into results values ('B writes row as A','ALLOWED (bad)');
exception when others then insert into results values ('B writes row as A','blocked: '||sqlerrm); end $$;
reset role;
insert into results select 'A profile name after attack', display_name from public.profiles where user_id='00000000-0000-0000-0000-0000000000a1';
select * from results;
