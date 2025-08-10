import { cn } from '@workspace/ui/lib/utils';
import type React from 'react';

export function TighterText({
  className,
  as: Component = 'span',
  children,
}: {
  className?: string;
  as?: keyof JSX.IntrinsicElements;
  children: React.ReactNode;
}) {
  return (
    <Component className={cn('tracking-tighter', className)}>
      {children}
    </Component>
  );
}
