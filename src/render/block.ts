import { MarkdownPostProcessorContext, MarkdownRenderChild, parseYaml } from 'obsidian';
import type DragonGlassPlugin from '../../main';
import { BlockConfig, EntityTableConfig } from '../model/types';
import { ViewContext } from './context';
import { renderIndexView } from './indexView';
import { renderCampaignView, renderTableView } from './campaignView';
import { renderRecapView } from './recapView';

const VALID_VIEWS = new Set(['index', 'campaign', 'table', 'recap']);

function parseTable(record: Record<string, unknown>): EntityTableConfig | null {
	const type = typeof record.type === 'string' ? record.type.trim() : '';
	if (!type) return null;

	return {
		type,
		title: typeof record.title === 'string' ? record.title : undefined,
		columns: Array.isArray(record.columns)
			? record.columns.filter((column): column is string => typeof column === 'string')
			: undefined,
		sort: typeof record.sort === 'string' ? record.sort : undefined,
		sortDesc: record.sortDesc === true,
		limit: typeof record.limit === 'number' ? record.limit : undefined,
	};
}

function parseTables(raw: unknown): EntityTableConfig[] | undefined {
	if (!Array.isArray(raw)) return undefined;

	const tables: EntityTableConfig[] = [];
	for (const entry of raw) {
		// `- person` is accepted as shorthand for `- type: person`.
		if (typeof entry === 'string') {
			tables.push({ type: entry });
			continue;
		}
		if (!entry || typeof entry !== 'object') continue;

		const table = parseTable(entry as Record<string, unknown>);
		if (table) tables.push(table);
	}
	return tables;
}

/** Parse the block body. Throws with a readable message the view can surface. */
export function parseBlockConfig(source: string): BlockConfig {
	const trimmed = source.trim();
	if (!trimmed) throw new Error('Empty block. Add "view: campaign" or "view: index".');

	const parsed: unknown = parseYaml(trimmed);
	if (!parsed || typeof parsed !== 'object') {
		throw new Error('Could not read this block as YAML.');
	}

	const record = parsed as Record<string, unknown>;
	const view = typeof record.view === 'string' ? record.view.trim() : '';
	if (!VALID_VIEWS.has(view)) {
		throw new Error(`Unknown view "${view || '(none)'}". Use index, campaign, or recap.`);
	}

	return {
		view: view as BlockConfig['view'],
		campaign: typeof record.campaign === 'string' ? record.campaign.trim() : undefined,
		tables: parseTables(record.tables),
		// A `view: table` block carries its table's keys at the top level.
		table: view === 'table' ? parseTable(record) ?? undefined : undefined,
		count: typeof record.count === 'number' ? record.count : undefined,
	};
}

export class DragonGlassBlock extends MarkdownRenderChild {
	private context: ViewContext;

	constructor(
		private plugin: DragonGlassPlugin,
		containerEl: HTMLElement,
		config: BlockConfig,
		ctx: MarkdownPostProcessorContext
	) {
		super(containerEl);

		this.context = {
			app: plugin.app,
			plugin,
			component: this,
			sourcePath: ctx.sourcePath,
			config,
			sort: config.view === 'index' ? { key: 'lastPlayed', desc: true } : { key: 'number', desc: true },
			entitySorts: new Map(),
			statusFilter: null,
			rerender: () => this.render(),
		};
	}

	onload(): void {
		this.registerEvent(this.plugin.index.on('changed', () => this.render()));
		this.render();
	}

	private render(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass('dragon-glass');

		try {
			switch (this.context.config.view) {
				case 'index':
					renderIndexView(this.context, containerEl);
					break;
				case 'campaign':
					renderCampaignView(this.context, containerEl);
					break;
				case 'table':
					renderTableView(this.context, containerEl);
					break;
				case 'recap':
					renderRecapView(this.context, containerEl);
					break;
			}
		} catch (error) {
			console.error('Dragon Glass: render failed', error);
			containerEl.createDiv({
				cls: 'dragon-glass-error',
				text: `Dragon Glass could not render this block: ${(error as Error).message}`,
			});
		}
	}
}
