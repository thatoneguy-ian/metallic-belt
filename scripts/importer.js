/**
 * Normalizes item names for compendium matches (e.g. "Crossbow, Light" -> "light crossbow").
 */
export function normalizeItemName(name) {
  if (!name) return "";
  let norm = name.toLowerCase().trim();
  
  // Handle reversed names like "Crossbow, Light" -> "light crossbow"
  if (norm.includes(",")) {
    const parts = norm.split(",").map(p => p.trim());
    if (parts.length === 2) {
      return `${parts[1]} ${parts[0]}`;
    }
  }
  return norm;
}

/**
 * Maps a single D&D Beyond spell entry (from either the `spells.{source}` buckets
 * or a `classSpells[].spells` list — both use the same `{ definition, prepared }`
 * shape) into a Foundry Item data object, preferring a compendium match for fully
 * configured rolling activities and icons.
 * @returns {Promise<Object|null>} the mapped item, or null if the entry has no definition.
 */
async function mapDDBSpell(spellData) {
  const def = spellData.definition;
  if (!def) return null;

  // Try looking up the spell in the native system spells compendium
  let compendiumSpell = null;
  if (typeof game !== "undefined" && game.packs) {
    try {
      const pack = game.packs.get("dnd5e.spells");
      if (pack) {
        const index = await pack.getIndex();
        const normDefName = normalizeItemName(def.name);
        const entry = index.find(e => normalizeItemName(e.name) === normDefName);
        if (entry) {
          const doc = await pack.getDocument(entry._id);
          compendiumSpell = doc.toObject();
        }
      }
    } catch (err) {
      console.warn(`[DDB-Bridge] Error fetching compendium spell for ${def.name}:`, err);
    }
  }

  if (compendiumSpell) {
    return {
      ...compendiumSpell,
      name: def.name,
      _id: undefined,
      system: {
        ...compendiumSpell.system,
        preparation: {
          prepared: !!spellData.prepared
        }
      }
    };
  }

  return {
    name: def.name,
    type: "spell",
    system: {
      level: def.level || 0,
      preparation: {
        prepared: !!spellData.prepared
      }
    }
  };
}

/**
 * Parses D&D Beyond character JSON data into a Foundry VTT Actor and Items update structure.
 * Target: Foundry VTT v14 and D&D 5e system v3.x.
 * 
 * @param {Object} ddbData The character JSON returned from D&D Beyond API.
 * @returns {Promise<Object>} { actorData: Object, items: Array }
 */
