import { cva, type VariantProps } from 'class-variance-authority';

/** Pressed well, matching `inputVariants` — see the note there. */
export const selectVariants = cva(
  [
    'w-full appearance-none cursor-pointer rounded-md bg-background',
    'transition-[background-color,box-shadow] duration-base ease-quint',
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
        sm: 'h-9 px-3 text-sm',
        md: 'h-11 px-4 text-sm',
        lg: 'h-12 px-4 text-base',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

export type SelectVariants = VariantProps<typeof selectVariants>;
