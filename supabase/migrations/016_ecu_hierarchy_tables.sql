-- ============================================================
-- Migration 016: Dynamic ECU Hierarchy Tables
-- Creates: ecu_manufacturers, ecu_families, ecu_model_codes,
--          ecu_software_ids
-- Seeded with all data from the previous static ECU_HIERARCHY
-- ============================================================

-- ── Tables ───────────────────────────────────────────────────

create table if not exists ecu_manufacturers (
  id   uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table if not exists ecu_families (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  manufacturer_id uuid not null references ecu_manufacturers(id) on delete cascade,
  unique (name, manufacturer_id)
);

create table if not exists ecu_model_codes (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  family_id uuid not null references ecu_families(id) on delete cascade,
  unique (name, family_id)
);

create table if not exists ecu_software_ids (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  model_code_id uuid not null references ecu_model_codes(id) on delete cascade,
  unique (name, model_code_id)
);

-- ── RLS: same access pattern as other lookup tables ──────────

alter table ecu_manufacturers enable row level security;
alter table ecu_families      enable row level security;
alter table ecu_model_codes   enable row level security;
alter table ecu_software_ids  enable row level security;

-- Authenticated users can read
create policy "auth read ecu_manufacturers" on ecu_manufacturers for select to authenticated using (true);
create policy "auth read ecu_families"      on ecu_families      for select to authenticated using (true);
create policy "auth read ecu_model_codes"   on ecu_model_codes   for select to authenticated using (true);
create policy "auth read ecu_software_ids"  on ecu_software_ids  for select to authenticated using (true);

-- Admins can mutate (same pattern as ecu_companies)
create policy "admin write ecu_manufacturers" on ecu_manufacturers for all to authenticated
  using   ((select role from profiles where id = auth.uid()) = 'admin')
  with check ((select role from profiles where id = auth.uid()) = 'admin');

create policy "admin write ecu_families" on ecu_families for all to authenticated
  using   ((select role from profiles where id = auth.uid()) = 'admin')
  with check ((select role from profiles where id = auth.uid()) = 'admin');

create policy "admin write ecu_model_codes" on ecu_model_codes for all to authenticated
  using   ((select role from profiles where id = auth.uid()) = 'admin')
  with check ((select role from profiles where id = auth.uid()) = 'admin');

create policy "admin write ecu_software_ids" on ecu_software_ids for all to authenticated
  using   ((select role from profiles where id = auth.uid()) = 'admin')
  with check ((select role from profiles where id = auth.uid()) = 'admin');

-- ── Seed Data ────────────────────────────────────────────────

do $$
declare
  -- manufacturer IDs
  id_sim2k       uuid;
  id_bosch       uuid;
  id_delphi      uuid;
  id_continental uuid;
  id_denso       uuid;
  id_siemens     uuid;

  -- family IDs (SIM2K)
  s47  uuid; s140 uuid; s141 uuid; s241 uuid; s341 uuid; s250 uuid; s259 uuid;
  -- family IDs (BOSCH)
  b47  uuid; b140 uuid; b141 uuid; b241 uuid; b341 uuid; b411 uuid;
  -- family IDs (DELPHI)
  d_dcm uuid; d_mt uuid;
  -- family IDs (CONTINENTAL)
  c_sim uuid; c_ems uuid;
  -- family IDs (DENSO)
  dn275 uuid; dn276 uuid;
  -- family IDs (SIEMENS)
  sg_sim uuid; sg_vdo uuid;

  -- model code IDs
  mc uuid;

begin
  -- ── Manufacturers ──────────────────────────────────────────
  insert into ecu_manufacturers(name) values ('SIM2K')       on conflict(name) do update set name=excluded.name returning id into id_sim2k;
  insert into ecu_manufacturers(name) values ('BOSCH')       on conflict(name) do update set name=excluded.name returning id into id_bosch;
  insert into ecu_manufacturers(name) values ('DELPHI')      on conflict(name) do update set name=excluded.name returning id into id_delphi;
  insert into ecu_manufacturers(name) values ('CONTINENTAL') on conflict(name) do update set name=excluded.name returning id into id_continental;
  insert into ecu_manufacturers(name) values ('DENSO')       on conflict(name) do update set name=excluded.name returning id into id_denso;
  insert into ecu_manufacturers(name) values ('SIEMENS')     on conflict(name) do update set name=excluded.name returning id into id_siemens;

  -- ── SIM2K Families ─────────────────────────────────────────
  insert into ecu_families(name, manufacturer_id) values ('47',  id_sim2k) on conflict do nothing returning id into s47;
  select id into s47 from ecu_families where name='47'  and manufacturer_id=id_sim2k;
  insert into ecu_families(name, manufacturer_id) values ('140', id_sim2k) on conflict do nothing returning id into s140;
  select id into s140 from ecu_families where name='140' and manufacturer_id=id_sim2k;
  insert into ecu_families(name, manufacturer_id) values ('141', id_sim2k) on conflict do nothing returning id into s141;
  select id into s141 from ecu_families where name='141' and manufacturer_id=id_sim2k;
  insert into ecu_families(name, manufacturer_id) values ('241', id_sim2k) on conflict do nothing returning id into s241;
  select id into s241 from ecu_families where name='241' and manufacturer_id=id_sim2k;
  insert into ecu_families(name, manufacturer_id) values ('341', id_sim2k) on conflict do nothing returning id into s341;
  select id into s341 from ecu_families where name='341' and manufacturer_id=id_sim2k;
  insert into ecu_families(name, manufacturer_id) values ('250', id_sim2k) on conflict do nothing returning id into s250;
  select id into s250 from ecu_families where name='250' and manufacturer_id=id_sim2k;
  insert into ecu_families(name, manufacturer_id) values ('259', id_sim2k) on conflict do nothing returning id into s259;
  select id into s259 from ecu_families where name='259' and manufacturer_id=id_sim2k;

  -- SIM2K / 47 model codes + software IDs
  insert into ecu_model_codes(name,family_id) values ('NF',s47) on conflict do nothing;
  select id into mc from ecu_model_codes where name='NF' and family_id=s47;
  insert into ecu_software_ids(name,model_code_id) values ('330',mc),('331',mc),('332',mc),('333',mc) on conflict do nothing;

  insert into ecu_model_codes(name,family_id) values ('MG',s47) on conflict do nothing;
  select id into mc from ecu_model_codes where name='MG' and family_id=s47;
  insert into ecu_software_ids(name,model_code_id) values ('330',mc),('331',mc) on conflict do nothing;

  insert into ecu_model_codes(name,family_id) values ('UN',s47) on conflict do nothing;
  select id into mc from ecu_model_codes where name='UN' and family_id=s47;
  insert into ecu_software_ids(name,model_code_id) values ('330',mc) on conflict do nothing;

  insert into ecu_model_codes(name,family_id) values ('TC',s47) on conflict do nothing;
  select id into mc from ecu_model_codes where name='TC' and family_id=s47;
  insert into ecu_software_ids(name,model_code_id) values ('330',mc) on conflict do nothing;

  insert into ecu_model_codes(name,family_id) values ('LM',s47) on conflict do nothing;
  select id into mc from ecu_model_codes where name='LM' and family_id=s47;
  insert into ecu_software_ids(name,model_code_id) values ('330',mc) on conflict do nothing;

  -- SIM2K / 140
  insert into ecu_model_codes(name,family_id) values ('NF',s140) on conflict do nothing;
  select id into mc from ecu_model_codes where name='NF' and family_id=s140;
  insert into ecu_software_ids(name,model_code_id) values ('330',mc),('331',mc),('332',mc) on conflict do nothing;

  insert into ecu_model_codes(name,family_id) values ('MG',s140) on conflict do nothing;
  select id into mc from ecu_model_codes where name='MG' and family_id=s140;
  insert into ecu_software_ids(name,model_code_id) values ('330',mc),('331',mc) on conflict do nothing;

  insert into ecu_model_codes(name,family_id) values ('TD',s140) on conflict do nothing;
  select id into mc from ecu_model_codes where name='TD' and family_id=s140;
  insert into ecu_software_ids(name,model_code_id) values ('330',mc) on conflict do nothing;

  -- SIM2K / 141
  insert into ecu_model_codes(name,family_id) values ('NF',s141) on conflict do nothing;
  select id into mc from ecu_model_codes where name='NF' and family_id=s141;
  insert into ecu_software_ids(name,model_code_id) values ('330',mc),('331',mc),('332',mc),('333',mc),('2G330',mc) on conflict do nothing;

  insert into ecu_model_codes(name,family_id) values ('MG',s141) on conflict do nothing;
  select id into mc from ecu_model_codes where name='MG' and family_id=s141;
  insert into ecu_software_ids(name,model_code_id) values ('330',mc),('331',mc),('332',mc) on conflict do nothing;

  insert into ecu_model_codes(name,family_id) values ('UN',s141) on conflict do nothing;
  select id into mc from ecu_model_codes where name='UN' and family_id=s141;
  insert into ecu_software_ids(name,model_code_id) values ('330',mc),('331',mc) on conflict do nothing;

  insert into ecu_model_codes(name,family_id) values ('TD',s141) on conflict do nothing;
  select id into mc from ecu_model_codes where name='TD' and family_id=s141;
  insert into ecu_software_ids(name,model_code_id) values ('330',mc) on conflict do nothing;

  insert into ecu_model_codes(name,family_id) values ('TC',s141) on conflict do nothing;
  select id into mc from ecu_model_codes where name='TC' and family_id=s141;
  insert into ecu_software_ids(name,model_code_id) values ('330',mc),('331',mc) on conflict do nothing;

  insert into ecu_model_codes(name,family_id) values ('LM',s141) on conflict do nothing;
  select id into mc from ecu_model_codes where name='LM' and family_id=s141;
  insert into ecu_software_ids(name,model_code_id) values ('330',mc),('331',mc) on conflict do nothing;

  -- SIM2K / 241
  insert into ecu_model_codes(name,family_id) values ('NF',s241) on conflict do nothing;
  select id into mc from ecu_model_codes where name='NF' and family_id=s241;
  insert into ecu_software_ids(name,model_code_id) values ('350',mc),('351',mc),('352',mc) on conflict do nothing;

  insert into ecu_model_codes(name,family_id) values ('MG',s241) on conflict do nothing;
  select id into mc from ecu_model_codes where name='MG' and family_id=s241;
  insert into ecu_software_ids(name,model_code_id) values ('350',mc),('351',mc) on conflict do nothing;

  insert into ecu_model_codes(name,family_id) values ('TD',s241) on conflict do nothing;
  select id into mc from ecu_model_codes where name='TD' and family_id=s241;
  insert into ecu_software_ids(name,model_code_id) values ('350',mc),('351',mc) on conflict do nothing;

  insert into ecu_model_codes(name,family_id) values ('TC',s241) on conflict do nothing;
  select id into mc from ecu_model_codes where name='TC' and family_id=s241;
  insert into ecu_software_ids(name,model_code_id) values ('350',mc) on conflict do nothing;

  insert into ecu_model_codes(name,family_id) values ('LM',s241) on conflict do nothing;
  select id into mc from ecu_model_codes where name='LM' and family_id=s241;
  insert into ecu_software_ids(name,model_code_id) values ('350',mc) on conflict do nothing;

  -- SIM2K / 341
  insert into ecu_model_codes(name,family_id) values ('NF',s341) on conflict do nothing;
  select id into mc from ecu_model_codes where name='NF' and family_id=s341;
  insert into ecu_software_ids(name,model_code_id) values ('350',mc),('351',mc),('352',mc) on conflict do nothing;

  insert into ecu_model_codes(name,family_id) values ('MG',s341) on conflict do nothing;
  select id into mc from ecu_model_codes where name='MG' and family_id=s341;
  insert into ecu_software_ids(name,model_code_id) values ('350',mc),('351',mc) on conflict do nothing;

  insert into ecu_model_codes(name,family_id) values ('UN',s341) on conflict do nothing;
  select id into mc from ecu_model_codes where name='UN' and family_id=s341;
  insert into ecu_software_ids(name,model_code_id) values ('350',mc) on conflict do nothing;

  -- SIM2K / 250
  insert into ecu_model_codes(name,family_id) values ('NF',s250) on conflict do nothing;
  select id into mc from ecu_model_codes where name='NF' and family_id=s250;
  insert into ecu_software_ids(name,model_code_id) values ('330',mc),('331',mc),('332',mc) on conflict do nothing;

  insert into ecu_model_codes(name,family_id) values ('MG',s250) on conflict do nothing;
  select id into mc from ecu_model_codes where name='MG' and family_id=s250;
  insert into ecu_software_ids(name,model_code_id) values ('330',mc),('331',mc) on conflict do nothing;

  -- SIM2K / 259
  insert into ecu_model_codes(name,family_id) values ('NF',s259) on conflict do nothing;
  select id into mc from ecu_model_codes where name='NF' and family_id=s259;
  insert into ecu_software_ids(name,model_code_id) values ('330',mc),('331',mc),('332',mc),('333',mc) on conflict do nothing;

  insert into ecu_model_codes(name,family_id) values ('MG',s259) on conflict do nothing;
  select id into mc from ecu_model_codes where name='MG' and family_id=s259;
  insert into ecu_software_ids(name,model_code_id) values ('330',mc),('331',mc) on conflict do nothing;

  insert into ecu_model_codes(name,family_id) values ('UN',s259) on conflict do nothing;
  select id into mc from ecu_model_codes where name='UN' and family_id=s259;
  insert into ecu_software_ids(name,model_code_id) values ('330',mc) on conflict do nothing;

  -- ── BOSCH Families ─────────────────────────────────────────
  insert into ecu_families(name,manufacturer_id) values ('47', id_bosch)  on conflict do nothing;
  select id into b47  from ecu_families where name='47'  and manufacturer_id=id_bosch;
  insert into ecu_families(name,manufacturer_id) values ('140',id_bosch)  on conflict do nothing;
  select id into b140 from ecu_families where name='140' and manufacturer_id=id_bosch;
  insert into ecu_families(name,manufacturer_id) values ('141',id_bosch)  on conflict do nothing;
  select id into b141 from ecu_families where name='141' and manufacturer_id=id_bosch;
  insert into ecu_families(name,manufacturer_id) values ('241',id_bosch)  on conflict do nothing;
  select id into b241 from ecu_families where name='241' and manufacturer_id=id_bosch;
  insert into ecu_families(name,manufacturer_id) values ('341',id_bosch)  on conflict do nothing;
  select id into b341 from ecu_families where name='341' and manufacturer_id=id_bosch;
  insert into ecu_families(name,manufacturer_id) values ('411',id_bosch)  on conflict do nothing;
  select id into b411 from ecu_families where name='411' and manufacturer_id=id_bosch;

  -- BOSCH / 47
  insert into ecu_model_codes(name,family_id) values ('NF',b47) on conflict do nothing;
  select id into mc from ecu_model_codes where name='NF' and family_id=b47;
  insert into ecu_software_ids(name,model_code_id) values ('9P347',mc),('9P348',mc) on conflict do nothing;

  insert into ecu_model_codes(name,family_id) values ('MG',b47) on conflict do nothing;
  select id into mc from ecu_model_codes where name='MG' and family_id=b47;
  insert into ecu_software_ids(name,model_code_id) values ('9MG47',mc) on conflict do nothing;

  insert into ecu_model_codes(name,family_id) values ('UN',b47) on conflict do nothing;
  select id into mc from ecu_model_codes where name='UN' and family_id=b47;
  insert into ecu_software_ids(name,model_code_id) values ('9UN47',mc) on conflict do nothing;

  -- BOSCH / 140
  insert into ecu_model_codes(name,family_id) values ('NF',b140) on conflict do nothing;
  select id into mc from ecu_model_codes where name='NF' and family_id=b140;
  insert into ecu_software_ids(name,model_code_id) values ('9NF140',mc) on conflict do nothing;

  insert into ecu_model_codes(name,family_id) values ('MG',b140) on conflict do nothing;
  select id into mc from ecu_model_codes where name='MG' and family_id=b140;
  insert into ecu_software_ids(name,model_code_id) values ('9MG140',mc) on conflict do nothing;

  insert into ecu_model_codes(name,family_id) values ('TD',b140) on conflict do nothing;
  select id into mc from ecu_model_codes where name='TD' and family_id=b140;
  insert into ecu_software_ids(name,model_code_id) values ('9TD140',mc) on conflict do nothing;

  -- BOSCH / 141
  insert into ecu_model_codes(name,family_id) values ('NF',b141) on conflict do nothing;
  select id into mc from ecu_model_codes where name='NF' and family_id=b141;
  insert into ecu_software_ids(name,model_code_id) values ('2G330',mc),('2G331',mc),('2G332',mc) on conflict do nothing;

  insert into ecu_model_codes(name,family_id) values ('MG',b141) on conflict do nothing;
  select id into mc from ecu_model_codes where name='MG' and family_id=b141;
  insert into ecu_software_ids(name,model_code_id) values ('2MG330',mc),('2MG331',mc) on conflict do nothing;

  insert into ecu_model_codes(name,family_id) values ('UN',b141) on conflict do nothing;
  select id into mc from ecu_model_codes where name='UN' and family_id=b141;
  insert into ecu_software_ids(name,model_code_id) values ('2UN141',mc) on conflict do nothing;

  insert into ecu_model_codes(name,family_id) values ('TD',b141) on conflict do nothing;
  select id into mc from ecu_model_codes where name='TD' and family_id=b141;
  insert into ecu_software_ids(name,model_code_id) values ('2TD141',mc) on conflict do nothing;

  insert into ecu_model_codes(name,family_id) values ('TC',b141) on conflict do nothing;
  select id into mc from ecu_model_codes where name='TC' and family_id=b141;
  insert into ecu_software_ids(name,model_code_id) values ('2TC141',mc) on conflict do nothing;

  insert into ecu_model_codes(name,family_id) values ('LM',b141) on conflict do nothing;
  select id into mc from ecu_model_codes where name='LM' and family_id=b141;
  insert into ecu_software_ids(name,model_code_id) values ('2LM141',mc) on conflict do nothing;

  -- BOSCH / 241
  insert into ecu_model_codes(name,family_id) values ('NF',b241) on conflict do nothing;
  select id into mc from ecu_model_codes where name='NF' and family_id=b241;
  insert into ecu_software_ids(name,model_code_id) values ('4NF241',mc) on conflict do nothing;

  insert into ecu_model_codes(name,family_id) values ('MG',b241) on conflict do nothing;
  select id into mc from ecu_model_codes where name='MG' and family_id=b241;
  insert into ecu_software_ids(name,model_code_id) values ('4MG241',mc) on conflict do nothing;

  insert into ecu_model_codes(name,family_id) values ('UN',b241) on conflict do nothing;
  select id into mc from ecu_model_codes where name='UN' and family_id=b241;
  insert into ecu_software_ids(name,model_code_id) values ('4UN241',mc) on conflict do nothing;

  insert into ecu_model_codes(name,family_id) values ('TD',b241) on conflict do nothing;
  select id into mc from ecu_model_codes where name='TD' and family_id=b241;
  insert into ecu_software_ids(name,model_code_id) values ('4TD241',mc) on conflict do nothing;

  insert into ecu_model_codes(name,family_id) values ('TC',b241) on conflict do nothing;
  select id into mc from ecu_model_codes where name='TC' and family_id=b241;
  insert into ecu_software_ids(name,model_code_id) values ('4TC241',mc) on conflict do nothing;

  insert into ecu_model_codes(name,family_id) values ('LM',b241) on conflict do nothing;
  select id into mc from ecu_model_codes where name='LM' and family_id=b241;
  insert into ecu_software_ids(name,model_code_id) values ('4LM241',mc) on conflict do nothing;

  -- BOSCH / 341
  insert into ecu_model_codes(name,family_id) values ('NF',b341) on conflict do nothing;
  select id into mc from ecu_model_codes where name='NF' and family_id=b341;
  insert into ecu_software_ids(name,model_code_id) values ('6NF341',mc) on conflict do nothing;

  insert into ecu_model_codes(name,family_id) values ('MG',b341) on conflict do nothing;
  select id into mc from ecu_model_codes where name='MG' and family_id=b341;
  insert into ecu_software_ids(name,model_code_id) values ('6MG341',mc) on conflict do nothing;

  insert into ecu_model_codes(name,family_id) values ('UN',b341) on conflict do nothing;
  select id into mc from ecu_model_codes where name='UN' and family_id=b341;
  insert into ecu_software_ids(name,model_code_id) values ('6UN341',mc) on conflict do nothing;

  insert into ecu_model_codes(name,family_id) values ('JA',b341) on conflict do nothing;
  select id into mc from ecu_model_codes where name='JA' and family_id=b341;
  insert into ecu_software_ids(name,model_code_id) values ('6JA341',mc) on conflict do nothing;

  insert into ecu_model_codes(name,family_id) values ('KA',b341) on conflict do nothing;
  select id into mc from ecu_model_codes where name='KA' and family_id=b341;
  insert into ecu_software_ids(name,model_code_id) values ('6KA341',mc) on conflict do nothing;

  -- BOSCH / 411
  insert into ecu_model_codes(name,family_id) values ('NF',b411) on conflict do nothing;
  select id into mc from ecu_model_codes where name='NF' and family_id=b411;
  insert into ecu_software_ids(name,model_code_id) values ('8NF411',mc) on conflict do nothing;

  insert into ecu_model_codes(name,family_id) values ('MG',b411) on conflict do nothing;
  select id into mc from ecu_model_codes where name='MG' and family_id=b411;
  insert into ecu_software_ids(name,model_code_id) values ('8MG411',mc) on conflict do nothing;

  -- ── DELPHI ─────────────────────────────────────────────────
  insert into ecu_families(name,manufacturer_id) values ('DCM',id_delphi) on conflict do nothing;
  select id into d_dcm from ecu_families where name='DCM' and manufacturer_id=id_delphi;
  insert into ecu_families(name,manufacturer_id) values ('MT', id_delphi) on conflict do nothing;
  select id into d_mt  from ecu_families where name='MT'  and manufacturer_id=id_delphi;

  insert into ecu_model_codes(name,family_id) values ('NF',d_dcm) on conflict do nothing;
  select id into mc from ecu_model_codes where name='NF' and family_id=d_dcm;
  insert into ecu_software_ids(name,model_code_id) values ('DCM-NF01',mc),('DCM-NF02',mc) on conflict do nothing;

  insert into ecu_model_codes(name,family_id) values ('MG',d_dcm) on conflict do nothing;
  select id into mc from ecu_model_codes where name='MG' and family_id=d_dcm;
  insert into ecu_software_ids(name,model_code_id) values ('DCM-MG01',mc) on conflict do nothing;

  insert into ecu_model_codes(name,family_id) values ('NF',d_mt) on conflict do nothing;
  select id into mc from ecu_model_codes where name='NF' and family_id=d_mt;
  insert into ecu_software_ids(name,model_code_id) values ('MT-NF1',mc) on conflict do nothing;

  insert into ecu_model_codes(name,family_id) values ('TD',d_mt) on conflict do nothing;
  select id into mc from ecu_model_codes where name='TD' and family_id=d_mt;
  insert into ecu_software_ids(name,model_code_id) values ('MT-TD1',mc) on conflict do nothing;

  -- ── CONTINENTAL ────────────────────────────────────────────
  insert into ecu_families(name,manufacturer_id) values ('SIM',id_continental) on conflict do nothing;
  select id into c_sim from ecu_families where name='SIM' and manufacturer_id=id_continental;
  insert into ecu_families(name,manufacturer_id) values ('EMS',id_continental) on conflict do nothing;
  select id into c_ems from ecu_families where name='EMS' and manufacturer_id=id_continental;

  insert into ecu_model_codes(name,family_id) values ('NF',c_sim) on conflict do nothing;
  select id into mc from ecu_model_codes where name='NF' and family_id=c_sim;
  insert into ecu_software_ids(name,model_code_id) values ('SIM-NF1',mc) on conflict do nothing;

  insert into ecu_model_codes(name,family_id) values ('MG',c_sim) on conflict do nothing;
  select id into mc from ecu_model_codes where name='MG' and family_id=c_sim;
  insert into ecu_software_ids(name,model_code_id) values ('SIM-MG1',mc) on conflict do nothing;

  insert into ecu_model_codes(name,family_id) values ('NF',c_ems) on conflict do nothing;
  select id into mc from ecu_model_codes where name='NF' and family_id=c_ems;
  insert into ecu_software_ids(name,model_code_id) values ('EMS-NF1',mc) on conflict do nothing;

  -- ── DENSO ──────────────────────────────────────────────────
  insert into ecu_families(name,manufacturer_id) values ('275900',id_denso) on conflict do nothing;
  select id into dn275 from ecu_families where name='275900' and manufacturer_id=id_denso;
  insert into ecu_families(name,manufacturer_id) values ('276200',id_denso) on conflict do nothing;
  select id into dn276 from ecu_families where name='276200' and manufacturer_id=id_denso;

  insert into ecu_model_codes(name,family_id) values ('NF',dn275) on conflict do nothing;
  select id into mc from ecu_model_codes where name='NF' and family_id=dn275;
  insert into ecu_software_ids(name,model_code_id) values ('275900-NF1',mc) on conflict do nothing;

  insert into ecu_model_codes(name,family_id) values ('NF',dn276) on conflict do nothing;
  select id into mc from ecu_model_codes where name='NF' and family_id=dn276;
  insert into ecu_software_ids(name,model_code_id) values ('276200-NF1',mc) on conflict do nothing;

  -- ── SIEMENS ────────────────────────────────────────────────
  insert into ecu_families(name,manufacturer_id) values ('SIM',id_siemens) on conflict do nothing;
  select id into sg_sim from ecu_families where name='SIM' and manufacturer_id=id_siemens;
  insert into ecu_families(name,manufacturer_id) values ('VDO',id_siemens) on conflict do nothing;
  select id into sg_vdo from ecu_families where name='VDO' and manufacturer_id=id_siemens;

  insert into ecu_model_codes(name,family_id) values ('NF',sg_sim) on conflict do nothing;
  select id into mc from ecu_model_codes where name='NF' and family_id=sg_sim;
  insert into ecu_software_ids(name,model_code_id) values ('SGSIM-NF',mc) on conflict do nothing;

  insert into ecu_model_codes(name,family_id) values ('NF',sg_vdo) on conflict do nothing;
  select id into mc from ecu_model_codes where name='NF' and family_id=sg_vdo;
  insert into ecu_software_ids(name,model_code_id) values ('VDO-NF1',mc) on conflict do nothing;

end $$;
