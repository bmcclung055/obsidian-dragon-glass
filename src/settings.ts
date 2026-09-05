import { App, PluginSettingTab, normalizePath } from 'obsidian';
import type { SettingDefinitionItem } from 'obsidian';
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

/**
 * Tidy a path typed into the settings tab.
 *
 * `normalizePath` maps an empty string to '/', which would silently point the plugin at
 * the vault root, so a cleared field stays empty and the default takes over instead.
 */
export function cleanPath(value: string): string {
	const trimmed = value.trim();
	return trimmed ? normalizePath(trimmed) : '';
}

/** Split a textarea/comma value into a trimmed, non-empty list. */
export function parseList(value: string): string[] {
	return value
		.split(/[\n,]/)
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
}

/** Settings stored as a list but edited as one-per-line text. */
type ListKey = 'campaignSubfolders' | 'roles' | 'systems' | 'statuses' | 'knownTypes';

const LIST_KEYS: ListKey[] = [
	'campaignSubfolders',
	'roles',
	'systems',
	'statuses',
	'knownTypes',
];

function isListKey(key: string): key is ListKey {
	return (LIST_KEYS as string[]).includes(key);
}

export class DragonGlassSettingTab extends PluginSettingTab {
	plugin: DragonGlassPlugin;

	constructor(app: App, plugin: DragonGlassPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: 'Root folder',
				desc: 'Folder holding one subfolder per campaign.',
				control: { type: 'text', key: 'rootFolder', placeholder: 'TTRPG' },
			},
			{
				name: 'Game index note',
				desc: 'Path to the note listing every campaign.',
				control: {
					type: 'text',
					key: 'gameIndexPath',
					placeholder: 'TTRPG/TTRPG Game Index.md',
				},
			},
			{
				name: 'Create the game index on startup',
				desc: 'Create the note above if it does not exist yet.',
				control: { type: 'toggle', key: 'autoCreateGameIndex' },
			},
			{
				type: 'group',
				heading: 'Campaigns',
				items: [
					{
						name: 'Campaign index filename',
						desc: '{{name}} is the campaign folder name.',
						control: {
							type: 'text',
							key: 'campaignIndexFormat',
							placeholder: '{{name}} Index',
						},
					},
					{
						name: 'Campaign index type',
						desc: 'A note with this `type:` marks its folder as a campaign. Keep it distinct from any type you use for in-game notes.',
						// No placeholder here: it would hold the literal frontmatter value
						// `campaign`, which the sentence-case rule wants capitalised, and
						// `type: Campaign` is not what this setting means.
						control: { type: 'text', key: 'campaignType' },
					},
					{
						name: 'Subfolders for new campaigns',
						desc: 'Created inside each new campaign folder. One per line; leave empty for none.',
						control: { type: 'textarea', key: 'campaignSubfolders' },
					},
				],
			},
			{
				type: 'group',
				heading: 'New campaign choices',
				items: [
					{
						name: 'Roles',
						desc: 'Choices offered for `role:`. One per line.',
						control: { type: 'textarea', key: 'roles' },
					},
					{
						name: 'Systems',
						desc: 'Choices offered for `system:`. One per line.',
						control: { type: 'textarea', key: 'systems' },
					},
					{
						name: 'Statuses',
						desc: 'Choices offered for `status:`. One per line.',
						control: { type: 'textarea', key: 'statuses' },
					},
				],
			},
			{
				type: 'group',
				heading: 'Sessions',
				items: [
					{
						name: 'Session filename',
						desc: '{{num}} is the padded session number. {{date:FORMAT}} takes a moment format.',
						control: {
							type: 'text',
							key: 'sessionFileFormat',
							placeholder: '{{num}}-{{date:YYYYMMDD}}',
						},
					},
					{
						name: 'Session number padding',
						desc: 'Digits to zero-pad session numbers to, so 3 gives 007.',
						control: {
							type: 'number',
							key: 'sessionNumberPadding',
							min: 0,
							defaultValue: DEFAULT_SETTINGS.sessionNumberPadding,
							validate: (value: number) =>
								Number.isInteger(value) && value >= 0
									? undefined
									: 'Enter a whole number of digits, 0 or more.',
						},
					},
				],
			},
			{
				type: 'group',
				heading: 'Entity tables',
				items: [
					{
						name: 'Known types',
						desc: 'Suggested in the settings. Any `type:` value works whether listed or not. One per line.',
						control: { type: 'textarea', key: 'knownTypes' },
					},
					{
						name: 'Default tables',
						desc: 'Types tabulated on every campaign index that does not list its own `tables:`. One per line; columns are inferred from your notes.',
						control: { type: 'textarea', key: 'defaultEntityTables' },
					},
				],
			},
		];
	}

	/** Stored value → control value. Lists render as one entry per line. */
	getControlValue(key: string): unknown {
		const settings = this.plugin.settings;

		if (isListKey(key)) return settings[key].join('\n');
		if (key === 'defaultEntityTables') {
			return settings.defaultEntityTables.map((table) => table.type).join('\n');
		}
		return settings[key as keyof DragonGlassSettings];
	}

	/**
	 * Control value → stored value, applying the same coercion the imperative tab did:
	 * a cleared field falls back to its default rather than persisting an empty value.
	 */
	async setControlValue(key: string, value: unknown): Promise<void> {
		const settings = this.plugin.settings;
		// Only the two settings that change what counts as a campaign need a rescan.
		let rebuild = false;

		if (isListKey(key)) {
			settings[key] = parseList(String(value));
		} else {
			switch (key) {
				case 'rootFolder':
					settings.rootFolder = cleanPath(String(value));
					rebuild = true;
					break;
				case 'gameIndexPath':
					settings.gameIndexPath = cleanPath(String(value));
					break;
				case 'autoCreateGameIndex':
					settings.autoCreateGameIndex = Boolean(value);
					break;
				case 'campaignIndexFormat':
					settings.campaignIndexFormat =
						String(value).trim() || DEFAULT_SETTINGS.campaignIndexFormat;
					break;
				case 'campaignType':
					settings.campaignType = String(value).trim() || DEFAULT_SETTINGS.campaignType;
					rebuild = true;
					break;
				case 'sessionFileFormat':
					settings.sessionFileFormat =
						String(value).trim() || DEFAULT_SETTINGS.sessionFileFormat;
					break;
				case 'sessionNumberPadding': {
					const padding = Number(value);
					settings.sessionNumberPadding =
						Number.isInteger(padding) && padding >= 0
							? padding
							: DEFAULT_SETTINGS.sessionNumberPadding;
					break;
				}
				case 'defaultEntityTables':
					settings.defaultEntityTables = parseList(String(value)).map((type) => ({ type }));
					break;
			}
		}

		await this.plugin.saveSettings();
		if (rebuild) this.plugin.index.rebuild();
	}
}
