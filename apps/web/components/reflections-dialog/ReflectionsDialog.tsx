import type { Assistant } from '@langchain/langgraph-sdk';
import { Badge } from '@workspace/ui/components/badge';
import { Button } from '@workspace/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@workspace/ui/components/dialog';
import { TighterText } from '@workspace/ui/components/header';
import { useToast } from '@workspace/ui/hooks/use-toast';
import { BrainCog, Loader } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useStore } from '@/hooks/useStore';
import { getIcon } from '../assistant-select/utils';
import { TooltipIconButton } from '../ui/assistant-ui/tooltip-icon-button';
import { ConfirmClearDialog } from './ConfirmClearDialog';

export interface NoReflectionsProps {
  selectedAssistant: Assistant | undefined;
  getReflections: (assistantId: string) => Promise<void>;
}

function NoReflections(props: NoReflectionsProps) {
  const { selectedAssistant } = props;
  const { toast } = useToast();

  const getReflections = async () => {
    if (!selectedAssistant) {
      toast({
        title: 'Error',
        description: 'Assistant ID not found.',
        variant: 'destructive',
        duration: 5000,
      });
      return;
    }
    await props.getReflections(selectedAssistant.assistant_id);
  };

  return (
    <div className="flex flex-col items-center mt-6 mb-[-24px] gap-3">
      <TighterText>No reflections have been generated yet.</TighterText>
      <TighterText className="text-sm text-gray-500">
        Reflections generate after 30s of inactivity. If none appear, try again
        later.
      </TighterText>
      <Button onClick={getReflections} variant="secondary" size="sm">
        <TighterText>Search for reflections</TighterText>
      </Button>
    </div>
  );
}

interface ReflectionsDialogProps {
  selectedAssistant: Assistant | undefined;
}

export function ReflectionsDialog(props: ReflectionsDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [lastFetchedFor, setLastFetchedFor] = useState<string | null>(null);
  const { selectedAssistant } = props;
  const {
    isLoadingReflections,
    reflections,
    getReflections,
    deleteReflections,
  } = useStore();

  useEffect(() => {
    if (!open || !selectedAssistant || typeof window === 'undefined') {
      return;
    }
    // Don't re-fetch reflections if they already exist & are for the same assistant
    const alreadyHasReflectionsForAssistant =
      (reflections?.content || reflections?.styleRules) &&
      reflections.assistantId === selectedAssistant.assistant_id;
    if (alreadyHasReflectionsForAssistant) {
      return;
    }
    if (isLoadingReflections) {
      return;
    }
    if (lastFetchedFor === selectedAssistant.assistant_id) {
      return;
    }

    setLastFetchedFor(selectedAssistant.assistant_id);
    getReflections(selectedAssistant.assistant_id);
  }, [
    open,
    selectedAssistant,
    getReflections,
    reflections?.content,
    reflections?.styleRules,
    reflections?.assistantId,
    isLoadingReflections,
    lastFetchedFor,
  ]);

  const handleDelete = async () => {
    if (!selectedAssistant) {
      toast({
        title: 'Error',
        description: 'Assistant ID not found.',
        variant: 'destructive',
        duration: 5000,
      });
      return false;
    }
    setOpen(false);
    return await deleteReflections(selectedAssistant.assistant_id);
  };

  const iconData = (
    selectedAssistant?.metadata as
      | { iconData?: { iconColor?: string; iconName?: string } }
      | undefined
  )?.iconData;

  return (
    <Dialog
      open={open}
      onOpenChange={(change) => {
        setOpen(change);
        if (change) {
          setLastFetchedFor(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <TooltipIconButton
          tooltip="Reflections"
          variant="ghost"
          className="w-fit h-fit p-2"
          onClick={() => setOpen(true)}
        >
          <BrainCog className="w-6 h-6 text-gray-600" />
        </TooltipIconButton>
      </DialogTrigger>
      <DialogContent className="max-w-xl p-8 bg-white rounded-lg shadow-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <TighterText className="text-3xl font-light text-gray-800">
              Reflections
            </TighterText>
            {selectedAssistant && (
              <Badge
                style={{
                  ...(iconData
                    ? {
                        color: iconData.iconColor,
                        backgroundColor: `${iconData.iconColor}20`, // 33 in hex is ~20% opacity
                      }
                    : {
                        color: '#000000',
                        backgroundColor: '#00000020',
                      }),
                }}
                className="flex items-center justify-center gap-2 px-2 py-1"
              >
                <span className="flex items-center justify-start w-4 h-4">
                  {getIcon((iconData?.iconName as string) || 'User')}
                </span>
                {selectedAssistant?.name}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="mt-2 text-md font-light text-gray-600">
            <TighterText>
              {isLoadingReflections ? (
                'Loading reflections...'
              ) : reflections?.content || reflections?.styleRules ? (
                'Current reflections generated by the assistant for content generation.'
              ) : (
                <NoReflections
                  selectedAssistant={selectedAssistant}
                  getReflections={getReflections}
                />
              )}
            </TighterText>
          </DialogDescription>
        </DialogHeader>
        <div className="mt-6 max-h-[60vh] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
          {isLoadingReflections ? (
            <div className="flex justify-center items-center h-32">
              <Loader className="h-8 w-8 animate-spin" />
            </div>
          ) : reflections?.content || reflections?.styleRules ? (
            <>
              {reflections?.styleRules && (
                <div className="mb-6">
                  <TighterText className="text-xl font-light text-gray-800 sticky top-0 bg-white py-2 mb-3">
                    Style Reflections:
                  </TighterText>
                  <ul className="list-disc list-inside space-y-2">
                    {reflections.styleRules?.map((rule) => (
                      <li key={rule} className="flex items-baseline">
                        <span className="mr-2">•</span>
                        <TighterText className="text-gray-600 font-light">
                          {rule}
                        </TighterText>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {reflections?.content && (
                <div className="mb-6">
                  <TighterText className="text-xl font-light text-gray-800 sticky top-0 bg-white py-2 mb-3">
                    Content Reflections:
                  </TighterText>
                  <ul className="list-disc list-inside space-y-2">
                    {reflections.content.map((rule) => (
                      <li key={rule} className="flex items-baseline">
                        <span className="mr-2">•</span>
                        <TighterText className="text-gray-600 font-light">
                          {rule}
                        </TighterText>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : null}
        </div>
        <div className="mt-6 flex justify-between">
          {reflections?.content || reflections?.styleRules ? (
            <ConfirmClearDialog handleDeleteReflections={handleDelete} />
          ) : null}
          <Button
            onClick={() => setOpen(false)}
            className="bg-black hover:bg-gray-800 text-white px-4 py-2 rounded shadow transition"
          >
            <TighterText>Close</TighterText>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
