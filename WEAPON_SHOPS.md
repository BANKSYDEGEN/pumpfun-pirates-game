# Main Street SWORD SHOP + MUSKET SHOP: gameplay hookup

BANKSY decided on Nov 3 that the weapons are sold in two Main Street buildings past the plaza, toward the town gate.
Timothy is rebuilding both exteriors in Blender with his shared material library on `timothy/plaza-blender`.
This branch adds only the gameplay hookup:
- the door interact points (E on desktop, tap the prompt on a phone)
- the store window wiring
- simple placeholder signs

No building is modelled or retextured here.

## Config: `js/island/battleAreas.js` `MAIN_ST_SHOPS`
```js
{ id: 'sword_shop',  vendor: 'weapons', tab: 'swords',  lx: -6.88, lz: -133.83, yaw:  Math.PI / 2, door: [0, 6.48], w: 9.66, d: 9.77, sign: 'SWORD SHOP',  label: 'E · SWORD SHOP',  empty: 'door_swords' },
{ id: 'musket_shop', vendor: 'weapons', tab: 'muskets', lx: 18.87, lz: -133.83, yaw: -Math.PI / 2, door: [0, 6.47], w: 9.66, d: 9.74, sign: 'MUSKET SHOP', label: 'E · MUSKET SHOP', empty: 'door_muskets' },
```
- `lx, lz, yaw`: the building's centre and facing, in town-local coordinates. +z of the building points out of its front door.
- `door`: the door offset in the building's own frame, as [along the front, out of the front]. The E/tap spot sits just outside the door.
- `w, d, sign`: used only to place the placeholder hanging sign. It uses the same style as the street SHOP and TAVERN signs.
- `empty`: when Timothy's GLB is in the scene, an Object3D with this name becomes the door. The interact point moves 1.2 m out along the empty's +z, and the placeholder sign is hidden.
  `js/onfoot/battle.js` polls for `door_swords` and `door_muskets` every 3 s for 3 minutes. After that, call `PFP.dock.battle.setShopDoor('sword_shop', obj)`.
  **For Timothy:** put an empty named `door_swords` in the sword shop GLB and one named `door_muskets` in the musket shop GLB, each at its front door with +Z pointing out to the street.
- The SWORD SHOP opens `openWeaponStore('swords')` and the MUSKET SHOP opens `openWeaponStore('muskets')`, via `{ kind: 'shop', vendor: 'weapons', tab }`.
  The window shows both tabs.

## Where they are today
They point at Main Street lots L6 and R6 (foot.js `buildStreet`). These are existing houses that face each other halfway between the square and the town gate.

| shop | building (town-local lx, lz) | door point (town-local lx, lz) |
|---|---|---|
| SWORD SHOP | -6.88, -133.83 (west side, faces +lx) | -0.40, -133.83 |
| MUSKET SHOP | 18.87, -133.83 (east side, faces -lx) | 12.40, -133.83 |

Main Street is the same with the default plaza (PV2) and with `?plaza=1` (v103), so the shops work with either.
Neither depends on the plaza-blender `shop_weapons` storefront. If that branch lands, leave its entry as `soon` or drop it.
The old WEAPON STORE placeholder signpost (BA.STORE at lx -6, lz -52) is gone.

## Shots
All in `screens/battle/ship/`:
- `<dev>_sword_shop_front.png` and `<dev>_musket_shop_front.png`: the shopfronts
- `<dev>_*_door.png`: the prompt at each door
- `<dev>_*_window.png` and `<dev>_*_detail.png`: each store window open
