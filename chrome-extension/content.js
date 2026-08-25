/**
 * content.js - Injected into the D&D Beyond iframe (ISOLATED world) to bridge actions to Foundry VTT.
 */

// ─── Roll mode state ────────────────────────────────────────────────────────
// Tracks the roll mode selected via D&D Beyond's right-click context menu.
// Values: 'advantage' | 'flat' | 'disadvantage'
let _rollMode = "flat";

/** Returns the currently selected roll mode. */
function getRollMode() {
  return _rollMode;
}

/** Sets the current roll mode (used by tests and the context menu observer). */
function setRollMode(mode) {
  _rollMode = mode;
}

// ─── Click Guard and Debounce ────────────────────────────────────────────────
let lastRollName = null;
let lastRollType = null;
let lastRollTime = 0;

function shouldProcessClick(event) {
  return event && event.isTrusted === true;
}

function resetRollDebounce() {
  lastRollName = null;
  lastRollType = null;
  lastRollTime = 0;
}

function checkRollDebounce(name, type) {
  const now = Date.now();
  if (lastRollName === name && lastRollType === type && (now - lastRollTime) < 500) {
    return false;
  }
  lastRollName = name;
  lastRollType = type;
  lastRollTime = now;
  return true;
}

function setRollDebounceTime(time) {
  lastRollTime = time;
}

// Extract character ID from the URL path (e.g. /characters/12345678)
const charIdMatch = window.location.pathname.match(/characters\/(\d+)/);
const characterId = charIdMatch ? charIdMatch[1] : null;

if (window.self !== window.top && characterId) {
  console.log(`[DDB-Bridge] Bridge content script active in iframe for Character ID: ${characterId}`);
  initializeBridge();
}

function initializeBridge() {
  // 1. Roll mode context menu observer — must be set up before any clicks
  setupContextMenuObserver();

  // 2. Roll / Click Interception
  document.addEventListener("click", (event) => {
    if (!shouldProcessClick(event)) return;
    handleRollClick(event);
  }, true);

  // 3. DOM Observer for state updates from D&D Beyond -> Foundry
  setupStateObservers();

  // 4. Message Listener for state updates from Foundry -> D&D Beyond
  window.addEventListener("message", (event) => {
    const message = event.data;
    if (message && message.source === "ddb-bridge-foundry" && message.characterId === characterId) {
      console.log("[DDB-Bridge] Received message from Foundry:", message);
      if (message.type === "REQUEST_DDB_JSON") {
        fetchCharacterJson();
      } else if (message.type === "STATE_UPDATE") {
        handleIncomingState(message);
      }
    }
  });

  // 5. Delayed initial scrape to sync fully rendered stats
  window.addEventListener("load", () => {
    setTimeout(sendInitialScrapedStats, 3000);
  });
  if (document.readyState === "complete") {
    setTimeout(sendInitialScrapedStats, 3000);
  }
}

/**
 * Sends initial scraped values (AC, Speed, HP, Initiative, Spell slots) to Foundry.
 */
function sendInitialScrapedStats() {
  console.log("[DDB-Bridge] Running initial page DOM scrape...");
  const diff = {};
  
  const ac = scrapeAC();
  const speed = scrapeSpeed();
  const init = scrapeInitiative();
  const hp = scrapeHP();

  if (ac !== null) diff.ac = ac;
  if (speed !== null) diff.speed = speed;
  if (init !== null) diff.initiative = init;
  if (hp !== null) diff.hp = hp;

  const slots = calculateSpellSlots();
  if (Object.keys(slots).length > 0) diff.spellSlots = slots;

  if (Object.keys(diff).length > 0) {
    console.log("[DDB-Bridge] Sending initial scraped stats to Foundry VTT:", diff);
    sendStateToFoundry(diff);
  }
}

/**
 * Fetches character JSON from the DDB endpoint (CORS-free within page origin) and posts it to Foundry VTT.
 * Also fetches the avatar image and encodes it as a base64 data URL so Foundry can use it
 * without hitting CORS restrictions (Foundry's origin is blocked by D&D Beyond's CDN).
 */
