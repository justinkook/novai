import { AIMessage } from '@langchain/core/messages';
import type { LangGraphRunnableConfig } from '@langchain/langgraph';
import { getModelFromConfig } from '../../utils.js';
import type {
  GameEngineGraphAnnotation,
  GameEngineGraphReturnType,
} from '../state.js';

function sanitizeNarration(raw: string): string {
  // Remove engine-struct blocks
  const text = raw
    .replace(/<engine-struct>[\s\S]*?<\/engine-struct>/gi, '')
    .trim();
  // Stop at common choice prompt markers to avoid duplicating choices in chat
  const stopMarkers = [
    /\bThree paths present themselves[:：]?/i,
    /\bThe choice is yours[.!?]*/i,
    /\bWhat will you do\??/i,
    /^Choices?:/i,
  ];
  const lines = text.split(/\n+/);
  const cleaned: string[] = [];
  let stop = false;
  for (const line of lines) {
    if (stop) break;
    // If the line looks like a menu item, stop here
    if (/^\s*(?:\d+\.|[-*])\s+/.test(line)) break;
    if (stopMarkers.some((re) => re.test(line))) {
      stop = true;
      continue;
    }
    cleaned.push(line);
  }
  return cleaned
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Generate a followup AI chat message that summarizes mechanics like choices,
 * stat checks, and combat from gameEngineResults. This message is for chat, not canvas.
 */
export const generateFollowup = async (
  state: typeof GameEngineGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<GameEngineGraphReturnType> => {
  const smallModel = await getModelFromConfig(config, {
    maxTokens: 150,
    temperature: 0.2,
    isToolCalling: true,
  });
  const results = state.gameEngineResults;
  const parts: string[] = [];

  if (results?.narration) {
    const cleaned = sanitizeNarration(results.narration);
    // Summarize narration briefly with the small model
    let summary: string | null = null;
    try {
      const response = await smallModel.invoke([
        {
          role: 'system',
          content:
            'You summarize fantasy game narrative in 3-4 short sentences. Be vivid but concise. Do not list choices or spoilers. Output plain text only.',
        },
        { role: 'user', content: cleaned.slice(0, 1200) },
      ]);
      summary = response.content?.toString().trim() || null;
      if (summary && /^summary\s*[:：]/i.test(summary)) {
        summary = summary.replace(/^summary\s*[:：]\s*/i, '').trim();
      }
    } catch {
      summary = null;
    }

    const narrativeSection: string[] = [];
    if (summary) {
      narrativeSection.push('#### Summary');
      narrativeSection.push('');
      narrativeSection.push(`> ${summary}`);
    } else {
      narrativeSection.push('#### Narrative');
      narrativeSection.push('');
      narrativeSection.push(`> ${cleaned}`);
    }
    parts.push(narrativeSection.join('\n'));
  }

  if (results?.choices?.length) {
    const list = results.choices.slice(0, 3).map((c, i) => `${i + 1}. ${c}`);
    parts.push(['### Choices', '', ...list].join('\n'));
  }

  if (results?.statCheck) {
    const sc = results.statCheck;
    const lines = [
      '### Stat Check',
      '',
      `- **Stat**: ${sc.stat}`,
      `- **DC**: ${sc.difficulty}`,
      `- **Roll**: ${sc.result}`,
      `- **Outcome**: ${sc.success ? 'Success' : 'Fail'}`,
    ];
    parts.push(lines.join('\n'));
  }

  if (results?.combat) {
    const enemies = results.combat.enemies || [];
    const showCombat =
      enemies.length > 0 &&
      !(enemies.length === 1 && enemies[0] === 'Unknown enemy');
    if (showCombat) {
      const enemyHealth = results.combat.enemyHealth || {};
      const enemyHpLines = Object.keys(enemyHealth)
        .sort()
        .map((name) => `  - ${name}: ${enemyHealth[name]}`);
      const lines = [
        '### Combat',
        '',
        `- **Enemies**: ${enemies.join(', ')}`,
        `- **Player HP**: ${results.combat.playerHealth}`,
        '- **Enemy HP**:',
        ...enemyHpLines,
      ];
      parts.push(lines.join('\n'));
    }
  }

  const text = parts.length
    ? parts.join('\n\n')
    : 'Your move. Describe your action or ask for details.';

  const response = new AIMessage({ content: text });

  return {
    messages: [response],
    _messages: [response],
  };
};
