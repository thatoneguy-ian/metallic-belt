/**
 * Custom Actor Sheet that displays the embedded D&D Beyond Character Sheet in an iframe
 * and provides interface elements to manage synchronization.
 */
export class DDBEmbeddedSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["sheet", "actor", "character", "ddb-sheet"],
      template: "modules/ddb-bridge/templates/embedded-sheet.html",
      width: 1050,
      height: 850,
      resizable: true
    });
  }

  /** @override */
  getData(options) {
    const context = super.getData(options);
    const characterId = this.actor.getFlag("ddb-bridge", "characterId");
    
    return {
      ...context,
      characterId,
      actorName: this.actor.name,
      actorId: this.actor.id
    };
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Save Character ID / URL
    html.find(".ddb-save-btn").click(this._onLinkCharacter.bind(this));

    // Force Sync Stats
    html.find(".ddb-sync-btn").click(this._onSyncStats.bind(this));

    // Configuration / Reset link
    html.find(".ddb-config-btn").click(this._onConfigureLink.bind(this));
  }

  /**
   * Action when clicking "Link Character" button.
   */
  async _onLinkCharacter(event) {
    event.preventDefault();
    const urlInput = this.element.find(".ddb-char-url").val() || "";
    
    // Extract ID (e.g. from https://www.dndbeyond.com/characters/12345678)
    const match = urlInput.match(/characters\/(\d+)/) || urlInput.match(/^(\d+)$/);
    if (!match) {
      ui.notifications.error("Invalid D&D Beyond URL or Character ID. Please check and try again.");
      return;
    }

    const characterId = match[1];
    await this.actor.setFlag("ddb-bridge", "characterId", characterId);
    ui.notifications.info("D&D Beyond Character linked successfully! Starting initial sync...");
    
    // Trigger initial sync
    const { syncActorFromDDB } = await import("./main.js");
    await syncActorFromDDB(this.actor);
  }

  /**
   * Action when clicking "Sync Stats" button.
   */
  async _onSyncStats(event) {
    event.preventDefault();
    const { syncActorFromDDB } = await import("./main.js");
    
    // Disable button during sync
    const btn = $(event.currentTarget);
    btn.prop("disabled", true).find("i").addClass("fa-spin");
    
    try {
      await syncActorFromDDB(this.actor);
      ui.notifications.info(`Successfully synced character data for ${this.actor.name}.`);
    } catch (err) {
      console.error(err);
      ui.notifications.error("Failed to sync character from D&D Beyond: " + err.message);
    } finally {
      btn.prop("disabled", false).find("i").removeClass("fa-spin");
    }
  }

  /**
   * Action when clicking "Config" button (removes link).
   */
  async _onConfigureLink(event) {
    event.preventDefault();
    
    // Clear flag to show config panel
    await this.actor.unsetFlag("ddb-bridge", "characterId");
  }
}
