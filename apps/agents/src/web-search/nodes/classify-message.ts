import { WebSearchState } from '../state.js';
import { getModelFromConfig } from '../../utils.js';
import z from 'zod';

const CLASSIFIER_PROMPT = `You're a helpful AI assistant tasked with classifying the user's latest message.
The user has enabled web search for their conversation, however not all messages should be searched.

Analyze their latest message in isolation and determine if it warrants a web search to include additional context.

<message>
{message}
</message>`;

const classificationSchema = z
  .object({
    shouldSearch: z
      .boolean()
      .describe(
        "Whether or not to search the web based on the user's latest message."
      ),
  })
  .describe("The classification of the user's latest message.");

export async function classifyMessage(
  state: WebSearchState
): Promise<Partial<WebSearchState>> {
  const baseModel = await getModelFromConfig(
    {},
    {
      temperature: 0,
      isToolCalling: true,
    }
  );

  const model = baseModel.withStructuredOutput(classificationSchema, {
    name: 'classify_message',
  });

  const latestMessage = state.messages[state.messages.length - 1];
  if (!latestMessage) {
    throw new Error('No messages found');
  }

  const latestMessageContent = latestMessage.content as string;
  const formattedPrompt = CLASSIFIER_PROMPT.replace(
    '{message}',
    latestMessageContent
  );

  const response = await model.invoke([['user', formattedPrompt]]);

  return {
    shouldSearch: response.shouldSearch,
  };
}
