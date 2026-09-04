import { Notice, Plugin } from 'obsidian';
import {
	DEFAULT_SETTINGS,
	DragonGlassSettingTab,
	DragonGlassSettings,
	cleanPath,
} from './src/settings';
import { VaultIndex } from './src/model/vaultIndex';
import { DragonGlassBlock, parseBlockConfig } from './src/render/block';
import { openNewCampaignModal, ensureFolder } from './src/commands/newCampaign';
import { createSession } from './src/commands/newSession';
import { CampaignSuggestModal } from './src/ui/CampaignSuggestModal';
import { adoptCampaignFolder } from './src/commands/createIndex';

export default class DragonGlassPlugin extends Plugin {
	settings: DragonGlassSettings;
	index: VaultIndex;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.index = new VaultIndex(this.app, this.settings);
		this.addSettingTab(new DragonGlassSettingTab(this.app, this));

		this.registerMarkdownCodeBlockProcessor('dragon-glass', (source, element, ctx) => {
			try {
				const config = parseBlockConfig(source);
				ctx.addChild(new DragonGlassBlock(this, element, config, ctx));
			} catch (error) {
				element.createDiv({
					cls: 'dragon-glass dragon-glass-error',
					text: `Dragon Glass: ${(error as Error).message}`,
				});
			}
		});

		// The vault's file list is not populated until layout is ready; building before
		// then yields an empty index on startup.
		this.app.workspace.onLayoutReady(async () => {
			this.index.rebuild();
			if (this.settings.autoCreateGameIndex) {
				await this.ensureGameIndex(false);
			}
		});

		// The vault holds plenty outside the campaign tree (Personal, Stat Blocks, …);
		// editing any of it should not trigger a rescan.
		const touchesCampaigns = (path: string, oldPath?: string): boolean => {
			const root = this.settings.rootFolder + '/';
			return path.startsWith(root) || (oldPath?.startsWith(root) ?? false);
		};

		this.registerEvent(
			this.app.metadataCache.on('changed', (file) => {
				if (touchesCampaigns(file.path)) this.index.scheduleRebuild();
			})
		);
		this.registerEvent(
			this.app.vault.on('rename', (file, oldPath) => {
				if (touchesCampaigns(file.path, oldPath)) this.index.scheduleRebuild();
			})
		);
		this.registerEvent(
			this.app.vault.on('delete', (file) => {
				if (touchesCampaigns(file.path)) this.index.scheduleRebuild();
			})
		);
		this.registerEvent(
			this.app.vault.on('create', (file) => {
				if (touchesCampaigns(file.path)) this.index.scheduleRebuild();
			})
		);

		this.registerCommands();
	}

	private registerCommands(): void {
		this.addCommand({
			id: 'open-game-index',
			name: 'Open game index',
			callback: () => void this.ensureGameIndex(true),
		});

		this.addCommand({
			id: 'new-campaign',
			name: 'New campaign',
			callback: () => openNewCampaignModal(this.app, this.settings),
		});

		this.addCommand({
			id: 'new-session',
			name: 'New session',
			callback: () => {
				const active = this.app.workspace.getActiveFile();
				const campaign = active ? this.index.getCampaignForPath(active.path) : null;

				if (campaign) {
					void createSession(this.app, this.settings, this.index, campaign.folder);
					return;
				}

				new CampaignSuggestModal(this.app, this.index.getCampaigns(), (chosen) =>
					void createSession(this.app, this.settings, this.index, chosen.folder)
				).open();
			},
		});

		this.addCommand({
			id: 'create-campaign-index',
			name: 'Set up campaign index',
			callback: () => {
				const unindexed = this.index
					.getCampaigns()
					.filter((campaign) => !campaign.indexFile);

				if (unindexed.length === 0) {
					new Notice('Every campaign already has an index note.');
					return;
				}

				new CampaignSuggestModal(this.app, unindexed, async (chosen) => {
					const folder = this.app.vault.getFolderByPath(chosen.path);
					if (!folder) return;
					await adoptCampaignFolder(this.app, this.settings, this.index, folder);
				}).open();
			},
		});
	}

	/** Open the game index, creating it first when it does not exist. */
	private async ensureGameIndex(open: boolean): Promise<void> {
		const path = this.settings.gameIndexPath;
		let file = this.app.vault.getFileByPath(path);

		if (!file) {
			const lastSlash = path.lastIndexOf('/');
			if (lastSlash > 0) await ensureFolder(this.app, path.slice(0, lastSlash));

			const title = path.slice(lastSlash + 1).replace(/\.md$/, '');
			file = await this.app.vault.create(
				path,
				['', `# ${title}`, '', '```dragon-glass', 'view: index', '```', ''].join('\n')
			);
		}

		if (open && file) {
			await this.app.workspace.getLeaf(false).openFile(file);
		}
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

		// Paths saved before normalization existed, or hand-edited in data.json, would
		// otherwise bypass the settings tab's cleaning entirely.
		this.settings.rootFolder =
			cleanPath(this.settings.rootFolder) || DEFAULT_SETTINGS.rootFolder;
		this.settings.gameIndexPath =
			cleanPath(this.settings.gameIndexPath) || DEFAULT_SETTINGS.gameIndexPath;
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
