import { App, TFile } from 'obsidian';

/**
 * Read a frontmatter value as a trimmed string. Obsidian yields numbers, booleans and
 * dates here too, and the vault holds plenty of empty values (`campaign:` with nothing
 * after it), so normalise everything to a string and let callers test for emptiness.
 */
export function readString(value: unknown): string {
	if (value === null || value === undefined) return '';
	if (typeof value === 'string') return value.trim();
	if (typeof value === 'number' || typeof value === 'boolean') return String(value);
	if (value instanceof Date) return value.toISOString().slice(0, 10);
	return '';
}

/** Read a frontmatter value as a number, tolerating numeric strings. */
export function readNumber(value: unknown): number | null {
	if (typeof value === 'number') return Number.isFinite(value) ? value : null;
	if (typeof value === 'string') {
		const parsed = Number.parseInt(value.trim(), 10);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
}

/**
 * Merge keys into a note's frontmatter through Obsidian's own writer.
 *
 * The Templater templates this replaces built frontmatter by string concatenation, which
 * is how `Duets.md` ended up with duplicate `status`/`type` keys and `Masks.md` with a
 * run of blank lines inside its block. Going through `processFrontMatter` makes that
 * class of corruption impossible.
 */
export async function writeFrontmatter(
	app: App,
	file: TFile,
	values: Record<string, unknown>
): Promise<void> {
	await app.fileManager.processFrontMatter(file, (frontmatter) => {
		for (const [key, value] of Object.entries(values)) {
			frontmatter[key] = value;
		}
	});
}
