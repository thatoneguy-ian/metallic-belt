/**
 * Custom ActorSheet that replicates the D&D Beyond look and feel.
 * Extends the default dnd5e character sheet.
 */
export class DDBCharacterSheet extends dnd5e.applications.actor.ActorSheet5eCharacter {

    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["dnd5e", "sheet", "actor", "character", "ddb-sheet"],
            template: "modules/ddb-character-sheet/templates/character-sheet.hbs",
            width: 1200,
            height: 900,
            tabs: [{ navSelector: ".ddb-tabs", contentSelector: ".ddb-content", initial: "actions" }]
        });
    }

    /** @override */
    async getData(options) {
        const data = await super.getData(options);

        // Add DDB-specific UI state
        data.ddb = {
            activeTab: this._tabs[0]?.active || "actions",
            isSyncing: false,
            lastSync: this.actor.getFlag("ddb-character-sheet", "lastSync") || "Never"
        };

        console.log("DDB-Sheet | Preparing Data", data);
        return data;
    }

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);

        // Handle Sync Button
        html.find(".ddb-sync-btn").click(this._onSyncClick.bind(this));

        // Interaction for DDB-style tabs (if separate from Foundry tabs)
        html.find(".ddb-tab-item").click(event => {
            const tab = event.currentTarget.dataset.tab;
            console.log("DDB-Sheet | Switching to tab:", tab);
        });
    }

    /**
     * Handle the manual sync button click.
     * @param {Event} event 
     * @private
     */
    async _onSyncClick(event) {
        event.preventDefault();
        console.log("DDB-Sheet | Sync requested for actor:", this.actor.name);
        // This will eventually open the DDBSyncDialog
    }
}
