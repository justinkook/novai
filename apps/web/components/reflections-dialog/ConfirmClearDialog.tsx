import { Button } from '@workspace/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTrigger,
} from '@workspace/ui/components/dialog';
import { TighterText } from '@workspace/ui/components/header';
import { useState } from 'react';

export interface ReflectionsProps {
  handleDeleteReflections: () => Promise<boolean>;
}

export function ConfirmClearDialog(props: ReflectionsProps) {
  const { handleDeleteReflections } = props;
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button onClick={() => setOpen(true)} variant="destructive">
          <TighterText>Clear reflections</TighterText>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl p-8 bg-white rounded-lg shadow-xl">
        <DialogHeader>
          <DialogDescription className="mt-2 text-md text-center font-light text-red-500">
            <TighterText>
              Are you sure you want to clear all reflections? This action can
              not be undone.
            </TighterText>
          </DialogDescription>
        </DialogHeader>
        <Button
          onClick={async () => {
            setOpen(false);
            await handleDeleteReflections();
          }}
          variant="destructive"
        >
          <TighterText>Clear reflections</TighterText>
        </Button>
        <div className="mt-6 flex justify-end">
          <Button onClick={() => setOpen(false)} variant="outline">
            <TighterText>Cancel</TighterText>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
