import { DDBEmbeddedSheet } from "./embedded-sheet.js";
import { parseDDBCharacter } from "./importer.js";

// Hook to register the custom actor sheet
Hooks.once("init", () => {
  console.log("[DDB-Bridge] Initializing D&D Beyond Bridge Module");

  Actors.registerSheet("dnd5e", DDBEmbeddedSheet, {
    types: ["character"],
    makeDefault: false,
    label: "D&D Beyond Embedded Sheet"
  });
});

// State to track pending chat card clicks
let pendingCardClick = null;

// Hook to start listening to the extension bridge when Foundry is ready
Hooks.once("ready", () => {
  window.addEventListener("message", handleIncomingBridgeMessage);
  console.log("[DDB-Bridge] Ready. Active listener registered.");
});

// Hook to auto-click the Attack/Damage button when a chat card is rendered
Hooks.on("renderChatMessageHTML", (message, html, data) => {
  if (!pendingCardClick) return;

  const root = (html && typeof html.find === "function")
    ? html[0]
    : (html instanceof Element ? html : (html && html.length ? html[0] : html));

  if (!root || typeof root.querySelector !== "function") return;

  // Extract item name from HTML.
  // Search within the card body first to avoid matching the actor's name (which also uses the '.title' class) in the message header.
  const cardEl = root.querySelector(".chat-card") || root.querySelector(".activation-card") || root.querySelector(".card-header") || root.querySelector(".message-content");
  const titleEl = cardEl
    ? (cardEl.querySelector(".title") || cardEl.querySelector(".card-name") || cardEl.querySelector("h3"))
    : (root.querySelector(".title") || root.querySelector(".card-name") || root.querySelector("h3"));

  const itemName = titleEl ? titleEl.textContent.trim() : (message.item?.name || message.flags?.dnd5e?.use?.item?.name || "");

  if (!itemName || itemName.toLowerCase() !== pendingCardClick.itemName) return;

  const action = pendingCardClick.action; // "attack" or "damage"
  const rollActionName = `roll${action.charAt(0).toUpperCase() + action.slice(1)}`; // e.g. rollAttack, rollDamage


  const button = root.querySelector(`button[data-action="${action}"]`) ||
                 root.querySelector(`[data-action="${action}"]`) ||
                 root.querySelector(`button[data-action="${rollActionName}"]`) ||
                 root.querySelector(`[data-action="${rollActionName}"]`);

  if (button) {
    console.log(`[DDB-Bridge] Auto-clicking chat card button for action: ${action}`);
    
    // Clear pending state
    const currentRollMode = pendingCardClick.rollMode;
    pendingCardClick = null;

    if (action === "attack") {
      autoResolveAttackRoll(currentRollMode);
    }

    button.click();
  }
});

// Hook to sync native updates back to D&D Beyond
Hooks.on("updateActor", (actor, change, options, userId) => {
  // Only sync if the current user made the change
  if (userId !== game.userId) return;
  // Prevent infinite loop if this update was triggered by our own sync
  if (options.ddbBridgeSync) return;

  const characterId = actor.getFlag("ddb-bridge", "characterId");
  if (!characterId) return;

  // We check if hp or spell slots were updated
  const hpUpdate = foundry.utils.getProperty(change, "system.attributes.hp");
  const spellsUpdate = foundry.utils.getProperty(change, "system.spells");

  if (hpUpdate || spellsUpdate) {
    const payload = {
      source: "ddb-bridge-foundry",
      characterId,
      type: "STATE_UPDATE",
      data: {}
    };

    if (hpUpdate && typeof hpUpdate.value === "number") {
      payload.data.hp = hpUpdate.value;
    }

    if (spellsUpdate) {
      payload.data.spellSlots = {};
      for (let i = 1; i <= 9; i++) {
        const lvl = spellsUpdate[`spell${i}`];
        if (lvl && typeof lvl.value === "number") {
          payload.data.spellSlots[i] = {
            value: lvl.value,
            max: lvl.max || actor.system.spells[`spell${i}`].max
          };
        }
      }
    }

    // Find the sheet and post message to iframe
    const sheet = Object.values(ui.windows).find(
      w => w instanceof DDBEmbeddedSheet && w.actor.id === actor.id
    );
    if (sheet) {
      const iframe = sheet.element.find(".ddb-sheet-iframe")[0];
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage(payload, "*");
      }
    }
  }
});

