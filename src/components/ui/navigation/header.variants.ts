import { cva, type VariantProps } from 'class-variance-authority';

export const headerVariants = cva('z-50', {
  variants: {
    position: {
      fixed: 'fixed top-0 left-0 right-0',
      sticky: 'sticky top-0',
      static: 'relative',
    },
    variant: {
      default: 'bg-background/80 backdrop-blur-lg border-b border-border/50',
      solid: 'bg-background border-b border-border',
      transparent: 'bg-transparent',
    },
    shape: {
      bar: 'w-full',
      // A floating header is the one element on the page allowed a backdrop
      // filter — it is fixed, so the blur is composited once per frame rather
      // than repainted. The radius is the squircle shell step, and the surface
      // transition runs on the quintic so the header feels like it changes
      // state rather than fades.
      floating:
        'rounded-shell shadow-lg backdrop-blur-xl transition-[background-color,border-color,box-shadow] duration-base ease-quint',
    },
  },
  compoundVariants: [
    // Floating + fixed: centered with gap
    {
      shape: 'floating',
      position: 'fixed',
      class: '!left-1/2 !right-auto -translate-x-1/2 w-[calc(100%-2rem)] max-w-4xl mt-4',
    },
    // Floating + sticky: centered with gap
    { shape: 'floating', position: 'sticky', class: '!top-4 mx-auto max-w-4xl' },
    // Floating + static: centered
    { shape: 'floating', position: 'static', class: 'mx-auto max-w-4xl' },
    // Floating + transparent: glass effect
    {
      shape: 'floating',
      variant: 'transparent',
      class: 'bg-white/[0.06] backdrop-blur-xl border border-white/[0.08]',
    },
    // Floating + default: semi-transparent with blur
    {
      shape: 'floating',
      variant: 'default',
      class: '!bg-background/80 backdrop-blur-xl !border border-border/50 !border-b-border/50',
    },
    // Floating + solid: opaque
    {
      shape: 'floating',
      variant: 'solid',
      class: '!bg-background !border border-border !border-b-border',
    },
  ],
  defaultVariants: {
    position: 'sticky',
    variant: 'default',
    shape: 'bar',
  },
});

/**
 * The gap matters at narrow widths: with `justify-between` and no gap, the
 * logo and the header CTA met at exactly the same x (measured 2026-09 at
 * 360/375/390px, where the logo wordmark was visually overwritten by the
 * button). `gap-3` gives the pair room on a phone, `gap-6` once there is space
 * for proper separation.
 */
export const headerInnerVariants = cva('flex items-center justify-between gap-3 sm:gap-6', {
  variants: {
    size: {
      sm: 'h-12',
      md: 'h-14',
      lg: 'h-16',
    },
    shape: {
      bar: 'mx-auto max-w-6xl px-6',
      floating: 'px-4',
    },
  },
  defaultVariants: {
    size: 'md',
    shape: 'bar',
  },
});

export type HeaderVariants = VariantProps<typeof headerVariants>;
export type HeaderInnerVariants = VariantProps<typeof headerInnerVariants>;
