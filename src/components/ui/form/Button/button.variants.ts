import { cva, type VariantProps } from 'class-variance-authority';

export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2',
    // Pills, not squircles: a fully rounded control is the one shape that reads
    // as a physical key at any size, and it pairs with the site's large radii.
    'font-medium rounded-full',
    // Two curves, deliberately. Surface swaps (colour, border, background) run
    // on the quintic so they feel like a physical state change; the press runs
    // on the spring so it has weight under the finger. `duration-150 ease-out`
    // was doing both jobs badly.
    'transition-[background-color,color,border-color,box-shadow,transform] duration-base ease-quint',
    'active:scale-[0.97] active:duration-instant',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        // Filled variants paint their own surface, so an inherited text halo
        // (ImageHero's copy legibility shadow) must not land on the label —
        // it renders as a drop shadow under the text. `[text-shadow:none]`
        // beats inheritance from any ancestor; ghost/outline/link labels sit
        // directly on the page surface and keep the inherited halo.
        //
        // Filled variants also get an inset top highlight instead of an outer
        // shadow: a physical button catches light on its upper edge, and the
        // hairline replaces the generic 1px border.
        primary:
          'bg-foreground text-background [text-shadow:none] [box-shadow:inset_0_1px_1px_rgb(255_255_255/0.14),inset_0_0_0_1px_rgb(16_62_51/0.1)] hover:bg-foreground/90 hover:[box-shadow:inset_0_1px_1px_rgb(255_255_255/0.18),inset_0_0_0_1px_rgb(16_62_51/0.14),0_12px_28px_-10px_rgb(16_62_51/0.28)]',
        secondary:
          'bg-secondary text-secondary-foreground [text-shadow:none] [box-shadow:inset_0_1px_1px_rgb(255_255_255/0.5),inset_0_0_0_1px_rgb(16_62_51/0.08)] hover:bg-secondary-hover hover:[box-shadow:inset_0_1px_1px_rgb(255_255_255/0.6),inset_0_0_0_1px_rgb(16_62_51/0.14),0_12px_28px_-10px_rgb(16_62_51/0.2)]',
        whatsapp:
          'bg-whatsapp text-white [text-shadow:none] [box-shadow:inset_0_1px_1px_rgb(255_255_255/0.18),inset_0_0_0_1px_rgb(13_122_65/0.5)] hover:bg-whatsapp-hover hover:[box-shadow:inset_0_1px_1px_rgb(255_255_255/0.22),inset_0_0_0_1px_rgb(13_122_65/0.6),0_12px_28px_-10px_rgb(13_122_65/0.4)]',
        outline:
          'bg-transparent text-foreground [box-shadow:inset_0_0_0_1px_rgb(16_62_51/0.14)] hover:bg-secondary hover:[box-shadow:inset_0_0_0_1px_rgb(16_62_51/0.24),0_12px_28px_-12px_rgb(16_62_51/0.24)]',
        ghost:
          'text-foreground-secondary hover:text-foreground hover:bg-secondary [box-shadow:inset_0_0_0_1px_transparent]',
        link: 'text-foreground-secondary hover:text-foreground underline-offset-4 hover:underline',
        destructive:
          'bg-destructive text-destructive-foreground [text-shadow:none] [box-shadow:inset_0_1px_1px_rgb(255_255_255/0.16),inset_0_0_0_1px_rgb(0_0_0/0.08)] hover:bg-destructive/90',

        /*
         * The `.cta` Button-in-Button family, as variants.
         *
         * These exist because `<Button class="cta cta-outline">` used to depend on
         * source order: the Button's own default variant paints `bg-foreground`,
         * and only beat the `.cta-outline` class because the hand-written rules
         * happened to be emitted after Tailwind's utilities in the same layer.
         * With the `.cta` rules in `@layer components` that accident ended and the
         * default's `bg-foreground` won — and inside `.invert-section`,
         * `--color-foreground` is remapped to paper, so the closing CTA on the
         * homepage became a paper plate with paper text on a forest field
         * (measured 2026-09-30).
         *
         * A variant is the honest home for this: it is the same information as
         * `variant="outline"`, in the same vocabulary, and it cannot lose a
         * cascade race with itself. Each mirrors its `.cta-*` class in global.css;
         * `.cta` still supplies the shape, the icon well and the press physics.
         */
        ctaPrimary:
          'text-primary-foreground [text-shadow:none] [background-color:var(--color-primary)] [box-shadow:var(--site-shadow-md),var(--hairline)] hover:[background-color:var(--color-primary-hover,var(--color-primary))]',
        ctaOutline:
          'text-foreground [text-shadow:none] [background-color:color-mix(in_oklch,var(--color-card)_60%,transparent)] [box-shadow:var(--hairline)] hover:[background-color:var(--color-secondary)]',
        ctaGhost:
          'text-foreground-secondary [text-shadow:none] [background-color:transparent] [box-shadow:inset_0_0_0_1px_transparent] hover:text-foreground',
        /*
         * `ctaOutline` on a forest field. It has to be its own variant rather
         * than `ctaOutline` plus an override class: inside `.invert-section`
         * `--color-card` is a darker forest, so the normal outline resolves to
         * a dark wash whose dark `--hairline` edge is invisible — the control
         * has no plate and no bezel. Measured 2026-09-30 on the homepage's
         * closing CTA, the page's primary action.
         */
        ctaOnInvert:
          'text-on-invert [text-shadow:none] [background-color:color-mix(in_srgb,var(--on-invert)_12%,transparent)] [box-shadow:var(--hairline-invert)] hover:[background-color:color-mix(in_srgb,var(--on-invert)_22%,transparent)]',
      },
      size: {
        // Heights stay put; the pills need slightly more inline padding than
        // the old squircles to read as generous rather than tight.
        sm: 'h-9 px-4 text-xs [&_svg]:h-4 [&_svg]:w-4',
        md: 'h-11 px-5 text-sm [&_svg]:h-5 [&_svg]:w-5',
        lg: 'h-13 px-7 text-base [&_svg]:h-5 [&_svg]:w-5',
      },
      fullWidth: {
        true: 'w-full',
      },
      icon: {
        // An icon-only control is a circle, not a rounded square. Its content
        // is optically centred with a fractional nudge because a stroked SVG
        // sits a half-pixel above true centre in most fonts.
        true: 'rounded-full px-0 [&_svg]:translate-y-px',
      },
    },
    compoundVariants: [
      { icon: true, size: 'sm', class: 'h-9 w-9' },
      { icon: true, size: 'md', class: 'h-11 w-11' },
      { icon: true, size: 'lg', class: 'h-13 w-13' },
    ],
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;
