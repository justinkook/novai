import OpenAI from 'openai';
import type { LLMConfig } from './types';

export class LLMService {
  private config: LLMConfig;
  private openai?: OpenAI;

  constructor(config: LLMConfig) {
    this.config = config;
    if (config.provider === 'openai' && config.apiKey) {
      this.openai = new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
      });
    }
  }

  async callLLM(
    prompt: string,
    memory: string[] = [],
    temperature: number = 0.7
  ): Promise<string> {
    switch (this.config.provider) {
      case 'openai':
        return this.callOpenAI(prompt, memory, temperature);
      case 'local':
        return this.callLocal(prompt, memory, temperature);
      default:
        throw new Error(`Unsupported LLM provider: ${this.config.provider}`);
    }
  }

  private async callOpenAI(
    prompt: string,
    memory: string[],
    temperature: number
  ): Promise<string> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const messages = [
      {
        role: 'system' as const,
        content:
          'You are an AI-powered Game Master for a text-based RPG. Respond in character and maintain narrative consistency.',
      },
      ...memory.map((msg) => ({
        role: 'user' as const,
        content: msg,
      })),
      {
        role: 'user' as const,
        content: prompt,
      },
    ];

    const response = await this.openai.chat.completions.create({
      model: this.config.model || 'gpt-4',
      messages,
      temperature,
      max_tokens: 1000,
    });

    return response.choices[0]?.message?.content || 'No response from AI';
  }

  private async callLocal(
    prompt: string,
    memory: string[],
    temperature: number
  ): Promise<string> {
    // For local LLM Studio or similar
    // This would typically use fetch to call a local endpoint
    const response = await fetch(
      this.config.baseUrl || 'http://localhost:1234/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model || 'local-model',
          messages: [
            {
              role: 'system',
              content:
                'You are an AI-powered Game Master for a text-based RPG. Respond in character and maintain narrative consistency.',
            },
            ...memory.map((msg) => ({
              role: 'user',
              content: msg,
            })),
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature,
          max_tokens: 1000,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Local LLM request failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'No response from local AI';
  }
}
