import type { TFile } from 'obsidian';

/** A session note: `type: session`, living directly in a campaign folder. */
export interface Session {
	file: TFile;
	/** From frontmatter `session:`, falling back to the `NNN-` filename prefix. */
	number: number | null;
	/** True when `number` came from the filename rather than frontmatter. */
	numberInferred: boolean;
	summary: string;
	/** From frontmatter `creationDate:`, else the `-YYYYMMDD` filename suffix, else ctime. */
	date: string | null;
}

/**
 * A campaign: a folder directly under the configured root that either holds an index
 * note (`type: campaign`) or, failing that, at least one session note.
 */
export interface Campaign {
	/** Folder name under the root. The campaign's stable identity. */
	folder: string;
	/** Full vault path of the folder. */
	path: string;
	/** Frontmatter `campaign:` when non-empty, else the folder name. */
	displayName: string;
	/** The index note, or null for an unindexed campaign. */
	indexFile: TFile | null;
	role: string;
	system: string;
	status: string;
	/** Frontmatter `creationDate:` on the index note. */
	created: string | null;
	sessions: Session[];
}

/** One entity table on a campaign index. `type` is any free string. */
export interface EntityTableConfig {
	type: string;
	title?: string;
	/** Frontmatter keys to show. Omitted, columns are inferred from the notes. */
	columns?: string[];
	sort?: string;
	sortDesc?: boolean;
	limit?: number;
}

/** Parsed contents of a ```dragon-glass``` code block. */
export interface BlockConfig {
	view: 'index' | 'campaign' | 'table' | 'recap';
	/** Explicit campaign folder; defaults to the folder containing the note. */
	campaign?: string;
	/** `view: campaign` only — entity tables rendered below the session table. */
	tables?: EntityTableConfig[];
	/** `view: table` only — the single table this block renders. */
	table?: EntityTableConfig;
	/** `view: recap` only — how many preceding sessions to show. Defaults to 1. */
	count?: number;
}
