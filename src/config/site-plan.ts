/**
 * Site plan explorer data: the 82 numbered plots of the brochure's layout
 * page (HMDA 2103/HMDA/SWDL/2026), redrawn for SitePlanExplorer.
 *
 * Sizes are the sq.yd figures printed in the plot circles on the brochure
 * plan. Plots printed without a figure are the standard 30' × 45' plots, which
 * is 150 sq.yd.
 *
 * Geometry follows the brochure drawing itself: every coordinate below is read
 * off `site-plan-reference-public.webp` scaled to 2000 px wide, so the outline
 * (curved west edge, the 2 m buffer cutting the blocks diagonally, the
 * neighbours' land notch and the highway on the east) matches the brochure.
 * The plot columns lean the way the brochure's roads do. Proportions follow
 * the drawing; the drawing itself is not a survey.
 *
 * Availability is deliberately absent: 12 plots are held under HMDA Mortgage
 * and the list of which ones is not published, so the explorer sends the
 * buyer to the team for the current status of any plot.
 */

export type PlotRoad = 'r40' | 'r33a' | 'r33b' | 'r33c' | 'r33d' | 'r18';

export interface SitePlot {
  no: number;
  sqyd: number;
  /** Outline in brochure coordinates */
  points: string;
  /** Label anchor */
  cx: number;
  cy: number;
  /** Rendered height, used to decide whether the size fits under the number */
  h: number;
  roads: PlotRoad[];
}

export const roadNames: Record<PlotRoad, string> = {
  r40: "Existing 40' road",
  r33a: "33' internal road",
  r33b: "33' internal road",
  r33c: "33' internal road",
  r33d: "33' internal road",
  r18: 'Existing 18 m road',
};

type Pt = [number, number];

/** The drawing's frame in brochure coordinates: x, y, width, height. */
export const planBox = { x: 380, y: 152, w: 1260, h: 780 } as const;

const STANDARD = 150;
/** Top of the plot rows, just under the 40' road. */
const TOP = 272;
/** The brochure's internal roads lean west as they run south. */
const LEAN = -0.06;
const lean = (x: number, y: number) => x + LEAN * (y - TOP);

/** Interpolate a polyline (sorted by the axis read) at one coordinate. */
function along(line: Pt[], value: number, axis: 0 | 1): number {
  const other = axis === 0 ? 1 : 0;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]!;
    const b = line[i]!;
    const lo = Math.min(a[axis], b[axis]);
    const hi = Math.max(a[axis], b[axis]);
    if (value >= lo && value <= hi) {
      const t = hi === lo ? 0 : (value - a[axis]) / (b[axis] - a[axis]);
      return a[other] + t * (b[other] - a[other]);
    }
  }
  const last = value < line[0]![axis] ? line[0]! : line[line.length - 1]!;
  return last[other];
}

/** Inner edge of the 2 m buffer along the south-west boundary, west to east. */
export const bufferInner: Pt[] = [
  [418, 240],
  [424, 330],
  [438, 430],
  [460, 500],
  [490, 540],
  [520, 580],
  [575, 650],
  [665, 725],
  [760, 780],
  [822, 830],
  [930, 897],
];

/** The site boundary along the buffer's outer edge. */
const bufferOuter: Pt[] = [
  [400, 235],
  [404, 330],
  [418, 432],
  [442, 510],
  [470, 550],
  [500, 590],
  [558, 665],
  [652, 745],
  [752, 800],
  [815, 850],
  [922, 920],
];

/** East edge of the site where it meets the neighbours' land, north to south. */
export const eastEdge: Pt[] = [
  [1095, 272],
  [1095, 420],
  [1080, 510],
  [1065, 600],
  [1050, 650],
  [1020, 740],
  [1000, 785],
  [940, 912],
];

/** West edge of the highway (existing 18 m road, proposed 90 m RRR). */
const highwayX = (y: number) => 1325 + 0.39 * (y - 180);

/** South edge of the plots on the 40' road (plots 5 to 1). */
const rowBottom = (x: number) => 420 - (22 * (x - 1095)) / 320;

const bufferY = (x: number) => along(bufferInner, x, 0);

const fmt = (pts: Pt[]) =>
  pts.map(([x, y]) => `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`).join(' ');

