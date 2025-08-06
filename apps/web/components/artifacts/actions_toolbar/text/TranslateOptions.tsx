import type { GraphInput, LanguageOptions } from '@workspace/shared/types';
import { TooltipIconButton } from '@/components/assistant-ui/tooltip-icon-button';
import {
  ChinaFlag,
  FrenchFlag,
  IndiaFlag,
  SpanishFlag,
  UsaFlag,
} from '@/components/icons/flags';

export interface TranslateOptionsProps {
  streamMessage: (params: GraphInput) => Promise<void>;
  handleClose: () => void;
}

export function TranslateOptions(props: TranslateOptionsProps) {
  const { streamMessage } = props;

  const handleSubmit = async (language: LanguageOptions) => {
    props.handleClose();
    await streamMessage({
      language,
    });
  };

  return (
    <div className="flex flex-col gap-3 items-center w-full">
      <TooltipIconButton
        tooltip="English"
        variant="ghost"
        className="transition-colors w-[36px] h-[36px]"
        onClick={async () => await handleSubmit('english')}
      >
        <UsaFlag />
      </TooltipIconButton>
      <TooltipIconButton
        tooltip="Mandarin"
        variant="ghost"
        className="transition-colors w-[36px] h-[36px]"
        onClick={async () => await handleSubmit('mandarin')}
      >
        <ChinaFlag />
      </TooltipIconButton>
      <TooltipIconButton
        tooltip="Hindi"
        variant="ghost"
        className="transition-colors w-[36px] h-[36px]"
        onClick={async () => await handleSubmit('hindi')}
      >
        <IndiaFlag />
      </TooltipIconButton>
      <TooltipIconButton
        tooltip="Spanish"
        variant="ghost"
        className="transition-colors w-[36px] h-[36px]"
        onClick={async () => await handleSubmit('spanish')}
      >
        <SpanishFlag />
      </TooltipIconButton>
      <TooltipIconButton
        tooltip="French"
        variant="ghost"
        className="transition-colors w-[36px] h-[36px]"
        onClick={async () => await handleSubmit('french')}
      >
        <FrenchFlag />
      </TooltipIconButton>
    </div>
  );
}
