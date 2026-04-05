export type HandLabel = "Left" | "Right";

export type Point = {
  x: number;
  y: number;
};

export type TrailPoint = Point | null;

export type EquationFamily = {
  category: string;
  skill_family: string;
  difficulty: string;
  template_id: string;
  display_template: string;
  js_template: string;
  type: string;
  params: string;
  param_ranges: string;
  hasTurningPoints: string;
};

type ExplicitEquationConfig = {
  type: "explicit";
  fn: (x: number) => number;
  label: string;
  latex: string;
  hasTurningPoints: boolean;
};

type ParametricEquationConfig = {
  type: "parametric";
  xFn: (t: number) => number;
  yFn: (t: number) => number;
  tMin: number;
  tMax: number;
  label: string;
  latex: string;
  hasTurningPoints: boolean;
  fn: null;
};

export type EquationConfig = ExplicitEquationConfig | ParametricEquationConfig;

export type ScoreResult = {
  total: number;
  shape: number;
  position: number;
  drawnCentroid?: Point;
  truthCentroid?: Point;
  drawnScaled?: Point[];
  truthCentered?: Point[];
};

export const graphConfig = {
  centerX: 320,
  centerY: 240,
  pxPerUnit: 60,
};

const LEADING_COEFF: Record<string, string> = {
  quadratic: "a",
  cubic: "a",
  exponential: "a",
  absolute_value: "a",
  square_root: "a",
};

const MIN_STROKE_POINTS = 5;

type ParamRange = {
  min: number;
  max: number;
  step: number;
};

type EquationFilters = {
  difficulty?: string;
  skillFamily?: string | null;
};

function parseParamRanges(rangeStr: string) {
  const params: Record<string, ParamRange[]> = {};

  for (const part of rangeStr.split("|")) {
    const [name, min, max, step] = part.split(":");

    if (!name || min === undefined || max === undefined || step === undefined) {
      continue;
    }

    if (!params[name]) {
      params[name] = [];
    }

    params[name].push({
      min: Number(min),
      max: Number(max),
      step: Number(step),
    });
  }

  return params;
}

function sampleParam(ranges: ParamRange[], depth = 0): number {
  const range = ranges[Math.floor(Math.random() * ranges.length)];

  if (!range) {
    return 0;
  }

  const steps = Math.round((range.max - range.min) / range.step);
  const index = Math.floor(Math.random() * (steps + 1));
  const value = range.min + index * range.step;

  if (value === 0 && Math.random() > 0.2 && depth < 10) {
    return sampleParam(ranges, depth + 1);
  }

  return Math.round(value * 1000) / 1000;
}

function generateEquation(family: EquationFamily): EquationConfig {
  const paramRanges = parseParamRanges(family.param_ranges);
  const values: Record<string, number> = {};
  const leadingParam = LEADING_COEFF[family.skill_family];

  for (const [name, ranges] of Object.entries(paramRanges)) {
    let value = sampleParam(ranges);

    if (name === leadingParam) {
      while (value === 0) {
        value = sampleParam(ranges);
      }
    }

    values[name] = value;
  }

  let label = family.display_template;

  for (const [key, value] of Object.entries(values)) {
    label = label.replaceAll(`{${key}}`, String(value));
  }

  label = label.replace(/(?<![0-9.])1(x|sin|cos|√|∣|\|)/g, "$1");
  label = label.replace(/(?<![0-9.])-1(x|sin|cos|√|∣|\|)/g, "-$1");
  label = label.replace(/\+ -/g, "- ");

  let latex = label;
  latex = latex.replace(/²/g, "^{2}");
  latex = latex.replace(/³/g, "^{3}");
  latex = latex.replace(/√\(([^)]+)\)/g, "\\sqrt{$1}");
  latex = latex.replace(/√/g, "\\sqrt");
  latex = latex.replace(/\|([^|]+)\|/g, "\\left|$1\\right|");
  latex = latex.replace(/sin/g, "\\sin");
  latex = latex.replace(/cos/g, "\\cos");
  latex = latex.replace(/·/g, "\\cdot ");

  let jsExpr = family.js_template;

  for (const [key, value] of Object.entries(values)) {
    jsExpr = jsExpr.replaceAll(`{${key}}`, String(value));
  }

  if (family.type === "parametric_circle") {
    const radius = values.r ?? 1;

    return {
      type: "parametric",
      xFn: (t) => radius * Math.cos(t),
      yFn: (t) => radius * Math.sin(t),
      tMin: 0,
      tMax: 2 * Math.PI,
      label,
      latex,
      hasTurningPoints: family.hasTurningPoints === "true",
      fn: null,
    };
  }

  const fn = new Function("x", `return ${jsExpr};`) as (x: number) => number;

  return {
    type: "explicit",
    fn,
    label,
    latex,
    hasTurningPoints: family.hasTurningPoints === "true",
  };
}