function centroid(pts: Pt[]): Pt {
  const n = pts.length;
  return [pts.reduce((s, p) => s + p[0], 0) / n, pts.reduce((s, p) => s + p[1], 0) / n];
}

type Entry = [no: number, sqyd: number | null, weight: number];

interface Column {
  /** West and east edge where the column meets the 40' road */
  x0: number;
  x1: number;
  /** Flat south end, or 'buffer' when the last plot is cut by the buffer */
  bottom: number | 'buffer';
  /** East edge follows the site boundary instead of a straight lean */
  eastBoundary?: boolean;
  road: PlotRoad;
  plots: Entry[];
}

/** One column of plots, north to south, the top plot a corner on the 40' road. */
function column({ x0, x1, bottom, eastBoundary, road, plots }: Column): SitePlot[] {
  // The span is measured down the middle of the column; the last plot's south
  // edge then follows the buffer at each corner.
  const midBottom = bottom === 'buffer' ? bufferY(lean((x0 + x1) / 2, 760)) - 4 : bottom;
  const total = plots.reduce((sum, [, , w]) => sum + w, 0);
  const unit = (midBottom - TOP) / total;
  const east = (y: number) => (eastBoundary ? along(eastEdge, y, 1) : lean(x1, y));

  let top = TOP;
  return plots.map(([no, sqyd, weight], index) => {
    const last = index === plots.length - 1;
    const yb = top + weight * unit;
    let pts: Pt[];
    if (last && bottom === 'buffer') {
      // Cut the corners on the buffer line.
      const wl = lean(x0, yb);
      const el = lean(x1, yb);
      pts = [
        [lean(x0, top), top],
        [east(top), top],
        [el, bufferY(el)],
        [wl, bufferY(wl)],
      ];
    } else {
      pts = [
        [lean(x0, top), top],
        [east(top), top],
      ];
      // Keep the boundary's corners inside a plot that spans them.
      if (eastBoundary) {
        for (const p of eastEdge) if (p[1] > top && p[1] < yb) pts.push([p[0], p[1]]);
      }
      pts.push([east(yb), yb], [lean(x0, yb), yb]);
    }
    const [cx, cy] = centroid(pts);
    const plot: SitePlot = {
      no,
      sqyd: sqyd ?? STANDARD,
      points: fmt(pts),
      cx,
      cy,
      h: yb - top,
      roads: index === 0 ? ['r40', road] : [road],
    };
    top = yb;
    return plot;
  });
}

const run = (from: number, to: number, weight = 38): Entry[] => {
  const step = from > to ? -1 : 1;
  const list: Entry[] = [];
  for (let no = from; step > 0 ? no <= to : no >= to; no += step) list.push([no, null, weight]);
  return list;
};

/** The plots on the 40' road, west to east, plot 1 against the highway. */
function frontRow(): SitePlot[] {
  const edges = [1095, 1150, 1205, 1260, 1315];
  const row: Array<[number, number]> = [
    [5, 515],
    [4, 495],
    [3, 474],
    [2, 452],
    [1, 946],
  ];
  return row.map(([no, sqyd], i) => {
    const xl = edges[i]!;
    const pts: Pt[] =
      no === 1
        ? [
            [xl, TOP],
            [highwayX(TOP), TOP],
            [highwayX(rowBottom(highwayX(398))), rowBottom(highwayX(398))],
            [xl, rowBottom(xl)],
          ]
        : [
            [xl, TOP],
            [edges[i + 1]!, TOP],
            [edges[i + 1]!, rowBottom(edges[i + 1]!)],
            [xl, rowBottom(xl)],
          ];
    const [cx, cy] = centroid(pts);
    return {
      no,
      sqyd,
      points: fmt(pts),
      cx,
      cy,
      h: rowBottom(xl) - TOP,
      roads: no === 1 ? ['r40', 'r18'] : ['r40'],
    };
  });
}

