export type Brand = 'google' | 'github'

const PATHS: Record<Brand, string> = {
  google:
    'M21.35 11.1H12v2.9h5.35c-.5 2.4-2.6 3.9-5.35 3.9a6 6 0 1 1 0-12c1.5 0 2.87.55 3.93 1.45l2.17-2.17A9 9 0 1 0 12 21c5.2 0 8.9-3.65 8.9-8.8 0-.37-.03-.74-.08-1.1Z',
  github:
    'M12 2A10 10 0 0 0 8.84 21.5c.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.1.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.58 9.58 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.6 1.03 2.69 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85V21c0 .27.16.59.67.5A10 10 0 0 0 12 2Z',
}

/** Filled brand marks — outside the Lucide set, so they get their own component. */
export function BrandIcon({ brand, size = 15 }: { brand: Brand; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path fill="currentColor" d={PATHS[brand]} />
    </svg>
  )
}
