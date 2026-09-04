import { App, FuzzySuggestModal } from 'obsidian';
import { Campaign } from '../model/types';

export class CampaignSuggestModal extends FuzzySuggestModal<Campaign> {
	constructor(
		app: App,
		private campaigns: Campaign[],
		private onChoose: (campaign: Campaign) => void
	) {
		super(app);
		this.setPlaceholder('Pick a campaign');
	}

	getItems(): Campaign[] {
		return this.campaigns;
	}

	getItemText(campaign: Campaign): string {
		return campaign.displayName;
	}

	onChooseItem(campaign: Campaign): void {
		this.onChoose(campaign);
	}
}