export const sitePlots: SitePlot[] = [
  // Block A, between the first and second 33' roads; social infra below it
  ...column({
    x0: 550,
    x1: 606,
    bottom: 548,
    road: 'r33a',
    plots: [[77, 293, 56], ...run(78, 81), [82, 300, 74]],
  }),
  ...column({
    x0: 606,
    x1: 655,
    bottom: 548,
    road: 'r33b',
    plots: [[76, 299, 56], ...run(75, 71), [70, 150, 36]],
  }),
  // Block B, cut by the buffer
  ...column({
    x0: 700,
    x1: 752,
    bottom: 'buffer',
    road: 'r33b',
    plots: [[58, 178, 44], ...run(59, 68), [69, 289, 76]],
  }),
  ...column({
    x0: 752,
    x1: 805,
    bottom: 'buffer',
    road: 'r33c',
    plots: [[57, 183, 44], ...run(56, 46), [45, 267, 70]],
  }),
  // Block C, the second park below it
  ...column({
    x0: 855,
    x1: 918,
    bottom: 800,
    road: 'r33c',
    plots: [[31, 197, 48], ...run(32, 43), [44, 150, 38]],
  }),
  ...column({
    x0: 918,
    x1: 980,
    bottom: 800,
    road: 'r33d',
    plots: [[30, 201, 48], ...run(29, 18), [17, 150, 38]],
  }),
  // Block D, one plot deep between the fourth road and the neighbours' land
  ...column({
    x0: 1030,
    x1: 1095,
    bottom: 700,
    eastBoundary: true,
    road: 'r33d',
    plots: [
      [6, 230, 52],
      [7, 167, 38],
      [8, 167, 38],
      [9, 166, 38],
      [10, 162, 38],
      [11, 157, 38],
      [12, 151, 38],
      [13, 175, 38],
      [14, 161, 38],
      [15, 156, 38],
      [16, 152, 38],
    ],
  }),
  ...frontRow(),
];

/** Everything on the drawing that is not a plot, as outlines in brochure coordinates. */
const road = (x0: number, x1: number, bottom: number | 'buffer'): string => {
  const y = (x: number) => (bottom === 'buffer' ? bufferY(lean(x, 760)) : bottom);
  return fmt([
    [lean(x0, TOP), TOP],
    [lean(x1, TOP), TOP],
    [lean(x1, y(x1)), y(x1)],
    [lean(x0, y(x0)), y(x0)],
  ]);
};

const site: Pt[] = [
  ...bufferOuter,
  ...[...eastEdge].reverse().filter(([, y]) => y <= 912),
  [highwayX(398), 398],
  [highwayX(235), 235],
];

const park1: Pt[] = [
  [438, 276],
  [lean(508, 276), 276],
  [lean(508, 520), 520],
  [490, 538],
  [458, 498],
  [442, 430],
];

const park2: Pt[] = [
  [lean(855, 806), 806],
  [lean(980, 806), 806],
  [935, 882],
  [870, bufferY(870)],
  [lean(855, 806), bufferY(lean(855, 806))],
];

