import { AIMessage } from '@langchain/core/messages';
import type { LangGraphRunnableConfig } from '@langchain/langgraph';
import type { ArtifactMarkdownV3, ArtifactV3 } from '@workspace/shared/types';
import {
  getArtifactContent,
  isArtifactMarkdownContent,
} from '@workspace/shared/utils/artifacts';
import type { GameEngineState } from '../state.js';
import type { GameResponse } from '../types.js';

function normalize(results: GameResponse): GameResponse {
  const narration = String(results.narration || '').trim();
  const rawChoices = results.choices;
  const choices = Array.isArray(rawChoices)
    ? rawChoices
        .map((c) => String(c).trim())
        .filter((c) => c.length > 0)
        .slice(0, 4)
    : undefined;
  const statCheck = results.statCheck
    ? {
        stat: String(results.statCheck.stat || '').trim(),
        difficulty: Number(results.statCheck.difficulty || 0),
        result: Number(results.statCheck.result || 0),
        success: Boolean(results.statCheck.success),
      }
    : undefined;
  const combat = results.combat
    ? {
        enemies: Array.isArray(results.combat.enemies)
          ? results.combat.enemies.map((e) => String(e))
          : [],
        playerHealth: Number(results.combat.playerHealth || 0),
        enemyHealth: results.combat.enemyHealth || {},
      }
    : undefined;

  return {
    ...results,
    narration,
    ...(choices ? { choices } : {}),
    ...(statCheck ? { statCheck } : {}),
    ...(combat ? { combat } : {}),
  };
}

export async function composeEngineOutputNode(
  state: GameEngineState,
  _config: LangGraphRunnableConfig
): Promise<Partial<GameEngineState>> {
  if (!state.gameEngineResults) {
    return {};
  }
  const normalized = normalize(state.gameEngineResults as GameResponse);

  // Build or update artifact
  const nextIndex = state.artifact?.contents.length
    ? state.artifact.contents.length + 1
    : 1;

  const previousContent = state.artifact
    ? getArtifactContent(state.artifact)
    : undefined;

  const prevMarkdown =
    previousContent && isArtifactMarkdownContent(previousContent)
      ? previousContent.fullMarkdown
      : undefined;

  const mdNarration = normalized.narration;
  const mdChoices = (() => {
    if (!Array.isArray(normalized.choices) || normalized.choices.length === 0) {
      return '';
    }
    // Cap at 3 to minimize repetition/noise
    const capped = normalized.choices.slice(0, 3);
    // If narration already includes a Choices header, avoid duplicating
    if (/\n#+\s*Choices/i.test(mdNarration)) {
      return '';
    }
    return `\n\n### Choices\n${capped
      .map((c, i) => `${i + 1}. ${c}`)
      .join('\n')}`;
  })();
  const mdStat = normalized.statCheck
    ? `\n\n> Stat Check: ${normalized.statCheck.stat} (DC ${normalized.statCheck.difficulty}) — Result ${normalized.statCheck.result} — ${normalized.statCheck.success ? 'Success' : 'Fail'}`
    : '';
  const mdCombat = normalized.combat
    ? `\n\n> Combat: Enemies ${normalized.combat.enemies.join(', ')} | PlayerHealth ${normalized.combat.playerHealth} | EnemyHealth ${JSON.stringify(
        normalized.combat.enemyHealth
      )}`
    : '';

  const newSection =
    `### Scene ${nextIndex}\n\n${mdNarration}\n\n${mdChoices}${mdStat}${mdCombat}`.replace(
      /\n{3,}/g,
      '\n\n'
    );
  const fullMarkdown = prevMarkdown
    ? `${prevMarkdown}\n\n---\n\n${newSection}`
    : newSection;

  const newContent: ArtifactMarkdownV3 = {
    index: nextIndex,
    type: 'text',
    title: `Scene ${nextIndex}`,
    fullMarkdown,
  };

  const updatedArtifact: ArtifactV3 = state.artifact?.contents?.length
    ? {
        currentIndex: nextIndex,
        contents: [...state.artifact.contents, newContent],
      }
    : {
        currentIndex: 1,
        contents: [newContent],
      };

  // Create a tailored follow-up message focused on choices
  const followupText =
    Array.isArray(normalized.choices) && normalized.choices.length
      ? `Choose: ${normalized.choices
          .slice(0, 3)
          .map((c, i) => `${i + 1}. ${c}`)
          .join('  ')}`
      : 'Your move. Describe your action or ask for details.';
  const followup = new AIMessage({ content: followupText });

  return {
    artifact: updatedArtifact,
    messages: [followup],
    _messages: [followup],
  };
}
