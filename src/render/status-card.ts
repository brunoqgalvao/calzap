import { DashboardView, MealType } from '../types';

export interface StatusCardMeal {
  timeLabel: string;
  mealType: MealType;
  description: string;
  calories: number;
}

export interface StatusCardSeriesPoint {
  label: string;
  value: number;
  highlight?: boolean;
}

export interface StatusCardWeightSummary {
  currentKg: number | null;
  deltaKg: number | null;
}

export interface StatusCardData {
  view: DashboardView;
  title: string;
  subtitle: string;
  totalCalories: number;
  goalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  averageCalories: number;
  remainingCalories: number;
  mealCounts: Record<MealType, number>;
  meals: StatusCardMeal[];
  seriesTitle: string;
  series: StatusCardSeriesPoint[];
  weight: StatusCardWeightSummary | null;
}

interface Surface {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
}

type Color = [number, number, number, number];

const FONT: Record<string, string[]> = {
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01110'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '10000', '11110', '00001', '00001', '11110'],
  '6': ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
  ':': ['00000', '00100', '00100', '00000', '00100', '00100', '00000'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '00110', '00110'],
  '/': ['00001', '00010', '00100', '01000', '10000', '00000', '00000'],
  '%': ['11001', '11010', '00100', '01000', '10110', '00110', '00000'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '?': ['01110', '10001', '00001', '00010', '00100', '00000', '00100'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
};

const COLORS = {
  bgTop: hex('#07131F'),
  bgBottom: hex('#12324A'),
  bgGrid: hex('#17344A'),
  panel: hex('#0D2232'),
  panelAlt: hex('#153650'),
  panelSoft: hex('#123047'),
  shadow: hex('#041018'),
  border: hex('#2A5877'),
  borderBright: hex('#3E7FA5'),
  text: hex('#F4F7FB'),
  muted: hex('#A4B6C8'),
  accent: hex('#69E0C8'),
  accent2: hex('#F9C74F'),
  protein: hex('#FF7F6A'),
  carbs: hex('#6FB1FF'),
  fat: hex('#F2C94C'),
  breakfast: hex('#F4A261'),
  lunch: hex('#69E0C8'),
  dinner: hex('#7CC6FE'),
  snack: hex('#F9C74F'),
  progressBg: hex('#21445D'),
  chartBar: hex('#56C3FF'),
  chartBarAlt: hex('#69E0C8'),
} as const;

export async function renderStatusCardPng(data: StatusCardData): Promise<Uint8Array> {
  const surface = createSurface(1080, 1180);
  fillVerticalGradient(surface, 0, 0, surface.width, surface.height, COLORS.bgTop, COLORS.bgBottom);
  drawBackdrop(surface);

  const progressPercent = Math.round(progressRatio(data.totalCalories, data.goalCalories) * 100);
  const totalMeals = sumMealCounts(data.mealCounts);

  drawPanel(surface, 48, 48, 952, 208, COLORS.panel);
  drawText(surface, 88, 86, data.title, 4, COLORS.accent);
  drawText(surface, 88, 134, data.subtitle, 3, COLORS.muted);
  drawText(surface, 88, 188, `KCAL ${data.totalCalories}/${data.goalCalories}`, 6, COLORS.text);
  drawText(surface, 88, 226, `${progressPercent}% OF GOAL`, 2, COLORS.muted);
  drawProgress(surface, 88, 246, 590, 20, data.totalCalories, data.goalCalories, COLORS.accent, COLORS.progressBg);
  drawStatCard(surface, 716, 104, 228, 62, 'PROGRESS', `${progressPercent}%`, null, COLORS.accent);
  drawWeightStatCard(surface, 716, 176, 228, 62, data.weight);

  const mealCountEntries: Array<[MealType, number]> = [
    ['breakfast', data.mealCounts.breakfast],
    ['lunch', data.mealCounts.lunch],
    ['dinner', data.mealCounts.dinner],
    ['snack', data.mealCounts.snack],
  ];

  let chipX = 88;
  for (const [mealType, count] of mealCountEntries) {
    drawMealCountChip(surface, chipX, 286, 194, 56, mealType, count);
    chipX += 214;
  }

  drawPanel(surface, 48, 374, 952, 244, COLORS.panelAlt);
  drawText(surface, 88, 410, 'MACROS', 4, COLORS.accent2);
  drawText(surface, 722, 414, `${totalMeals} MEALS LOGGED`, 2, COLORS.muted);
  drawMacroRow(surface, 88, 452, 'PROTEIN', data.totalProtein, macroPercent(data.totalProtein * 4, data.totalCalories), COLORS.protein);
  drawMacroRow(surface, 88, 520, 'CARBS', data.totalCarbs, macroPercent(data.totalCarbs * 4, data.totalCalories), COLORS.carbs);
  drawMacroRow(surface, 88, 588, 'FAT', data.totalFat, macroPercent(data.totalFat * 9, data.totalCalories), COLORS.fat);

  drawPanel(surface, 48, 650, 952, 458, COLORS.panel);
  drawText(surface, 88, 686, data.view === 'day' ? 'LATEST MEALS' : data.seriesTitle, 4, COLORS.accent);
  drawText(surface, 704, 690, data.view === 'day' ? 'TODAY FEED' : 'CALORIE TREND', 2, COLORS.muted);

  if (data.view === 'day') {
    drawMealsSection(surface, data.meals);
  } else {
    drawSeriesChart(surface, 96, 736, 856, 266, data.series);
  }

  drawFooterPill(surface, 88, 1036, 224, 40, 'MEALS', `${totalMeals}`);
  drawFooterPill(surface, 340, 1036, 260, 40, 'AVG DAY', `${Math.round(data.averageCalories)} KCAL`);
  drawFooterPill(surface, 628, 1036, 332, 40, data.remainingCalories >= 0 ? 'TARGET LEFT' : 'OVER GOAL', formatSignedKcal(data.remainingCalories));

  return encodePng(surface);
}

function drawMealsSection(surface: Surface, meals: StatusCardMeal[]): void {
  const visibleMeals = meals.slice(0, 4);

  visibleMeals.forEach((meal, index) => {
    drawMealCard(surface, 88, 730 + index * 82, 872, 66, meal);
  });

  if (visibleMeals.length === 0) {
    drawText(surface, 108, 786, 'NO MEALS LOGGED YET', 4, COLORS.muted);
    drawText(surface, 108, 832, 'SEND A PHOTO OR TEXT TO START', 2, COLORS.borderBright);
  }
}

function drawSeriesChart(
  surface: Surface,
  x: number,
  y: number,
  width: number,
  height: number,
  series: StatusCardSeriesPoint[],
): void {
  fillRect(surface, x, y, width, height, COLORS.panelSoft);
  fillRect(surface, x, y + height - 22, width, 2, COLORS.border);

  const visibleSeries = series.slice(0, 30);
  const maxValue = Math.max(2000, ...visibleSeries.map((point) => point.value));
  const gap = visibleSeries.length > 14 ? 6 : 10;
  const barWidth = Math.max(10, Math.floor((width - gap * (visibleSeries.length - 1)) / Math.max(1, visibleSeries.length)));

  visibleSeries.forEach((point, index) => {
    const barX = x + index * (barWidth + gap);
    const barHeight = Math.max(6, Math.round((Math.max(0, point.value) / maxValue) * (height - 54)));
    const barY = y + height - 24 - barHeight;
    const color = point.highlight ? COLORS.chartBarAlt : COLORS.chartBar;
    fillRect(surface, barX, barY, barWidth, barHeight, color);

    const showLabel = visibleSeries.length <= 10 || index % 5 === 0 || index === visibleSeries.length - 1;
    if (showLabel) {
      const label = point.label.slice(0, 2);
      drawText(surface, barX, y + height - 16, label, 1, COLORS.muted);
    }
  });

  drawText(surface, x + width - 108, y + 8, `${maxValue} KCAL`, 2, COLORS.muted);
}

function drawMacroRow(
  surface: Surface,
  x: number,
  y: number,
  label: string,
  grams: number,
  ratio: number,
  color: Color,
): void {
  fillRect(surface, x, y + 10, 12, 28, color);
  drawText(surface, x + 28, y, label, 4, COLORS.text);
  drawText(surface, x + 302, y, `${formatNumber(grams)}G`, 4, COLORS.text);
  drawText(surface, x + 620, y + 6, `${Math.round(ratio * 100)}% KCAL`, 2, COLORS.muted);
  drawProgress(surface, x + 28, y + 44, 756, 18, Math.round(ratio * 100), 100, color, COLORS.progressBg);
}

function drawProgress(
  surface: Surface,
  x: number,
  y: number,
  width: number,
  height: number,
  current: number,
  total: number,
  color: Color,
  bgColor: Color,
): void {
  fillRect(surface, x, y, width, height, bgColor);
  fillRect(surface, x, y, Math.max(6, Math.round(width * progressRatio(current, total))), height, color);
}

function drawBackdrop(surface: Surface): void {
  for (let y = 0; y < surface.height; y += 40) {
    fillRect(surface, 0, y, surface.width, 2, COLORS.bgGrid);
  }

  for (let x = 0; x < surface.width; x += 72) {
    fillRect(surface, x, 0, 2, surface.height, COLORS.bgGrid);
  }

  fillRect(surface, 760, 36, 208, 18, COLORS.panelSoft);
  fillRect(surface, 840, 560, 136, 12, COLORS.panelSoft);
  fillRect(surface, 92, 920, 180, 12, COLORS.panelSoft);
}

function drawPanel(surface: Surface, x: number, y: number, width: number, height: number, fill: Color): void {
  fillRect(surface, x + 14, y + 14, width, height, COLORS.shadow);
  fillRect(surface, x, y, width, height, COLORS.border);
  fillRect(surface, x + 4, y + 4, width - 8, height - 8, fill);
  fillRect(surface, x + 4, y + 4, width - 8, 6, COLORS.borderBright);
}

function drawStatCard(
  surface: Surface,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  value: string,
  subvalue: string | null,
  accent: Color,
): void {
  fillRect(surface, x, y, width, height, COLORS.panelSoft);
  fillRect(surface, x, y, width, 6, accent);
  drawText(surface, x + 16, y + 10, label, 2, COLORS.muted);
  drawText(surface, x + 16, y + 24, value, 4, COLORS.text);

  if (subvalue) {
    drawText(surface, x + width - 16 - measureTextWidth(subvalue, 2), y + 10, subvalue, 2, COLORS.muted);
  }
}

function drawWeightStatCard(surface: Surface, x: number, y: number, width: number, height: number, weight: StatusCardWeightSummary | null): void {
  if (!weight || weight.currentKg === null) {
    drawStatCard(surface, x, y, width, height, 'WEIGHT', 'NO DATA', null, COLORS.accent2);
    return;
  }

  const deltaLabel =
    weight.deltaKg === null
      ? null
      : `${weight.deltaKg > 0 ? '+' : ''}${formatNumber(weight.deltaKg)} KG`;

  drawStatCard(surface, x, y, width, height, 'WEIGHT', `${formatNumber(weight.currentKg)} KG`, deltaLabel, COLORS.accent2);
}

function drawMealCountChip(
  surface: Surface,
  x: number,
  y: number,
  width: number,
  height: number,
  mealType: MealType,
  count: number,
): void {
  const accent = mealTypeColor(mealType);
  fillRect(surface, x + 8, y + 8, width, height, COLORS.shadow);
  fillRect(surface, x, y, width, height, COLORS.panelSoft);
  fillRect(surface, x, y, width, 6, accent);
  drawText(surface, x + 16, y + 14, mealTypeShort(mealType), 2, COLORS.text);
  drawTextRight(surface, x + width - 18, y + 10, `${count}`, 4, accent);
}

function drawMealCard(
  surface: Surface,
  x: number,
  y: number,
  width: number,
  height: number,
  meal: StatusCardMeal,
): void {
  const accent = mealTypeColor(meal.mealType);
  fillRect(surface, x, y, width, height, COLORS.panelSoft);
  fillRect(surface, x, y, 8, height, accent);
  fillRect(surface, x + width - 150, y, 150, height, COLORS.panelAlt);

  drawText(surface, x + 22, y + 8, meal.timeLabel, 2, COLORS.muted);
  drawText(surface, x + 118, y + 8, mealTypeShort(meal.mealType), 2, accent);
  drawTextRight(surface, x + width - 18, y + 8, `${meal.calories} KCAL`, 2, COLORS.text);
  drawText(surface, x + 22, y + 26, truncateLabel(meal.description, 42), 3, COLORS.text);
}

function drawFooterPill(
  surface: Surface,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  value: string,
): void {
  fillRect(surface, x, y, width, height, COLORS.panelSoft);
  drawText(surface, x + 14, y + 10, label, 2, COLORS.muted);
  drawTextRight(surface, x + width - 14, y + 8, value, 3, COLORS.text);
}

function fillVerticalGradient(surface: Surface, x: number, y: number, width: number, height: number, top: Color, bottom: Color): void {
  for (let row = 0; row < height; row += 1) {
    const t = row / Math.max(1, height - 1);
    fillRect(surface, x, y + row, width, 1, mix(top, bottom, t));
  }
}

function createSurface(width: number, height: number): Surface {
  return {
    width,
    height,
    pixels: new Uint8ClampedArray(width * height * 4),
  };
}

function fillRect(surface: Surface, x: number, y: number, width: number, height: number, color: Color): void {
  const startX = clamp(Math.round(x), 0, surface.width);
  const startY = clamp(Math.round(y), 0, surface.height);
  const endX = clamp(Math.round(x + width), 0, surface.width);
  const endY = clamp(Math.round(y + height), 0, surface.height);

  for (let py = startY; py < endY; py += 1) {
    for (let px = startX; px < endX; px += 1) {
      const index = (py * surface.width + px) * 4;
      surface.pixels[index] = color[0];
      surface.pixels[index + 1] = color[1];
      surface.pixels[index + 2] = color[2];
      surface.pixels[index + 3] = color[3];
    }
  }
}

function drawText(surface: Surface, x: number, y: number, text: string, scale: number, color: Color): void {
  const normalized = normalizeLabel(text);
  let cursor = x;

  for (const char of normalized) {
    const glyph = FONT[char] ?? FONT['?'];
    drawGlyph(surface, cursor, y, glyph, scale, color);
    cursor += (glyph[0].length + 1) * scale;
  }
}

function drawTextRight(surface: Surface, rightX: number, y: number, text: string, scale: number, color: Color): void {
  drawText(surface, rightX - measureTextWidth(text, scale), y, text, scale, color);
}

function drawGlyph(surface: Surface, x: number, y: number, glyph: string[], scale: number, color: Color): void {
  for (let row = 0; row < glyph.length; row += 1) {
    for (let col = 0; col < glyph[row].length; col += 1) {
      if (glyph[row][col] === '1') {
        fillRect(surface, x + col * scale, y + row * scale, scale, scale, color);
      }
    }
  }
}

async function encodePng(surface: Surface): Promise<Uint8Array> {
  const scanlines = new Uint8Array(surface.height * (surface.width * 4 + 1));
  let offset = 0;

  for (let y = 0; y < surface.height; y += 1) {
    scanlines[offset] = 0;
    offset += 1;
    const rowStart = y * surface.width * 4;
    scanlines.set(surface.pixels.subarray(rowStart, rowStart + surface.width * 4), offset);
    offset += surface.width * 4;
  }

  const compressed = await compress(scanlines);
  const signature = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = makeChunk(
    'IHDR',
    concat(
      uint32(surface.width),
      uint32(surface.height),
      Uint8Array.from([8, 6, 0, 0, 0]),
    ),
  );

  return concat(signature, ihdr, makeChunk('IDAT', compressed), makeChunk('IEND', new Uint8Array(0)));
}

async function compress(data: Uint8Array): Promise<Uint8Array> {
  const stream = new CompressionStream('deflate');
  const writer = stream.writable.getWriter();
  await writer.write(data);
  await writer.close();
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

function makeChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const crc = crc32(concat(typeBytes, data));
  return concat(uint32(data.length), typeBytes, data, uint32(crc));
}

function uint32(value: number): Uint8Array {
  return Uint8Array.from([
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ]);
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function concat(...arrays: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(arrays.reduce((sum, array) => sum + array.length, 0));
  let offset = 0;
  for (const array of arrays) {
    result.set(array, offset);
    offset += array.length;
  }
  return result;
}

function hex(value: string): Color {
  const clean = value.replace('#', '');
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
    255,
  ];
}

function mix(a: Color, b: Color, t: number): Color {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
    255,
  ];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function progressRatio(current: number, total: number): number {
  return Math.max(0, Math.min(1, total > 0 ? current / total : 0));
}

function macroPercent(macroCalories: number, totalCalories: number): number {
  if (totalCalories <= 0) return 0;
  return Math.max(0, Math.min(1, macroCalories / totalCalories));
}

function normalizeLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 :./%+\-()?]/g, ' ');
}

