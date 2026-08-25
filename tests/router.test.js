// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock globals before importing the file under test
globalThis.registeredHooks = {};
globalThis.Hooks = {
  once: vi.fn((hook, cb) => {
    if (hook === "ready" || hook === "init") cb();
  }),
  on: vi.fn((hook, cb) => {
    globalThis.registeredHooks[hook] = cb;
  })
};
globalThis.Actors = {
  registerSheet: vi.fn()
};
globalThis.ActorSheet = class {};
globalThis.ui = {
  notifications: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  },
  windows: {}
};

// Mock game database
const mockActor = {
  id: "actor123",
  name: "Grog the Mighty",
  system: {
    abilities: {
      dex: {
        value: 14 // Dex mod = 2
      }
    }
  },
  getFlag: vi.fn((namespace, key) => {
    if (namespace === "ddb-bridge" && key === "characterId") return "12345";
    return null;
  }),
  update: vi.fn().mockResolvedValue({}),
  rollAbilitySave: vi.fn().mockResolvedValue({}),
  rollAbilityTest: vi.fn().mockResolvedValue({}),
  rollSkill: vi.fn().mockResolvedValue({}),
  deleteEmbeddedDocuments: vi.fn().mockResolvedValue({}),
  updateEmbeddedDocuments: vi.fn().mockResolvedValue({}),
  createEmbeddedDocuments: vi.fn().mockResolvedValue({}),
  getActiveTokens: vi.fn().mockReturnValue([]),
  items: (() => {
    const arr = [
      {
        name: "Longsword",
        type: "weapon",
        _id: "item1",
        use: vi.fn().mockResolvedValue({})
      }
    ];
    arr.toObject = vi.fn().mockReturnValue(arr);
    return arr;
  })()
};


globalThis.game = {
  userId: "user1",
  actors: {
    find: vi.fn((fn) => {
      // Find actor based on callback filter matching flag
      if (fn(mockActor)) return mockActor;
      return null;
    })
  }
};

// Import main.js so the event listener is registered
await import("../foundry-module/scripts/main.js");

