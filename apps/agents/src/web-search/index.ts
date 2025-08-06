import { END, START, StateGraph } from '@langchain/langgraph';
import { classifyMessage } from './nodes/classify-message.js';
import { queryGenerator } from './nodes/query-generator.js';
import { search } from './nodes/search.js';
import { WebSearchGraphAnnotation, type WebSearchState } from './state.js';

function searchOrEndConditional(
  state: WebSearchState
): 'queryGenerator' | typeof END {
  if (state.shouldSearch) {
    return 'queryGenerator';
  }
  return END;
}

const builder = new StateGraph(WebSearchGraphAnnotation)
  .addNode('classifyMessage', classifyMessage)
  .addNode('queryGenerator', queryGenerator)
  .addNode('search', search)
  .addEdge(START, 'classifyMessage')
  .addConditionalEdges('classifyMessage', searchOrEndConditional, [
    'queryGenerator',
    END,
  ])
  .addEdge('queryGenerator', 'search')
  .addEdge('search', END);

export const graph = builder.compile();

graph.name = 'Web Search Graph';
