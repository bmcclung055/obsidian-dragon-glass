import { App, Modal, Setting } from 'obsidian';
import { DragonGlassSettings } from '../settings';
import { validateCampaignName } from '../model/naming';

export interface NewCampaignResult {
	name: string;
	role: string;
	system: string;
	status: string;
	subfolders: string[];
}

/** Replaces the chain of `tp.system.prompt` / `suggester` calls the templates used. */
export class NewCampaignModal extends Modal {
	private name = '';
	private role: string;
	private system: string;
	private status: string;
	private subfolders: string[];
	private errorEl: HTMLElement | null = null;

	constructor(
		app: App,
		private settings: DragonGlassSettings,
		private onSubmit: (result: NewCampaignResult) => void
	) {
		super(app);
		this.role = settings.roles[0] ?? '';
		this.system = settings.systems[0] ?? '';
		this.status = settings.statuses[0] ?? 'active';
		this.subfolders = [...settings.campaignSubfolders];
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass('dragon-glass-modal');
		contentEl.createEl('h2', { text: 'New campaign' });

		new Setting(contentEl).setName('Name').addText((text) => {
			text.setPlaceholder('Greyhawk').onChange((value) => {
				this.name = value;
				this.clearError();
			});
			text.inputEl.addEventListener('keydown', (event) => {
				if (event.key === 'Enter') {
					event.preventDefault();
					this.submit();
				}
			});
			window.setTimeout(() => text.inputEl.focus(), 0);
		});

		const dropdowns: Array<[string, string[], 'role' | 'system' | 'status']> = [
			['Role', this.settings.roles, 'role'],
			['System', this.settings.systems, 'system'],
			['Status', this.settings.statuses, 'status'],
		];

		for (const [label, options, key] of dropdowns) {
			if (options.length === 0) continue;
			new Setting(contentEl).setName(label).addDropdown((dropdown) => {
				for (const option of options) dropdown.addOption(option, option);
				dropdown.setValue(this[key]).onChange((value) => {
					this[key] = value;
				});
			});
		}

		new Setting(contentEl)
			.setName('Subfolders')
			.setDesc('Created inside the campaign folder. Comma separated; leave empty for none.')
			.addText((text) =>
				text.setValue(this.subfolders.join(', ')).onChange((value) => {
					this.subfolders = value
						.split(',')
						.map((item) => item.trim())
						.filter((item) => item.length > 0);
				})
			);

		this.errorEl = contentEl.createDiv({ cls: 'dragon-glass-modal-error' });

		new Setting(contentEl)
			.addButton((button) => button.setButtonText('Cancel').onClick(() => this.close()))
			.addButton((button) =>
				button.setButtonText('Create').setCta().onClick(() => this.submit())
			);
	}

	private clearError(): void {
		this.errorEl?.setText('');
	}

	private showError(message: string): void {
		this.errorEl?.setText(message);
	}

	private submit(): void {
		const name = this.name.trim();

		const invalid = validateCampaignName(name);
		if (invalid) {
			this.showError(invalid);
			return;
		}

		const path = `${this.settings.rootFolder}/${name}`;
		if (this.app.vault.getAbstractFileByPath(path)) {
			this.showError(`${path} already exists.`);
			return;
		}

		this.close();
		this.onSubmit({
			name,
			role: this.role,
			system: this.system,
			status: this.status,
			subfolders: this.subfolders,
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
