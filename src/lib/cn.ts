import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind classes with proper precedence handling.
 *
 * Needed because Astro's only class primitive, `class:list`, is plain `clsx` —
 * it does not resolve Tailwind conflicts, so a `class` prop would otherwise lose
 * to the component's own base classes in `class` order.
 *
 * @example
 * cn('px-2 py-1', isActive && 'bg-primary', className)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
