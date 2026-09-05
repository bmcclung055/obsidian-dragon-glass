import { TFile } from 'obsidian';
import { Campaign, EntityTableConfig, Session } from '../model/types';
import { Column, SortState, renderFileLink, renderMarkdownCell, renderTable } from './table';
import { createSession } from '../commands/newSession';
import { readString } from '../model/frontmatter';
import { ViewContext } from './context';

/** Title Case a frontmatter key for a column header: `association` → `Association`. */
function humanize(key: string): string {
	return key
		.replace(/[_-]+/g, ' ')
		.replace(/([a-z])([A-Z])/g, '$1 $2')
		.replace(/\b\w/g, (character) => character.toUpperCase());
}

function sortFor(context: ViewContext, key: string, fallback: SortState): SortState {
	let state = context.entitySorts.get(key);
	if (!state) {
		state = fallback;
		context.entitySorts.set(key, state);
	}
	return state;
}

function renderSessions(
	context: ViewContext,
	container: HTMLElement,
	campaign: Campaign
): void {
	const { app, plugin, sourcePath } = context;

	const toolbar = container.createDiv({ cls: 'dragon-glass-toolbar' });
	const button = toolbar.createEl('button', {
		cls: 'mod-cta dragon-glass-button',
		text: 'New session',
	});
	const onNewSession = async (): Promise<void> => {
		button.disabled = true;
		try {
			await createSession(app, plugin.settings, plugin.index, campaign.folder);
		} finally {
			button.disabled = false;
		}
	};
	button.addEventListener('click', () => void onNewSession());

	toolbar.createSpan({
		cls: 'dragon-glass-count',
		text: `${campaign.sessions.length} session${campaign.sessions.length === 1 ? '' : 's'}`,
	});

	const columns: Column<Session>[] = [
		{
			key: 'number',
			header: '#',
			className: 'dragon-glass-numeric',
			value: (session) => session.number ?? -1,
			render: (cell, session) => {
				const label =
					session.number === null
						? '—'
						: String(session.number).padStart(plugin.settings.sessionNumberPadding, '0');
				renderFileLink(app, cell, session.file, sourcePath, label);
				// Flag numbers read off the filename because frontmatter had none.
				if (session.numberInferred) cell.addClass('is-inferred');
			},
		},
		{
			key: 'date',
			header: 'Date',
			value: (session) => session.date ?? '',
		},
		{
			key: 'summary',
			header: 'Summary',
			className: 'dragon-glass-summary',
			value: (session) => session.summary,
			render: (cell, session) =>
				renderMarkdownCell(app, cell, session.summary, sourcePath, context.component),
		},
	];

	renderTable(container, {
		columns,
		rows: campaign.sessions,
		sort: sortFor(context, '__sessions', context.sort),
		onSortChange: context.rerender,
		emptyText: 'No sessions yet. Use the button above to start one.',
	});
}

export function renderEntityTable(
	context: ViewContext,
	container: HTMLElement,
	campaign: Campaign,
	config: EntityTableConfig,
	options: { heading?: boolean } = {}
): void {
	const { app, plugin, sourcePath } = context;

	const files = plugin.index.getEntities(campaign.folder, config.type);
	const columns = config.columns?.length
		? config.columns
		: plugin.index.inferColumns(campaign.folder, config.type);

	const section = container.createDiv({ cls: 'dragon-glass-section' });

	// A standalone block usually sits under a heading the note already has, so it only
	// adds its own when asked for one.
	if (options.heading !== false || config.title) {
		section.createEl('h3', {
			cls: 'dragon-glass-section-title',
			text: config.title ?? humanize(config.type),
		});
	}

	const value = (file: TFile, key: string): string => {
		const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
		return readString(frontmatter?.[key]);
	};

	const tableColumns: Column<TFile>[] = [
		{
			key: 'name',
			header: 'Name',
			value: (file) => file.basename,
			render: (cell, file) => renderFileLink(app, cell, file, sourcePath),
		},
		...columns.map((key) => ({
			key,
			header: humanize(key),
			value: (file: TFile) => value(file, key),
		})),
	];

	const rows = config.limit ? files.slice(0, config.limit) : files;

	renderTable(section, {
		columns: tableColumns,
		rows,
		sort: sortFor(context, config.type, {
			key: config.sort ?? 'name',
			desc: config.sortDesc ?? false,
		}),
		onSortChange: context.rerender,
		emptyText: `No notes with type: ${config.type} in this campaign.`,
	});
}

/**
 * The campaign a block belongs to: the one named in the block, else the one owning the
 * note's folder. Writes its own error into the container when neither resolves.
 */
export function resolveCampaign(
	context: ViewContext,
	container: HTMLElement
): Campaign | null {
	const { plugin, config, sourcePath } = context;

	const folder = config.campaign ?? plugin.index.getCampaignForPath(sourcePath)?.folder;
	if (!folder) {
		container.createDiv({
			cls: 'dragon-glass-error',
			text: `This note is not inside a campaign folder under ${plugin.settings.rootFolder}. Add a "campaign:" line to the block to choose one.`,
		});
		return null;
	}

	const campaign = plugin.index.getCampaign(folder);
	if (!campaign) {
		container.createDiv({ cls: 'dragon-glass-error', text: `No campaign named ${folder}.` });
		return null;
	}

	return campaign;
}

export function renderCampaignView(context: ViewContext, container: HTMLElement): void {
	const campaign = resolveCampaign(context, container);
	if (!campaign) return;

	renderSessions(context, container, campaign);

	const tables = context.config.tables ?? context.plugin.settings.defaultEntityTables;
	for (const table of tables) {
		if (!table.type) continue;
		renderEntityTable(context, container, campaign, table);
	}
}

/** A single entity table, standing on its own under whatever heading the note provides. */
export function renderTableView(context: ViewContext, container: HTMLElement): void {
	const config = context.config.table;
	if (!config?.type) {
		container.createDiv({
			cls: 'dragon-glass-error',
			text: 'This block needs a "type:" naming the notes to tabulate.',
		});
		return;
	}

	const campaign = resolveCampaign(context, container);
	if (!campaign) return;

	renderEntityTable(context, container, campaign, config, { heading: false });
}
