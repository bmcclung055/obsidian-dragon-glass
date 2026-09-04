import { App, Notice, TFile, TFolder, moment } from 'obsidian';
import { DragonGlassSettings } from '../settings';
import { campaignIndexBasename, joinPath } from '../model/naming';
import { writeFrontmatter } from '../model/frontmatter';
import { VaultIndex } from '../model/vaultIndex';

export interface CampaignMeta {
	role: string;
	system: string;
	status: string;
}

/** The body every campaign index note gets. The block carries no paths or line numbers. */
export function campaignIndexBody(title: string): string {
	return [
		'',
		`# ${title}`,
		'',
		'## Sessions',
		'',
		'```dragon-glass',
		'view: campaign',
		'```',
		'',
	].join('\n');
}

/**
 * Create a campaign index note inside an existing folder.
 *
 * Used both by the new-campaign flow and to adopt a folder that already holds sessions but
 * no index.
 */
export async function createCampaignIndex(
	app: App,
	settings: DragonGlassSettings,
	folder: TFolder,
	meta: CampaignMeta,
	created?: string
): Promise<TFile> {
	const basename = campaignIndexBasename(settings, folder.name);
	const path = joinPath(folder.path, `${basename}.md`);

	const existing = app.vault.getFileByPath(path);
	if (existing) {
		new Notice(`${basename} already exists.`);
		return existing;
	}

	const file = await app.vault.create(path, campaignIndexBody(basename));

	await writeFrontmatter(app, file, {
		creationDate: created ?? moment().format('YYYY-MM-DD'),
		campaign: folder.name,
		role: meta.role,
		system: meta.system,
		status: meta.status,
		type: settings.campaignType,
	});

	return file;
}

/**
 * Give a campaign folder that has sessions but no index note a working one, then open it.
 */
export async function adoptCampaignFolder(
	app: App,
	settings: DragonGlassSettings,
	index: VaultIndex,
	folder: TFolder
): Promise<void> {
	const file = await createCampaignIndex(app, settings, folder, {
		role: settings.roles[0] ?? '',
		system: settings.systems[0] ?? '',
		status: 'active',
	});
	index.rebuild();
	await app.workspace.getLeaf(false).openFile(file);
}