async function fetchCharacterJson() {
  try {
    const url = `https://character-service.dndbeyond.com/character/v5/character/${characterId}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch character: ${response.statusText}`);
    }
    const data = await response.json();

    const scrapedStats = {
      ac: scrapeAC(),
      speed: scrapeSpeed(),
      initiative: scrapeInitiative()
    };

    // Attempt to fetch the avatar image and encode as base64 data URL.
    // This runs on the D&D Beyond page origin, so there are no CORS restrictions.
    // Foundry (a different origin) cannot fetch D&D Beyond images directly.
    let avatarBase64 = null;
    try {
      const avatarUrl = data?.data?.decorations?.avatarUrl;
      if (avatarUrl) {
        const imgResponse = await fetch(avatarUrl);
        if (imgResponse.ok) {
          const blob = await imgResponse.blob();
          avatarBase64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          console.log("[DDB-Bridge] Avatar encoded as base64 data URL (bypasses CORS).");
        }
      }
    } catch (imgErr) {
      console.warn("[DDB-Bridge] Could not encode avatar as base64, will use URL fallback:", imgErr.message);
    }

    window.parent.postMessage({
      source: "ddb-bridge-extension",
      characterId: characterId,
      type: "DDB_JSON_RESPONSE",
      data: data,
      scrapedStats: scrapedStats,
      avatarBase64: avatarBase64   // null if fetch failed; main.js falls back to avatarUrl
    }, "*");
  } catch (err) {
    console.error("[DDB-Bridge] Error fetching DDB JSON:", err);
  }
}

/**
 * Helper to scrape a stat based on its textual label in the DOM.
 */
function scrapeStatByLabel(labelText) {
  const elements = Array.from(document.querySelectorAll("div, span, p, label, h1, h2, h3, h4, h5, h6"));
  const labelEl = elements.find(el => el.textContent.trim().toUpperCase() === labelText.toUpperCase());
  if (!labelEl) return null;
  
  const parent = labelEl.parentElement;
  if (parent) {
    const parentText = parent.textContent.replace(labelEl.textContent, "").trim();
    const match = parentText.match(/(-?\d+)/);
    if (match) return parseInt(match[1], 10);
  }
  
  const parentEl = labelEl.parentElement;
  if (parentEl) {
    for (const child of parentEl.children) {
      if (child === labelEl) continue;
      const match = child.textContent.trim().match(/(-?\d+)/);
      if (match) return parseInt(match[1], 10);
    }
  }
  return null;
}

function scrapeAC() {
  const val = scrapeStatByLabel("ARMOR CLASS");
  if (val !== null) return val;
  const el = document.querySelector(".ct-armor-class-box__value, .ct-combat-summary__ac-value, .ct-armor-class-box__ac-value");
  return el ? parseInt(el.textContent.trim(), 10) : null;
}

function scrapeInitiative() {
  const val = scrapeStatByLabel("INITIATIVE");
  if (val !== null) return val;
  const el = document.querySelector(".ct-initiative-summary__value, .ct-initiative-box__value");
  return el ? parseInt(el.textContent.trim(), 10) : null;
}

function scrapeSpeed() {
  const val = scrapeStatByLabel("WALKING") || scrapeStatByLabel("SPEED") || scrapeStatByLabel("WALKING SPEED");
  if (val !== null) return val;
  const el = document.querySelector(".ct-speed-summary__speed, .ct-speed-summary__value, .ct-speed-summary__walking-value");
  return el ? parseInt(el.textContent.trim(), 10) : null;
}

function scrapeHP() {
  const hpInput = document.querySelector('input[name="currentHp"], .ct-health-summary__hp-number');
  if (hpInput) {
    return parseInt(hpInput.value || hpInput.textContent, 10);
  }
  return null;
}

/**
 * Helper to find a parent element whose class list contains any of the keywords.
 */
function findParentByClassKeyword(element, keywords) {
  const EXCLUDED_SUFFIXES = [
    "__tohit", "__to-hit", "__damage", "__action", "__primary", 
    "__ability-modifier", "__modifier", "__col", "__cell", 
    "__roll", "__value", "__icon", "__label", "__header", "__type"
  ];

  let curr = element;
  while (curr && curr !== document.body) {
    if (curr.classList) {
      for (const cls of curr.classList) {
        const clsLower = cls.toLowerCase();
        const isExcluded = EXCLUDED_SUFFIXES.some(suffix => clsLower.includes(suffix));
        if (isExcluded) continue;

        for (const kw of keywords) {
          if (clsLower.includes(kw.toLowerCase())) {
            return curr;
          }
        }
      }
    }
    curr = curr.parentElement;
  }
  return null;
}

/**
 * Helper to find a child element whose class list contains any of the keywords.
 */
function findChildByClassKeyword(parent, keywords) {
  if (!parent) return null;
  const elements = parent.querySelectorAll("*");
  for (const el of elements) {
    if (el.classList) {
      for (const cls of el.classList) {
        for (const kw of keywords) {
          if (cls.toLowerCase().includes(kw.toLowerCase())) {
            return el;
          }
        }
      }
    }
  }
  return null;
}

