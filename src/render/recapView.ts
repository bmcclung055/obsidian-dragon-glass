import { TFile } from 'obsidian';
import { renderFileLink, renderMarkdownCell } from './table';
import { readNumber } from '../model/frontmatter';
import { ViewContext } from './context';

/**
 * The preceding session's summary, resolved at read time.
 *
 * The Templater version wrote `WHERE session = N-1` into each note at creation, so the
 * recap froze: renumber or reorder anything and every prior note pointed at the wrong
 * session, or nothing at all.
 */
export function renderRecapView(context: ViewContext, container: HTMLElement): void {
	const { app, plugin, config, sourcePath } = context;

	const campaign = config.campaign
		? plugin.index.getCampaign(config.campaign)
		: plugin.index.getCampaignForPath(sourcePath);

	if (!campaign) {
		container.createDiv({
			cls: 'dragon-glass-error',
			text: 'This note is not inside a campaign folder.',
		});
		return;
	}

	const file = app.vault.getAbstractFileByPath(sourcePath);
	const frontmatter =
		file instanceof TFile ? app.metadataCache.getFileCache(file)?.frontmatter : undefined;
	const current = readNumber(frontmatter?.session);

	if (current === null) {
		container.createDiv({
			cls: 'dragon-glass-error',
			text: 'This note has no "session:" number, so there is nothing to recap from.',
		});
		return;
	}

	const count = Math.max(1, config.count ?? 1);
	const previous = campaign.sessions
		.filter((session) => session.number !== null && session.number < current)
		.sort((a, b) => (b.number ?? 0) - (a.number ?? 0))
		.slice(0, count)
		.reverse();

	if (previous.length === 0) {
		container.createDiv({ cls: 'dragon-glass-empty', text: 'No earlier sessions.' });
		return;
	}

	for (const session of previous) {
		const entry = container.createDiv({ cls: 'dragon-glass-recap' });
		const heading = entry.createDiv({ cls: 'dragon-glass-recap-heading' });
		renderFileLink(
			app,
			heading,
			session.file,
			sourcePath,
			`Session ${String(session.number).padStart(plugin.settings.sessionNumberPadding, '0')}`
		);
		if (session.date) heading.createSpan({ cls: 'dragon-glass-count', text: session.date });

		if (session.summary) {
			renderMarkdownCell(app, entry, session.summary, sourcePath, context.component);
		} else {
			entry.createDiv({ cls: 'dragon-glass-empty', text: 'No summary recorded.' });
		}
	}
}
