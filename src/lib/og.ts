import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import satori from 'satori';
import { html } from 'satori-html';
import sharp from 'sharp';
import siteConfig from '~/config/site.config';

export interface OGImageOptions {
  title: string;
  description?: string;
  type?: 'website' | 'article';
}

/*
 * Satori only reads static woff instances (no variable fonts, no woff2), so
 * the OG renderer gets its own static copies in public/fonts/.
 */
const displayFiles = [
  { weight: 400, file: 'public/fonts/fraunces-latin-400-normal.woff' },
  { weight: 600, file: 'public/fonts/fraunces-latin-600-normal.woff' },
] as const;

const textFiles = [
  { weight: 400, file: 'public/fonts/manrope-latin-400-normal.woff' },
  { weight: 500, file: 'public/fonts/manrope-latin-500-normal.woff' },
  { weight: 600, file: 'public/fonts/manrope-latin-600-normal.woff' },
] as const;

const fontCache = new Map<string, Buffer>();

function loadFont(file: string): Buffer {
  const cached = fontCache.get(file);
  if (cached) return cached;
  const data = readFileSync(resolve(process.cwd(), file));
  fontCache.set(file, data);
  return data;
}

export async function generateOGImage(options: OGImageOptions): Promise<Buffer> {
  const { title, description, type = 'website' } = options;

  // Site palette (paper/sand/forest) so the card reads as the brand, not a
  // grey rectangle. Accent is gold, not brand green — on the forest field
  // #123d31 the green rule is invisible. The pill wash is paper at 12%, same
  // inversion `--shell-surface-invert` uses in the stylesheet.
  const paper = '#fdfbf6';
  const sand = '#f3f0e7';
  const forest = '#113e33';
  const accent = '#f2cb67';
  const brandSoft = 'rgba(253, 251, 246, 0.12)';
  const pillBorder = 'rgba(253, 251, 246, 0.24)';

  const truncatedDescription = description
    ? description.length > 120
      ? description.slice(0, 117) + '...'
      : description
    : '';

  // Satori requires an explicit `display` on every node and inline HTML (not
  // string interpolation) for dynamic parts.
  const markup = html`
    <div
      style="height: 100%; width: 100%; display: flex; flex-direction: column; background-color: ${forest}; background-image: linear-gradient(160deg, ${forest} 0%, #0d3129 55%, ${forest} 100%); padding: 60px 80px; font-family: 'Manrope'; position: relative;"
    >
      <!-- Satori renders a CSS subset (no radial-gradient, no filter), so the
        site's grain overlay cannot be reproduced; depth comes from the gold
        accent rule. -->
      <div
        style="display: flex; position: absolute; top: 0; left: 0; width: 8px; height: 100%; background-color: ${accent};"
      ></div>
      <div
        style="display: flex; flex-direction: column; justify-content: space-between; height: 100%; padding-left: 24px;"
      >
        <div style="display: flex; align-items: center;">
          <div
            style="display: flex; align-items: center; gap: 10px; padding: 7px 16px; background-color: ${brandSoft}; border: 1px solid ${pillBorder}; border-radius: 9999px; color: ${paper}; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.16em;"
          >
            ${type === 'article' ? 'Article' : 'Page'}
          </div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 26px;">
          <div
            style="display: flex; font-family: 'Fraunces'; font-size: ${title.length > 50 ? '60px' : '76px'}; font-weight: 600; color: ${paper}; line-height: 1.06; letter-spacing: -0.03em; max-width: 980px;"
          >
            ${title}
          </div>
          <div
            style="display: ${truncatedDescription ? 'flex' : 'none'}; font-size: 25px; color: ${sand}; line-height: 1.5; max-width: 820px; opacity: 0.82;"
          >
            ${truncatedDescription}
          </div>
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div
              style="display: flex; width: 4px; height: 34px; background-color: ${accent}; border-radius: 9999px;"
            ></div>
            <span style="font-size: 24px; font-weight: 600; color: ${paper};"
              >${siteConfig.name}</span
            >
          </div>
          <span style="font-size: 17px; color: ${sand}; opacity: 0.6;"
            >${new URL(siteConfig.url).hostname}</span
          >
        </div>
      </div>
    </div>
  `;

  // Generate SVG with satori
  const svg = await satori(markup, {
    width: 1200,
    height: 630,
    fonts: [
      ...displayFiles.map((font) => ({
        name: 'Fraunces',
        data: loadFont(font.file),
        weight: font.weight,
        style: 'normal' as const,
      })),
      ...textFiles.map((font) => ({
        name: 'Manrope',
        data: loadFont(font.file),
        weight: font.weight,
        style: 'normal' as const,
      })),
    ],
  });

  // Convert SVG to PNG
  return Buffer.from(await sharp(Buffer.from(svg)).resize(1200).png().toBuffer());
}