function truncateLabel(value: string, maxLength: number): string {
  const normalized = normalizeLabel(value).replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
}

function measureTextWidth(text: string, scale: number): number {
  const normalized = normalizeLabel(text);
  let width = 0;
  for (const char of normalized) {
    const glyph = FONT[char] ?? FONT['?'];
    width += (glyph[0].length + 1) * scale;
  }
  return Math.max(0, width - scale);
}

function sumMealCounts(mealCounts: Record<MealType, number>): number {
  return mealCounts.breakfast + mealCounts.lunch + mealCounts.dinner + mealCounts.snack;
}

function mealTypeShort(mealType: MealType): string {
  switch (mealType) {
    case 'breakfast':
      return 'BREAKFAST';
    case 'lunch':
      return 'LUNCH';
    case 'dinner':
      return 'DINNER';
    case 'snack':
    default:
      return 'SNACK';
  }
}

function mealTypeColor(mealType: MealType): Color {
  switch (mealType) {
    case 'breakfast':
      return COLORS.breakfast;
    case 'lunch':
      return COLORS.lunch;
    case 'dinner':
      return COLORS.dinner;
    case 'snack':
    default:
      return COLORS.snack;
  }
}

function formatSignedKcal(value: number): string {
  return value >= 0 ? `${value} KCAL` : `+${Math.abs(value)} KCAL`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}