/**
 * Triggers a sync request by telling the iframe to fetch and return the character JSON.
 */
export async function syncActorFromDDB(actor) {
  const characterId = actor.getFlag("ddb-bridge", "characterId");
  if (!characterId) throw new Error("No D&D Beyond Character ID linked.");

  // Find sheet window and post message requesting JSON
  const sheet = Object.values(ui.windows).find(
    w => w instanceof DDBEmbeddedSheet && w.actor.id === actor.id
  );
  if (!sheet) throw new Error("Character sheet must be open to sync.");

  const iframe = sheet.element.find(".ddb-sheet-iframe")[0];
  if (!iframe || !iframe.contentWindow) throw new Error("Embedded sheet iframe not ready.");

  // Send request message
  iframe.contentWindow.postMessage({
    source: "ddb-bridge-foundry",
    characterId,
    type: "REQUEST_DDB_JSON"
  }, "*");
}

/**
 * Router for incoming postMessages from the D&D Beyond iframe content script.
 */
async function handleIncomingBridgeMessage(event) {
  const msg = event.data;
  if (!msg || msg.source !== "ddb-bridge-extension") return;

  const characterId = msg.characterId;
  if (!characterId) return;

  // Find the actor linked to this character ID
  const actor = game.actors.find(a => a.getFlag("ddb-bridge", "characterId") === characterId);
  if (!actor) {
    console.warn(`[DDB-Bridge] No actor found with DDB Character ID: ${characterId}`);
    return;
  }

  switch (msg.type) {
    case "DDB_JSON_RESPONSE":
      await handleDDBJsonResponse(actor, msg.data, msg.scrapedStats, msg.avatarBase64 || null);
      break;
    case "ROLL_ACTION":
      await handleRollAction(actor, msg.data);
      break;
    case "STATE_SYNC":
      await handleStateSync(actor, msg.data);
      break;
  }
}

/**
 * Updates the native Actor using imported JSON schema.
 * @param {Actor} actor
 * @param {object} ddbJson  - The raw JSON from character-service.dndbeyond.com
 * @param {object|null} scrapedStats - DOM-scraped AC/speed/initiative overrides
 * @param {string|null} avatarBase64 - Base64 data URL of the avatar image fetched
 *   from D&D Beyond by content.js (same-origin, no CORS). Preferred over raw URL.
 */
