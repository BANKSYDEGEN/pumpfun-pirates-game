import { assertEquals } from "jsr:@std/assert@1";
import { pulseWalks, PULSE_ACTION } from "./pulse.ts";

Deno.test("pulseWalks: only the three walk actions, cap 3, pet_walk needs a pet", () => {
  assertEquals(PULSE_ACTION, "pulse");
  assertEquals(pulseWalks(null), []);
  assertEquals(pulseWalks([{ action: "pet_walk" }]), []);
  assertEquals(pulseWalks([{ action: "pet_walk", pet: "pet_cat" }, { action: "parrot_walk" }, { action: "pilly_walk" }, { action: "pet_list" }]), [
    { action: "pet_walk", pet: "pet_cat" },
    { action: "parrot_walk" },
    { action: "pilly_walk" },
  ]);
});
