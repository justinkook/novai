import { cpp } from '@codemirror/lang-cpp';
import { html } from '@codemirror/lang-html';
import { java } from '@codemirror/lang-java';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { php } from '@codemirror/lang-php';
import { python } from '@codemirror/lang-python';
import { rust } from '@codemirror/lang-rust';
import { sql } from '@codemirror/lang-sql';
import { xml } from '@codemirror/lang-xml';
import { clojure } from '@nextjournal/lang-clojure';
import { csharp } from '@replit/codemirror-lang-csharp';
import CodeMirror, { type EditorView } from '@uiw/react-codemirror';
import type { ArtifactCodeV3 } from '@workspace/shared/types';
import { getArtifactContent } from '@workspace/shared/utils/artifacts';
import { cn } from '@workspace/ui/lib/utils';
import React, { type MutableRefObject, useEffect } from 'react';
import { useGraphContext } from '@/contexts/GraphContext';
import { cleanContent } from '@/lib/normalize_string';
import styles from './CodeRenderer.module.css';
import { CopyText } from './components/CopyText';

export interface CodeRendererProps {
  editorRef: MutableRefObject<EditorView | null>;
  isHovering: boolean;
}

const getLanguageExtension = (language: string) => {
  switch (language) {
    case 'javascript':
      return javascript({ jsx: true, typescript: false });
    case 'typescript':
      return javascript({ jsx: true, typescript: true });
    case 'cpp':
      return cpp();
    case 'java':
      return java();
    case 'php':
      return php();
    case 'python':
      return python();
    case 'html':
      return html();
    case 'sql':
      return sql();
    case 'json':
      return json();
    case 'rust':
      return rust();
    case 'xml':
      return xml();
    case 'clojure':
      return clojure();
    case 'csharp':
      return csharp();
    default:
      return [];
  }
};

export function CodeRendererComponent(props: Readonly<CodeRendererProps>) {
  const { graphData } = useGraphContext();
  const {
    artifact,
    isStreaming,
    updateRenderedArtifactRequired,
    firstTokenReceived,
    setArtifactContent,
    setUpdateRenderedArtifactRequired,
  } = graphData;

  useEffect(() => {
    if (updateRenderedArtifactRequired) {
      setUpdateRenderedArtifactRequired(false);
    }
  }, [updateRenderedArtifactRequired, setUpdateRenderedArtifactRequired]);

  if (!artifact) {
    return null;
  }

  const artifactContent = getArtifactContent(artifact) as ArtifactCodeV3;
  const extensions = [getLanguageExtension(artifactContent.language)];

  if (!artifactContent.code) {
    return null;
  }

  const isEditable = !isStreaming;

  return (
    <div className="relative">
      <style jsx global>{`
        .pulse-code .cm-content {
          animation: codePulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        @keyframes codePulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.3;
          }
        }
      `}</style>
      {props.isHovering && (
        <div className="absolute top-0 right-4 z-10">
          <CopyText currentArtifactContent={artifactContent} />
        </div>
      )}
      <CodeMirror
        editable={isEditable}
        className={cn(
          'w-full min-h-full',
          styles.codeMirrorCustom,
          isStreaming && !firstTokenReceived ? 'pulse-code' : ''
        )}
        value={cleanContent(artifactContent.code)}
        height="800px"
        extensions={extensions}
        onChange={(c) => setArtifactContent(artifactContent.index, c)}
        onCreateEditor={(view) => {
          props.editorRef.current = view;
        }}
      />
    </div>
  );
}

export const CodeRenderer = React.memo(CodeRendererComponent);
