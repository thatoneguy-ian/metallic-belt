import { describe, it, expect } from "vitest";
import { parseDDBCharacter, normalizeItemName } from "../foundry-module/scripts/importer.js";
import characterSample from "./fixtures/character-sample.json";

describe("D&D Beyond Character Importer", () => {
  it("should parse character name, level, and class details", async () => {
    const result = await parseDDBCharacter(characterSample);
    
    expect(result.actorData.name).toBe("Grog the Mighty");
    expect(result.actorData.system.details.level).toBe(5);
    expect(result.actorData.system.details.class).toBe("Barbarian");
    expect(result.actorData.img).toBe("https://media.dndbeyond.com/character-avatars/12345.jpeg");
    expect(result.actorData.prototypeToken.texture.src).toBe("https://media.dndbeyond.com/character-avatars/12345.jpeg");
  });

  it("should parse and calculate ability scores including modifiers", async () => {
    const result = await parseDDBCharacter(characterSample);
    
    // Base Str 18 + 2 modifier = 20
    expect(result.actorData.system.abilities.str.value).toBe(20);
    // Base Dex 14 = 14
    expect(result.actorData.system.abilities.dex.value).toBe(14);
    // Base Con 16 + 1 modifier = 17
    expect(result.actorData.system.abilities.con.value).toBe(17);
    // Base Int 8 = 8
    expect(result.actorData.system.abilities.int.value).toBe(8);
    // Base Wis 10 = 10
    expect(result.actorData.system.abilities.wis.value).toBe(10);
    // Base Cha 8 = 8
    expect(result.actorData.system.abilities.cha.value).toBe(8);
  });

  it("should parse hit points correctly", async () => {
    const result = await parseDDBCharacter(characterSample);
    
    // Max HP = 35 (baseHitPoints)
    // Current HP = 35 - 10 (removedHitPoints) = 25
    // Temp HP = 5
    expect(result.actorData.system.attributes.hp.max).toBe(35);
    expect(result.actorData.system.attributes.hp.value).toBe(25);
    expect(result.actorData.system.attributes.hp.temp).toBe(5);
  });

  it("should parse spell slots remaining and max", async () => {
    const result = await parseDDBCharacter(characterSample);
    
    // level 1: max 4, used 2 -> remaining 2
    expect(result.actorData.system.spells.spell1.max).toBe(4);
    expect(result.actorData.system.spells.spell1.value).toBe(2);
    
    // level 2: max 2, used 0 -> remaining 2
    expect(result.actorData.system.spells.spell2.max).toBe(2);
    expect(result.actorData.system.spells.spell2.value).toBe(2);
  });

  it("should parse inventory weapons and armor into items array", async () => {
    const result = await parseDDBCharacter(characterSample);
    
    expect(result.items).toHaveLength(4); // 2 inventory items + 1 spells.class spell + 1 classSpells spell
    
    const greataxe = result.items.find(i => i.name === "Greataxe");
    expect(greataxe).toBeDefined();
    expect(greataxe.type).toBe("weapon");
    expect(greataxe.system.equipped).toBe(true);
    expect(greataxe.system.quantity).toBe(1);
    expect(greataxe.system.damage.parts[0][0]).toBe("1d12");
    expect(greataxe.system.damage.parts[0][1]).toBe("slashing");

    const leatherArmor = result.items.find(i => i.name === "Leather Armor");
    expect(leatherArmor).toBeDefined();
    expect(leatherArmor.type).toBe("equipment");
    expect(leatherArmor.system.equipped).toBe(true);
    expect(leatherArmor.system.armor.value).toBe(11);
  });

  it("should parse spells into items array", async () => {
    const result = await parseDDBCharacter(characterSample);

    const cureWounds = result.items.find(i => i.name === "Cure Wounds");
    expect(cureWounds).toBeDefined();
    expect(cureWounds.type).toBe("spell");
    expect(cureWounds.system.level).toBe(1);
    expect(cureWounds.system.preparation.prepared).toBe(true);
  });

  it("should parse a class's known/prepared spell list from classSpells, not just spells.class", async () => {
    // classSpells is where a caster's actual spell list lives (e.g. a Warlock's
    // known spells, including at-will cantrips) — distinct from char.spells.class,
    // which only covers spells granted outside the normal spell-list mechanism.
    // Before this fix, classSpells was never read, so these spells never became
    // Foundry items and rolling them reported "not found on Foundry actor."
    const result = await parseDDBCharacter(characterSample);

    const eldritchBlast = result.items.find(i => i.name === "Eldritch Blast");
    expect(eldritchBlast).toBeDefined();
    expect(eldritchBlast.type).toBe("spell");
    expect(eldritchBlast.system.level).toBe(0);
    expect(eldritchBlast.system.preparation.prepared).toBe(true);
  });

  it("should parse and calculate walking movement speed correctly", async () => {
    const result = await parseDDBCharacter(characterSample);
    expect(result.actorData.system.attributes.movement.walk).toBe(40);
  });

  it("should parse and calculate armor class correctly", async () => {
    const result = await parseDDBCharacter(characterSample);
    expect(result.actorData.system.attributes.ac.flat).toBe(18);
    expect(result.actorData.system.attributes.ac.calc).toBe("flat");
  });

  it("should parse senses correctly", async () => {
    const result = await parseDDBCharacter(characterSample);
    expect(result.actorData.system.attributes.senses.blindsight).toBe(10);
    expect(result.actorData.system.attributes.senses.darkvision).toBe(60);
  });

  it("should normalize protocol-relative avatar URLs starting with //", async () => {
    const sampleCopy = JSON.parse(JSON.stringify(characterSample));
    sampleCopy.data.decorations.avatarUrl = "//media.dndbeyond.com/character-avatars/relative.jpeg";
    
    const result = await parseDDBCharacter(sampleCopy);
    expect(result.actorData.img).toBe("https://media.dndbeyond.com/character-avatars/relative.jpeg");
    expect(result.actorData.prototypeToken.texture.src).toBe("https://media.dndbeyond.com/character-avatars/relative.jpeg");
  });

  it("should normalize root-relative avatar URLs starting with /", async () => {
    const sampleCopy = JSON.parse(JSON.stringify(characterSample));
    sampleCopy.data.decorations.avatarUrl = "/character-avatars/relative.jpeg";
    
    const result = await parseDDBCharacter(sampleCopy);
    expect(result.actorData.img).toBe("https://www.dndbeyond.com/character-avatars/relative.jpeg");
    expect(result.actorData.prototypeToken.texture.src).toBe("https://www.dndbeyond.com/character-avatars/relative.jpeg");
  });

  describe("normalizeItemName helper", () => {
    it("should reverse names with commas like 'Crossbow, Light'", () => {
      expect(normalizeItemName("Crossbow, Light")).toBe("light crossbow");
      expect(normalizeItemName("Leather, Studded")).toBe("studded leather");
    });

    it("should handle normal names correctly", () => {
      expect(normalizeItemName("Greataxe")).toBe("greataxe");
      expect(normalizeItemName("Plate")).toBe("plate");
    });
  });

  describe("fallback weapon attributes", () => {
    it("should parse simple/martial and melee/ranged weapon types and build activities", async () => {
      const sampleCopy = JSON.parse(JSON.stringify(characterSample));
      // Inject a Simple Ranged Weapon: Crossbow, Light
      sampleCopy.data.inventory.push({
        id: 1003,
        equipped: true,
        quantity: 1,
        definition: {
          name: "Crossbow, Light",
          description: "Ranged weapon",
          filterType: "Weapon",
          type: "Simple Ranged Weapon",
          damage: {
            diceCount: 1,
            diceValue: 8,
            diceMultiplier: null,
            fixedValue: null,
            diceString: "1d8"
          },
          damageType: "Piercing"
        }
      });

      const result = await parseDDBCharacter(sampleCopy);
      const crossbow = result.items.find(i => i.name === "Crossbow, Light");
      expect(crossbow).toBeDefined();
      expect(crossbow.system.type.value).toBe("simpleR");
      expect(crossbow.system.activities.ddbactivityweapon).toBeDefined();
      expect(crossbow.system.activities.ddbactivityweapon.type).toBe("attack");
      expect(crossbow.system.activities.ddbactivityweapon.attack.type.value).toBe("ranged");
      expect(crossbow.system.activities.ddbactivityweapon.damage.parts[0].formula).toBe("1d8");
    });
  });
});

