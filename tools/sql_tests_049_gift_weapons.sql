do $$
declare r jsonb; a text := 'dev:aaaaaaaaaaaaaaaaaaaa0335'; b text := 'dev:bbbbbbbbbbbbbbbbbbbb0335'; g uuid; out jsonb;
begin
  insert into pvp_dev_profiles (id) values (a), (b);
  perform pvp_inv_add(a, 'wpn:musket:navy:common', 1, 'carry_buy', 'test');
  perform pvp_inv_add(a, 'wpn:sword:cutlass:rare', 1, 'chest', 'test');
  insert into pvp_inv_equip (player_id, slot, item) values (a, 'musket', 'wpn:musket:navy:common');
  insert into pvp_gun_inst (player_id, item, place, acc) values (a, 'wpn:musket:navy:common', 'equip', '{"scope":"val:acc_scope"}') returning gid into g;
  r := pvp_inv_gift(a, b, 'wpn:musket:navy:common', 1, g);
  out := jsonb_build_object('gift', r, 'flag', pvp_flag('gift'),
    'b_inv', (select jsonb_agg(jsonb_build_object('item', item, 'src', source, 'q', qty)) from pvp_inv where player_id = b),
    'a_inv', (select jsonb_agg(jsonb_build_object('item', item, 'src', source, 'q', qty)) from pvp_inv where player_id = a),
    'a_eq', (select jsonb_agg(item) from pvp_inv_equip where player_id = a),
    'gun', (select jsonb_agg(jsonb_build_object('p', player_id, 'place', place, 'acc', acc)) from pvp_gun_inst where gid = g),
    'sword', pvp_inv_gift(a, b, 'wpn:sword:cutlass:rare', 1));
  raise exception 'RESULT %', out;
end $$;