/** Even-odd test, for scattering trees inside a park outline. */
function inside([x, y]: Pt, poly: Pt[]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** A small deterministic jitter, so the trees look planted rather than gridded. */
const jitter = (n: number) => (Math.sin(n * 12.9898) * 43758.5453) % 1;

export interface Tree {
  x: number;
  y: number;
  /** Canopy radius */
  r: number;
}

function grove(poly: Pt[], step: number, seed: number): Tree[] {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  const trees: Tree[] = [];
  let n = seed;
  for (let y = Math.min(...ys) + step / 2; y < Math.max(...ys); y += step) {
    for (let x = Math.min(...xs) + step / 2; x < Math.max(...xs); x += step) {
      n += 1;
      const pt: Pt = [x + jitter(n) * step * 0.3, y + jitter(n + 7) * step * 0.3];
      // Keep the canopy clear of the edge.
      const r = 6 + Math.abs(jitter(n + 3)) * 3;
      const clear = [
        [pt[0] - r, pt[1]],
        [pt[0] + r, pt[1]],
        [pt[0], pt[1] - r],
        [pt[0], pt[1] + r],
      ].every((q) => inside(q as Pt, poly));
      if (clear) trees.push({ x: pt[0], y: pt[1], r });
    }
  }
  return trees;
}

/** A planted line along the 2 m buffer, between its two edges. */
function bufferRow(): Tree[] {
  const trees: Tree[] = [];
  for (let x = 470; x <= 905; x += 26) {
    const y = (bufferY(x) + along(bufferOuter, x, 0)) / 2 + 4;
    trees.push({ x: x - 4, y, r: 5 });
  }
  return trees;
}

/** Decorative trees: the two parks and the buffer planting. */
export const trees: Tree[] = [...grove(park1, 22, 1), ...grove(park2, 22, 40), ...bufferRow()];

/** Centre line of an internal road, north to south, for the dashed road markings. */
const centre = (x0: number, x1: number, bottom: number | 'buffer'): string => {
  const mid = (x0 + x1) / 2;
  const end = bottom === 'buffer' ? bufferY(lean(mid, 760)) - 10 : bottom - 6;
  return `M${lean(mid, TOP)} ${TOP} L${lean(mid, end)} ${end}`;
};

export const planShapes = {
  site: fmt(site),
  buffer: fmt([...bufferOuter, ...[...bufferInner].reverse()]),
  highway: fmt([
    [highwayX(planBox.y), planBox.y],
    [highwayX(planBox.y) + 145, planBox.y],
    [highwayX(planBox.y + planBox.h) + 145, planBox.y + planBox.h],
    [highwayX(planBox.y + planBox.h), planBox.y + planBox.h],
  ]),
  highwayLabel: { x: highwayX(540) + 72, y: 540, angle: 68.7 },
  road40: fmt([
    [396, 235],
    [highwayX(235), 235],
    [highwayX(TOP), TOP],
    [419, TOP],
  ]),
  /** Dashed centre lines: the 40' road, the highway, then the four 33' roads */
  centreLines: [
    `M410 253.5 L${highwayX(253.5) - 8} 253.5`,
    `M${highwayX(planBox.y) + 72} ${planBox.y} L${highwayX(planBox.y + planBox.h) + 72} ${planBox.y + planBox.h}`,
    centre(510, 550, 'buffer'),
    centre(655, 700, 'buffer'),
    centre(805, 855, 'buffer'),
    centre(980, 1030, 800),
  ],
  /** The four 33' roads, west to east, with their label anchors */
  roads: [
    { points: road(510, 550, 'buffer'), label: [lean(530, 400), 400] as Pt },
    { points: road(655, 700, 'buffer'), label: [lean(678, 480), 480] as Pt },
    { points: road(805, 855, 'buffer'), label: [lean(830, 520), 520] as Pt },
    { points: road(980, 1030, 800), label: [lean(1005, 520), 520] as Pt },
  ],
  park1: {
    points: fmt(park1),
    label: [lean(474, 400), 400] as Pt,
  },
  park2: {
    points: fmt(park2),
    label: [890, 832] as Pt,
  },
  social: {
    points: fmt([
      [lean(550, 552), 552],
      [lean(655, 552), 552],
      [lean(655, 645), 645],
      [575, 650],
      [lean(550, 552), bufferY(lean(550, 552))],
    ]),
    label: [588, 585] as Pt,
  },
  sump: {
    points: fmt([
      [585, 652],
      [lean(655, 652), 652],
      [lean(655, 676), 676],
      [606, 676],
    ]),
    label: [612, 667] as Pt,
  },
  gbtf: {
    points: fmt([
      [lean(1030, 703), 703],
      [along(eastEdge, 703, 1), 703],
      [along(eastEdge, 740, 1), 740],
      [lean(1030, 740), 740],
    ]),
    label: [1017, 721.5] as Pt,
  },
  st: {
    points: fmt([
      [lean(1030, 743), 743],
      [along(eastEdge, 743, 1), 743],
      [along(eastEdge, 790, 1), 790],
      [lean(1030, 790), 790],
    ]),
    label: [1012, 766] as Pt,
  },
  neighbours: [1246, 452] as Pt,
} as const;

export type SizeBand = { id: string; label: string; test: (sqyd: number) => boolean };

export const sizeBands: SizeBand[] = [
  { id: 'std', label: '150 sq.yd', test: (s) => s === 150 },
  { id: 'mid', label: '151–200', test: (s) => s > 150 && s <= 200 },
  { id: 'large', label: '201–300', test: (s) => s > 200 && s <= 300 },
  { id: 'xl', label: 'Above 300', test: (s) => s > 300 },
];

export const bandOf = (sqyd: number): string => sizeBands.find((b) => b.test(sqyd))?.id ?? 'std';
