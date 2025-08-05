# Novai - AI-Powered Text RPG Engine

**Novai** is a source-agnostic AI-driven text RPG system that replicates the full gameplay experience of games like Baldur's Gate 3 using only text, powered by LLMs as the Game Master.

## 🎯 Project Vision

Build a **campaign-agnostic AI-driven text RPG system** that can:
- Replicate full gameplay (characters, stat checks, combat, branching choices) using only text
- Support multiple campaigns (BG3, Game of Thrones, Cyberpunk, etc.)
- Export playthroughs as traditional web novels
- Use LLMs as intelligent Game Masters

## 🛠 Tech Stack

- **Monorepo**: Turborepo
- **Frontend**: Next.js 15 (App Router), Tailwind CSS, shadcn/ui
- **Backend**: NestJS 11 (TypeScript)
- **AI**: OpenAI via `vercel/ai` SDK for hosted MVP, local LM Studio for dev NSFW
- **Vector DB**: Pinecone or Supabase pgvector
- **Storage**: 
  - Dev: local `fs` (fast iteration)
  - Prod: Supabase PostgreSQL
- **Hosting**: Vercel (web), Railway or Fly.io (api)

## 🏗 Architecture

```
.
├── apps/
│   ├── web/              # Next.js frontend for player input/output
│   └── api/              # NestJS backend with game logic, LLM routing
│
├── packages/
│   ├── engine/           # Core text RPG engine
│   ├── rulesets/         # Modular RPG logic (D&D, etc.)
│   ├── prompts/          # Dynamic system prompts per campaign
│   ├── exporters/        # Web novel output compiler
│   └── ui/               # Shared UI components
│
├── campaigns/            # Data for BG3, Thrones, etc.
├── turbo.json            # Turborepo config
└── .env                  # Store user-provided API keys
```

## 🎮 Features

### Core Engine
- **AI Game Master**: LLM-powered narration and decision-making
- **Modular Rulesets**: D&D 5e, Game of Thrones politics, etc.
- **Dynamic Campaigns**: Load campaigns from `/campaigns/{name}/`
- **Stat System**: Full RPG stat checks and combat mechanics
- **Choice System**: Branching narratives with consequences
- **Companion System**: AI-driven companion interactions

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
```bash
# Copy .env.example to .env in both apps/api and apps/web
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# Add your OpenAI API key
echo "NEXT_PUBLIC_OPENAI_API_KEY=your_key_here" >> apps/web/.env
```

3. **Start Development**
```bash
pnpm dev
```

4. **Visit the RPG**
- Open http://localhost:3000/rpg
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
- `dnd-5e.ts`: D&D 5e system prompts
- `prompt-templates.ts`: Reusable prompt templates
- Campaign-specific prompt generation

#### `@workspace/rulesets`
- `dnd-5e.ts`: D&D 5e rules implementation
- `types.ts`: Ruleset interfaces
- Modular ruleset system

### Campaigns

#### `campaigns/baldurs-gate-3/`
- `campaign.json`: Campaign configuration
- `intro.md`: Opening narrative
- `companions.json`: Character data
- `locations.json`: World locations
- `plot.json`: Story progression

## 🔧 Development

### Adding New Campaigns

1. Create campaign directory: `campaigns/{campaign-name}/`
2. Add `campaign.json` with configuration
3. Create `intro.md` for opening narrative
4. Add companion and location data
5. Update prompts for campaign-specific style

### Adding New Rulesets

1. Create ruleset in `packages/rulesets/src/{ruleset}.ts`
2. Implement `Ruleset` interface
3. Add prompt templates in `packages/prompts/src/`
4. Update engine to support new ruleset

### Local LLM Development

For NSFW content or faster iteration:
```bash
# Start LM Studio locally
# Update LLMConfig to use 'local' provider
# Point to http://localhost:1234/v1/chat/completions
```

## 📊 Roadmap

### Phase 1 ✅ (Current)
- [x] Turborepo monorepo setup
- [x] Core engine with OpenAI integration
- [x] D&D 5e ruleset
- [x] Baldur's Gate 3 campaign
- [x] Basic web interface
- [x] Stat checks and combat system

### Phase 2 🚧
- [ ] Vector DB integration for memory
- [ ] Advanced combat mechanics
- [ ] Companion AI interactions
- [ ] Story branching and consequences
- [ ] Export to web novel format

### Phase 3 📋
- [ ] Game of Thrones campaign
- [ ] Cyberpunk campaign
- [ ] Multiplayer support
- [ ] Advanced AI features
- [ ] Mobile app

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
