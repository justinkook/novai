import { getCampaignSystemPrompt, getRulesetPrompt } from '@workspace/prompts';
import { CampaignService } from './CampaignService';
import { LLMService } from './LLMService';
import type { GameRequest, GameResponse, GameState, LLMConfig } from './types';

export class GameEngineService {
  private llmService: LLMService;
  private campaignService: CampaignService;

  constructor(llmConfig: LLMConfig, campaignsPath?: string) {
    this.llmService = new LLMService(llmConfig);
    this.campaignService = new CampaignService(campaignsPath);
  }

  async processGameRequest(request: GameRequest): Promise<GameResponse> {
    const { gameState, playerInput, context } = request;

    // Load campaign data
    const campaign = await this.campaignService.loadCampaign(
      gameState.campaignId
    );

    // Build system prompt based on campaign and ruleset
    const systemPrompt = await this.buildSystemPrompt(campaign, gameState);

    // Build user prompt with player input and context
    const userPrompt = this.buildUserPrompt(playerInput, gameState, context);

    // Get narrative memory from game state
    const memory = gameState.narrative.map((n) => n.content).slice(-5); // Last 5 narrative entries

    // Call LLM
    const aiResponse = await this.llmService.callLLM(
      `${systemPrompt}\n\n${userPrompt}`,
      memory,
      0.7
    );

    // Parse AI response and update game state
    const updatedGameState = this.updateGameState(
      gameState,
      playerInput,
      aiResponse
    );

    // Extract choices, stat checks, and combat info from AI response
    const choices = this.extractChoices(aiResponse);
    const statCheck = this.extractStatCheck(aiResponse);
    const combat = this.extractCombat(aiResponse);

    return {
      narration: aiResponse,
      choices,
      statCheck,
      combat,
      updatedGameState,
    };
  }

  private async buildSystemPrompt(
    campaign: { name: string; description: string; ruleset?: string },
    gameState: GameState
  ): Promise<string> {
    const ruleset = campaign.ruleset || 'dnd-5e';
    const rulesetPrompt = getRulesetPrompt(ruleset);
    const campaignExtra = getCampaignSystemPrompt(gameState.campaignId);

    return `You are a Dungeon Master narrating ${campaign.name} in ${ruleset} style.

${rulesetPrompt}
${campaignExtra ? `\n${campaignExtra}\n` : ''}

CAMPAIGN CONTEXT:
- Campaign: ${campaign.name}
- Description: ${campaign.description}
- Current Location: ${gameState.currentLocation}
- Companions: ${gameState.companions.join(', ') || 'None'}
- Player Stats: ${JSON.stringify(gameState.stats)}

RULES:
- Handle stat checks, choices, companions, turn-based combat
- Never break character
- Use 2nd-person narration
- Provide 2-4 meaningful choices when appropriate
- Include stat checks when relevant (e.g., "Make a Strength check (DC 15)")
- Describe combat in turn-based format
- Maintain narrative consistency and immersion`;
  }

  private buildUserPrompt(
    playerInput: string,
    gameState: GameState,
    context?: Record<string, unknown>
  ): string {
    return `PLAYER INPUT: ${playerInput}

CURRENT GAME STATE:
- Location: ${gameState.currentLocation}
- Inventory: ${gameState.inventory.join(', ') || 'Empty'}
- Recent choices: ${gameState.choices.slice(-3).join(', ') || 'None'}

${context ? `CONTEXT: ${JSON.stringify(context)}\n` : ''}

Respond as the Game Master, continuing the narrative based on the player's input.`;
  }

  private updateGameState(
    gameState: GameState,
    playerInput: string,
    aiResponse: string
  ): GameState {
    const timestamp = new Date().toISOString();

    return {
      ...gameState,
      narrative: [
        ...gameState.narrative,
        {
          timestamp,
          content: `Player: ${playerInput}`,
          type: 'choice',
        },
        {
          timestamp,
          content: aiResponse,
          type: 'narration',
        },
      ],
    };
  }

  private extractChoices(aiResponse: string): string[] | undefined {
    // Simple extraction - look for numbered choices or bullet points
    const choiceMatches = aiResponse.match(
      /(?:^|\n)(?:\d+\.|\*|-)\s*(.+?)(?=\n|$)/g
    );
    if (choiceMatches && choiceMatches.length > 0) {
      return choiceMatches.map((choice) =>
        choice.replace(/^(?:\d+\.|\*|-)\s*/, '').trim()
      );
    }
    return undefined;
  }

  private extractStatCheck(aiResponse: string): any | undefined {
    // Look for stat check patterns like "Make a Strength check (DC 15)"
    const statCheckMatch = aiResponse.match(/Make a (\w+) check \(DC (\d+)\)/i);
    if (statCheckMatch?.[1] && statCheckMatch[2]) {
      const stat = statCheckMatch[1];
      const difficulty = parseInt(statCheckMatch[2]);
      const result = Math.floor(Math.random() * 20) + 1; // Simple d20 roll
      return {
        stat,
        difficulty,
        result,
        success: result >= difficulty,
      };
    }
    return undefined;
  }

  private extractCombat(aiResponse: string): any | undefined {
    // Look for combat indicators
    if (
      aiResponse.toLowerCase().includes('combat') ||
      aiResponse.toLowerCase().includes('battle')
    ) {
      return {
        enemies: ['Unknown enemy'],
        playerHealth: 100,
        enemyHealth: { 'Unknown enemy': 50 },
      };
    }
    return undefined;
  }

  async createNewGame(
    campaignId: string,
    playerName: string
  ): Promise<GameState> {
    const _campaign = await this.campaignService.loadCampaign(campaignId);
    const intro = await this.campaignService.getCampaignIntro(campaignId);

    const initialGameState: GameState = {
      id: `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      campaignId,
      playerName,
      currentLocation: 'start',
      companions: [],
      inventory: [],
      stats: {
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      },
      choices: [],
      narrative: [
        {
          timestamp: new Date().toISOString(),
          content: intro,
          type: 'narration',
        },
      ],
    };

    return initialGameState;
  }
}
