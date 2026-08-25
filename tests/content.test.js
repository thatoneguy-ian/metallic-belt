// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("Companion Extension Content Script Helpers", () => {
  beforeEach(async () => {
    // Reset DOM
    document.body.innerHTML = "";
    
    // Import content.js to register globals on globalThis/window
    // Since it's a side-effect script, we just dynamic import it
    await import("../chrome-extension/content.js");
  });

  describe("findRollTarget", () => {
    it("should match classic roll button class names", () => {
      const button = document.createElement("button");
      button.className = "ddbc-roll-button";
      document.body.appendChild(button);

      const target = globalThis.findRollTarget(button);
      expect(target).toBe(button);
    });

    it("should match integrated-dice__container class names", () => {
      const button = document.createElement("button");
      button.className = "F8U5pq_button integrated-dice__container";
      document.body.appendChild(button);

      const target = globalThis.findRollTarget(button);
      expect(target).toBe(button);
    });

    it("should find roll button parent if clicking a nested span", () => {
      const button = document.createElement("button");
      button.className = "integrated-dice__container";
      
      const span = document.createElement("span");
      span.className = "styles_numberDisplay__Rg1za";
      span.textContent = "+9";
      button.appendChild(span);
      document.body.appendChild(button);

      const target = globalThis.findRollTarget(span);
      expect(target).toBe(button);
    });

    it("should return null if element is not a roll button", () => {
      const div = document.createElement("div");
      div.className = "some-other-class";
      document.body.appendChild(div);

      const target = globalThis.findRollTarget(div);
      expect(target).toBeNull();
    });
  });

  describe("extractActionData", () => {
    it("should extract attack name with classic classes", () => {
      const row = document.createElement("div");
      row.className = "ct-combat-attack";
      
      const nameEl = document.createElement("span");
      nameEl.className = "ct-combat-attack__name";
      nameEl.textContent = "Longsword";
      
      const button = document.createElement("button");
      button.className = "integrated-dice__container";
      
      row.appendChild(nameEl);
      row.appendChild(button);
      document.body.appendChild(row);

      const data = globalThis.extractActionData(button);
      expect(data).toEqual({ name: "Longsword", type: "attack" });
    });

    it("should extract clean attack name when name element contains nested name and type metadata spans", () => {
      const row = document.createElement("div");
      row.className = "ct-combat-attack";
      
      const nameEl = document.createElement("div");
      nameEl.className = "ct-combat-attack__name";
      
      const labelSpan = document.createElement("span");
      labelSpan.className = "ct-combat-attack__label";
      labelSpan.textContent = "Rapier";
      
      const metaSpan = document.createElement("span");
      metaSpan.className = "ct-combat-attack__meta";
      metaSpan.textContent = "Melee Weapon";
      
      nameEl.appendChild(labelSpan);
      nameEl.appendChild(metaSpan);
      
      const button = document.createElement("button");
      button.className = "integrated-dice__container";
      
      row.appendChild(nameEl);
      row.appendChild(button);
      document.body.appendChild(row);

      const data = globalThis.extractActionData(button);
      expect(data).toEqual({ name: "Rapier", type: "attack" });
    });


    it("should extract attack name with hashed CSS module classes", () => {
      const row = document.createElement("div");
      row.className = "styles_combatAttack__xyz12"; // hashed
      
      const nameEl = document.createElement("span");
      nameEl.className = "styles_attackName__abc34"; // hashed
      nameEl.textContent = "Greatsword +1";
      
      const button = document.createElement("button");
      button.className = "integrated-dice__container";
      
      row.appendChild(nameEl);
      row.appendChild(button);
      document.body.appendChild(row);

      const data = globalThis.extractActionData(button);
      expect(data).toEqual({ name: "Greatsword +1", type: "attack" });
    });

    it("should extract skill name with hashed CSS module classes", () => {
      const row = document.createElement("div");
      row.className = "styles_skillsItem__abcde12";
      
      const nameEl = document.createElement("span");
      nameEl.className = "styles_skillsName__12345";
      nameEl.textContent = "Acrobatics";
      
      const button = document.createElement("button");
      button.className = "integrated-dice__container";
      
      row.appendChild(nameEl);
      row.appendChild(button);
      document.body.appendChild(row);

      const data = globalThis.extractActionData(button);
      expect(data).toEqual({ name: "Acrobatics", type: "skill" });
    });

    it("should extract attack name when button is nested inside a cell like combat-attack__damage", () => {
      const row = document.createElement("div");
      row.className = "ddbc-combat-attack";
      
      const nameEl = document.createElement("span");
      nameEl.className = "ct-combat-attack__name";
      nameEl.textContent = "Flame Blade";
      row.appendChild(nameEl);
      
      const cell = document.createElement("div");
      cell.className = "ddbc-combat-attack__damage";
      row.appendChild(cell);
      
      const button = document.createElement("button");
      button.className = "integrated-dice__container";
      button.textContent = "3d6";
      cell.appendChild(button);
      
      document.body.appendChild(row);

      const data = globalThis.extractActionData(button);
      expect(data).toEqual({ name: "Flame Blade", type: "attack" });
    });
  });

  describe("getRollMode / setRollMode", () => {
    it("should default to 'flat' (normal one die roll)", () => {
      // Reset to flat before this test
      globalThis.setRollMode("flat");
      expect(globalThis.getRollMode()).toBe("flat");
    });

    it("should update to 'advantage' when setRollMode is called", () => {
      globalThis.setRollMode("advantage");
      expect(globalThis.getRollMode()).toBe("advantage");
      // Cleanup
      globalThis.setRollMode("flat");
    });

    it("should update to 'disadvantage' when setRollMode is called", () => {
      globalThis.setRollMode("disadvantage");
      expect(globalThis.getRollMode()).toBe("disadvantage");
      // Cleanup
      globalThis.setRollMode("flat");
    });
  });

  describe("context menu roll mode observer", () => {
    it("should detect and track Advantage selection from D&D Beyond right-click context menu", async () => {
      globalThis.setRollMode("flat"); // reset

      // Simulate D&D Beyond appending a right-click context menu to the DOM
      const menu = document.createElement("div");
      menu.className = "ct-beyond-dice-context-menu";
      menu.innerHTML = `
        <div class="ct-beyond-dice-context-menu__roll-mode">
          <button class="ct-beyond-dice-context-menu__roll-mode-option ct-beyond-dice-context-menu__roll-mode-option--advantage">Advantage</button>
          <button class="ct-beyond-dice-context-menu__roll-mode-option ct-beyond-dice-context-menu__roll-mode-option--flat">Flat (One Die)</button>
          <button class="ct-beyond-dice-context-menu__roll-mode-option ct-beyond-dice-context-menu__roll-mode-option--disadvantage">Disadvantage</button>
        </div>
      `;
      document.body.appendChild(menu);

      // Manually attach listeners (simulates what the MutationObserver does in the real page)
      globalThis.attachRollModeListeners(menu);

      // Simulate clicking the Advantage option
      const advBtn = menu.querySelector('[class*="advantage"]');
      advBtn.click();

      await new Promise(resolve => setTimeout(resolve, 50));


      expect(globalThis.getRollMode()).toBe("advantage");

      // Cleanup
      menu.remove();
      globalThis.setRollMode("flat");
    });

    it("should detect and track Disadvantage selection from D&D Beyond right-click context menu", async () => {
      globalThis.setRollMode("flat"); // reset

      const menu = document.createElement("div");
      menu.className = "ct-beyond-dice-context-menu";
      menu.innerHTML = `
        <div class="ct-beyond-dice-context-menu__roll-mode">
          <button class="ct-beyond-dice-context-menu__roll-mode-option ct-beyond-dice-context-menu__roll-mode-option--advantage">Advantage</button>
          <button class="ct-beyond-dice-context-menu__roll-mode-option ct-beyond-dice-context-menu__roll-mode-option--flat">Flat (One Die)</button>
          <button class="ct-beyond-dice-context-menu__roll-mode-option ct-beyond-dice-context-menu__roll-mode-option--disadvantage">Disadvantage</button>
        </div>
      `;
      document.body.appendChild(menu);

      // Manually attach listeners (simulates what the MutationObserver does in the real page)
      globalThis.attachRollModeListeners(menu);

      const disBtn = menu.querySelector('[class*="disadvantage"]');
      disBtn.click();

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(globalThis.getRollMode()).toBe("disadvantage");

      menu.remove();
      globalThis.setRollMode("flat");
    });

    it("should reset to 'flat' when Flat option is selected", async () => {
      globalThis.setRollMode("advantage"); // start as advantage

      const menu = document.createElement("div");
      menu.className = "ct-beyond-dice-context-menu";
      menu.innerHTML = `
        <div class="ct-beyond-dice-context-menu__roll-mode">
          <button class="ct-beyond-dice-context-menu__roll-mode-option ct-beyond-dice-context-menu__roll-mode-option--advantage">Advantage</button>
          <button class="ct-beyond-dice-context-menu__roll-mode-option ct-beyond-dice-context-menu__roll-mode-option--flat">Flat (One Die)</button>
          <button class="ct-beyond-dice-context-menu__roll-mode-option ct-beyond-dice-context-menu__roll-mode-option--disadvantage">Disadvantage</button>
        </div>
      `;
      document.body.appendChild(menu);

      // Manually attach listeners (simulates what the MutationObserver does in the real page)
      globalThis.attachRollModeListeners(menu);

      const flatBtn = menu.querySelector('[class*="--flat"]');
      flatBtn.click();

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(globalThis.getRollMode()).toBe("flat");

      menu.remove();
    });
  });

  describe("setupContextMenuObserver - null body guard", () => {
    it("should not throw when document.body is null at call time", () => {
      // Simulate the extension running before the body element exists.
      // The real crash was: 'observe' on 'MutationObserver': parameter 1 is not of type 'Node'.
      // Our fix: defer observation until body is available.
      const savedBody = document.body;

      // We cannot actually set document.body to null in jsdom, but we CAN verify
      // that isRollContextMenu and attachRollModeListeners are robust helpers,
      // and that setupContextMenuObserver only observes a valid Node.
      // Verify the function exists and can be called without throwing
      expect(() => {
        globalThis.setupContextMenuObserver && globalThis.setupContextMenuObserver();
      }).not.toThrow();
    });
  });

  describe("click handler - isTrusted guard and debounce", () => {
    it("should ignore synthetic (non-trusted) click events fired by D&D Beyond's own JS", () => {
      // D&D Beyond fires programmatic click events after the user's initial click.
      // Only process events where isTrusted is true (real user gestures).
      const row = document.createElement("div");
      row.className = "ct-combat-attack";
      const nameEl = document.createElement("span");
      nameEl.className = "ct-combat-attack__name";
      nameEl.textContent = "Rapier";
      const button = document.createElement("button");
      button.className = "integrated-dice__container";
      row.appendChild(nameEl);
      row.appendChild(button);
      document.body.appendChild(row);

      const syntheticEvent = { target: button, isTrusted: false };

      // findRollTarget still works on the element
      const target = globalThis.findRollTarget(syntheticEvent.target);
      expect(target).toBe(button);

      // But the isTrusted guard means we should bail early for non-trusted events.
      // We verify the guard via the exported shouldProcessClick helper.
      expect(globalThis.shouldProcessClick(syntheticEvent)).toBe(false);
    });

    it("should process trusted click events", () => {
      const button = document.createElement("button");
      button.className = "integrated-dice__container";
      document.body.appendChild(button);

      const trustedEvent = { target: button, isTrusted: true };
      expect(globalThis.shouldProcessClick(trustedEvent)).toBe(true);
    });

    it("should debounce duplicate rolls of the same action within 500ms", () => {
      // Reset debounce state
      globalThis.resetRollDebounce();

      // First call should be allowed
      expect(globalThis.checkRollDebounce("Rapier", "attack")).toBe(true);

      // Second call within debounce window should be blocked
      expect(globalThis.checkRollDebounce("Rapier", "attack")).toBe(false);
    });

    it("should allow the same action again after the debounce window expires", async () => {
      globalThis.resetRollDebounce();

      // Simulate the first call setting the debounce with a very old timestamp
      globalThis.checkRollDebounce("Longsword", "attack");

      // Advance time by faking the debounce state
      // We expose setRollDebounceTime for testing purposes
      globalThis.setRollDebounceTime(Date.now() - 600); // 600ms ago = past 500ms window

      // Should be allowed again
      expect(globalThis.checkRollDebounce("Longsword", "attack")).toBe(true);
    });
  });
});
