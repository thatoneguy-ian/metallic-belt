import { DDBDataService } from "./DDBDataService.js";

/**
 * Dialog for comparing Foundry data with D&D Beyond data.
 */
export class DDBSyncDialog extends Application {
    constructor(actor, ddbData, options = {}) {
        super(options);
        this.actor = actor;
        this.ddbData = ddbData;
        this.diffs = DDBDataService.computeDiff(actor, ddbData);
    }

    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "ddb-sync-dialog",
            template: "modules/ddb-character-sheet/templates/sync-dialog.hbs",
            title: game.i18n.localize("DDB_SHEET.Sync.Title"),
            width: 600,
            height: "auto",
            classes: ["ddb-sheet", "sync-dialog"]
        });
    }

    /** @override */
    getData() {
        return {
            actor: this.actor,
            diffs: this.diffs
        };
    }

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);

        html.find(".sync-execute").click(this._onSyncExecute.bind(this));
        html.find(".diff-checkbox").change(this._onCheckboxChange.bind(this));
    }

    _onCheckboxChange(event) {
        const index = event.currentTarget.dataset.index;
        this.diffs[index].enabled = event.currentTarget.checked;
    }

    async _onSyncExecute(event) {
        event.preventDefault();
        const approvedChanges = this.diffs.filter(d => d.enabled !== false);

        console.log("DDB-Sheet | Executing Sync for:", approvedChanges);

        for (let change of approvedChanges) {
            if (change.direction === "DDB_TO_FOUNDRY") {
                await this.actor.update({ [change.path]: change.ddb });
            } else {
                // Foundry to DDB (Write-back) logic would go here
                ui.notifications.warn(`Syncing ${change.field} to D&D Beyond is not yet implemented.`);
            }
        }

        ui.notifications.info(`Synchronized ${approvedChanges.length} changes.`);
        this.close();
    }
}
