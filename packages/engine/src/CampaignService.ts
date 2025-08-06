import { type Campaign, CampaignSchema } from './types';

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

// Static campaign data for client-side use
const STATIC_CAMPAIGNS: Record<string, Campaign> = {
  'baldurs-gate-3': {
    id: 'baldurs-gate-3',
    name: "Baldur's Gate 3",
    description:
      'A dark, mature D&D 5e campaign set in the Forgotten Realms. You awaken aboard a nautiloid ship with a Mind Flayer tadpole in your head, beginning a journey of survival, choice, and power.',
    ruleset: 'dnd-5e',
    intro: `You awaken aboard a nautiloid ship, your head pounding with a strange, alien presence. A Mind Flayer tadpole has been implanted in your brain, and you're hurtling through the Astral Plane. The ship is under attack by Githyanki warriors, and you must fight for your survival while coming to terms with your new... condition.

As you struggle to escape the crashing vessel, you'll encounter other survivors - potential companions who share your fate. Together, you'll embark on a journey across the Forgotten Realms, seeking a cure for the tadpole while uncovering ancient secrets and facing impossible choices.

Your decisions will shape not only your own destiny, but the fate of entire realms. Will you embrace the power the tadpole offers, or fight to remove it? Will you save the world, or watch it burn?

The adventure begins now...`,
    companions: [
      {
        id: 'shadowheart',
        name: 'Shadowheart',
        description:
          "A mysterious half-elf cleric of Shar, the goddess of darkness and loss. She's secretive about her past and mission, but her healing abilities make her a valuable ally.",
      },
      {
        id: 'astarion',
        name: 'Astarion',
        description:
          "A charismatic high elf vampire spawn with a sharp wit and sharper fangs. He's been a slave to a cruel master for 200 years and seeks freedom and power.",
      },
      {
        id: 'laezel',
        name: "Lae'zel",
        description:
          "A fierce Githyanki warrior with a strict code of honor and a burning desire to return to her people. She's pragmatic and direct, but not without depth.",
      },
      {
        id: 'gale',
        name: 'Gale',
        description:
          'A human wizard of great renown who carries a dangerous secret - he has a Netherese orb in his chest that threatens to consume him and everything around him.',
      },
      {
        id: 'wyll',
        name: 'Wyll',
        description:
          "The Blade of Frontiers, a human warlock who made a pact with a devil to gain power and protect the innocent. He's charming and heroic, but his past haunts him.",
      },
      {
        id: 'karlach',
        name: 'Karlach',
        description:
          "A tiefling barbarian who escaped from the Nine Hells after being sold to Zariel. She's full of life and energy, but her infernal engine heart threatens to burn her alive.",
      },
    ],
    locations: [
      {
        id: 'nautiloid',
        name: 'Nautiloid Ship',
        description:
          'A massive Mind Flayer vessel floating through the Astral Plane. The ship is under attack and crashing, filled with dangerous creatures and potential allies.',
        connections: ['crash-site'],
      },
      {
        id: 'crash-site',
        name: 'Crash Site',
        description:
          'The wreckage of the nautiloid ship on the Sword Coast. The area is dangerous but may contain survivors and valuable resources.',
        connections: ['nautiloid', 'grove'],
      },
      {
        id: 'grove',
        name: 'Emerald Grove',
        description:
          "A sacred druid grove protected by nature magic. It's currently under threat from goblin raiders and internal strife.",
        connections: ['crash-site', 'goblin-camp'],
      },
      {
        id: 'goblin-camp',
        name: 'Goblin Camp',
        description:
          "A chaotic encampment of goblins, bugbears, and other creatures. It's a dangerous place but may hold answers about the Mind Flayer threat.",
        connections: ['grove', 'underdark'],
      },
      {
        id: 'underdark',
        name: 'Underdark',
        description:
          "A vast network of underground caverns and tunnels. It's home to dangerous creatures but may offer a path to safety or power.",
        connections: ['goblin-camp', 'moonrise-towers'],
      },
      {
        id: 'moonrise-towers',
        name: 'Moonrise Towers',
        description:
          "An ancient fortress that serves as the base of operations for the cult of the Absolute. It's heavily defended and holds many secrets.",
        connections: ['underdark', 'baldurs-gate'],
      },
      {
        id: 'baldurs-gate',
        name: "Baldur's Gate",
        description:
          "The great city of Baldur's Gate, a center of commerce, politics, and intrigue. It's here that the final confrontation may take place.",
        connections: ['moonrise-towers'],
      },
    ],
    plot: [
      {
        id: 'escape-nautiloid',
        title: 'Escape the Nautiloid',
        description:
          'Survive the crash of the Mind Flayer ship and escape with your life.',
        requirements: [],
      },
      {
        id: 'find-companions',
        title: 'Find Companions',
        description:
          'Locate and recruit potential allies who share your condition.',
        requirements: ['escape-nautiloid'],
      },
      {
        id: 'investigate-tadpole',
        title: 'Investigate the Tadpole',
        description:
          'Learn more about the Mind Flayer tadpole and potential cures.',
        requirements: ['find-companions'],
      },
      {
        id: 'confront-absolute',
        title: 'Confront the Absolute',
        description:
          'Face the cult of the Absolute and their mysterious leader.',
        requirements: ['investigate-tadpole'],
      },
      {
        id: 'final-choice',
        title: 'The Final Choice',
        description:
          'Make the ultimate decision about your fate and the fate of the realms.',
        requirements: ['confront-absolute'],
      },
    ],
  },
};

