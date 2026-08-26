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
globalThis.foundry = {
  utils: {
    getProperty: (obj, path) => path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj)
  }
};

// Mock attack Activity — the object handleRollAction now calls rollAttack/rollDamage
// on directly (bypassing item.use()/activity.use(), see main.js for why).
const mockAttackActivity = {
  rollAttack: vi.fn().mockResolvedValue([]),
  rollDamage: vi.fn().mockResolvedValue([])
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
        system: {
          activities: {
            getByType: vi.fn((type) => type === "attack" ? [mockAttackActivity] : [])
          }
        }
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
// Loaded after mocks (ActorSheet etc.) so its `extends ActorSheet` resolves correctly
const { DDBEmbeddedSheet } = await import("../foundry-module/scripts/embedded-sheet.js");

describe("Foundry Module Message Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should route ROLL_ACTION for attack to the item's attack activity rollAttack()", async () => {
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

    expect(mockAttackActivity.rollAttack).toHaveBeenCalled();
  });

  it("should warn and not throw when the item has no attack activity", async () => {
    mockActor.items[0].system.activities.getByType = vi.fn(() => []);

    const event = new MessageEvent("message", {
      data: {
        source: "ddb-bridge-extension",
        characterId: "12345",
        type: "ROLL_ACTION",
        data: { name: "Longsword", type: "attack" }
      }
    });

    window.dispatchEvent(event);
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(globalThis.ui.notifications.warn).toHaveBeenCalled();
    expect(mockAttackActivity.rollAttack).not.toHaveBeenCalled();

    // Restore for subsequent tests
    mockActor.items[0].system.activities.getByType = vi.fn((type) => type === "attack" ? [mockAttackActivity] : []);
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

  it("should roll a flat attack with configure:false and no advantage/disadvantage", async () => {
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

    expect(mockAttackActivity.rollAttack).toHaveBeenCalledWith(
      { advantage: false, disadvantage: false },
      { configure: false }
    );
  });

  it("should roll an advantage attack with configure:false and advantage:true", async () => {
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

    expect(mockAttackActivity.rollAttack).toHaveBeenCalledWith(
      { advantage: true, disadvantage: false },
      { configure: false }
    );
  });

  it("should roll a disadvantage attack with configure:false and disadvantage:true", async () => {
    const event = new MessageEvent("message", {
      data: {
        source: "ddb-bridge-extension",
        characterId: "12345",
        type: "ROLL_ACTION",
        data: { name: "Longsword", type: "attack", rollMode: "disadvantage" }
      }
    });

    window.dispatchEvent(event);
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mockAttackActivity.rollAttack).toHaveBeenCalledWith(
      { advantage: false, disadvantage: true },
      { configure: false }
    );
  });

  it("should roll damage with configure:false regardless of rollMode", async () => {
    // Damage has no advantage/disadvantage concept — configure:false alone
    // skips its dialog while inheriting whatever crit status a prior
    // associated attack roll set.
    const event = new MessageEvent("message", {
      data: {
        source: "ddb-bridge-extension",
        characterId: "12345",
        type: "ROLL_ACTION",
        data: { name: "Longsword", type: "damage", rollMode: "advantage" }
      }
    });

    window.dispatchEvent(event);
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mockAttackActivity.rollDamage).toHaveBeenCalledWith({}, { configure: false });
  });

  describe("updateActor sync back to D&D Beyond", () => {
    // Builds a mock DDBEmbeddedSheet "window" for ui.windows without invoking
    // the real ActorSheet/Application constructor chain (which isn't mocked
    // beyond an empty class) — just enough shape for the hook's own lookups.
    function makeMockSheet(actor, iframeContentWindow) {
      const sheet = Object.create(DDBEmbeddedSheet.prototype);
      sheet.actor = actor;
      const iframeEl = { contentWindow: iframeContentWindow };
      sheet.element = { find: vi.fn((selector) => selector === ".ddb-sheet-iframe" ? [iframeEl] : []) };
      return sheet;
    }

    it("should push an HP change to D&D Beyond even when a DIFFERENT user (e.g. the GM) triggered it, as long as THIS client has the sheet open", () => {
      const updateActorCallback = globalThis.registeredHooks.updateActor;
      expect(updateActorCallback).toBeDefined();

      const postMessageSpy = vi.fn();
      globalThis.ui.windows = {
        1: makeMockSheet(mockActor, { postMessage: postMessageSpy })
      };

      // userId is the GM's id — deliberately NOT equal to game.userId ("user1") —
      // simulating the GM applying damage on their own client, while THIS
      // callback instance represents the player's client where the sheet is open.
      updateActorCallback(
        mockActor,
        { system: { attributes: { hp: { value: 20 } } } },
        {},
        "gm-user-id"
      );

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          source: "ddb-bridge-foundry",
          type: "STATE_UPDATE",
          data: expect.objectContaining({ hp: 20 })
        }),
        "*"
      );

      globalThis.ui.windows = {};
    });

    it("should NOT push when the update was caused by our own incoming sync (ddbBridgeSync flag)", () => {
      const updateActorCallback = globalThis.registeredHooks.updateActor;
      const postMessageSpy = vi.fn();
      globalThis.ui.windows = {
        1: makeMockSheet(mockActor, { postMessage: postMessageSpy })
      };

      updateActorCallback(
        mockActor,
        { system: { attributes: { hp: { value: 20 } } } },
        { ddbBridgeSync: true },
        "user1"
      );

      expect(postMessageSpy).not.toHaveBeenCalled();
      globalThis.ui.windows = {};
    });

    it("should not throw and should not push when no matching sheet is open on this client", () => {
      const updateActorCallback = globalThis.registeredHooks.updateActor;
      globalThis.ui.windows = {}; // no open DDBEmbeddedSheet for this actor

      expect(() => updateActorCallback(
        mockActor,
        { system: { attributes: { hp: { value: 20 } } } },
        {},
        "gm-user-id"
      )).not.toThrow();
    });
  });

});

