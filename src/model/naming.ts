import { moment, normalizePath } from 'obsidian';
import { DragonGlassSettings } from '../settings';

/** Characters Obsidian refuses in a file or folder name. */
const ILLEGAL_PATH_CHARS = /[\\/:*?"<>|#^[\]]/;

export function validateCampaignName(name: string): string | null {
	const trimmed = name.trim();
	if (!trimmed) return 'Enter a campaign name.';
	if (ILLEGAL_PATH_CHARS.test(trimmed)) return 'Name cannot contain \\ / : * ? " < > | # ^ [ ]';
	if (trimmed.startsWith('.')) return 'Name cannot start with a dot.';
	return null;
}

/** `{{name}} Index` → `Greyhawk Index`. */
export function campaignIndexBasename(settings: DragonGlassSettings, name: string): string {
	return settings.campaignIndexFormat.replace(/\{\{name\}\}/g, name).trim();
}

/** `{{num}}-{{date:YYYYMMDD}}` → `007-20230317`. */
export function sessionBasename(
	settings: DragonGlassSettings,
	sessionNumber: number,
	date: Date = new Date()
): string {
	const padded = String(sessionNumber).padStart(settings.sessionNumberPadding, '0');
	return settings.sessionFileFormat
		.replace(/\{\{num\}\}/g, padded)
		.replace(/\{\{date:([^}]+)\}\}/g, (_match, format: string) => moment(date).format(format))
		.trim();
}

/**
 * Join path segments into a vault path.
 *
 * Every segment here can originate in user input — a configured root folder, a campaign
 * name typed into the modal — so the result goes through `normalizePath`, which settles
 * backslashes, doubled and trailing separators, and non-breaking spaces. It maps an empty
 * path to '/', which is not what joining nothing means, so that case returns '' instead.
 */
export function joinPath(...segments: string[]): string {
	const joined = segments.filter((segment) => segment.length > 0).join('/');
	return joined ? normalizePath(joined) : '';
}