/**
 * Finds if the clicked element or any of its parents is a roll button.
 */
function findRollTarget(element) {
  let curr = element;
  while (curr && curr !== document.body) {
    if (curr.classList && curr.classList.length > 0) {
      const hasIntegratedDice = Array.from(curr.classList).some(c => c.includes("integrated-dice"));
      if (
        hasIntegratedDice ||
        curr.classList.contains("ddbc-roll-button") ||
        curr.classList.contains("ct-combat-attack__roll") ||
        curr.classList.contains("ct-spells-spell__roll") ||
        curr.classList.contains("ddbc-saving-throw__roll") ||
        curr.classList.contains("ct-skills__col--roll")
      ) {
        return curr;
      }
    }
    if (curr.getAttribute && curr.getAttribute("role") === "button" && curr.textContent && curr.textContent.includes("Roll")) {
      return curr;
    }
    curr = curr.parentElement;
  }
  return null;
}

/**
 * Clean the extracted action name, resolving nested sub-elements that D&D Beyond uses.
 */
function getCleanName(nameEl) {
  if (!nameEl) return "";

  // Try to find specific name label sub-element (e.g. class containing 'label' or 'name-label')
  const labelEl = nameEl.querySelector('[class*="label"], [class*="name-label"]');
  if (labelEl) {
    return labelEl.textContent.trim();
  }

  // Fallback to first child text content if nested
  if (nameEl.firstElementChild) {
    return nameEl.firstElementChild.textContent.trim();
  }

  return nameEl.textContent.trim();
}

/**
 * Extracts action data (type, name, roll type) based on the clicked element's surroundings.
 */
function extractActionData(element) {
  let name = "";
  let type = "check";

  // Check closest match (supports classic class and CSS Module hashed class)
  const attackRow = element.closest(".ct-combat-attack") || findParentByClassKeyword(element, ["combat-attack", "combatAttack"]);
  const spellRow = element.closest(".ct-spells-spell") || findParentByClassKeyword(element, ["spells-spell", "spellsSpell", "spell-row"]);
  const saveEl = element.closest(".ddbc-saving-throw") || findParentByClassKeyword(element, ["saving-throw", "savingThrow"]);
  const abilityEl = element.closest(".ddbc-ability-summary") || findParentByClassKeyword(element, ["ability-summary", "abilitySummary"]);
  const skillRow = element.closest(".ct-skills__item") || findParentByClassKeyword(element, ["skills__item", "skillsItem", "skill-row"]);

  if (attackRow) {
    const nameEl = attackRow.querySelector(".ct-combat-attack__name") || findChildByClassKeyword(attackRow, ["attack__name", "attack-name", "combat-attack__name", "name"]);
    name = getCleanName(nameEl);
    type = "attack";
  } else if (spellRow) {
    const nameEl = spellRow.querySelector(".ct-spells-spell__name") || findChildByClassKeyword(spellRow, ["spell__name", "spell-name", "spells-spell__name", "name"]);
    name = getCleanName(nameEl);
    type = "spell";
  } else if (saveEl) {
    const labelEl = saveEl.querySelector(".ddbc-saving-throw__label") || findChildByClassKeyword(saveEl, ["saving-throw__label", "savingThrow__label", "label"]);
    name = getCleanName(labelEl);
    type = "save";
  } else if (abilityEl) {
    const labelEl = abilityEl.querySelector(".ddbc-ability-summary__label") || findChildByClassKeyword(abilityEl, ["ability-summary__label", "abilitySummary__label", "label"]);
    name = getCleanName(labelEl);
    type = "check";
  } else if (skillRow) {
    const nameEl = skillRow.querySelector(".ct-skills__col--skill") || findChildByClassKeyword(skillRow, ["skills__col--skill", "skill__name", "skill-name", "skill"]);
    name = getCleanName(nameEl);
    type = "skill";
  }

  if (!name) {
    name = element.textContent.trim();
  }

  return { name, type };
}

/**
 * Handles a captured-phase click on the document: identifies whether it targets a
 * D&D Beyond roll control, and if so, suppresses D&D Beyond's own native roll and
 * forwards the action to Foundry instead. Foundry is the sole roller — without this,
 * the same action rolled independently on both sides (see #main.js handleRollAction).
 *
 * @returns {boolean} true if a roll action was identified and suppressed (whether or
 *   not it was actually forwarded — a debounced duplicate is still suppressed so a
 *   rapid double-click can't roll natively in D&D Beyond just because Foundry ignored it).
 */
