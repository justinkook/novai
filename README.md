# NovAI - AI-Powered Text RPG Engine

**Novai** is a source-agnostic AI-driven text RPG system that replicates the full gameplay experience of games like Baldur's Gate 3 using only text, powered by LLMs as the Game Master.

## 🎯 Project Vision

Build a **campaign-agnostic AI-driven text RPG system** that can:

- Replicate full gameplay (characters, stat checks, combat, branching choices) using only text
- Support multiple campaigns (NovAI/BG3, Game of Thrones, Cyberpunk, etc.)
- Export playthroughs as traditional web novels
- Use LLMs as intelligent Game Masters

## 🛠 Tech Stack

- **Monorepo**: Turborepo
- **Frontend**: Next.js 15 (App Router), Tailwind CSS, shadcn/ui
- **Agents**: LangGraph + LangChain (TypeScript)
- **AI Providers**: OpenAI, Anthropic, Google Gemini, Fireworks, Groq, Ollama/local
- **Vector/Search**: Pinecone or Supabase pgvector; Exa (optional)
- **Storage**: Supabase PostgreSQL
- **Hosting**: Vercel (web), Railway/Fly.io/Render (agents)

## 🏗 Architecture

```
.
├── apps/
│   ├── web/               # Next.js frontend for player input/output
│   └── agents/            # LangGraph graphs (Open Canvas, NovAI, Reflection, ...)
│
├── packages/
│   ├── shared/            # Shared utils, model lists, types
│   ├── ui/                # Shared UI components
│   ├── evals/             # Evaluation utilities/tests
│   └── typescript-config/ # TS config presets
│
├── apps/docs/             # Mintlify documentation site
├── langgraph.json         # Graph registry for agents
├── turbo.json             # Turborepo config
└── .env                   # Root env (used by agents)
```

## 🎮 Features

### Core Engine (in agents)

- **AI Game Master**: LLM-powered narration and decision-making
- **Campaign-Aware Prompts**: D&D 5e-flavored guidance and mechanics
- **Campaign Data**: Lives in `apps/agents/src/game-engine/campaigns/`
- **Stat/Choice/Combat**: Extracted from AI output with structured summary

### Campaign Support

- **Baldur's Gate 3**: Full D&D 5e experience with Mind Flayer tadpole
- **Game of Thrones**: Political intrigue and noble politics
- **Cyberpunk**: Futuristic setting with corporate intrigue
- **Custom Campaigns**: Easy to create new campaigns

### Export Features

- **Web Novel Export**: Convert playthroughs to Markdown/text
- **AO3/WebNovel/KDP**: Ready for publishing platforms
- **Story Compilation**: Automatic chapter organization

## 🚀 Quick Start

1. **Clone and Setup**

```bash
git clone <repository>
cd novai
pnpm install
```

2. **Environment Variables**
   Create two env files: one at the repo root (for agents), and one for the web app.

```
# Root .env (agents)
OPENAI_API_KEY=...
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
# Optional local model (LM Studio/Ollama)
LOCAL_LLM_URL=http://localhost:11434/v1
LOCAL_LLM_MODEL=llama3.1

# Supabase (agents write access)
SUPABASE_SERVICE_ROLE=...
SUPABASE_URL=...

# Optional providers
ANTHROPIC_API_KEY=...
GOOGLE_API_KEY=...
FIREWORKS_API_KEY=...
GROQ_API_KEY=...
EXA_API_KEY=...
PINECONE_API_KEY=...
PINECONE_INDEX=novai-chapters

# Agents server
PORT=54367
```

```
# apps/web/.env.local (web)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# Base URLs
NEXT_PUBLIC_BASE_URL=http://localhost:3000
LANGGRAPH_API_URL=http://localhost:54367

# Feature toggles (optional)
NEXT_PUBLIC_OPENAI_ENABLED=true
NEXT_PUBLIC_ANTHROPIC_ENABLED=true
NEXT_PUBLIC_AZURE_ENABLED=false
NEXT_PUBLIC_GEMINI_ENABLED=true
NEXT_PUBLIC_OLLAMA_ENABLED=true
NEXT_PUBLIC_GROQ_ENABLED=true

# Analytics (optional)
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

3. **Start Development**

```bash
# Start both via Turborepo
pnpm dev

# Or run individually
# Terminal A (agents)
pnpm --filter @workspace/agents dev
# Terminal B (web)
pnpm --filter web dev
```

4. **Visit the RPG**

- Open http://localhost:3000
- Start your Baldur's Gate 3 adventure!

## 🎲 How to Play

1. **Character Creation**: Enter your character's name
2. **Begin Adventure**: Start with the nautiloid ship crash
3. **Make Choices**: Respond to AI-generated scenarios
4. **Stat Checks**: Roll for success on challenges
5. **Combat**: Engage in turn-based combat
6. **Companions**: Interact with AI-driven companions
7. **Story Progression**: Unlock new locations and plot points

## 📁 Project Structure

### Core Packages

#### `@workspace/engine`

- `GameEngineService`: Main game orchestration
- `LLMService`: AI provider abstraction (OpenAI/local)
- `CampaignService`: Campaign data management
- `types.ts`: Core game state and response types

#### `@workspace/prompts`

- `dnd-5e.ts`: D&D 5e-flavored prompts
- `prompt-templates.ts`: Reusable prompt templates
- Campaign-specific prompt generation

### Campaigns

- Campaigns are TypeScript modules under `apps/agents/src/game-engine/campaigns/` (e.g., `bg3.ts`).
- Each campaign exports metadata (companions, locations, plot) and an intro string.

## 🔧 Development

### Adding New Campaigns

1. Create a new file under `apps/agents/src/game-engine/campaigns/` and export a `Campaign`.
2. Register it in `apps/agents/src/game-engine/campaigns/index.ts`.
3. Provide `intro`, `companions`, `locations`, and `plot`.
4. Optionally add campaign-specific prompts later.

### Local LLM Development

For offline/NSFW/faster iteration you can use LM Studio or Ollama.

```
# Example LM Studio/Ollama env (root .env)
LOCAL_LLM_URL=http://localhost:11434/v1
LOCAL_LLM_MODEL=llama3.1
```

When `LOCAL_LLM_URL` is set, agents use the local provider; otherwise they use hosted providers.

## 📊 Roadmap

### Phase 1 ✅ (Current)

- [x] Turborepo monorepo setup
- [x] Core engine with OpenAI integration
- [x] D&D 5e ruleset
- [x] Baldur's Gate 3 campaign
- [x] Basic web interface
- [x] Stat checks and combat system

### Phase 2 🚧

- [x] Vector DB integration for memory
- [x] Advanced combat mechanics
- [ ] Companion AI interactions
- [ ] Story branching and consequences
- [x] Export to web novel format

### Phase 3 📋

- [ ] Game of Thrones campaign
- [ ] Cyberpunk campaign
- [ ] Advanced AI features

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by Baldur's Gate 3 and classic text adventures
- Built with modern AI/LLM technology
- Powered by the open-source community
