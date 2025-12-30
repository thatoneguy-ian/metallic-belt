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

    // Determine the base class for the character sheet
    const dnd5eApps = window.dnd5e?.applications?.actor;
    const BaseSheetClass = dnd5eApps?.CharacterSheet5e || dnd5eApps?.ActorSheet5eCharacter || ActorSheet;

    if (!dnd5eApps) {
        console.warn("DDB-Sheet | dnd5e applications not found. Falling back to base ActorSheet.");
    } else {
        console.log(`DDB-Sheet | Extending base class: ${BaseSheetClass.name}`);
    }

    /**
     * Custom ActorSheet that replicates the D&D Beyond look and feel.
     */
    class DDBCharacterSheet extends BaseSheetClass {
        /** @override */
        static get defaultOptions() {
            const options = super.defaultOptions;
            return foundry.utils.mergeObject(options, {
                classes: [...(options.classes || []), "ddb-sheet"],
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

    // Register for all types just to be safe, then restrict to character
    Actors.registerSheet("dnd5e", DDBCharacterSheet, {
        types: ["character"],
        makeDefault: false,
        label: "DDB Beyond Character Sheet"
    });

    console.log("DDB-Sheet | Sheet Registration Hook Finished");
});