function handleRollClick(event) {
  const rollTarget = findRollTarget(event.target);
  if (!rollTarget) return false;

  const actionData = extractActionData(rollTarget);
  if (!actionData) return false;

  // D&D Beyond's own roll handling is attached below `document` in the click's
  // propagation path (either a delegated root listener or a listener on the
  // target itself). Halting the event here, before it reaches that target,
  // stops D&D Beyond's native roll animation/result from firing at all.
  event.preventDefault();
  event.stopImmediatePropagation();

  if (!checkRollDebounce(actionData.name, actionData.type)) {
    console.log("[DDB-Bridge] Debouncing duplicate click for:", actionData.name);
    return true;
  }

  // Include the roll mode selected via right-click context menu
  actionData.rollMode = _rollMode;
  console.log("[DDB-Bridge] Sending action to Foundry:", actionData);
  window.parent.postMessage({
    source: "ddb-bridge-extension",
    characterId: characterId,
    type: "ROLL_ACTION",
    data: actionData
  }, "*");
  return true;
}

/**
 * Sets up a MutationObserver to detect D&D Beyond's right-click context menu.
 *
 * D&D Beyond shows a floating context menu when the player right-clicks a dice
 * button. This menu contains Advantage / Flat (One Die) / Disadvantage options.
 * We observe when this menu is added to the DOM and attach click listeners to
 * each option so we can track the player's selected roll mode.
 *
 * Detection strategy: The menu contains all three of the key text labels
 * ("Advantage", "Flat", "Disadvantage") and has class names that include
 * those terms. We also handle generic menus that match those class patterns.
 */
function setupContextMenuObserver() {
  // Guard: document.body may be null if the script runs before the DOM is ready.
  // In that case, defer until DOMContentLoaded fires.
  const startObserving = () => {
    const target = document.body || document.documentElement;
    if (!target) {
      // Extremely early — try again after a tick
      setTimeout(startObserving, 50);
      return;
    }

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue; // elements only
          if (!isRollContextMenu(node)) continue;

          attachRollModeListeners(node);
        }
      }
    });

    observer.observe(target, { childList: true, subtree: true });
    console.log("[DDB-Bridge] Context menu observer active.");
  };

  if (document.readyState === "loading") {
    // DOM not ready yet — wait for it
    document.addEventListener("DOMContentLoaded", startObserving, { once: true });
  } else {
    // DOM already parsed, observe immediately
    startObserving();
  }
}

/**
 * Returns true if the given DOM node looks like D&D Beyond's roll mode
 * right-click context menu (contains Advantage + Disadvantage options).
 */
function isRollContextMenu(node) {
  if (!node.textContent) return false;
  const text = node.textContent;
  // Must mention both advantage and disadvantage to be the right menu
  return text.includes("Advantage") && text.includes("Disadvantage");
}

/**
 * Attaches click listeners to the roll-mode option buttons inside the
 * D&D Beyond right-click context menu.
 *
 * Handles both semantic class names (ct-beyond-dice-context-menu__roll-mode-option--advantage)
 * and the real DDB hashed class patterns by scanning for elements whose
 * class names or text content match Advantage / Flat / Disadvantage.
 */
function attachRollModeListeners(menuNode) {
  menuNode.addEventListener("click", (e) => {
    // Walk up from the click target to find an element with a meaningful class
    let target = e.target;
    while (target && target !== menuNode) {
      const classes = Array.from(target.classList || []).join(" ").toLowerCase();
      const text    = (target.textContent || "").trim().toLowerCase();

      if (classes.includes("disadvantage") || text === "disadvantage") {
        setRollMode("disadvantage");
        console.log("[DDB-Bridge] Roll mode → disadvantage");
        return;
      }
      if (classes.includes("advantage") || text === "advantage") {
        setRollMode("advantage");
        console.log("[DDB-Bridge] Roll mode → advantage");
        return;
      }
      // "Flat (One Die)" — class contains 'flat', or text starts with 'flat'
      if (classes.includes("--flat") || classes.includes("flat") || text.startsWith("flat")) {
        setRollMode("flat");
        console.log("[DDB-Bridge] Roll mode → flat");
        return;
      }

      target = target.parentElement;
    }
  });
}

let isSyncingFromFoundry = false;

/**
 * Observes changes to HP input fields and spell slot checkboxes to report to Foundry VTT.
 */
