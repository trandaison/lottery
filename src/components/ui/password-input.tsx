'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface PasswordInputProps extends Omit<React.ComponentProps<'input'>, 'type'> {
  /** Optional id for the underlying input (for label association) */
  id?: string;
}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, id, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);

    return (
      <div
        className={cn(
          'border-input flex h-9 w-full min-w-0 items-center rounded-md border bg-transparent shadow-xs transition-[color,box-shadow]',
          'focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]',
          'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
          'has-[:disabled]:pointer-events-none has-[:disabled]:opacity-50',
          className
        )}
      >
        <input
          ref={ref}
          id={id}
          type={visible ? 'text' : 'password'}
          data-slot="input"
          autoComplete={props.autoComplete ?? 'off'}
          className={cn(
            'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30',
            'flex flex-1 bg-transparent px-3 py-1 text-base outline-none md:text-sm',
            'min-w-0 border-0 focus-visible:outline-none focus-visible:ring-0'
          )}
          {...props}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? (
            <EyeOff className="size-4" aria-hidden />
          ) : (
            <Eye className="size-4" aria-hidden />
          )}
        </Button>
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';

export { PasswordInput };
