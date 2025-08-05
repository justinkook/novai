'use client';

import {
  GameEngineService,
  type GameState,
  type LLMConfig,
} from '@workspace/engine';
import { Badge } from '@workspace/ui/components/badge';
import { Button } from '@workspace/ui/components/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { ScrollArea } from '@workspace/ui/components/scroll-area';
import { Textarea } from '@workspace/ui/components/textarea';
import { useEffect, useRef, useState } from 'react';

export default function RPGPage() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerInput, setPlayerInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [narration, setNarration] = useState<string[]>([]);
  const [choices, setChoices] = useState<string[]>([]);
  const [playerName, setPlayerName] = useState('');
  const [showSetup, setShowSetup] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const gameEngine = useRef<GameEngineService | null>(null);

  useEffect(() => {
    // Initialize game engine with OpenAI config
    const config: LLMConfig = {
      provider: 'openai',
      apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
      model: 'gpt-4',
    };
    gameEngine.current = new GameEngineService(config);
  }, []);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, []);

  const startNewGame = async () => {
    if (!gameEngine.current || !playerName.trim()) {
      return;
    }

    setIsLoading(true);
    try {
      const newGameState = await gameEngine.current.createNewGame(
        'baldurs-gate-3',
        playerName
      );
      setGameState(newGameState);
      if (
        newGameState.narrative &&
        newGameState.narrative.length > 0 &&
        newGameState.narrative[0]
      ) {
        setNarration([newGameState.narrative[0].content]);
      } else {
        setNarration(['Welcome to your adventure!']);
      }
      setShowSetup(false);
    } catch (error) {
      console.error('Failed to start game:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const submitInput = async () => {
    if (!gameEngine.current || !gameState || !playerInput.trim()) {
      return;
    }

    setIsLoading(true);
    const currentInput = playerInput;
    setPlayerInput('');

    try {
      const response = await gameEngine.current.processGameRequest({
        gameState,
        playerInput: currentInput,
        context: {},
      });

      setGameState(response.updatedGameState);
      setNarration((prev) => [
        ...prev,
        `You: ${currentInput}`,
        response.narration,
      ]);

      if (response.choices && response.choices.length > 0) {
        setChoices(response.choices);
      } else {
        setChoices([]);
      }

      if (response.statCheck) {
        const { stat, difficulty, result, success } = response.statCheck;
        setNarration((prev) => [
          ...prev,
          `[${stat.toUpperCase()} CHECK: ${result} vs DC ${difficulty} - ${success ? 'SUCCESS' : 'FAILURE'}]`,
        ]);
      }
    } catch (error) {
      console.error('Failed to process input:', error);
      setNarration((prev) => [
        ...prev,
        'Error: Failed to process your input. Please try again.',
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChoice = (choice: string) => {
    setPlayerInput(choice);
    setChoices([]);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitInput();
    }
  };

  if (showSetup) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>Start Your Adventure</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="playerName">Character Name</Label>
              <Input
                id="playerName"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your character's name..."
                className="mt-1"
              />
            </div>
            <Button
              onClick={startNewGame}
              disabled={!playerName.trim() || isLoading}
              className="w-full"
            >
              {isLoading ? 'Starting Adventure...' : 'Begin Your Journey'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl h-screen flex flex-col">
      <div className="flex-1 flex gap-6">
        {/* Main Game Area */}
        <div className="flex-1 flex flex-col">
          <Card className="flex-1 flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Baldur's Gate 3 - {playerName}</span>
                {gameState && (
                  <div className="flex gap-2">
                    <Badge variant="outline">
                      Location: {gameState.currentLocation}
                    </Badge>
                    <Badge variant="outline">
                      Companions: {gameState.companions.length}
                    </Badge>
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <ScrollArea
                className="flex-1 border rounded-md p-4 mb-4"
                ref={scrollAreaRef}
              >
                <div className="space-y-4">
                  {narration.map((text, index) => (
                    <div key={index} className="text-sm">
                      {text.startsWith('You: ') ? (
                        <div className="bg-blue-50 p-2 rounded">
                          <strong>You:</strong> {text.substring(5)}
                        </div>
                      ) : text.startsWith('[') && text.endsWith(']') ? (
                        <div className="bg-yellow-50 p-2 rounded font-mono text-xs">
                          {text}
                        </div>
                      ) : (
                        <div className="bg-gray-50 p-2 rounded">{text}</div>
                      )}
                    </div>
                  ))}
                  {isLoading && (
                    <div className="bg-gray-50 p-2 rounded">
                      <em>Thinking...</em>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Choices */}
              {choices.length > 0 && (
                <div className="mb-4">
                  <Label className="text-sm font-medium">Choices:</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {choices.map((choice, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        onClick={() => handleChoice(choice)}
                      >
                        {choice}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input Area */}
              <div className="flex gap-2">
                <Textarea
                  value={playerInput}
                  onChange={(e) => setPlayerInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="What would you like to do?"
                  className="flex-1"
                  rows={2}
                  disabled={isLoading}
                />
                <Button
                  onClick={submitInput}
                  disabled={!playerInput.trim() || isLoading}
                  className="self-end"
                >
                  {isLoading ? '...' : 'Send'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="w-80 space-y-4">
          {/* Character Stats */}
          {gameState && (
            <Card>
              <CardHeader>
                <CardTitle>Character Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {Object.entries(gameState.stats).map(([stat, value]) => (
                    <div key={stat} className="flex justify-between">
                      <span className="capitalize">{stat}:</span>
                      <span className="font-mono">{value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Inventory */}
          {gameState && gameState.inventory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Inventory</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {gameState.inventory.map((item, index) => (
                    <div key={index} className="text-sm">
                      {item}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Companions */}
          {gameState && gameState.companions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Companions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {gameState.companions.map((companion, index) => (
                    <div key={index} className="text-sm">
                      {companion}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
