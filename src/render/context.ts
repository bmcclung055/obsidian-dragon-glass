import { App, Component } from 'obsidian';
import type DragonGlassPlugin from '../../main';
import { BlockConfig } from '../model/types';
import { SortState } from './table';

/**
 * State shared by every view, owned by the block's render child. Sort and filter live
 * here rather than in the rendered DOM so a metadata-driven re-render keeps whatever
 * ordering the reader picked.
 */
export interface ViewContext {
	app: App;
	plugin: DragonGlassPlugin;
	/** For `MarkdownRenderer.render` lifecycle, and for resolving relative links. */
	component: Component;
	sourcePath: string;
	config: BlockConfig;
	sort: SortState;
	/** Per-entity-table sort state, keyed by entity type. */
	entitySorts: Map<string, SortState>;
	statusFilter: string | null;
	rerender: () => void;
}
