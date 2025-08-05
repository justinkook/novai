# NovAI Web Application

The NovAI web application is a Next.js-based frontend that provides an interactive interface for AI-powered tabletop RPG experiences.

## Features

- **Interactive Game Interface**: Real-time chat-based gameplay
- **Character Management**: Create and manage player characters
- **Campaign Selection**: Choose from available campaigns
- **Game State Persistence**: Save and load game progress
- **Responsive Design**: Works on desktop and mobile devices
- **Real-time Updates**: Live game state synchronization

## Tech Stack

- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: Beautiful, accessible UI components
- **NextAuth.js**: Authentication system
- **PostHog**: Analytics and feature flags
- **Sentry**: Error monitoring and performance tracking

## Development

### Prerequisites

- Node.js 18+ 
- pnpm (recommended) or npm
- NovAI API server running

### Setup

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Environment variables**:
   Create a `.env.local` file with:
   ```bash
   NEXTAUTH_SECRET=your_secret_here
   NEXTAUTH_URL=http://localhost:3000
   NEXT_PUBLIC_API_URL=http://localhost:3001
   ```

3. **Start development server**:
   ```bash
   pnpm dev
   ```

4. **Open your browser**:
   Navigate to `http://localhost:3000`

### Code Quality

This project uses **Biome** for linting and formatting. Biome is a fast, unified tool that replaces Prettier and ESLint.

```bash
# Format code
pnpm format

# Check for linting issues
pnpm lint

# Fix issues automatically
pnpm lint:fix
```

### Available Scripts

```bash
# Development
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm start        # Start production server

# Code Quality
pnpm lint         # Run Biome linter
pnpm format       # Format code with Biome
pnpm type-check   # Run TypeScript type checking

# Testing
pnpm test         # Run tests
pnpm test:watch   # Run tests in watch mode
pnpm test:coverage # Run tests with coverage
```

## Project Structure

```
apps/web/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Authentication pages
│   ├── (home)/            # Main application pages
│   ├── api/               # API routes
│   └── layout.tsx         # Root layout
├── components/             # Reusable UI components
├── hooks/                 # Custom React hooks
├── lib/                   # Utility functions
├── services/              # API service layer
├── types/                 # TypeScript type definitions
└── public/                # Static assets
```

## Key Components

### Game Interface

The main game interface is located in `app/(home)/game/page.tsx` and provides:

- Real-time chat interface for player interactions
- Character sheet display
- Inventory management
- Game state visualization

### Authentication

Authentication is handled by NextAuth.js with:

- Email/password authentication
- Session management
- Protected routes
- User profile management

### API Integration

The web app communicates with the NovAI API through services in `services/`:

- Game state management
- Campaign loading
- User authentication
- Real-time updates

## Styling

The application uses Tailwind CSS with shadcn/ui components:

- **Design System**: Consistent component library
- **Dark Mode**: Built-in theme support
- **Responsive**: Mobile-first design
- **Accessible**: WCAG compliant components

## Performance

- **Code Splitting**: Automatic route-based splitting
- **Image Optimization**: Next.js Image component
- **Bundle Analysis**: Built-in bundle analyzer
- **Caching**: Strategic caching strategies

## Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Other Platforms

The application can be deployed to any platform that supports Next.js:

- Netlify
- Railway
- DigitalOcean App Platform
- AWS Amplify

## Environment Variables

```bash
# Authentication
NEXTAUTH_SECRET=your_secret_here
NEXTAUTH_URL=http://localhost:3000

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001

# Analytics (Optional)
NEXT_PUBLIC_POSTHOG_KEY=your_posthog_key
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# Error Monitoring (Optional)
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn
```

## Contributing

1. Follow the project's code style using Biome
2. Write tests for new features
3. Update documentation as needed
4. Ensure accessibility standards are met

## Troubleshooting

### Common Issues

**Port conflicts**: If port 3000 is in use, Next.js will automatically use the next available port.

**API connection errors**: Ensure the NovAI API server is running on port 3001.

**Authentication issues**: Check that `NEXTAUTH_SECRET` and `NEXTAUTH_URL` are properly configured.

### Getting Help

- Check the [main documentation](../../docs/)
- Review the [API documentation](../../docs/api-reference/)
- Join the [Discord community](https://discord.gg/novai)

## License

MIT License - see LICENSE file for details. 