export function parseEquationCsv(text: string): EquationFamily[] {
  const rows = text.trim().split("\n");
  const headerLine = rows[0];

  if (!headerLine) {
    return [];
  }

  const headers = headerLine.split(",");
  const families: EquationFamily[] = [];

  for (let index = 1; index < rows.length; index += 1) {
    const rowText = rows[index];

    if (!rowText?.trim()) {
      continue;
    }

    const row: string[] = [];
    let current = "";
    let inQuotes = false;

    for (const character of rowText) {
      if (character === '"') {
        inQuotes = !inQuotes;
      } else if (character === "," && !inQuotes) {
        row.push(current.trim());
        current = "";
      } else {
        current += character;
      }
    }

    row.push(current.trim());

    if (row.length < headers.length) {
      continue;
    }

    const family: Partial<EquationFamily> = {};

    headers.forEach((header, headerIndex) => {
      family[header.trim() as keyof EquationFamily] = row[headerIndex] ?? "";
    });

    families.push(family as EquationFamily);
  }

  return families;
}

export function formatSkillFamilyLabel(skillFamily: string) {
  return skillFamily
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function listSkillFamilies(families: EquationFamily[]) {
  return [...new Set(families.map((family) => family.skill_family.trim()).filter(Boolean))].sort(
    (left, right) =>
      formatSkillFamilyLabel(left).localeCompare(formatSkillFamilyLabel(right)),
  );
}

export function filterEquationFamilies(
  families: EquationFamily[],
  options: EquationFilters = {},
) {
  return families.filter((family) => {
    if (options.difficulty && family.difficulty !== options.difficulty) {
      return false;
    }

    if (options.skillFamily && family.skill_family !== options.skillFamily) {
      return false;
    }

    return true;
  });
}

export function selectRandomEquation(families: EquationFamily[], options: EquationFilters = {}) {
  const pool = filterEquationFamilies(families, options);

  if (!pool.length) {
    return {
      type: "explicit",
      fn: (x: number) => x,
      label: "y = x",
      latex: "y = x",
      hasTurningPoints: false,
    } satisfies ExplicitEquationConfig;
  }

  const family = pool[Math.floor(Math.random() * pool.length)];
  return generateEquation(family);
}

function sampleCurvePoints(equationConfig: EquationConfig, step?: number) {
  const width = 640;
  const points: Array<{ mx: number; my: number }> = [];

  if (equationConfig.type === "parametric") {
    const tStep = step ?? (equationConfig.tMax - equationConfig.tMin) / 400;

    for (let t = equationConfig.tMin; t <= equationConfig.tMax; t += tStep) {
      const mx = equationConfig.xFn(t);
      const my = equationConfig.yFn(t);

      if (Number.isFinite(mx) && Number.isFinite(my)) {
        points.push({ mx, my });
      }
    }

    return points;
  }

  const xMin = -graphConfig.centerX / graphConfig.pxPerUnit;
  const xMax = (width - graphConfig.centerX) / graphConfig.pxPerUnit;
  const stepSize = step ?? 0.05;

  for (let x = xMin; x <= xMax; x += stepSize) {
    const my = equationConfig.fn(x);

    if (Number.isFinite(my)) {
      points.push({ mx: x, my });
    }
  }

  return points;
}

function mathToGrid(mx: number, my: number): Point {
  return {
    x: graphConfig.centerX + mx * graphConfig.pxPerUnit,
    y: graphConfig.centerY - my * graphConfig.pxPerUnit,
  };
}

function mathToDraw(mx: number, my: number): Point {
  return {
    x: 640 - (graphConfig.centerX + mx * graphConfig.pxPerUnit),
    y: graphConfig.centerY - my * graphConfig.pxPerUnit,
  };
}

function getGroundTruthPoints(equationConfig: EquationConfig) {
  const samples = sampleCurvePoints(equationConfig);
  const points: Point[] = [];

  for (const { mx, my } of samples) {
    const point = mathToDraw(mx, my);

    if (point.x >= 0 && point.x <= 640 && point.y >= 0 && point.y <= 480) {
      points.push(point);
    }
  }

  return points;
}

function centroid(points: Point[]) {
  let totalX = 0;
  let totalY = 0;

  for (const point of points) {
    totalX += point.x;
    totalY += point.y;
  }

  return {
    x: totalX / points.length,
    y: totalY / points.length,
  };
}

function findVisibleIntercepts(equationConfig: EquationConfig) {
  const height = 480;
  const width = 640;
  const yMin = -(height - graphConfig.centerY) / graphConfig.pxPerUnit;
  const yMax = graphConfig.centerY / graphConfig.pxPerUnit;
  const xMin = -graphConfig.centerX / graphConfig.pxPerUnit;
  const xMax = (width - graphConfig.centerX) / graphConfig.pxPerUnit;
  const intercepts: Array<{ x: number; y: number; type: "x" | "y" }> = [];
  const samples = sampleCurvePoints(equationConfig, 0.01);

  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const current = samples[index];

    if (
      previous &&
      current &&
      previous.my * current.my <= 0 &&
      Math.abs(previous.my) + Math.abs(current.my) > 0
    ) {
      const interpolation =
        Math.abs(previous.my) / (Math.abs(previous.my) + Math.abs(current.my));
      const crossX = previous.mx + interpolation * (current.mx - previous.mx);

      if (crossX >= xMin && crossX <= xMax) {
        intercepts.push({ x: crossX, y: 0, type: "x" });
      }
    }

    if (
      previous &&
      current &&
      previous.mx * current.mx <= 0 &&
      Math.abs(previous.mx) + Math.abs(current.mx) > 0
    ) {
      const interpolation =
        Math.abs(previous.mx) / (Math.abs(previous.mx) + Math.abs(current.mx));
      const crossY = previous.my + interpolation * (current.my - previous.my);

      if (crossY >= yMin && crossY <= yMax) {
        intercepts.push({ x: 0, y: crossY, type: "y" });
      }
    }
  }

  return intercepts;
}

