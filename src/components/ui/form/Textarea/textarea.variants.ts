import { cva, type VariantProps } from 'class-variance-authority';

/** Pressed well, matching `inputVariants` — see the note there. */
export const textareaVariants = cva(
  [
    'w-full min-h-[6rem] resize-y rounded-md bg-background',
    'transition-[background-color,box-shadow] duration-base ease-quint',
    'placeholder:text-muted-foreground',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'text-foreground',
    '[box-shadow:inset_0_1px_2px_rgb(16_62_51/0.1),inset_0_0_0_1px_rgb(16_62_51/0.1)]',
    'hover:[box-shadow:inset_0_1px_2px_rgb(16_62_51/0.12),inset_0_0_0_1px_rgb(16_62_51/0.18)]',
    'focus-visible:[box-shadow:inset_0_2px_4px_rgb(16_62_51/0.14),inset_0_0_0_1px_rgb(16_62_51/0.34)]',
  ],
  {
    variants: {
      size: {
        sm: 'px-3 py-2 text-sm',
        md: 'px-4 py-3 text-sm',
        lg: 'px-4 py-3 text-base',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

export type TextareaVariants = VariantProps<typeof textareaVariants>;
