import { END, START, StateGraph } from '@langchain/langgraph';
import { generateArtifact } from './nodes/generate-artifact/index.js';
import { generateFollowup } from './nodes/generateFollowup.js';
import { rewriteArtifact } from './nodes/rewrite-artifact/index.js';
import { runEngineNode } from './nodes/run-engine.js';
import { GameEngineGraphAnnotation } from './state.js';

function routeAfterPersist(
  state: typeof GameEngineGraphAnnotation.State
): 'generateArtifact' | 'rewriteArtifact' {
  const hasArtifact = Boolean(state.artifact?.contents?.length);
  return hasArtifact ? 'rewriteArtifact' : 'generateArtifact';
}

const builder = new StateGraph(GameEngineGraphAnnotation)
  .addNode('runEngine', runEngineNode)
  .addEdge(START, 'runEngine')
  .addNode('generateArtifact', generateArtifact)
  .addNode('rewriteArtifact', rewriteArtifact)
  .addNode('generateFollowup', generateFollowup)
  .addConditionalEdges('runEngine', routeAfterPersist, [
    'generateArtifact',
    'rewriteArtifact',
  ])
  .addEdge('generateArtifact', 'generateFollowup')
  .addEdge('rewriteArtifact', 'generateFollowup')
  .addEdge('generateFollowup', END);

export const graph = builder.compile();

graph.name = 'Game Engine Graph';