async function handleDDBJsonResponse(actor, ddbJson, scrapedStats = null, avatarBase64 = null) {
  try {
    const characterId = actor.getFlag("ddb-bridge", "characterId");
    
    // Delegate to ddb-importer if installed and active
    const ddbImporterActive = typeof game !== "undefined" && 
                              game.modules && 
                              typeof game.modules.get === "function" && 
                              game.modules.get("ddb-importer")?.active;

    if (ddbImporterActive && characterId) {
      console.log("[DDB-Bridge] ddb-importer is active. Delegating character sync to DDB Importer.");
      await actor.update({
        "flags.ddbimporter.dndbeyond.characterId": characterId,
        "flags.ddbimporter.dndbeyond.url": `https://www.dndbeyond.com/characters/${characterId}`
      });
      
      if (typeof DDBImporter !== "undefined" && typeof DDBImporter.importCharacter === "function") {
        const imported = await DDBImporter.importCharacter({
          actor: actor,
          notifier: (title, message) => {
            if (typeof ui.notifications !== "undefined") {
              ui.notifications.info(`[DDB Importer] ${title}: ${message}`);
            }
          }
        });
        if (imported) {
          console.log("[DDB-Bridge] Character sync via DDB Importer completed successfully.");
          if (typeof actor.getActiveTokens === "function") {
            const tokens = actor.getActiveTokens();
            const tokenImageSrc = actor.img;
            for (const token of tokens) {
              if (token.document) {
                await token.document.update({ "texture.src": tokenImageSrc });
              }
            }
          }
          return;
        }
      }
    }

    const { actorData, items } = await parseDDBCharacter(ddbJson);

    // Apply scraped DOM overrides if present
    if (scrapedStats) {
      if (typeof scrapedStats.ac === "number") {
        actorData.system.attributes.ac.flat = scrapedStats.ac;
        actorData.system.attributes.ac.calc = "flat";
      }
      if (typeof scrapedStats.speed === "number") {
        actorData.system.attributes.movement.walk = scrapedStats.speed;
      }
      if (typeof scrapedStats.initiative === "number") {
        const dexVal = actorData.system.abilities.dex.value || 10;
        const dexMod = Math.floor((dexVal - 10) / 2);
        actorData.system.attributes.init = {
          bonus: Math.max(0, scrapedStats.initiative - dexMod)
        };
      }
    }
    
    // Update main attributes
    await actor.update(actorData);

    // Update active tokens on the canvas.
    // Prefer avatarBase64 (data URL encoded from D&D Beyond origin by content.js)
    // because Foundry's texture loader cannot load raw D&D Beyond URLs cross-origin.
    const tokenImageSrc = avatarBase64 || actorData.img;
    if (tokenImageSrc && typeof actor.getActiveTokens === "function") {
      const tokens = actor.getActiveTokens();
      for (const token of tokens) {
        if (token.document) {
          await token.document.update({ "texture.src": tokenImageSrc });
        }
      }
    }


    // Sync items: Remove obsolete and update or create items
    const currentItems = actor.items.toObject();
    const itemsToDelete = [];
    const itemsToCreate = [];
    const itemsToUpdate = [];

    for (const newItem of items) {
      const match = currentItems.find(
        i => i.name.toLowerCase() === newItem.name.toLowerCase() && i.type === newItem.type
      );
      if (match) {
        newItem._id = match._id;
        itemsToUpdate.push(newItem);
      } else {
        itemsToCreate.push(newItem);
      }
    }

    // Delete items that are no longer present
    for (const currentItem of currentItems) {
      const match = items.find(
        i => i.name.toLowerCase() === currentItem.name.toLowerCase() && i.type === currentItem.type
      );
      // We only delete items sync'd from DDB (i.e. not custom items created by GM)
      if (!match && ["weapon", "equipment", "spell"].includes(currentItem.type)) {
        itemsToDelete.push(currentItem._id);
      }
    }

    if (itemsToDelete.length > 0) await actor.deleteEmbeddedDocuments("Item", itemsToDelete);
    if (itemsToUpdate.length > 0) await actor.updateEmbeddedDocuments("Item", itemsToUpdate);
    if (itemsToCreate.length > 0) await actor.createEmbeddedDocuments("Item", itemsToCreate);

    console.log(`[DDB-Bridge] Synced Actor ${actor.name} successfully.`);
  } catch (err) {
    console.error(`[DDB-Bridge] Error updating actor from DDB JSON:`, err);
    ui.notifications.error("Failed to parse and update character data.");
  }
}

/**
 * Triggers a native Foundry roll for an item/spell, or executes saves/checks.
 * When rollMode is 'advantage' or 'disadvantage', registers a one-time hook
 * that intercepts the Attack Roll configuration dialog and automatically clicks
 * the correct ADVANTAGE / NORMAL / DISADVANTAGE button.
 */
async function handleRollAction(actor, data) {
  const { name, type, rollMode } = data;

  if (type === "attack" || type === "spell" || type === "damage") {
    // Find matching item on actor
    const item = actor.items.find(i => i.name.toLowerCase() === name.toLowerCase());
    if (!item) {
      ui.notifications.warn(`Weapon or spell "${name}" not found on Foundry actor.`);
      return;
    }

    console.log(`[DDB-Bridge] Rolling item: ${item.name} (rollMode: ${rollMode || "flat"})`);

    // If a non-default roll mode was sent from D&D Beyond, pre-register a
    // dialog hook so we can auto-click the correct button when the Attack Roll
    // configuration dialog appears (after the player clicks ATTACK on the card).
    if (rollMode === "advantage" || rollMode === "disadvantage") {
      autoResolveAttackRoll(rollMode);
    }

    // Set pending chat card click
    const action = type === "damage" ? "damage" : "attack";
    pendingCardClick = {
      itemName: item.name.toLowerCase(),
      action: action,
      rollMode: rollMode || "flat"
    };

    // item.use() creates the chat card.  The Attack Roll dialog appears later
    // when the player (or a future auto-click) presses ATTACK on the card.
    await item.use();

  } else if (type === "save") {
    const abilityKey = getAbilityKey(name);
    if (abilityKey) {
      if (typeof actor.rollSavingThrow === "function") {
        await actor.rollSavingThrow({ ability: abilityKey });
      } else {
        await actor.rollAbilitySave(abilityKey);
      }
    }
  } else if (type === "check") {
    const abilityKey = getAbilityKey(name);
    if (abilityKey) {
      if (typeof actor.rollAbilityCheck === "function") {
        await actor.rollAbilityCheck({ ability: abilityKey });
      } else {
        await actor.rollAbilityTest(abilityKey);
      }
    }
  } else if (type === "skill") {
    const skillKey = getSkillKey(name);
    if (skillKey) {
      if (typeof actor.rollSkill === "function") {
        try {
          await actor.rollSkill({ skill: skillKey });
        } catch (e) {
          await actor.rollSkill(skillKey);
        }
      }
    }
  }
}

