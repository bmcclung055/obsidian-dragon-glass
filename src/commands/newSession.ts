import { App, Notice, TFile, moment } from 'obsidian';
import { DragonGlassSettings } from '../settings';
import { VaultIndex } from '../model/vaultIndex';
import { joinPath, sessionBasename } from '../model/naming';
import { writeFrontmatter } from '../model/frontmatter';

/**
 * The session body. The recap is a live block rather than a Dataview query with the
 * previous session number baked in, so renumbering or reordering never strands it.
 */
function sessionBody(title: string): string {
	return [
		'',
		`# ${title}`,
		'',
		'## Recap',
		'',
		'```dragon-glass',
		'view: recap',
		'```',
		'',
		'## Session Summary',
		'',
		'',
	].join('\n');
}

export async function createSession(
	app: App,
	settings: DragonGlassSettings,
	index: VaultIndex,
	campaignFolder: string
): Promise<TFile | null> {
	const campaign = index.getCampaign(campaignFolder);
	if (!campaign) {
		new Notice(`No campaign named ${campaignFolder}.`);
		return null;
	}

	const folder = app.vault.getFolderByPath(campaign.path);
	if (!folder) {
		new Notice(`${campaign.path} is not a folder.`);
		return null;
	}

	const number = index.nextSessionNumber(campaignFolder);
	const now = new Date();
	const basename = sessionBasename(settings, number, now);
	const path = joinPath(folder.path, `${basename}.md`);

	if (app.vault.getFileByPath(path)) {
		new Notice(`${basename} already exists.`);
		return null;
	}

	try {
		const file = await app.vault.create(path, sessionBody(basename));

		await writeFrontmatter(app, file, {
			creationDate: moment(now).format('YYYY-MM-DD'),
			type: 'session',
			session: number,
			campaign: campaign.folder,
			summary: '',
		});

		await app.workspace.getLeaf(false).openFile(file);
		return file;
	} catch (error) {
		console.error('Dragon Glass: failed to create session', error);
		new Notice(`Could not create session: ${(error as Error).message}`);
		return null;
	}
}
