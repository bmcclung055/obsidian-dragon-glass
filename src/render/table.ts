import { App, Component, Keymap, MarkdownRenderer, TFile } from 'obsidian';

export interface Column<T> {
	/** Stable id, used as the sort key. */
	key: string;
	header: string;
	/** Value the column sorts on. Strings compare with locale collation. */
	value: (row: T) => string | number;
	/** Fills the cell. Defaults to the stringified sort value. */
	render?: (cell: HTMLElement, row: T) => void;
	className?: string;
	/** Column cannot be sorted (an actions column, say). */
	unsortable?: boolean;
}

/** Sort state lives with the view so a re-render keeps the reader's chosen order. */
export interface SortState {
	key: string | null;
	desc: boolean;
}

export interface TableOptions<T> {
	columns: Column<T>[];
	rows: T[];
	sort: SortState;
	/** Re-renders the whole view after the sort state changes. */
	onSortChange: () => void;
	emptyText?: string;
}

export function renderTable<T>(container: HTMLElement, options: TableOptions<T>): void {
	const { columns, rows, sort, onSortChange } = options;

	if (rows.length === 0) {
		container.createDiv({
			cls: 'dragon-glass-empty',
			text: options.emptyText ?? 'Nothing here yet.',
		});
		return;
	}

	const sorted = [...rows];
	const activeColumn = columns.find((column) => column.key === sort.key);
	if (activeColumn) {
		sorted.sort((a, b) => {
			const left = activeColumn.value(a);
			const right = activeColumn.value(b);
			const comparison =
				typeof left === 'number' && typeof right === 'number'
					? left - right
					: String(left).localeCompare(String(right), undefined, { numeric: true });
			return sort.desc ? -comparison : comparison;
		});
	}

	const wrapper = container.createDiv({ cls: 'dragon-glass-table-wrapper' });
	const table = wrapper.createEl('table', { cls: 'dragon-glass-table' });

	const headerRow = table.createEl('thead').createEl('tr');
	for (const column of columns) {
		const cell = headerRow.createEl('th', { cls: column.className });
		if (column.unsortable) {
			cell.setText(column.header);
			continue;
		}

		cell.addClass('is-sortable');
		cell.setText(column.header);
		if (sort.key === column.key) {
			cell.addClass('is-sorted');
			cell.createSpan({
				cls: 'dragon-glass-sort-arrow',
				text: sort.desc ? ' ▾' : ' ▴',
			});
		}
		cell.addEventListener('click', () => {
			if (sort.key === column.key) {
				sort.desc = !sort.desc;
			} else {
				sort.key = column.key;
				sort.desc = false;
			}
			onSortChange();
		});
	}

	const body = table.createEl('tbody');
	for (const row of sorted) {
		const tableRow = body.createEl('tr');
		for (const column of columns) {
			const cell = tableRow.createEl('td', { cls: column.className });
			if (column.render) column.render(cell, row);
			else cell.setText(String(column.value(row)));
		}
	}
}

/** An internal link that honours modifier-click for a new tab or split. */
export function renderFileLink(
	app: App,
	cell: HTMLElement,
	file: TFile,
	sourcePath: string,
	label?: string
): void {
	const link = cell.createEl('a', {
		cls: 'internal-link',
		text: label ?? file.basename,
		href: file.path,
	});
	link.addEventListener('click', (event) => {
		event.preventDefault();
		app.workspace.openLinkText(file.path, sourcePath, Keymap.isModEvent(event));
	});
}

/**
 * Render a cell's text as markdown, so wikilinks written into a session summary stay
 * live links rather than becoming literal `[[brackets]]`.
 */
export function renderMarkdownCell(
	app: App,
	cell: HTMLElement,
	markdown: string,
	sourcePath: string,
	component: Component
): void {
	if (!markdown) return;
	const holder = cell.createDiv({ cls: 'dragon-glass-markdown-cell' });
	void MarkdownRenderer.render(app, markdown, holder, sourcePath, component);
}
