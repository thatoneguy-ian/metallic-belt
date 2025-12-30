import { DDBCharacterSheet } from "./DDBCharacterSheet.js";
import { registerSettings } from "./Settings.js";

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
    Actors.registerSheet("dnd5e", DDBCharacterSheet, {
        types: ["character"],
        makeDefault: false,
        label: "DDB Beyond Character Sheet"
    });
});

Hooks.once("ready", async () => {
    // Check for Cobalt Cookie and prompt automation if missing
    // Logic will be implemented in DDBAuth.js
});
