import { App, PluginSettingTab, Setting } from 'obsidian';
import type DragonGlassPlugin from '../main';
import { EntityTableConfig } from './model/types';

export interface DragonGlassSettings {
	rootFolder: string;
	gameIndexPath: string;
	autoCreateGameIndex: boolean;

	/** Filename pattern for a campaign index note. `{{name}}` is the campaign folder name. */
	campaignIndexFormat: string;
	/**
	 * The `type:` marking a note as a campaign index, both read and written.
	 *
	 * Deliberately one unambiguous value. `world` is not usable here: a campaign folder
	 * routinely holds in-game worldbuilding notes typed `world`, and there is no reliable
	 * way to tell those from the index.
	 */
	campaignType: string;

	roles: string[];
	systems: string[];
	statuses: string[];

	/** `{{num}}` is the zero-padded session number, `{{date:FORMAT}}` a moment format. */
	sessionFileFormat: string;
	sessionNumberPadding: number;

	/** Subfolders created inside a new campaign folder. Empty by default. */
	campaignSubfolders: string[];

	/** Seeds autocomplete only. Any type string is always accepted. */
	knownTypes: string[];
	defaultEntityTables: EntityTableConfig[];
}

export const DEFAULT_SETTINGS: DragonGlassSettings = {
	rootFolder: 'TTRPG',
	gameIndexPath: 'TTRPG/TTRPG Game Index.md',
	autoCreateGameIndex: false,

	campaignIndexFormat: '{{name}} Index',
	campaignType: 'campaign',

	roles: ['DM', 'Player'],
	systems: [
		'D&D 5e',
		'Dread',
		'Custom D6',
		'Pathfinder',
		'Dungeon Crawl Classics',
		'Kids on Bikes',
		'Kids on Brooms',
		'Never Stop Blowing Up',
		'Call of Cthulhu',
		'Powered By The Apocalypse',
	],
	statuses: ['active', 'hiatus', 'completed'],

	sessionFileFormat: '{{num}}-{{date:YYYYMMDD}}',
	sessionNumberPadding: 3,

	campaignSubfolders: [],

	knownTypes: ['person', 'player', 'location', 'faction', 'battle', 'item'],
	defaultEntityTables: [],
};

/** Split a textarea/comma value into a trimmed, non-empty list. */
export function parseList(value: string): string[] {
	return value
		.split(/[\n,]/)
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
}

export class DragonGlassSettingTab extends PluginSettingTab {
	plugin: DragonGlassPlugin;

	constructor(app: App, plugin: DragonGlassPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Root folder')
			.setDesc('Folder holding one subfolder per campaign.')
			.addText((text) =>
				text
					.setPlaceholder('TTRPG')
					.setValue(this.plugin.settings.rootFolder)
					.onChange(async (value) => {
						this.plugin.settings.rootFolder = value.trim().replace(/\/+$/, '');
						await this.plugin.saveSettings();
						this.plugin.index.rebuild();
					})
			);

		new Setting(containerEl)
			.setName('Game index note')
			.setDesc('Path to the note listing every campaign.')
			.addText((text) =>
				text
					.setPlaceholder('TTRPG/TTRPG Game Index.md')
					.setValue(this.plugin.settings.gameIndexPath)
					.onChange(async (value) => {
						this.plugin.settings.gameIndexPath = value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Create the game index on startup')
			.setDesc('Create the note above if it does not exist yet.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoCreateGameIndex)
					.onChange(async (value) => {
						this.plugin.settings.autoCreateGameIndex = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl).setName('Campaigns').setHeading();

		new Setting(containerEl)
			.setName('Campaign index filename')
			.setDesc('{{name}} is the campaign folder name.')
			.addText((text) =>
				text
					.setPlaceholder('{{name}} Index')
					.setValue(this.plugin.settings.campaignIndexFormat)
					.onChange(async (value) => {
						this.plugin.settings.campaignIndexFormat = value.trim() || '{{name}} Index';
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Campaign index type')
			.setDesc(
				'A note with this `type:` marks its folder as a campaign. Keep it distinct from any type you use for in-game notes.'
			)
			.addText((text) =>
				text
					.setPlaceholder('campaign')
					.setValue(this.plugin.settings.campaignType)
					.onChange(async (value) => {
						this.plugin.settings.campaignType = value.trim() || 'campaign';
						await this.plugin.saveSettings();
						this.plugin.index.rebuild();
					})
			);

		new Setting(containerEl)
			.setName('Subfolders for new campaigns')
			.setDesc('Created inside each new campaign folder. One per line; leave empty for none.')
			.addTextArea((area) =>
				area
					.setValue(this.plugin.settings.campaignSubfolders.join('\n'))
					.onChange(async (value) => {
						this.plugin.settings.campaignSubfolders = parseList(value);
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl).setName('New campaign options').setHeading();

		const listSettings: Array<[string, string, keyof DragonGlassSettings]> = [
			['Roles', 'Choices offered for `role:`. One per line.', 'roles'],
			['Systems', 'Choices offered for `system:`. One per line.', 'systems'],
			['Statuses', 'Choices offered for `status:`. One per line.', 'statuses'],
		];

		for (const [name, desc, key] of listSettings) {
			new Setting(containerEl)
				.setName(name)
				.setDesc(desc)
				.addTextArea((area) =>
					area
						.setValue((this.plugin.settings[key] as string[]).join('\n'))
						.onChange(async (value) => {
							(this.plugin.settings[key] as string[]) = parseList(value);
							await this.plugin.saveSettings();
						})
				);
		}

		new Setting(containerEl).setName('Sessions').setHeading();

		new Setting(containerEl)
			.setName('Session filename')
			.setDesc('{{num}} is the padded session number. {{date:FORMAT}} takes a moment format.')
			.addText((text) =>
				text
					.setPlaceholder('{{num}}-{{date:YYYYMMDD}}')
					.setValue(this.plugin.settings.sessionFileFormat)
					.onChange(async (value) => {
						this.plugin.settings.sessionFileFormat =
							value.trim() || '{{num}}-{{date:YYYYMMDD}}';
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Session number padding')
			.setDesc('Digits to zero-pad session numbers to. 3 gives 007.')
			.addText((text) =>
				text
					.setValue(String(this.plugin.settings.sessionNumberPadding))
					.onChange(async (value) => {
						const parsed = Number.parseInt(value, 10);
						this.plugin.settings.sessionNumberPadding =
							Number.isFinite(parsed) && parsed >= 0 ? parsed : 3;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl).setName('Entity tables').setHeading();

		new Setting(containerEl)
			.setName('Known types')
			.setDesc(
				'Suggested in the settings. Any `type:` value works whether listed or not. One per line.'
			)
			.addTextArea((area) =>
				area
					.setValue(this.plugin.settings.knownTypes.join('\n'))
					.onChange(async (value) => {
						this.plugin.settings.knownTypes = parseList(value);
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Default tables')
			.setDesc(
				'Types tabulated on every campaign index that does not list its own `tables:`. One per line; columns are inferred from your notes.'
			)
			.addTextArea((area) =>
				area
					.setValue(
						this.plugin.settings.defaultEntityTables.map((table) => table.type).join('\n')
					)
					.onChange(async (value) => {
						this.plugin.settings.defaultEntityTables = parseList(value).map((type) => ({
							type,
						}));
						await this.plugin.saveSettings();
					})
			);
	}
}