describe("Foundry Module Message Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should route ROLL_ACTION for attack to item.use()", async () => {
    const event = new MessageEvent("message", {
      data: {
        source: "ddb-bridge-extension",
        characterId: "12345",
        type: "ROLL_ACTION",
        data: { name: "Longsword", type: "attack" }
      }
    });

    window.dispatchEvent(event);

    // Wait short time for async handler
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mockActor.items[0].use).toHaveBeenCalled();
  });

  it("should route ROLL_ACTION for save to modern actor.rollSavingThrow() if available", async () => {
    mockActor.rollSavingThrow = vi.fn().mockResolvedValue({});
    mockActor.rollAbilitySave = vi.fn().mockResolvedValue({});

    const event = new MessageEvent("message", {
      data: {
        source: "ddb-bridge-extension",
        characterId: "12345",
        type: "ROLL_ACTION",
        data: { name: "Constitution", type: "save" }
      }
    });

    window.dispatchEvent(event);
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mockActor.rollSavingThrow).toHaveBeenCalledWith({ ability: "con" });
    expect(mockActor.rollAbilitySave).not.toHaveBeenCalled();
  });

  it("should route ROLL_ACTION for save to legacy actor.rollAbilitySave() if modern is unavailable", async () => {
    delete mockActor.rollSavingThrow;
    mockActor.rollAbilitySave = vi.fn().mockResolvedValue({});

    const event = new MessageEvent("message", {
      data: {
        source: "ddb-bridge-extension",
        characterId: "12345",
        type: "ROLL_ACTION",
        data: { name: "Constitution", type: "save" }
      }
    });

    window.dispatchEvent(event);
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mockActor.rollAbilitySave).toHaveBeenCalledWith("con");
  });

  it("should route ROLL_ACTION for ability check to modern actor.rollAbilityCheck() if available", async () => {
    mockActor.rollAbilityCheck = vi.fn().mockResolvedValue({});
    mockActor.rollAbilityTest = vi.fn().mockResolvedValue({});

    const event = new MessageEvent("message", {
      data: {
        source: "ddb-bridge-extension",
        characterId: "12345",
        type: "ROLL_ACTION",
        data: { name: "Strength", type: "check" }
      }
    });

    window.dispatchEvent(event);
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mockActor.rollAbilityCheck).toHaveBeenCalledWith({ ability: "str" });
    expect(mockActor.rollAbilityTest).not.toHaveBeenCalled();
  });

  it("should route ROLL_ACTION for ability check to legacy actor.rollAbilityTest() if modern is unavailable", async () => {
    delete mockActor.rollAbilityCheck;
    mockActor.rollAbilityTest = vi.fn().mockResolvedValue({});

    const event = new MessageEvent("message", {
      data: {
        source: "ddb-bridge-extension",
        characterId: "12345",
        type: "ROLL_ACTION",
        data: { name: "Strength", type: "check" }
      }
    });

    window.dispatchEvent(event);
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mockActor.rollAbilityTest).toHaveBeenCalledWith("str");
  });

  it("should route ROLL_ACTION for skill check to modern actor.rollSkill()", async () => {
    mockActor.rollSkill = vi.fn().mockResolvedValue({});

    const event = new MessageEvent("message", {
      data: {
        source: "ddb-bridge-extension",
        characterId: "12345",
        type: "ROLL_ACTION",
        data: { name: "Perception", type: "skill" }
      }
    });

    window.dispatchEvent(event);
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mockActor.rollSkill).toHaveBeenCalledWith({ skill: "prc" });
  });

  it("should fall back to legacy skill check signature if modern rollSkill fails", async () => {
    mockActor.rollSkill = vi.fn().mockImplementation((arg) => {
      if (typeof arg === "object") throw new Error("Modern signature not supported");
      return Promise.resolve({});
    });

    const event = new MessageEvent("message", {
      data: {
        source: "ddb-bridge-extension",
        characterId: "12345",
        type: "ROLL_ACTION",
        data: { name: "Perception", type: "skill" }
      }
    });

    window.dispatchEvent(event);
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mockActor.rollSkill).toHaveBeenCalledWith("prc");
  });


  it("should route STATE_SYNC to actor.update() for HP", async () => {
    const event = new MessageEvent("message", {
      data: {
        source: "ddb-bridge-extension",
        characterId: "12345",
        type: "STATE_SYNC",
        data: { hp: 45 }
      }
    });

    window.dispatchEvent(event);
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mockActor.update).toHaveBeenCalledWith(
      { "system.attributes.hp.value": 45 },
      { ddbBridgeSync: true }
    );
  });

  it("should route STATE_SYNC to actor.update() for spell slots", async () => {
    const event = new MessageEvent("message", {
      data: {
        source: "ddb-bridge-extension",
        characterId: "12345",
        type: "STATE_SYNC",
        data: {
          spellSlots: {
            1: { max: 4, value: 3 },
            2: { max: 2, value: 0 }
          }
        }
      }
    });

    window.dispatchEvent(event);
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mockActor.update).toHaveBeenCalledWith(
      {
        "system.spells.spell1.value": 3,
        "system.spells.spell1.max": 4,
        "system.spells.spell2.value": 0,
        "system.spells.spell2.max": 2
      },
      { ddbBridgeSync: true }
    );
  });

  it("should route STATE_SYNC to actor.update() for AC", async () => {
    const event = new MessageEvent("message", {
      data: {
        source: "ddb-bridge-extension",
        characterId: "12345",
        type: "STATE_SYNC",
        data: { ac: 18 }
      }
    });

    window.dispatchEvent(event);
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mockActor.update).toHaveBeenCalledWith(
      {
        "system.attributes.ac.flat": 18,
        "system.attributes.ac.calc": "flat"
      },
      { ddbBridgeSync: true }
    );
  });

  it("should route STATE_SYNC to actor.update() for speed", async () => {
    const event = new MessageEvent("message", {
      data: {
        source: "ddb-bridge-extension",
        characterId: "12345",
        type: "STATE_SYNC",
        data: { speed: 45 }
      }
    });

    window.dispatchEvent(event);
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mockActor.update).toHaveBeenCalledWith(
      { "system.attributes.movement.walk": 45 },
      { ddbBridgeSync: true }
    );
  });

  it("should route STATE_SYNC to actor.update() for initiative", async () => {
    const event = new MessageEvent("message", {
      data: {
        source: "ddb-bridge-extension",
        characterId: "12345",
        type: "STATE_SYNC",
        data: { initiative: 6 } // Dex mod is 2, so bonus should be 4
      }
    });

    window.dispatchEvent(event);
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mockActor.update).toHaveBeenCalledWith(
      { "system.attributes.init.bonus": 4 },
      { ddbBridgeSync: true }
    );
  });

  it("should handle DDB_JSON_RESPONSE and update active tokens on canvas using avatarUrl", async () => {
    const mockTokenUpdate = vi.fn().mockResolvedValue({});
    mockActor.getActiveTokens = vi.fn().mockReturnValue([
      {
        document: {
          update: mockTokenUpdate
        }
      }
    ]);

    const event = new MessageEvent("message", {
      data: {
        source: "ddb-bridge-extension",
        characterId: "12345",
        type: "DDB_JSON_RESPONSE",
        data: {
          success: true,
          data: {
            id: 12345,
            name: "Grog the Mighty",
            baseHitPoints: 35,
            removedHitPoints: 10,
            temporaryHitPoints: 5,
            decorations: {
              avatarUrl: "https://media.dndbeyond.com/character-avatars/12345.jpeg"
            },
            stats: [
              { "id": 1, "value": 18 },
              { "id": 2, "value": 14 },
              { "id": 3, "value": 16 },
              { "id": 4, "value": 8 },
              { "id": 5, "value": 10 },
              { "id": 6, "value": 8 }
            ],
            overrideStats: [],
            modifiers: {},
            classes: []
          }
        }
      }
    });

    window.dispatchEvent(event);
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mockActor.update).toHaveBeenCalled();
    expect(mockActor.getActiveTokens).toHaveBeenCalled();
    expect(mockTokenUpdate).toHaveBeenCalledWith({
      "texture.src": "https://media.dndbeyond.com/character-avatars/12345.jpeg"
    });
  });

  it("should prefer avatarBase64 data URL over raw avatarUrl to avoid CORS failures", async () => {
    const mockTokenUpdate = vi.fn().mockResolvedValue({});
    mockActor.getActiveTokens = vi.fn().mockReturnValue([
      { document: { update: mockTokenUpdate } }
    ]);

    const fakeDataUrl = "data:image/jpeg;base64,/9j/fakebase64data";

    const event = new MessageEvent("message", {
      data: {
        source: "ddb-bridge-extension",
        characterId: "12345",
        type: "DDB_JSON_RESPONSE",
        // avatarBase64 is added by content.js when it fetches the image from DDB origin
        avatarBase64: fakeDataUrl,
        data: {
          success: true,
          data: {
            id: 12345,
            name: "Grog the Mighty",
            baseHitPoints: 35,
            removedHitPoints: 10,
            temporaryHitPoints: 5,
            decorations: {
              avatarUrl: "https://media.dndbeyond.com/character-avatars/12345.jpeg"
            },
            stats: [
              { "id": 1, "value": 18 },
              { "id": 2, "value": 14 },
              { "id": 3, "value": 16 },
              { "id": 4, "value": 8 },
              { "id": 5, "value": 10 },
              { "id": 6, "value": 8 }
            ],
            overrideStats: [],
            modifiers: {},
            classes: []
          }
        }
      }
    });

    window.dispatchEvent(event);
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mockActor.update).toHaveBeenCalled();
    // Must use the base64 data URL, NOT the raw D&D Beyond URL (which causes CORS failure)
    expect(mockTokenUpdate).toHaveBeenCalledWith({
      "texture.src": fakeDataUrl
    });
  });

  it("should route ROLL_ACTION attack with rollMode 'flat' by calling item.use() without any dialog manipulation", async () => {
    const useCallArgs = [];
    mockActor.items[0].use = vi.fn().mockImplementation((...args) => {
      useCallArgs.push(args);
      return Promise.resolve({});
    });

    const event = new MessageEvent("message", {
      data: {
        source: "ddb-bridge-extension",
        characterId: "12345",
        type: "ROLL_ACTION",
        data: { name: "Longsword", type: "attack", rollMode: "flat" }
      }
    });

    window.dispatchEvent(event);
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mockActor.items[0].use).toHaveBeenCalled();
  });

  it("should route ROLL_ACTION attack with rollMode 'advantage' and register a Hooks.once listener for dialog", async () => {
    const hookRegistrations = [];
    globalThis.Hooks.once = vi.fn((hook, cb) => {
      if (hook === "ready" || hook === "init") cb();
      else hookRegistrations.push({ hook, cb });
    });

    mockActor.items[0].use = vi.fn().mockResolvedValue({});

    const event = new MessageEvent("message", {
      data: {
        source: "ddb-bridge-extension",
        characterId: "12345",
        type: "ROLL_ACTION",
        data: { name: "Longsword", type: "attack", rollMode: "advantage" }
      }
    });

    window.dispatchEvent(event);
    await new Promise(resolve => setTimeout(resolve, 50));

    // Should have called item.use
    expect(mockActor.items[0].use).toHaveBeenCalled();

    // Should have registered a Hooks.once listener waiting for the dialog
    const dialogHook = hookRegistrations.find(r => r.hook === "renderDialog" || r.hook === "renderApplication");
    expect(dialogHook).toBeDefined();
  });

  it("should route ROLL_ACTION attack with rollMode 'disadvantage' and register a Hooks.once listener for dialog", async () => {
    const hookRegistrations = [];
    globalThis.Hooks.once = vi.fn((hook, cb) => {
      if (hook === "ready" || hook === "init") cb();
      else hookRegistrations.push({ hook, cb });
    });

    mockActor.items[0].use = vi.fn().mockResolvedValue({});

    const event = new MessageEvent("message", {
      data: {
        source: "ddb-bridge-extension",
        characterId: "12345",
        type: "ROLL_ACTION",
        data: { name: "Longsword", type: "attack", rollMode: "disadvantage" }
      }
    });

    window.dispatchEvent(event);
    expect(mockActor.items[0].use).toHaveBeenCalled();

    const dialogHook = hookRegistrations.find(r => r.hook === "renderDialog" || r.hook === "renderApplication");
    expect(dialogHook).toBeDefined();
  });

  describe("renderChatMessage auto-click behavior", () => {
    it("should register a Hooks.on('renderChatMessageHTML') listener", () => {
      expect(globalThis.registeredHooks.renderChatMessageHTML).toBeDefined();
    });

    it("should auto-click the Attack button on renderChatMessageHTML when there is a pending attack roll", async () => {
      const renderChatCallback = globalThis.registeredHooks.renderChatMessageHTML;
      expect(renderChatCallback).toBeDefined();

      // Trigger ROLL_ACTION message for an attack
      const event = new MessageEvent("message", {
        data: {
          source: "ddb-bridge-extension",
          characterId: "12345",
          type: "ROLL_ACTION",
          data: { name: "Longsword", type: "attack", rollMode: "advantage" }
        }
      });
      window.dispatchEvent(event);
      await new Promise(resolve => setTimeout(resolve, 50));

      // Prepare mock HTML elements
      const mockButton = {
        click: vi.fn()
      };
      const mockTitleEl = {
        textContent: "Longsword"
      };
      const mockHtml = {
        querySelector: vi.fn((selector) => {
          if (selector === ".title") return mockTitleEl;
          if (selector.includes('data-action="attack"') || selector.includes('rollAttack')) return mockButton;
          return null;
        })
      };
      const mockMessage = {
        item: { name: "Longsword" }
      };

      // Call renderChatMessageHTML hook (passing mockHtml directly as if it's a native Element or resolving via html[0])
      await renderChatCallback(mockMessage, mockHtml);

      // Verify button was clicked
      expect(mockButton.click).toHaveBeenCalled();
    });

    it("should auto-click the Damage button on renderChatMessageHTML when there is a pending damage roll", async () => {
      const renderChatCallback = globalThis.registeredHooks.renderChatMessageHTML;
      expect(renderChatCallback).toBeDefined();

      // Trigger ROLL_ACTION message for damage
      const event = new MessageEvent("message", {
        data: {
          source: "ddb-bridge-extension",
          characterId: "12345",
          type: "ROLL_ACTION",
          data: { name: "Longsword", type: "damage" }
        }
      });
      window.dispatchEvent(event);
      await new Promise(resolve => setTimeout(resolve, 50));

      // Prepare mock HTML elements
      const mockButton = {
        click: vi.fn()
      };
      const mockTitleEl = {
        textContent: "Longsword"
      };
      const mockHtml = {
        querySelector: vi.fn((selector) => {
          if (selector === ".title") return mockTitleEl;
          if (selector.includes('data-action="damage"') || selector.includes('rollDamage')) return mockButton;
          return null;
        })
      };
      const mockMessage = {
        item: { name: "Longsword" }
      };

      // Call renderChatMessageHTML hook
      await renderChatCallback(mockMessage, mockHtml);

      // Verify button was clicked
      expect(mockButton.click).toHaveBeenCalled();
    });


    it("should correctly find the item title when an actor name with class '.title' is in the message header", async () => {
      const renderChatCallback = globalThis.registeredHooks.renderChatMessageHTML;
      expect(renderChatCallback).toBeDefined();

      const event = new MessageEvent("message", {
        data: {
          source: "ddb-bridge-extension",
          characterId: "12345",
          type: "ROLL_ACTION",
          data: { name: "Longsword", type: "attack", rollMode: "flat" }
        }
      });
      window.dispatchEvent(event);
      await new Promise(resolve => setTimeout(resolve, 50));

      // Create a DOM structure using real elements since jsdom environment is active
      const container = document.createElement("div");
      container.innerHTML = `
        <li class="chat-message message flexcol">
          <header class="message-header flexrow">
            <h4 class="message-sender">
              <span class="title">Ray Jay Doe</span>
            </h4>
          </header>
          <div class="message-content">
            <div class="chat-card midi-chat-card activation-card">
              <header class="summary">
                <div class="name-stacked border">
                  <span class="title">Longsword</span>
                </div>
              </header>
              <div class="card-buttons midi-buttons">
                <button type="button" data-action="rollAttack">Attack</button>
              </div>
            </div>
          </div>
        </li>
      `;

      const liElement = container.querySelector("li");
      const attackButton = liElement.querySelector('button[data-action="rollAttack"]');
      const clickSpy = vi.spyOn(attackButton, "click");

      const mockMessage = {
        item: { name: "Longsword" }
      };

      await renderChatCallback(mockMessage, liElement);

      expect(clickSpy).toHaveBeenCalled();
    });
  });
});

