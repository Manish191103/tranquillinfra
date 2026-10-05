import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Form fields are pressed wells, not bordered boxes.
 *
 * A `1px` border around an input is the single most recognisable default in
 * web forms. The alternative is the same inset logic used by `.icon-well`: a
 * dark top edge, a light bottom edge, no border at all. The field then reads as
 * a recess cut into the page rather than a rectangle drawn on top of it, and it
 * matches the double-bezel cards the fields sit inside.
 */
export const inputVariants = cva(
  [
    'w-full rounded-md',
    'transition-[background-color,box-shadow] duration-base ease-quint',
    'focus-visible:outline-none focus-visible:ring-2',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'bg-background text-foreground',
    'placeholder:text-muted-foreground',
    'focus-visible:ring-ring',
    // Inset top + a hairline ring. Replaces `border` with no layout box, so
    // focusing cannot shift anything on the page.
    '[box-shadow:inset_0_1px_2px_rgb(16_62_51/0.1),inset_0_0_0_1px_rgb(16_62_51/0.1)]',
    'hover:[box-shadow:inset_0_1px_2px_rgb(16_62_51/0.12),inset_0_0_0_1px_rgb(16_62_51/0.18)]',
    // Focus tightens the ring and deepens the inset — the field appears to be
    // pressed further in, which is the tactile cue without animating a border
    // colour that other rules may also be setting.
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

export const inputSizeConfig = {
  sm: {
    iconWrapper: 'w-9',
    leadingPadding: 'pl-9',
    trailingPadding: 'pr-9',
    baseLeftPadding: 'pl-3',
    baseRightPadding: 'pr-3',
  },
  md: {
    iconWrapper: 'w-11',
    leadingPadding: 'pl-11',
    trailingPadding: 'pr-11',
    baseLeftPadding: 'pl-4',
    baseRightPadding: 'pr-4',
  },
  lg: {
    iconWrapper: 'w-12',
    leadingPadding: 'pl-12',
    trailingPadding: 'pr-12',
    baseLeftPadding: 'pl-4',
    baseRightPadding: 'pr-4',
  },
} as const;

export type InputVariants = VariantProps<typeof inputVariants>;
