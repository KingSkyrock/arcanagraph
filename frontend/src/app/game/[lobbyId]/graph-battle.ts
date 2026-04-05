// Frontend-only: DOM-dependent rendering functions.
// All pure scoring/equation logic lives in shared/graph-scoring.ts.

export {
  type HandLabel,
  type Point,
  type TrailPoint,
  type EquationFamily,
  type EquationConfig,
  type ScoreResult,
  type SerializableEquation,
  graphConfig,
  parseEquationCsv,
  selectRandomEquation,
  generateEquation,
  equationConfigFromDescriptor,
  sampleCurvePoints,
  scoreDrawing,
} from "@/shared/graph-scoring";

import {
  type EquationConfig,
  type Point,
  graphConfig,
  sampleCurvePoints,
} from "@/shared/graph-scoring";

function mathToGrid(mx: number, my: number): Point {
  return {
    x: graphConfig.centerX + mx * graphConfig.pxPerUnit,
    y: graphConfig.centerY - my * graphConfig.pxPerUnit,
  };
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