/**
 * Registers a one-time Foundry dialog hook that will fire when the Attack Roll
 * configuration dialog appears. The hook auto-clicks ADVANTAGE or DISADVANTAGE.
 *
 * The hook stays registered until the next dialog renders — this is fine because
 * the Attack Roll dialog is typically the next dialog to appear after item.use().
 *
 * @param {"advantage"|"disadvantage"} rollMode
 */
function autoResolveAttackRoll(rollMode) {
  // Map D&D Beyond roll mode → the button label in Foundry's Attack Roll dialog
  const labelMap = {
    advantage:    "ADVANTAGE",
    flat:         "NORMAL",
    disadvantage: "DISADVANTAGE"
  };
  const targetLabel = labelMap[rollMode] || "NORMAL";

  console.log(`[DDB-Bridge] Pre-registering Attack Roll dialog hook for: ${targetLabel}`);

  Hooks.once("renderDialog", (dialog, html) => {
    console.log(`[DDB-Bridge] renderDialog fired — title: "${dialog.title}"`);

    // Resolve the HTML root: Foundry v11 passes a jQuery object, v12 may pass Element
    const root = (html && typeof html.find === "function")
      ? html[0]
      : (html instanceof Element ? html : null);

    if (!root) {
      console.warn("[DDB-Bridge] renderDialog: could not resolve root element");
      return;
    }

    // Find all buttons in the dialog and click the one matching our label
    const buttons = root.querySelectorAll("button");
    let clicked = false;
    for (const btn of buttons) {
      if (btn.textContent.trim().toUpperCase() === targetLabel) {
        console.log(`[DDB-Bridge] Auto-clicking "${targetLabel}" in Attack Roll dialog`);
        btn.click();
        clicked = true;
        break;
      }
    }

    if (!clicked) {
      console.warn(`[DDB-Bridge] Could not find "${targetLabel}" button in dialog. Available buttons:`,
        Array.from(buttons).map(b => b.textContent.trim()));
    }
  });
}


/**
 * Updates actor's HP and spell slots directly from iframe.
 */
async function handleStateSync(actor, data) {
  const updates = {};

  if (typeof data.hp === "number") {
    updates["system.attributes.hp.value"] = data.hp;
  }

  if (typeof data.ac === "number") {
    updates["system.attributes.ac.flat"] = data.ac;
    updates["system.attributes.ac.calc"] = "flat";
  }

  if (typeof data.speed === "number") {
    updates["system.attributes.movement.walk"] = data.speed;
  }

  if (typeof data.initiative === "number") {
    const dexVal = actor.system.abilities.dex.value || 10;
    const dexMod = Math.floor((dexVal - 10) / 2);
    updates["system.attributes.init.bonus"] = Math.max(0, data.initiative - dexMod);
  }

  if (data.spellSlots) {
    for (const lvl in data.spellSlots) {
      updates[`system.spells.spell${lvl}.value`] = data.spellSlots[lvl].value;
      updates[`system.spells.spell${lvl}.max`] = data.spellSlots[lvl].max;
    }
  }

  if (Object.keys(updates).length > 0) {
    await actor.update(updates, { ddbBridgeSync: true });
  }
}

function getAbilityKey(name) {
  const mapping = {
    strength: "str", dex: "dex", dexterity: "dex", con: "con", constitution: "con",
    int: "int", intelligence: "int", intellect: "int", wis: "wis", wisdom: "wis",
    cha: "cha", charisma: "cha"
  };
  return mapping[name.toLowerCase()];
}

function getSkillKey(name) {
  const mapping = {
    athletics: "ath", acrobatics: "acr", "sleight of hand": "slt", stealth: "ste",
    arcana: "arc", history: "his", investigation: "inv", nature: "nat", religion: "rel",
    "animal handling": "ani", insight: "ins", medicine: "med", perception: "prc", survival: "srv",
    deception: "dec", intimidation: "itm", performance: "prf", persuasion: "per"
  };
  return mapping[name.toLowerCase()];
}