export function drawGrid(gridCtx: CanvasRenderingContext2D) {
  const width = 640;
  const height = 480;

  gridCtx.clearRect(0, 0, width, height);
  gridCtx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  gridCtx.lineWidth = 1;

  for (
    let pixel = graphConfig.centerX % graphConfig.pxPerUnit;
    pixel < width;
    pixel += graphConfig.pxPerUnit
  ) {
    gridCtx.beginPath();
    gridCtx.moveTo(pixel, 0);
    gridCtx.lineTo(pixel, height);
    gridCtx.stroke();
  }

  for (
    let pixel = graphConfig.centerY % graphConfig.pxPerUnit;
    pixel < height;
    pixel += graphConfig.pxPerUnit
  ) {
    gridCtx.beginPath();
    gridCtx.moveTo(0, pixel);
    gridCtx.lineTo(width, pixel);
    gridCtx.stroke();
  }

  gridCtx.strokeStyle = "rgba(255, 255, 255, 0.7)";
  gridCtx.lineWidth = 2;

  gridCtx.beginPath();
  gridCtx.moveTo(0, graphConfig.centerY);
  gridCtx.lineTo(width, graphConfig.centerY);
  gridCtx.stroke();

  gridCtx.beginPath();
  gridCtx.moveTo(graphConfig.centerX, 0);
  gridCtx.lineTo(graphConfig.centerX, height);
  gridCtx.stroke();

  gridCtx.fillStyle = "rgba(255, 255, 255, 0.7)";
  gridCtx.font = "12px system-ui";
  gridCtx.textAlign = "center";
  gridCtx.textBaseline = "top";

  const xMin = Math.ceil(-graphConfig.centerX / graphConfig.pxPerUnit);
  const xMax = Math.floor((width - graphConfig.centerX) / graphConfig.pxPerUnit);

  for (let unit = xMin; unit <= xMax; unit += 1) {
    if (unit === 0) {
      continue;
    }

    const pixel = graphConfig.centerX + unit * graphConfig.pxPerUnit;
    gridCtx.fillText(String(unit), pixel, graphConfig.centerY + 4);
  }

  gridCtx.textAlign = "right";
  gridCtx.textBaseline = "middle";
  const yMin = Math.ceil(-graphConfig.centerY / graphConfig.pxPerUnit);
  const yMax = Math.floor((height - graphConfig.centerY) / graphConfig.pxPerUnit);

  for (let unit = yMin; unit <= yMax; unit += 1) {
    if (unit === 0) {
      continue;
    }

    const pixel = graphConfig.centerY - unit * graphConfig.pxPerUnit;
    gridCtx.fillText(String(unit), graphConfig.centerX - 6, pixel);
  }

  gridCtx.textAlign = "right";
  gridCtx.textBaseline = "top";
  gridCtx.fillText("0", graphConfig.centerX - 6, graphConfig.centerY + 4);
}

