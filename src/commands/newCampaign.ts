import { App, Notice, TFolder } from 'obsidian';
import { DragonGlassSettings } from '../settings';
import { NewCampaignModal, NewCampaignResult } from '../ui/NewCampaignModal';
import { createCampaignIndex } from './createIndex';
import { joinPath } from '../model/naming';

/** Create the folder if it is missing, and return it either way. */
export async function ensureFolder(app: App, path: string): Promise<TFolder> {
	const existing = app.vault.getFolderByPath(path);
	if (existing) return existing;
	// getFolderByPath is null both for "nothing here" and "a note is here"; only the
	// second is an error worth reporting.
	if (app.vault.getFileByPath(path)) throw new Error(`${path} exists but is not a folder.`);
	return app.vault.createFolder(path);
}

export function openNewCampaignModal(app: App, settings: DragonGlassSettings): void {
	new NewCampaignModal(app, settings, (result) => {
		void createCampaign(app, settings, result);
	}).open();
}

async function createCampaign(
	app: App,
	settings: DragonGlassSettings,
	result: NewCampaignResult
): Promise<void> {
	try {
		await ensureFolder(app, settings.rootFolder);
		const folder = await ensureFolder(app, joinPath(settings.rootFolder, result.name));

		for (const subfolder of result.subfolders) {
			await ensureFolder(app, joinPath(folder.path, subfolder));
		}

		const file = await createCampaignIndex(app, settings, folder, {
			role: result.role,
			system: result.system,
			status: result.status,
		});

		await app.workspace.getLeaf(false).openFile(file);
		new Notice(`Created ${result.name}.`);
	} catch (error) {
		console.error('Dragon Glass: failed to create campaign', error);
		new Notice(`Could not create campaign: ${(error as Error).message}`);
	}
}