function setupStateObservers() {
  document.addEventListener("change", (event) => {
    if (isSyncingFromFoundry) return;

    const target = event.target;
    if (!target) return;

    if (target.name === "currentHp" || target.classList.contains("ct-health-summary__hp-number")) {
      const hp = parseInt(target.value, 10);
      if (!isNaN(hp)) {
        sendStateToFoundry({ hp });
      }
    }
  });

  document.addEventListener("click", (event) => {
    if (isSyncingFromFoundry) return;

    const target = event.target;
    if (!target) return;

    const spellSlotBubble = target.closest(".ct-spells-level-slot, .ct-spells-spell__slot-checkbox");
    if (spellSlotBubble) {
      setTimeout(() => {
        const slotsData = calculateSpellSlots();
        sendStateToFoundry({ spellSlots: slotsData });
      }, 100);
    }
  });
}

function sendStateToFoundry(diff) {
  window.parent.postMessage({
    source: "ddb-bridge-extension",
    characterId: characterId,
    type: "STATE_SYNC",
    data: diff
  }, "*");
}

/**
 * Scrapes spell slot DOM to determine current states.
 */
function calculateSpellSlots() {
  const levels = {};
  document.querySelectorAll(".ct-spells-level").forEach((levelContainer) => {
    const levelHeader = levelContainer.querySelector(".ct-spells-level__header");
    if (!levelHeader) return;
    
    const levelText = levelHeader.textContent.trim();
    const match = levelText.match(/(\d+)/);
    if (!match) return;
    const level = parseInt(match[1], 10);

    const slots = levelContainer.querySelectorAll(".ct-spells-level-slot");
    const total = slots.length;
    let used = 0;
    slots.forEach(slot => {
      if (slot.classList.contains("ct-spells-level-slot--used") || slot.querySelector("input:checked")) {
        used++;
      }
    });

    levels[level] = { max: total, value: total - used };
  });
  return levels;
}

/**
 * Handles incoming state changes from Foundry and updates the D&D Beyond UI.
 */
function handleIncomingState(message) {
  isSyncingFromFoundry = true;
  try {
    const diff = message.data;
    if (!diff) return;

  if (typeof diff.hp === "number") {
    const hpInput = document.querySelector('input[name="currentHp"], .ct-health-summary__hp-number');
    if (hpInput && parseInt(hpInput.value, 10) !== diff.hp) {
      hpInput.value = diff.hp;
      hpInput.dispatchEvent(new Event("input", { bubbles: true }));
      hpInput.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  if (diff.spellSlots) {
    for (const lvl in diff.spellSlots) {
      const slotInfo = diff.spellSlots[lvl];
      const levelContainer = Array.from(document.querySelectorAll(".ct-spells-level")).find(el => {
        const header = el.querySelector(".ct-spells-level__header");
        return header && header.textContent.includes(`${lvl}`);
      });

      if (levelContainer) {
        const slots = Array.from(levelContainer.querySelectorAll(".ct-spells-level-slot"));
        const targetUsed = slotInfo.max - slotInfo.value;

        let currentUsed = 0;
        slots.forEach(slot => {
          const isUsed = slot.classList.contains("ct-spells-level-slot--used") || slot.querySelector("input:checked");
          if (isUsed) currentUsed++;
        });

        if (currentUsed !== targetUsed) {
          let diffCount = Math.abs(currentUsed - targetUsed);
          for (const slot of slots) {
            if (diffCount === 0) break;
            const isUsed = slot.classList.contains("ct-spells-level-slot--used") || slot.querySelector("input:checked");
            if (targetUsed > currentUsed && !isUsed) {
              slot.click();
              diffCount--;
            } else if (targetUsed < currentUsed && isUsed) {
              slot.click();
              diffCount--;
            }
          }
        }
      }
    }
  }
  } finally {
    // Release lock after React renders and synthetic events propagate
    setTimeout(() => { isSyncingFromFoundry = false; }, 100);
  }
}

if (typeof globalThis !== "undefined") {
  globalThis.findRollTarget = findRollTarget;
  globalThis.extractActionData = extractActionData;
  globalThis.findParentByClassKeyword = findParentByClassKeyword;
  globalThis.findChildByClassKeyword = findChildByClassKeyword;
  globalThis.handleRollClick = handleRollClick;
  // Roll mode state — exposed for testing
  globalThis.getRollMode = getRollMode;
  globalThis.setRollMode = setRollMode;
  // Context menu helpers — exposed for testing
  globalThis.isRollContextMenu = isRollContextMenu;
  globalThis.attachRollModeListeners = attachRollModeListeners;
  globalThis.setupContextMenuObserver = setupContextMenuObserver;
  // Click guard and debounce — exposed for testing
  globalThis.shouldProcessClick = shouldProcessClick;
  globalThis.resetRollDebounce = resetRollDebounce;
  globalThis.checkRollDebounce = checkRollDebounce;
  globalThis.setRollDebounceTime = setRollDebounceTime;
}

