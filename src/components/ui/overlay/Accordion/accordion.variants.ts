import { cva, type VariantProps } from 'class-variance-authority';

export const accordionItemVariants = cva('border-b border-border', {
  variants: {
    variant: {
      // The default variant is a hairline rule, not a border — the machine edge
      // rather than a drawn line, which is what keeps a long FAQ list from
      // reading as a stack of ruled boxes.
      default: '[box-shadow:inset_0_-1px_0_var(--color-border)]',
      // The card variant is the double-bezel at list-item scale.
      card: 'mb-[var(--shell-padding)] rounded-shell bg-[var(--shell-surface)] p-[var(--shell-padding)] shadow-[var(--shell-edge)] last:mb-0',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export const accordionTriggerVariants = cva(
  [
    'flex w-full items-center justify-between py-4 text-left',
    'font-medium text-foreground',
    // Colour on the quintic: an FAQ row opening should feel like the row itself
    // changing state, not like a tint cross-fading in.
    'transition-[color,background-color] duration-base ease-quint hover:text-foreground-secondary',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:rounded-sm',
  ],
  {
    variants: {
      size: {
        sm: 'text-sm py-3',
        md: 'text-sm py-4',
        lg: 'text-base py-5',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

export type AccordionVariants = VariantProps<typeof accordionItemVariants>;
export type AccordionTriggerVariants = VariantProps<typeof accordionTriggerVariants>;
