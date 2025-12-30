import { DDBAuth } from "./DDBAuth.js";

/**
 * Service for interacting with D&D Beyond APIs.
 */
export class DDBDataService {

    /**
     * Fetches character data from D&D Beyond.
     * @param {string} characterId 
     * @returns {Promise<object|null>}
     */
    static async fetchCharacterData(characterId) {
        const cookie = game.settings.get("ddb-character-sheet", "cobaltCookie");
        const url = `https://character-service.dndbeyond.com/character/v5/character/${characterId}`;

        try {
            console.log(`DDB-Sheet | Fetching data for ${characterId}...`);
            const response = await fetch(url, {
                headers: {
                    "Authorization": `Bearer ${cookie}` // This is how DDB uses the cobalt token
                }
            });

            if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
            const json = await response.json();
            return json.data;
        } catch (e) {
            console.error("DDB-Sheet | Fetch failed:", e);
            ui.notifications.error("Failed to fetch data from D&D Beyond. Check your character ID and Cobalt Cookie.");
            return null;
        }
    }

    /**
     * Computes the difference between a Foundry Actor and DDB Data.
     * @param {Actor} actor 
     * @param {object} ddbData 
     * @returns {object[]}
     */
    static computeDiff(actor, ddbData) {
        const diffs = [];

        // HP Check
        const foundryHP = actor.system.attributes.hp.value;
        const ddbHP = ddbData.removedHitPoints ? (ddbData.baseHitPoints + ddbData.bonusHitPoints - ddbData.removedHitPoints) : ddbData.baseHitPoints;

        if (foundryHP !== ddbHP) {
            diffs.push({
                field: "HP",
                foundry: foundryHP,
                ddb: ddbHP,
                direction: "DDB_TO_FOUNDRY",
                path: "system.attributes.hp.value"
            });
        }

        // Ability Scores (Simplified)
        for (let [id, ability] of Object.entries(actor.system.abilities)) {
            const ddbScore = ddbData.stats.find(s => s.id === this._getDDBStatId(id))?.value || 10;
            if (ability.value !== ddbScore) {
                diffs.push({
                    field: id.toUpperCase(),
                    foundry: ability.value,
                    ddb: ddbScore,
                    direction: "DDB_TO_FOUNDRY",
                    path: `system.abilities.${id}.value`
                });
            }
        }

        return diffs;
    }

    /**
     * Maps Foundry ability keys to DDB stat IDs.
     * @private
     */
    static _getDDBStatId(key) {
        const map = { str: 1, dex: 2, con: 3, int: 4, wis: 5, cha: 6 };
        return map[key];
    }
}