export async function parseDDBCharacter(ddbData) {
  if (!ddbData || !ddbData.success || !ddbData.data) {
    throw new Error("Invalid D&D Beyond character data");
  }

  const char = ddbData.data;

  // 1. Ability Score Mapping
  const abilityMap = {
    1: "str",
    2: "dex",
    3: "con",
    4: "int",
    5: "wis",
    6: "cha"
  };

  const abilityNames = {
    1: "strength",
    2: "dexterity",
    3: "constitution",
    4: "intellect",
    5: "wisdom",
    6: "charisma"
  };

  const abilities = {};

  // Extract modifiers
  const modifierList = [];
  if (char.modifiers) {
    for (const source in char.modifiers) {
      if (Array.isArray(char.modifiers[source])) {
        modifierList.push(...char.modifiers[source]);
      }
    }
  }

  for (const stat of char.stats) {
    const abId = stat.id;
    const key = abilityMap[abId];
    if (!key) continue;

    // Base score
    let score = stat.value || 0;

    // Check overrides
    const override = char.overrideStats.find(o => o.id === abId);
    if (override && override.value !== null && override.value !== undefined) {
      score = override.value;
    } else {
      // Add bonuses
      const statName = abId === 4 ? "intelligence" : abilityNames[abId];
      const bonuses = modifierList.filter(
        m => m.type === "bonus" && m.subType === `${statName}-score`
      );
      for (const bonus of bonuses) {
        if (typeof bonus.value === "number") {
          score += bonus.value;
        }
      }
    }

    abilities[key] = { value: score };
  }

  // 2. Classes and Levels (resolved before HP below — total level feeds the CON HP bonus)
  const classesList = char.classes || [];
  const level = classesList.reduce((sum, c) => sum + (c.level || 0), 0);

  const startingClass = classesList.find(c => c.isStartingClass) || classesList[0];
  const className = startingClass ? startingClass.definition.name : "";

  // 3. Hit Points Mapping
  // char.baseHitPoints is ONLY the hit-die-derived portion of max HP — it does NOT
  // include the CON modifier bonus (CON mod x total levels), which D&D Beyond adds
  // separately. Verified against ddb-importer's reference implementation
  // (src/parser/character/hp.ts): maxHitPoints = constitutionHP + baseHitPoints,
  // unless overrideHitPoints is set, in which case that manual value replaces the
  // calculation entirely rather than being added to it. Omitting both meant every
  // imported character's max HP was short by its CON contribution.
  const overrideHitPoints = char.overrideHitPoints || 0;
  const conModForHP = Math.floor(((abilities.con?.value ?? 10) - 10) / 2);
  const constitutionHP = conModForHP * level;
  const maxHP = overrideHitPoints !== 0 ? overrideHitPoints : (char.baseHitPoints || 0) + constitutionHP;
  const currentHP = Math.max(0, maxHP - (char.removedHitPoints || 0));
  const tempHP = char.temporaryHitPoints || 0;

  // 4. Spell Slots
  const spells = {};
  if (Array.isArray(char.spellSlots)) {
    for (const slot of char.spellSlots) {
      const slotLvl = slot.level;
      const key = `spell${slotLvl}`;
      spells[key] = {
        max: slot.max || 0,
        value: Math.max(0, (slot.max || 0) - (slot.used || 0))
      };
    }
  }

  // 4a. Senses
  const blindsightMod = modifierList.find(m => m.subType === "blindsight");
  const darkvisionMod = modifierList.find(m => m.subType === "darkvision");
  const tremorsenseMod = modifierList.find(m => m.subType === "tremorsense");
  const truesightMod = modifierList.find(m => m.subType === "truesight");

  const senses = {
    blindsight: blindsightMod ? (blindsightMod.value || 0) : 0,
    darkvision: darkvisionMod ? (darkvisionMod.value || 0) : 0,
    tremorsense: tremorsenseMod ? (tremorsenseMod.value || 0) : 0,
    truesight: truesightMod ? (truesightMod.value || 0) : 0,
    units: "ft"
  };

  // 4b. Movement Speed
  let walkSpeed = 30;
  if (char.race && char.race.weightSpeeds && char.race.weightSpeeds.normal && typeof char.race.weightSpeeds.normal.walk === "number") {
    walkSpeed = char.race.weightSpeeds.normal.walk;
  } else if (char.race && typeof char.race.baseSpeed === "number") {
    walkSpeed = char.race.baseSpeed;
  }
  const speedBonus = modifierList
    .filter(m => m.type === "bonus" && m.subType === "speed")
    .reduce((sum, m) => sum + (m.value || 0), 0);
  const finalWalkSpeed = walkSpeed + speedBonus;

  // 4c. Armor Class
  const getMod = (score) => Math.floor((score - 10) / 2);
  const dexMod = getMod(abilities.dex.value);
  const conMod = getMod(abilities.con.value);
  const wisMod = getMod(abilities.wis.value);

  const baseSetAc = modifierList.find(m => m.type === "set" && m.subType === "unarmored-armor-class");
  const equippedArmor = char.inventory ? char.inventory.find(i => i.equipped && i.definition.filterType === "Armor" && i.definition.type !== "Shield") : null;
  const equippedShield = char.inventory ? char.inventory.find(i => i.equipped && i.definition.filterType === "Armor" && i.definition.type === "Shield") : null;

  let armorAcValue = 10 + dexMod;
  if (equippedArmor) {
    const armorAc = equippedArmor.definition.armorClass || 10;
    const armorType = equippedArmor.definition.type;
    if (armorType === "Light Armor") {
      armorAcValue = armorAc + dexMod;
    } else if (armorType === "Medium Armor") {
      armorAcValue = armorAc + Math.min(2, dexMod);
    } else if (armorType === "Heavy Armor") {
      armorAcValue = armorAc;
    }
  }

  let unarmoredAcValue = 10 + dexMod;
  if (baseSetAc && typeof baseSetAc.value === "number") {
    unarmoredAcValue = baseSetAc.value;
  } else {
    const hasMonk = classesList.some(c => c.definition.name.toLowerCase() === "monk");
    const hasBarb = classesList.some(c => c.definition.name.toLowerCase() === "barbarian");
    if (hasMonk) {
      unarmoredAcValue = 10 + dexMod + wisMod;
    } else if (hasBarb) {
      unarmoredAcValue = 10 + dexMod + conMod;
    }
  }

  let baseAc = Math.max(armorAcValue, unarmoredAcValue);

  if (equippedShield) {
    baseAc += (equippedShield.definition.armorClass || 2);
  }

  const acBonus = modifierList
    .filter(m => m.type === "bonus" && m.subType === "armor-class")
    .reduce((sum, m) => sum + (m.value || 0), 0);
  const finalAc = baseAc + acBonus;

  // Extract avatar URL from decorations
  let avatarUrl = (char.decorations && char.decorations.avatarUrl) || char.avatarUrl || "icons/svg/mystery-man.svg";
  if (avatarUrl) {
    if (avatarUrl.startsWith("//")) {
      avatarUrl = "https:" + avatarUrl;
    } else if (avatarUrl.startsWith("/") && !avatarUrl.startsWith("/icons/")) {
      avatarUrl = "https://www.dndbeyond.com" + avatarUrl;
    }
  }


  // Build the Foundry Actor update object
  const actorData = {
    name: char.name,
    img: avatarUrl,
    prototypeToken: {
      texture: {
        src: avatarUrl
      }
    },
    system: {
      abilities,
      attributes: {
        hp: {
          max: maxHP,
          value: currentHP,
          temp: tempHP
        },
        ac: {
          flat: finalAc,
          calc: "flat"
        },
        movement: {
          walk: finalWalkSpeed
        },
        senses
      },
      details: {
        level,
        class: className
      },
      spells
    }
  };

  // 5. Item Mapping (Inventory & Spells)
  const items = [];

  // Parse inventory
  if (Array.isArray(char.inventory)) {
    for (const invItem of char.inventory) {
      const def = invItem.definition;
      if (!def) continue;

      // Try looking up the item in the native system compendium for fully configured rolling activities and icons
      let compendiumItem = null;
      if (typeof game !== "undefined" && game.packs) {
        try {
          const pack = game.packs.get("dnd5e.items");
          if (pack) {
            const index = await pack.getIndex();
            const normDefName = normalizeItemName(def.name);
            const entry = index.find(e => normalizeItemName(e.name) === normDefName);
            if (entry) {
              const doc = await pack.getDocument(entry._id);
              compendiumItem = doc.toObject();
            }
          }
        } catch (err) {
          console.warn(`[DDB-Bridge] Error fetching compendium item for ${def.name}:`, err);
        }
      }

      let mappedItem;
      if (compendiumItem) {
        mappedItem = {
          ...compendiumItem,
          name: def.name,
          _id: undefined, // Let Foundry allocate ID
          system: {
            ...compendiumItem.system,
            equipped: !!invItem.equipped,
            quantity: invItem.quantity || 1
          }
        };
      } else {
        mappedItem = {
          name: def.name,
          system: {
            equipped: !!invItem.equipped,
            quantity: invItem.quantity || 1
          }
        };

        if (def.filterType === "Weapon") {
          mappedItem.type = "weapon";
          const diceString = def.damage ? def.damage.diceString : null;
          const damageType = def.damageType ? def.damageType.toLowerCase() : "";
          mappedItem.system.damage = {
            parts: diceString ? [[diceString, damageType]] : []
          };

          // Build robust system fields for v12/v14 compatibility
          const ddbType = (def.type || "").toLowerCase();
          let typeVal = "simpleM";
          if (ddbType.includes("simple") && ddbType.includes("melee")) typeVal = "simpleM";
          else if (ddbType.includes("simple") && ddbType.includes("ranged")) typeVal = "simpleR";
          else if (ddbType.includes("martial") && ddbType.includes("melee")) typeVal = "martialM";
          else if (ddbType.includes("martial") && ddbType.includes("ranged")) typeVal = "martialR";

          mappedItem.system.type = {
            value: typeVal
          };

          const isRanged = ddbType.includes("ranged");
          const activityId = "ddbactivityweapon";
          mappedItem.system.activities = {
            [activityId]: {
              _id: activityId,
              type: "attack",
              name: "Attack",
              activation: {
                type: "action",
                value: 1
              },
              attack: {
                ability: "",
                bonus: "",
                critThreshold: null,
                flat: false,
                type: {
                  value: isRanged ? "ranged" : "melee",
                  classification: "weapon"
                }
              },
              damage: {
                critical: {
                  bonus: ""
                },
                parts: diceString ? [
                  {
                    custom: {
                      enabled: false,
                      formula: ""
                    },
                    formula: diceString,
                    types: [damageType]
                  }
                ] : []
              }
            }
          };
        } else if (def.filterType === "Armor") {
          mappedItem.type = "equipment";
          mappedItem.system.armor = {
            value: def.armorClass || 0
          };
        } else {
          mappedItem.type = "loot";
        }
      }

      items.push(mappedItem);
    }
  }

  // Parse spells granted outside the normal class spell list (a feat- or
  // item-granted spell, a racial spell) — NOT a caster's actual known/prepared list.
  const spellSources = ["class", "race", "item", "feat"];
  if (char.spells) {
    for (const source of spellSources) {
      const spellList = char.spells[source];
      if (Array.isArray(spellList)) {
        for (const spellData of spellList) {
          const mappedSpell = await mapDDBSpell(spellData);
          if (mappedSpell) items.push(mappedSpell);
        }
      }
    }
  }

  // Parse each class's actual known/prepared spell list. This is a SEPARATE
  // top-level field from `char.spells` above — it's where a caster's real spell
  // list lives, including a Warlock's known spells (e.g. Eldritch Blast) and a
  // Wizard's spellbook. Without this, "spells known" casters import with no
  // spell items at all, even though `char.spells.class` may look populated.
  if (Array.isArray(char.classSpells)) {
    for (const classEntry of char.classSpells) {
      const spellList = classEntry.spells;
      if (!Array.isArray(spellList)) continue;
      for (const spellData of spellList) {
        const mappedSpell = await mapDDBSpell(spellData);
        if (mappedSpell) items.push(mappedSpell);
      }
    }
  }

  return { actorData, items };
}
