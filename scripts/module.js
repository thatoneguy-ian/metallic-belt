import { registerSettings } from "./Settings.js";
import { DDBDataService } from "./DDBDataService.js";
import { DDBSyncDialog } from "./DDBSyncDialog.js";

/**
 * Handlebars Helper for DDB-style tabs
 */
Handlebars.registerHelper("isDDBTab", function (current, target) {
    return current === target;
});

Hooks.once("init", async () => {
    console.log("DDB-Sheet | Initializing D&D Beyond Character Sheet Replica");

    // Register module settings
    registerSettings();

    // Register the custom character sheet 
    // We define the class inside the hook to ensure dnd5e namespace is available if needed
    // or we just ensure dnd5e isn't required at definition time if we extend ActorSheet.
    // However, for dnd5e system integration, extending their base sheet is best.

    class DDBCharacterSheet extends dnd5e.applications.actor.ActorSheet5eCharacter {
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
            data.ddb = {
                activeTab: this._tabs[0]?.active || "actions",
                isSyncing: this._isSyncing || false,
                lastSync: this.actor.getFlag("ddb-character-sheet", "lastSync") || "Never"
            };
            return data;
        }

        /** @override */
        activateListeners(html) {
            super.activateListeners(html);
            html.find(".ddb-sync-btn").click(this._onSyncClick.bind(this));
        }

        async _onSyncClick(event) {
            event.preventDefault();
            const characterId = this.actor.getFlag("ddb-character-sheet", "characterId");
            if (!characterId) return ui.notifications.warn("Please set a D&D Beyond Character ID in the actor's flags.");

            this._isSyncing = true;
            this.render();
            try {
                const ddbData = await DDBDataService.fetchCharacterData(characterId);
                if (ddbData) new DDBSyncDialog(this.actor, ddbData).render(true);
            } finally {
                this._isSyncing = false;
                this.render();
            }
        }
    }

    Actors.registerSheet("dnd5e", DDBCharacterSheet, {
        types: ["character"],
        makeDefault: false,
        label: "DDB Beyond Character Sheet"
    });

    console.log("DDB-Sheet | Sheet Registration Complete");
});
