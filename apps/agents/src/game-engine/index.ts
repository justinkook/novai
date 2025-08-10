import { END, START, StateGraph } from '@langchain/langgraph';
import { composeEngineOutputNode } from './nodes/compose-output.js';
import { persistEngineTurnNode } from './nodes/persist-turn.js';
import { runEngineNode } from './nodes/run-engine.js';
import { GameEngineGraphAnnotation } from './state.js';

const builder = new StateGraph(GameEngineGraphAnnotation)
  .addNode('runEngine', runEngineNode)
  .addEdge(START, 'runEngine')
  .addNode('persistEngineTurn', persistEngineTurnNode)
  .addNode('composeEngineOutput', composeEngineOutputNode)
  .addEdge('runEngine', 'persistEngineTurn')
  .addEdge('persistEngineTurn', 'composeEngineOutput')
  .addEdge('composeEngineOutput', END);

export const graph = builder.compile();

graph.name = 'Game Engine Graph';
