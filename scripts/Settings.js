/**
 * Defines and registers module settings for DDB Character Sheet.
 */
export function registerSettings() {
    // Cobalt Cookie (Secret)
    game.settings.register("ddb-character-sheet", "cobaltCookie", {
        name: game.i18n.localize("DDB_SHEET.Settings.CobaltCookie.Name"),
        hint: game.i18n.localize("DDB_SHEET.Settings.CobaltCookie.Hint"),
        scope: "world",
        config: true,
        type: String,
        default: "",
        onChange: (value) => {
            console.log("DDB-Sheet | Cobalt Cookie updated.");
        }
    });

    // Minimum Sync Permission
    game.settings.register("ddb-character-sheet", "syncPermissionLevel", {
        name: game.i18n.localize("DDB_SHEET.Settings.SyncPermission.Name"),
        hint: game.i18n.localize("DDB_SHEET.Settings.SyncPermission.Hint"),
        scope: "world",
        config: true,
        type: String,
        choices: {
            "PLAYER": "Player",
            "TRUSTED": "Trusted Player",
            "ASSISTANT": "Assistant GM",
            "GAMEMASTER": "Game Master"
        },
        default: "GAMEMASTER"
    });

    // Synchronization Preferences
    game.settings.register("ddb-character-sheet", "syncPreferences", {
        name: game.i18n.localize("DDB_SHEET.Settings.SyncPrefs.Name"),
        hint: game.i18n.localize("DDB_SHEET.Settings.SyncPrefs.Hint"),
        scope: "world",
        config: true,
        type: Object,
        default: {
            hp: "AUTO_DDB",
            slots: "CONFIRM",
            stats: "CONFIRM",
            inventory: "IGNORE",
            spells: "IGNORE",
            xp: "AUTO_DDB"
        }
    });
}

/**
 * Helper to check if the current user has permission to sync.
 */
export function canUserSync() {
    const minLevel = game.settings.get("ddb-character-sheet", "syncPermissionLevel");
    const userRole = game.user.role;

    const roles = {
        "PLAYER": CONST.USER_ROLES.PLAYER,
        "TRUSTED": CONST.USER_ROLES.TRUSTED,
        "ASSISTANT": CONST.USER_ROLES.ASSISTANT,
        "GAMEMASTER": CONST.USER_ROLES.GAMEMASTER
    };

    return userRole >= roles[minLevel];
}
