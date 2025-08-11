import { AIMessage } from '@langchain/core/messages';
import type { LangGraphRunnableConfig } from '@langchain/langgraph';
import { ARTIFACT_TOOL_SCHEMA } from '../../open-canvas/nodes/generate-artifact/schemas.js';
import { getModelFromConfig } from '../../utils.js';
import type { GameEngineState } from '../state.js';
import type { GameResponse } from '../types.js';

const stripEngineStructAndDebugJson = (input: string): string => {
  if (!input) {
    return '';
  }
  let output = input;
  // Remove any <engine-struct>...</engine-struct> blocks (extra safety if any leaked)
  output = output.replace(/<engine-struct>[\s\S]*?<\/engine-struct>/gi, '');
  // Remove any standalone JSON blocks that look like engine struct
  output = output.replace(/(?:^|\n)\s*\{[\s\S]*?\}\s*(?=\n|$)/g, (match) => {
    const lower = match.toLowerCase();
    const isEngineStructLike =
      lower.includes('"choices"') ||
      lower.includes("'choices'") ||
      lower.includes('"statcheck"') ||
      lower.includes("'statcheck'") ||
      lower.includes('"combat"') ||
      lower.includes("'combat'");
    return isEngineStructLike ? '' : match;
  });
  return output.replace(/\n{3,}/g, '\n\n').trim();
};

function normalize(results: GameResponse): GameResponse {
  const narration = stripEngineStructAndDebugJson(
    String(results.narration || '').trim()
  );
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

  const nextIndex = state.artifact?.contents.length
    ? state.artifact.contents.length + 1
    : 1;

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

  const toolCallingModel = (
    await getModelFromConfig(_config, { isToolCalling: true })
  )
    .bindTools(
      [
        {
          name: 'generate_artifact',
          description: ARTIFACT_TOOL_SCHEMA.description,
          schema: ARTIFACT_TOOL_SCHEMA,
        },
      ],
      { tool_choice: 'generate_artifact' }
    )
    .withConfig({ runName: 'composeEngineOutput' });

  const prompt = `You are formatting a game engine scene into a single artifact entry for display.
Call the generate_artifact tool only and return ONLY the new scene entry, not any prior history.

Inputs:
<section>\n${newSection}\n</section>

Rules:
- type must be 'text'.
- language must be 'other'.
- title should be "Scene ${nextIndex}".
- artifact must equal the section content exactly.`;

  // Fire the tool call; the UI listens to streamed chunks and will append a new history entry.
  await toolCallingModel.invoke([{ role: 'user', content: prompt }]);

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
    messages: [followup],
    _messages: [followup],
  };
}
