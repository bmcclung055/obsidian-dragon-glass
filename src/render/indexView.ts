import { TFolder } from 'obsidian';
import { Campaign } from '../model/types';
import { Column, renderFileLink, renderTable } from './table';
import { openNewCampaignModal } from '../commands/newCampaign';
import { adoptCampaignFolder } from '../commands/createIndex';
import { ViewContext } from './context';

/** Latest session date in a campaign, or empty when it has none. */
function lastPlayed(campaign: Campaign): string {
	let latest = '';
	for (const session of campaign.sessions) {
		if (session.date && session.date > latest) latest = session.date;
	}
	return latest;
}

export function renderIndexView(context: ViewContext, container: HTMLElement): void {
	const { app, plugin, sourcePath } = context;
	const campaigns = plugin.index.getCampaigns();

	const toolbar = container.createDiv({ cls: 'dragon-glass-toolbar' });
	const newButton = toolbar.createEl('button', {
		cls: 'mod-cta dragon-glass-button',
		text: '+ New Campaign',
	});
	newButton.addEventListener('click', () =>
		openNewCampaignModal(app, plugin.settings)
	);

	// Status chips, built from what the campaigns actually declare rather than the
	// configured list, so a campaign with an unexpected status stays reachable.
	const statuses = [...new Set(campaigns.map((c) => c.status).filter(Boolean))].sort();
	if (statuses.length > 1) {
		const filters = toolbar.createDiv({ cls: 'dragon-glass-filters' });
		const chip = (label: string, value: string | null) => {
			const el = filters.createEl('button', {
				cls: 'dragon-glass-chip',
				text: label,
			});
			if (context.statusFilter === value) el.addClass('is-active');
			el.addEventListener('click', () => {
				context.statusFilter = context.statusFilter === value ? null : value;
				context.rerender();
			});
		};
		chip('All', null);
		for (const status of statuses) chip(status, status);
	}

	const visible = context.statusFilter
		? campaigns.filter((campaign) => campaign.status === context.statusFilter)
		: campaigns;

	const columns: Column<Campaign>[] = [
		{
			key: 'name',
			header: 'Campaign',
			value: (campaign) => campaign.displayName,
			render: (cell, campaign) => {
				if (campaign.indexFile) {
					renderFileLink(app, cell, campaign.indexFile, sourcePath, campaign.displayName);
					return;
				}

				// A folder holding sessions but no index note. Offer to adopt it rather
				// than silently hiding a campaign that plainly exists.
				cell.createSpan({ text: campaign.displayName });
				const adopt = cell.createEl('button', {
					cls: 'dragon-glass-inline-button',
					text: 'Set up index',
				});
				adopt.addEventListener('click', async () => {
					const folder = app.vault.getAbstractFileByPath(campaign.path);
					if (!(folder instanceof TFolder)) return;
					await adoptCampaignFolder(app, plugin.settings, plugin.index, folder);
				});
			},
		},
		{
			key: 'created',
			header: 'Created',
			value: (campaign) => campaign.created ?? '',
		},
		{
			key: 'lastPlayed',
			header: 'Last Played',
			value: (campaign) => lastPlayed(campaign),
		},
		{
			key: 'sessions',
			header: 'Sessions',
			value: (campaign) => campaign.sessions.length,
			className: 'dragon-glass-numeric',
		},
		{ key: 'system', header: 'System', value: (campaign) => campaign.system },
		{ key: 'role', header: 'Role', value: (campaign) => campaign.role },
		{ key: 'status', header: 'Status', value: (campaign) => campaign.status },
	];

	renderTable(container, {
		columns,
		rows: visible,
		sort: context.sort,
		onSortChange: context.rerender,
		emptyText: `No campaigns found in ${plugin.settings.rootFolder}.`,
	});
}
