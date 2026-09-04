import { App, Events, TFile, TFolder, debounce, moment } from 'obsidian';
import { DragonGlassSettings } from '../settings';
import { Campaign, Session } from './types';
import { readNumber, readString } from './frontmatter';

/** Frontmatter keys never offered as an inferred entity-table column. */
const INFER_EXCLUDED = new Set(['type', 'aliases', 'alias', 'position', 'cssclass', 'tags']);

/** Filenames like `007-20230317` — the vault's session convention. */
const SESSION_FILENAME = /^(\d+)-(\d{8})$/;

/**
 * Scans the root folder and answers every question the views ask.
 *
 * Discovery is by frontmatter, never by filename. A folder directly under the root is a
 * campaign when it holds an index note (`type: campaign`) or, failing that, at least one
 * session note. The second rule surfaces campaigns whose same-named note is something
 * else entirely, or whose note has no readable frontmatter at all.
 */
export class VaultIndex extends Events {
	private campaigns = new Map<string, Campaign>();

	constructor(private app: App, private settings: DragonGlassSettings) {
		super();
	}

	/** Coalesces the burst of metadata events Obsidian fires while a file is being written. */
	readonly scheduleRebuild = debounce(() => this.rebuild(), 150, true);

	rebuild(): void {
		this.campaigns.clear();

		const root = this.app.vault.getAbstractFileByPath(this.settings.rootFolder);
		if (!(root instanceof TFolder)) {
			this.trigger('changed');
			return;
		}

		for (const child of root.children) {
			if (!(child instanceof TFolder)) continue;
			const campaign = this.scanFolder(child);
			if (campaign) this.campaigns.set(campaign.folder, campaign);
		}

		this.trigger('changed');
	}

	private scanFolder(folder: TFolder): Campaign | null {
		const files = this.collectMarkdown(folder);
		const campaignType = this.settings.campaignType.toLowerCase();

		let indexFile: TFile | null = null;
		const sessions: Session[] = [];

		for (const file of files) {
			const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
			if (!frontmatter) continue;
			const type = readString(frontmatter.type).toLowerCase();

			if (type === 'session') {
				sessions.push(this.toSession(file, frontmatter));
				continue;
			}

			// Prefer an index note sitting directly in the campaign folder over a nested one.
			if (type === campaignType) {
				const isDirectChild = file.parent?.path === folder.path;
				if (!indexFile || (isDirectChild && indexFile.parent?.path !== folder.path)) {
					indexFile = file;
				}
			}
		}

		if (!indexFile && sessions.length === 0) return null;

		sessions.sort((a, b) => (a.number ?? -1) - (b.number ?? -1));

		const frontmatter = indexFile
			? this.app.metadataCache.getFileCache(indexFile)?.frontmatter
			: undefined;
		const declaredName = readString(frontmatter?.campaign);

		return {
			folder: folder.name,
			path: folder.path,
			// `Planescape.md` and `Strixhaven.md` both carry an empty `campaign:`.
			displayName: declaredName || folder.name,
			indexFile,
			role: readString(frontmatter?.role),
			system: readString(frontmatter?.system),
			status: readString(frontmatter?.status),
			created: readString(frontmatter?.creationDate) || null,
			sessions,
		};
	}

	private collectMarkdown(folder: TFolder): TFile[] {
		const files: TFile[] = [];
		const walk = (current: TFolder) => {
			for (const child of current.children) {
				if (child instanceof TFolder) walk(child);
				else if (child instanceof TFile && child.extension === 'md') files.push(child);
			}
		};
		walk(folder);
		return files;
	}

	private toSession(file: TFile, frontmatter: Record<string, unknown>): Session {
		const filenameMatch = SESSION_FILENAME.exec(file.basename);

		let number = readNumber(frontmatter.session);
		let numberInferred = false;
		if (number === null && filenameMatch) {
			number = Number.parseInt(filenameMatch[1], 10);
			numberInferred = true;
		}

		let date = readString(frontmatter.creationDate);
		if (!date && filenameMatch) {
			date = moment(filenameMatch[2], 'YYYYMMDD').format('YYYY-MM-DD');
		}
		if (!date) {
			date = moment(file.stat.ctime).format('YYYY-MM-DD');
		}

		return {
			file,
			number,
			numberInferred,
			summary: readString(frontmatter.summary),
			date,
		};
	}

	getCampaigns(): Campaign[] {
		return [...this.campaigns.values()].sort((a, b) =>
			a.displayName.localeCompare(b.displayName)
		);
	}

	getCampaign(folder: string): Campaign | null {
		return this.campaigns.get(folder) ?? null;
	}

	/**
	 * The first path segment below the root folder, whether or not that folder has been
	 * discovered as a campaign.
	 */
	getCampaignFolderName(path: string): string | null {
		const root = this.settings.rootFolder;
		if (!path.startsWith(root + '/')) return null;
		const [folder, ...rest] = path.slice(root.length + 1).split('/');
		// A file directly in the root is not inside any campaign.
		return rest.length > 0 ? folder : null;
	}

	/** The campaign owning a path, if that folder is a discovered campaign. */
	getCampaignForPath(path: string): Campaign | null {
		const folder = this.getCampaignFolderName(path);
		return folder ? this.getCampaign(folder) : null;
	}

	getSessions(folder: string): Session[] {
		return this.getCampaign(folder)?.sessions ?? [];
	}

	/** Notes of an arbitrary `type` within a campaign. */
	getEntities(folder: string, type: string): TFile[] {
		const campaign = this.getCampaign(folder);
		if (!campaign) return [];

		const target = type.toLowerCase();
		const parent = this.app.vault.getAbstractFileByPath(campaign.path);
		if (!(parent instanceof TFolder)) return [];

		return this.collectMarkdown(parent).filter((file) => {
			const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
			return readString(frontmatter?.type).toLowerCase() === target;
		});
	}

	/**
	 * Columns for an entity table with no explicit `columns:`. Takes the frontmatter keys
	 * most notes of that type actually carry, so the table fits whatever the campaign's
	 * system happens to record rather than any schema baked into this plugin.
	 */
	inferColumns(folder: string, type: string, limit = 5): string[] {
		const files = this.getEntities(folder, type);
		if (files.length === 0) return [];

		const counts = new Map<string, number>();
		for (const file of files) {
			const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
			if (!frontmatter) continue;
			for (const key of Object.keys(frontmatter)) {
				if (INFER_EXCLUDED.has(key.toLowerCase())) continue;
				counts.set(key, (counts.get(key) ?? 0) + 1);
			}
		}

		return [...counts.entries()]
			.filter(([, count]) => count >= files.length / 2)
			.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
			.slice(0, limit)
			.map(([key]) => key);
	}

	/**
	 * The number a new session should take: one past the highest that exists.
	 *
	 * The Templater script this replaces returned a *count*, so deleting a session made
	 * the next one collide with a live number. `Ravnica` also holds duplicate numbers,
	 * which a max handles cleanly and a count compounds.
	 */
	nextSessionNumber(folder: string): number {
		const sessions = this.getSessions(folder);
		let highest = -1;
		for (const session of sessions) {
			if (session.number !== null && session.number > highest) highest = session.number;
		}
		return highest + 1;
	}
}