export class CampaignService {
  private campaignsPath: string;

  constructor(campaignsPath?: string) {
    // Default to campaigns directory relative to project root
    this.campaignsPath =
      campaignsPath || (isBrowser ? '/campaigns' : '/campaigns'); // Simplified for now - will be overridden in Node.js
  }

  async loadCampaign(campaignId: string): Promise<Campaign> {
    try {
      if (isBrowser) {
        // In browser, use static data
        const campaign = STATIC_CAMPAIGNS[campaignId];
        if (campaign) {
          return campaign;
        }
        throw new Error(`Campaign ${campaignId} not found`);
      } else {
        // In Node.js, use fs - but this won't be bundled for browser
        // For now, fall back to static data in browser builds
        const campaign = STATIC_CAMPAIGNS[campaignId];
        if (campaign) {
          return campaign;
        }
        throw new Error(`Campaign ${campaignId} not found`);
      }
    } catch (error) {
      throw new Error(`Failed to load campaign ${campaignId}: ${error}`);
    }
  }

  async listCampaigns(): Promise<string[]> {
    try {
      if (isBrowser) {
        // In browser, return hardcoded list
        return Object.keys(STATIC_CAMPAIGNS);
      } else {
        // In Node.js, use fs - but this won't be bundled for browser
        // For now, fall back to static data in browser builds
        return Object.keys(STATIC_CAMPAIGNS);
      }
    } catch (error) {
      throw new Error(`Failed to list campaigns: ${error}`);
    }
  }

  async getCampaignIntro(campaignId: string): Promise<string> {
    try {
      if (isBrowser) {
        // In browser, use static data
        const campaign = STATIC_CAMPAIGNS[campaignId];
        if (campaign) {
          return campaign.intro;
        }
        throw new Error(`Campaign ${campaignId} not found`);
      } else {
        // In Node.js, use fs - but this won't be bundled for browser
        // For now, fall back to static data in browser builds
        const campaign = STATIC_CAMPAIGNS[campaignId];
        if (campaign) {
          return campaign.intro;
        }
        throw new Error(`Campaign ${campaignId} not found`);
      }
    } catch (error) {
      throw new Error(
        `Failed to load campaign intro for ${campaignId}: ${error}`
      );
    }
  }

  async getCompanions(campaignId: string): Promise<any[]> {
    try {
      if (isBrowser) {
        // In browser, use static data
        const campaign = STATIC_CAMPAIGNS[campaignId];
        if (campaign) {
          return campaign.companions;
        }
        throw new Error(`Campaign ${campaignId} not found`);
      } else {
        // In Node.js, use fs - but this won't be bundled for browser
        // For now, fall back to static data in browser builds
        const campaign = STATIC_CAMPAIGNS[campaignId];
        if (campaign) {
          return campaign.companions;
        }
        throw new Error(`Campaign ${campaignId} not found`);
      }
    } catch (error) {
      throw new Error(`Failed to load companions for ${campaignId}: ${error}`);
    }
  }

  async getLocations(campaignId: string): Promise<any[]> {
    try {
      if (isBrowser) {
        // In browser, use static data
        const campaign = STATIC_CAMPAIGNS[campaignId];
        if (campaign) {
          return campaign.locations;
        }
        throw new Error(`Campaign ${campaignId} not found`);
      } else {
        // In Node.js, use fs - but this won't be bundled for browser
        // For now, fall back to static data in browser builds
        const campaign = STATIC_CAMPAIGNS[campaignId];
        if (campaign) {
          return campaign.locations;
        }
        throw new Error(`Campaign ${campaignId} not found`);
      }
    } catch (error) {
      throw new Error(`Failed to load locations for ${campaignId}: ${error}`);
    }
  }

  async getPlot(campaignId: string): Promise<any[]> {
    try {
      if (isBrowser) {
        // In browser, use static data
        const campaign = STATIC_CAMPAIGNS[campaignId];
        if (campaign) {
          return campaign.plot;
        }
        throw new Error(`Campaign ${campaignId} not found`);
      } else {
        // In Node.js, use fs - but this won't be bundled for browser
        // For now, fall back to static data in browser builds
        const campaign = STATIC_CAMPAIGNS[campaignId];
        if (campaign) {
          return campaign.plot;
        }
        throw new Error(`Campaign ${campaignId} not found`);
      }
    } catch (error) {
      throw new Error(`Failed to load plot for ${campaignId}: ${error}`);
    }
  }
}