export function drawGroundTruth(
  gridCtx: CanvasRenderingContext2D,
  equationConfig: EquationConfig | null,
) {
  if (!equationConfig) {
    return;
  }

  const samples = sampleCurvePoints(equationConfig);
  let started = false;

  gridCtx.strokeStyle = "rgba(100, 200, 255, 0.6)";
  gridCtx.lineWidth = 2;
  gridCtx.beginPath();

  for (const { mx, my } of samples) {
    const point = mathToGrid(mx, my);

    if (point.y < -50 || point.y > 530 || point.x < -50 || point.x > 690) {
      started = false;
      continue;
    }

    if (!started) {
      gridCtx.moveTo(point.x, point.y);
      started = true;
    } else {
      gridCtx.lineTo(point.x, point.y);
    }
  }

  gridCtx.stroke();
}

export function scoreDrawing(
  trails: Record<HandLabel, TrailPoint[]>,
  equationConfig: EquationConfig | null,
): ScoreResult {
  const drawn: Point[] = [];

  for (const label of ["Left", "Right"] satisfies HandLabel[]) {
    let stroke: Point[] = [];

    for (const point of trails[label]) {
      if (point === null) {
        if (stroke.length >= MIN_STROKE_POINTS) {
          drawn.push(...stroke);
        }

        stroke = [];
      } else {
        stroke.push(point);
      }
    }

    if (stroke.length >= MIN_STROKE_POINTS) {
      drawn.push(...stroke);
    }
  }

  if (drawn.length < MIN_STROKE_POINTS || !equationConfig) {
    return { total: 0, shape: 0, position: 0 };
  }

  const truth = getGroundTruthPoints(equationConfig);

  if (truth.length < 2) {
    return { total: 0, shape: 0, position: 0 };
  }

  const drawnCentroid = centroid(drawn);
  const truthCentroid = centroid(truth);
  const posAligned = drawn.map((point) => ({ x: point.x, y: point.y }));
  let posTx = 0;
  let posTy = 0;

  for (const drawnPoint of posAligned) {
    let minDistance = Number.POSITIVE_INFINITY;
    let closest = truth[0];

    for (const truthPoint of truth) {
      const distance =
        (drawnPoint.x - truthPoint.x) ** 2 + (drawnPoint.y - truthPoint.y) ** 2;

      if (distance < minDistance) {
        minDistance = distance;
        closest = truthPoint;
      }
    }

    if (closest) {
      posTx += closest.x - drawnPoint.x;
      posTy += closest.y - drawnPoint.y;
    }
  }

  posTx /= posAligned.length;
  posTy /= posAligned.length;

  for (const point of posAligned) {
    point.x += posTx * 0.5;
    point.y += posTy * 0.5;
  }

  let posDistance = 0;

  for (const drawnPoint of posAligned) {
    let minDistance = Number.POSITIVE_INFINITY;

    for (const truthPoint of truth) {
      const distance = Math.sqrt(
        (drawnPoint.x - truthPoint.x) ** 2 + (drawnPoint.y - truthPoint.y) ** 2,
      );

      if (distance < minDistance) {
        minDistance = distance;
      }
    }

    posDistance += minDistance;
  }

  const positionScore = Math.max(0, 1 - posDistance / posAligned.length / 120);
  const drawnCentered = drawn.map((point) => ({
    x: point.x - drawnCentroid.x,
    y: point.y - drawnCentroid.y,
  }));
  const truthCentered = truth.map((point) => ({
    x: point.x - truthCentroid.x,
    y: point.y - truthCentroid.y,
  }));

  let drawnExtent = 0;
  let truthExtent = 0;

  for (const point of drawnCentered) {
    drawnExtent = Math.max(drawnExtent, Math.abs(point.x), Math.abs(point.y));
  }

  for (const point of truthCentered) {
    truthExtent = Math.max(truthExtent, Math.abs(point.x), Math.abs(point.y));
  }

  let preScale = drawnExtent > 0 ? truthExtent / drawnExtent : 1;
  preScale = Math.max(0.5, Math.min(3, preScale));

  const drawnAligned = drawnCentered.map((point) => ({
    x: point.x * preScale,
    y: point.y * preScale,
  }));

  let icpScale = preScale;

  for (let iteration = 0; iteration < 10; iteration += 1) {
    const matches: Point[] = [];

    for (const drawnPoint of drawnAligned) {
      let minDistance = Number.POSITIVE_INFINITY;
      let closest = truthCentered[0];

      for (const truthPoint of truthCentered) {
        const distance =
          (drawnPoint.x - truthPoint.x) ** 2 + (drawnPoint.y - truthPoint.y) ** 2;

        if (distance < minDistance) {
          minDistance = distance;
          closest = truthPoint;
        }
      }

      if (closest) {
        matches.push(closest);
      }
    }

    let deltaX = 0;
    let deltaY = 0;

    for (let index = 0; index < drawnAligned.length; index += 1) {
      const match = matches[index];
      const drawnPoint = drawnAligned[index];

      if (!match || !drawnPoint) {
        continue;
      }

      deltaX += match.x - drawnPoint.x;
      deltaY += match.y - drawnPoint.y;
    }

    deltaX /= drawnAligned.length;
    deltaY /= drawnAligned.length;

    for (const point of drawnAligned) {
      point.x += deltaX;
      point.y += deltaY;
    }

    let numerator = 0;
    let denominator = 0;

    for (let index = 0; index < drawnAligned.length; index += 1) {
      const match = matches[index];
      const drawnPoint = drawnAligned[index];

      if (!match || !drawnPoint) {
        continue;
      }

      numerator += drawnPoint.x * match.x + drawnPoint.y * match.y;
      denominator += drawnPoint.x ** 2 + drawnPoint.y ** 2;
    }

    let deltaScale = denominator > 0 ? numerator / denominator : 1;
    deltaScale = Math.max(0.5, Math.min(2, deltaScale));

    for (const point of drawnAligned) {
      point.x *= deltaScale;
      point.y *= deltaScale;
    }

    icpScale *= deltaScale;

    if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5 && Math.abs(deltaScale - 1) < 0.001) {
      break;
    }
  }

  if (icpScale < 0.5 || icpScale > 3) {
    const clampedScale = Math.max(0.5, Math.min(3, icpScale));
    const scaleFix = clampedScale / icpScale;

    for (const point of drawnAligned) {
      point.x *= scaleFix;
      point.y *= scaleFix;
    }

    icpScale = clampedScale;
  }

  let forwardDistance = 0;

  for (const drawnPoint of drawnAligned) {
    let minDistance = Number.POSITIVE_INFINITY;

    for (const truthPoint of truthCentered) {
      const distance = Math.sqrt(
        (drawnPoint.x - truthPoint.x) ** 2 + (drawnPoint.y - truthPoint.y) ** 2,
      );

      if (distance < minDistance) {
        minDistance = distance;
      }
    }

    forwardDistance += minDistance;
  }

  let reverseDistance = 0;

  for (const truthPoint of truthCentered) {
    let minDistance = Number.POSITIVE_INFINITY;

    for (const drawnPoint of drawnAligned) {
      const distance = Math.sqrt(
        (truthPoint.x - drawnPoint.x) ** 2 + (truthPoint.y - drawnPoint.y) ** 2,
      );

      if (distance < minDistance) {
        minDistance = distance;
      }
    }

    reverseDistance += minDistance;
  }

  const shapeAvg =
    (forwardDistance / drawnAligned.length + reverseDistance / truthCentered.length) / 2;
  const shapeScore = Math.max(0, 1 - shapeAvg / 40);
  const intercepts = findVisibleIntercepts(equationConfig);
  const interceptRadius = 0.4 * graphConfig.pxPerUnit;
  let interceptBonus = 0;

  if (intercepts.length > 0) {
    const bonusPerIntercept = 1 / intercepts.length;

    for (const intercept of intercepts) {
      const interceptX = 640 - (graphConfig.centerX + intercept.x * graphConfig.pxPerUnit);
      const interceptY = graphConfig.centerY - intercept.y * graphConfig.pxPerUnit;
      let minDistance = Number.POSITIVE_INFINITY;

      for (const point of drawn) {
        const distance = Math.sqrt(
          (point.x - interceptX) ** 2 + (point.y - interceptY) ** 2,
        );

        if (distance < minDistance) {
          minDistance = distance;
        }
      }

      if (minDistance < interceptRadius) {
        const closeness = 1 - minDistance / interceptRadius;
        interceptBonus += (0.06 + closeness * 0.09) * bonusPerIntercept;
      }
    }
  }

  const xAxisPixel = graphConfig.centerY;
  const yAxisPixel = 640 - graphConfig.centerX;
  let drawnXCrossings = 0;
  let drawnYCrossings = 0;

  for (let index = 1; index < drawn.length; index += 1) {
    const previous = drawn[index - 1];
    const point = drawn[index];

    if (!previous || !point) {
      continue;
    }

    if ((previous.y - xAxisPixel) * (point.y - xAxisPixel) < 0) {
      drawnXCrossings += 1;
    }

    if ((previous.x - yAxisPixel) * (point.x - yAxisPixel) < 0) {
      drawnYCrossings += 1;
    }
  }

  const expectedXIntercepts = intercepts.filter((intercept) => intercept.type === "x").length;
  const expectedYIntercepts = intercepts.filter((intercept) => intercept.type === "y").length;
  const expectedCrossings = intercepts.length;
  const drawnCrossings = drawnXCrossings + drawnYCrossings;
  const extraCrossings = Math.max(0, drawnCrossings - expectedCrossings);
  const missingCrossings = Math.max(0, expectedCrossings - drawnCrossings - 1);
  const extraRatio =
    expectedCrossings > 0 ? extraCrossings / expectedCrossings : extraCrossings;
  const missingRatio =
    expectedCrossings > 0 ? missingCrossings / expectedCrossings : missingCrossings;
  const totalPenalty =
    0.035 * (extraRatio * extraRatio + missingRatio * missingRatio) * expectedCrossings;
  const extraX = Math.max(0, drawnXCrossings - expectedXIntercepts);
  const missingX = Math.max(0, expectedXIntercepts - drawnXCrossings - 1);
  const extraXRatio = expectedXIntercepts > 0 ? extraX / expectedXIntercepts : extraX;
  const missingXRatio =
    expectedXIntercepts > 0 ? missingX / expectedXIntercepts : missingX;
  const xPenalty =
    0.015 *
    (extraXRatio * extraXRatio + missingXRatio * missingXRatio) *
    Math.max(1, expectedXIntercepts);
  const extraY = Math.max(0, drawnYCrossings - expectedYIntercepts);
  const missingY = Math.max(0, expectedYIntercepts - drawnYCrossings - 1);
  const extraYRatio = expectedYIntercepts > 0 ? extraY / expectedYIntercepts : extraY;
  const missingYRatio =
    expectedYIntercepts > 0 ? missingY / expectedYIntercepts : missingY;
  const yPenalty =
    0.015 *
    (extraYRatio * extraYRatio + missingYRatio * missingYRatio) *
    Math.max(1, expectedYIntercepts);
  const adjustedPosition = Math.min(
    1,
    Math.max(0, positionScore + interceptBonus - (totalPenalty + xPenalty + yPenalty)),
  );

  let shapeBonus = 0;

  if (shapeScore > 0.9) {
    shapeBonus = 0.04;
  } else if (shapeScore > 0.85) {
    shapeBonus = 0.02;
  }

  let total = ((shapeScore + shapeBonus) * 0.7 + adjustedPosition * 0.3) * 100;
  total = Math.min(99, total);

  return {
    total: Math.round(total),
    shape: Math.round(shapeScore * 100),
    position: Math.round(adjustedPosition * 100),
    drawnCentroid,
    truthCentroid,
    drawnScaled: drawnAligned,
    truthCentered,
  };
}
