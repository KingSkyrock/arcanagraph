"use client";

import katex from "katex";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  GestureRecognizer,
  HandLandmarker,
  NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import { apiUrl } from "@/lib/api";
import type { LobbyMatch, LobbyPlayer } from "@/lib/types";
import styles from "./page.module.css";
import {
  drawGrid,
  drawGroundTruth,
  parseEquationCsv,
  scoreDrawing,
  selectRandomEquation,
  type EquationConfig,
  type EquationFamily,
  type HandLabel,
  type Point,
  type TrailPoint,
} from "./graph-battle";

type GraphBattlePanelProps = {
  currentPlayer: LobbyPlayer;
  lobbyMatch: LobbyMatch | null;
  opponents: LobbyPlayer[];
  selectedTargetId: string | null;
  disabled: boolean;
  onSuccessfulScore: (targetUserId: string, score: number) => Promise<void>;
};

type GradeAnimation = {
  score: number;
  startTime: number;
  duration: number;
};

const VIDEO_WIDTH = 860;
const VIDEO_HEIGHT = 620;
const DRAW_WIDTH = 640;
const DRAW_HEIGHT = 480;
const DRAW_OFFSET_X = 110;
const DRAW_OFFSET_Y = 70;
const HAND_CONNECTIONS = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [0, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [0, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [5, 9],
  [9, 13],
  [13, 17],
] as const;
const HAND_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const GESTURE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task";

function formatPlayerName(player: Pick<LobbyPlayer, "displayName" | "email" | "firebaseUid">) {
  return player.displayName || player.email || player.firebaseUid;
}

function getHealthPercent(match: LobbyMatch | null, userId: string) {
  if (!match) {
    return 0;
  }

  const player = match.players.find((entry) => entry.userId === userId);

  if (!player) {
    return 0;
  }

  return Math.max(0, Math.min(100, (player.health / match.maxHealth) * 100));
}

export function GraphBattlePanel({
  currentPlayer,
  lobbyMatch,
  opponents,
  selectedTargetId,
  disabled,
  onSuccessfulScore,
}: GraphBattlePanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const opponentContainerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const gridRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const attackCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const selectedTargetIdRef = useRef<string | null>(selectedTargetId);
  const selectedTargetNameRef = useRef("No target selected");
  const disabledRef = useRef(disabled);
  const onSuccessfulScoreRef = useRef(onSuccessfulScore);
  const resetSessionRef = useRef<() => void>(() => undefined);
  const nextEquationRef = useRef<() => void>(() => undefined);
  const animationFrameRef = useRef<number | null>(null);
  const timeoutIdsRef = useRef<number[]>([]);
  const familiesRef = useRef<EquationFamily[]>([]);
  const equationConfigRef = useRef<EquationConfig | null>(null);
  const [trackingStatus, setTrackingStatus] = useState("Loading graph battle...");
  const [scoreDisplay, setScoreDisplay] = useState("");
  const [equationMarkup, setEquationMarkup] = useState("");
  const [localError, setLocalError] = useState("");
  const [lockedTargetId, setLockedTargetId] = useState<string | null>(null);

  const selectedOpponent = useMemo(
    () =>
      opponents.find((player) => player.userId === (lockedTargetId ?? selectedTargetId)) ??
      opponents.find((player) => getHealthPercent(lobbyMatch, player.userId) > 0) ??
      opponents[0] ??
      null,
    [lobbyMatch, lockedTargetId, opponents, selectedTargetId],
  );

  useEffect(() => {
    selectedTargetIdRef.current = selectedTargetId;
  }, [selectedTargetId]);

  useEffect(() => {
    selectedTargetNameRef.current = selectedOpponent
      ? formatPlayerName(selectedOpponent)
      : "No target selected";
  }, [selectedOpponent]);

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  useEffect(() => {
    onSuccessfulScoreRef.current = onSuccessfulScore;
  }, [onSuccessfulScore]);

  useEffect(() => {
    const video = videoRef.current!;
    const gridCanvas = gridRef.current;
    const drawCanvas = drawingRef.current;
    const overlayCanvas = overlayRef.current;
    const attackCanvas = attackCanvasRef.current!;
    const battleContainer = containerRef.current!;
    const targetContainer = opponentContainerRef.current!;

    if (
      !video ||
      !gridCanvas ||
      !drawCanvas ||
      !overlayCanvas ||
      !attackCanvas ||
      !battleContainer ||
      !targetContainer
    ) {
      return;
    }

    const overlayContext = overlayCanvas.getContext("2d")!;
    const drawingContext = drawCanvas.getContext("2d")!;
    const gridContext = gridCanvas.getContext("2d")!;
    const attackContext = attackCanvas.getContext("2d")!;

    const attackLayer = attackCanvas;
    const runtimeVideo = video;

    let cancelled = false;
    let handLandmarker: HandLandmarker | null = null;
    let gestureRecognizer: GestureRecognizer | null = null;
    let lastVideoTime = -1;
    let openPalmDetected = false;
    let openPalmStart = 0;
    let palmScored = false;
    let gestureFrameCount = 0;
    let gradeAnim: GradeAnimation | null = null;
    let shapeDebugData:
      | {
          drawnScaled: Point[];
          truthCentered: Point[];
        }
      | null = null;
    const trails: Record<HandLabel, TrailPoint[]> = { Left: [], Right: [] };
    const wasDrawing: Record<HandLabel, boolean> = { Left: false, Right: false };
    const rawDrawing: Record<HandLabel, boolean> = { Left: false, Right: false };
    const rawChangeTime: Record<HandLabel, number> = { Left: 0, Right: 0 };
    const stableDrawing: Record<HandLabel, boolean> = { Left: false, Right: false };
    const trailHistory: Record<HandLabel, Array<{ time: number; len: number }>> = {
      Left: [],
      Right: [],
    };
    const smoothed: Record<HandLabel, Point | null> = { Left: null, Right: null };
    const lastTrailPoint: Record<HandLabel, Point | null> = { Left: null, Right: null };
    const lastTrailTime: Record<HandLabel, number> = { Left: 0, Right: 0 };
    const lastPos: Record<HandLabel, Point | null> = { Left: null, Right: null };
    const lastPosTime: Record<HandLabel, number> = { Left: 0, Right: 0 };
    const velocity: Record<HandLabel, number> = { Left: 0, Right: 0 };
    const direction: Record<HandLabel, Point> = {
      Left: { x: 0, y: 0 },
      Right: { x: 0, y: 0 },
    };
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      decay: number;
      size: number;
      color: string;
    }> = [];
    const attackProjectiles: Array<{
      startX: number;
      startY: number;
      endX: number;
      endY: number;
      progress: number;
      speed: number;
      size: number;
      color: string;
      trail: Point[];
      isBurst?: boolean;
    }> = [];
    let stream: MediaStream | null = null;

    const DEBOUNCE_MS = 125;
    const TRIM_LOOKBACK_MS = 60;
    const EMA_ALPHA = 0.4;
    const MIN_POINT_DIST = 4;
    const TRAIL_TIMEOUT_MS = 500;
    const FAST_THRESHOLD = 300;
    const OUTLIER_ANGLE_COS = -0.7;
    const OUTLIER_MIN_JUMP = 60;
    const PARTICLE_COLORS: Record<HandLabel, string[]> = {
      Right: ["#ffd700", "#ffaa00", "#ff6600", "#fff4b0"],
      Left: ["#33ff33", "#00ff88", "#88ffcc", "#ccffee"],
    };

    function registerTimeout(timeoutId: number) {
      timeoutIdsRef.current.push(timeoutId);
    }

    function clearRegisteredTimeouts() {
      for (const timeoutId of timeoutIdsRef.current) {
        window.clearTimeout(timeoutId);
      }

      timeoutIdsRef.current = [];
    }

    function resizeAttackCanvas() {
      attackLayer.width = window.innerWidth;
      attackLayer.height = window.innerHeight;
    }

    function renderEquation(config: EquationConfig) {
      equationConfigRef.current = config;
      setEquationMarkup(
        katex.renderToString(config.latex || config.label, {
          throwOnError: false,
          displayMode: true,
        }),
      );
      drawGrid(gridContext);
      drawGroundTruth(gridContext, config);
    }

    function chooseNextEquation() {
      const families = familiesRef.current;

      if (!families.length) {
        return;
      }

      renderEquation(selectRandomEquation(families));
      setScoreDisplay("");
    }

    function resetTrackingState(label: HandLabel) {
      wasDrawing[label] = false;
      rawDrawing[label] = false;
      rawChangeTime[label] = 0;
      stableDrawing[label] = false;
      trailHistory[label] = [];
      smoothed[label] = null;
      lastTrailPoint[label] = null;
      lastTrailTime[label] = 0;
      lastPos[label] = null;
      lastPosTime[label] = 0;
      velocity[label] = 0;
      direction[label] = { x: 0, y: 0 };
    }

    function resetSession() {
      trails.Left = [];
      trails.Right = [];
      setLockedTargetId(null);
      resetTrackingState("Left");
      resetTrackingState("Right");
      shapeDebugData = null;
      gradeAnim = null;
      openPalmDetected = false;
      openPalmStart = 0;
      palmScored = false;
      drawingContext.clearRect(0, 0, DRAW_WIDTH, DRAW_HEIGHT);
      overlayContext.clearRect(0, 0, DRAW_WIDTH, DRAW_HEIGHT);
      attackContext.clearRect(0, 0, attackLayer.width, attackLayer.height);
      attackProjectiles.length = 0;
      particles.length = 0;
      setScoreDisplay("");
    }

    function scheduleNextRound(delayMs: number) {
      registerTimeout(
        window.setTimeout(() => {
          if (cancelled) {
            return;
          }

          resetSession();
          chooseNextEquation();
        }, delayMs),
      );
    }

    function launchAttack(score: number) {
      if (score < 50) {
        return;
      }

      const playerRect = battleContainer.getBoundingClientRect();
      const opponentRect = targetContainer.getBoundingClientRect();
      const startX = playerRect.left + playerRect.width / 2;
      const startY = playerRect.top + playerRect.height / 2;
      const endX = opponentRect.left + opponentRect.width / 2;
      const endY = opponentRect.top + opponentRect.height / 2;
      const fireColors = ["#ff3300", "#ff5500", "#ff7700", "#ff9900", "#ffbb00"];

      for (let index = 0; index < 12; index += 1) {
        const delay = index * 30;
        const spread = (Math.random() - 0.5) * 40;
        attackProjectiles.push({
          startX: startX + (Math.random() - 0.5) * 60,
          startY: startY + (Math.random() - 0.5) * 60,
          endX: endX + spread,
          endY: endY + spread,
          progress: -delay / 500,
          speed: 0.04 + Math.random() * 0.02,
          size: 5 + Math.random() * 8,
          color: fireColors[Math.floor(Math.random() * fireColors.length)] ?? fireColors[0],
          trail: [],
        });
      }
    }

    function updateAndDrawAttack() {
      attackContext.clearRect(0, 0, attackLayer.width, attackLayer.height);

      if (!attackProjectiles.length) {
        return;
      }

      for (let index = attackProjectiles.length - 1; index >= 0; index -= 1) {
        const projectile = attackProjectiles[index];

        if (!projectile) {
          continue;
        }

        projectile.progress += projectile.speed;

        if (projectile.progress < 0) {
          continue;
        }

        if (projectile.progress > 1) {
          if (!projectile.isBurst) {
            const burstColors = ["#ff3300", "#ff6600", "#ff9900", "#ffcc00"];

            for (let burstIndex = 0; burstIndex < 16; burstIndex += 1) {
              const angle = Math.random() * Math.PI * 2;
              attackProjectiles.push({
                startX: projectile.endX,
                startY: projectile.endY,
                endX: projectile.endX + Math.cos(angle) * (50 + Math.random() * 80),
                endY: projectile.endY + Math.sin(angle) * (50 + Math.random() * 80),
                progress: 0,
                speed: 0.02 + Math.random() * 0.02,
                size: 3 + Math.random() * 7,
                color:
                  burstColors[Math.floor(Math.random() * burstColors.length)] ??
                  burstColors[0],
                trail: [],
                isBurst: true,
              });
            }
          }

          attackProjectiles.splice(index, 1);
          continue;
        }

        const alpha = projectile.isBurst ? 1 - projectile.progress : 1;
        const tween = projectile.isBurst
          ? projectile.progress
          : projectile.progress * projectile.progress * (3 - 2 * projectile.progress);
        const x = projectile.startX + (projectile.endX - projectile.startX) * tween;
        const y = projectile.startY + (projectile.endY - projectile.startY) * tween;

        projectile.trail.push({ x, y });

        if (projectile.trail.length > 8) {
          projectile.trail.shift();
        }

        for (let trailIndex = 0; trailIndex < projectile.trail.length; trailIndex += 1) {
          const trailPoint = projectile.trail[trailIndex];

          if (!trailPoint) {
            continue;
          }

          const trailAlpha = ((trailIndex + 1) / projectile.trail.length) * 0.4 * alpha;
          attackContext.globalAlpha = trailAlpha;
          attackContext.fillStyle = projectile.color;
          attackContext.beginPath();
          attackContext.arc(trailPoint.x, trailPoint.y, projectile.size * 0.5, 0, Math.PI * 2);
          attackContext.fill();
        }

        attackContext.globalAlpha = alpha;
        attackContext.fillStyle = projectile.color;
        attackContext.shadowColor = projectile.color;
        attackContext.shadowBlur = 12;
        attackContext.beginPath();
        attackContext.arc(
          x,
          y,
          projectile.size * (projectile.isBurst ? 1 - projectile.progress : 1),
          0,
          Math.PI * 2,
        );
        attackContext.fill();
        attackContext.shadowBlur = 0;
      }

      attackContext.globalAlpha = 1;
    }

    function spawnParticles(x: number, y: number, label: HandLabel, speed: number) {
      const count = Math.min(4, 1 + Math.floor(speed / 400));
      const colors = PARTICLE_COLORS[label];

      for (let index = 0; index < count; index += 1) {
        const angle = Math.random() * Math.PI * 2;
        const velocityScale = 0.5 + Math.random() * 1.5;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * velocityScale,
          vy: Math.sin(angle) * velocityScale - 0.5,
          life: 1,
          decay: 0.015 + Math.random() * 0.02,
          size: 2 + Math.random() * 3,
          color: colors[Math.floor(Math.random() * colors.length)] ?? colors[0] ?? "#ffd700",
        });
      }
    }

    function updateAndDrawParticles() {
      for (let index = particles.length - 1; index >= 0; index -= 1) {
        const particle = particles[index];

        if (!particle) {
          continue;
        }

        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life -= particle.decay;

        if (particle.life <= 0) {
          particles.splice(index, 1);
          continue;
        }

        overlayContext.globalAlpha = particle.life;
        overlayContext.fillStyle = particle.color;
        overlayContext.shadowColor = particle.color;
        overlayContext.shadowBlur = 8;
        overlayContext.beginPath();
        overlayContext.arc(particle.x, particle.y, particle.size * particle.life, 0, Math.PI * 2);
        overlayContext.fill();
      }

      overlayContext.globalAlpha = 1;
      overlayContext.shadowBlur = 0;
    }

    function smoothStroke(trail: TrailPoint[]) {
      let start = trail.length - 1;

      while (start > 0 && trail[start - 1] !== null) {
        start -= 1;
      }

      if (trail.length - start < 3) {
        return;
      }

      for (let pass = 0; pass < 2; pass += 1) {
        for (let index = start + 1; index < trail.length - 1; index += 1) {
          const previous = trail[index - 1];
          const current = trail[index];
          const next = trail[index + 1];

          if (!previous || !current || !next) {
            continue;
          }

          current.x += 0.3 * ((previous.x + next.x) / 2 - current.x);
          current.y += 0.3 * ((previous.y + next.y) / 2 - current.y);
        }
      }
    }

    function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      return Math.sqrt(dx * dx + dy * dy);
    }

    function checkDrawing(landmarks: NormalizedLandmark[]) {
      const wrist = 0;
      const margin = 0.02;
      const indexTip = dist(landmarks[8]!, landmarks[wrist]!);
      const indexPip = dist(landmarks[6]!, landmarks[wrist]!);
      const middleTip = dist(landmarks[12]!, landmarks[wrist]!);
      const middlePip = dist(landmarks[10]!, landmarks[wrist]!);
      const ringTip = dist(landmarks[16]!, landmarks[wrist]!);
      const ringPip = dist(landmarks[14]!, landmarks[wrist]!);
      const pinkyTip = dist(landmarks[20]!, landmarks[wrist]!);
      const pinkyPip = dist(landmarks[18]!, landmarks[wrist]!);
      const indexExtended = indexTip > indexPip;
      const middleCurled = middleTip < middlePip + margin;
      const ringCurled = ringTip < ringPip + margin;
      const pinkyCurled = pinkyTip < pinkyPip + margin;
      const otherTipsZ =
        (landmarks[12]!.z + landmarks[16]!.z + landmarks[20]!.z) / 3;
      const indexProtrusion = otherTipsZ - landmarks[8]!.z;
      const indexFingerLength = Math.sqrt(
        (landmarks[8]!.x - landmarks[5]!.x) ** 2 +
          (landmarks[8]!.y - landmarks[5]!.y) ** 2 +
          (landmarks[8]!.z - landmarks[5]!.z) ** 2,
      );
      const indexBaseLength = Math.sqrt(
        (landmarks[6]!.x - landmarks[5]!.x) ** 2 +
          (landmarks[6]!.y - landmarks[5]!.y) ** 2 +
          (landmarks[6]!.z - landmarks[5]!.z) ** 2,
      );
      const fingerRatio = indexBaseLength > 0 ? indexFingerLength / indexBaseLength : 0;
      const handSize = dist(landmarks[0]!, landmarks[9]!);
      const normalizedProtrusion =
        handSize < 0.11 ? indexProtrusion * (0.11 / handSize) : indexProtrusion;
      const pointingAtCamera = normalizedProtrusion > 0.03 && fingerRatio > 1.5;

      return (indexExtended || pointingAtCamera) && middleCurled && ringCurled && pinkyCurled;
    }

    function renderTrails() {
      drawingContext.clearRect(0, 0, DRAW_WIDTH, DRAW_HEIGHT);
      const colors: Record<HandLabel, string> = {
        Left: "#33ff33",
        Right: "#ffd700",
      };

      for (const label of ["Left", "Right"] satisfies HandLabel[]) {
        const trail = trails[label];

        if (trail.length < 2) {
          continue;
        }

        drawingContext.strokeStyle = colors[label];
        drawingContext.lineWidth = 3;
        drawingContext.lineCap = "round";
        drawingContext.lineJoin = "round";
        const strokes: Point[][] = [];
        let currentStroke: Point[] = [];

        for (const point of trail) {
          if (point === null) {
            if (currentStroke.length >= 2) {
              strokes.push(currentStroke);
            }

            currentStroke = [];
          } else {
            currentStroke.push(point);
          }
        }

        if (currentStroke.length >= 2) {
          strokes.push(currentStroke);
        }

        for (const points of strokes) {
          drawingContext.beginPath();
          drawingContext.moveTo(points[0]!.x, points[0]!.y);

          if (points.length === 2) {
            drawingContext.lineTo(points[1]!.x, points[1]!.y);
          } else {
            let midX = (points[0]!.x + points[1]!.x) / 2;
            let midY = (points[0]!.y + points[1]!.y) / 2;
            drawingContext.lineTo(midX, midY);

            for (let index = 1; index < points.length - 1; index += 1) {
              const current = points[index]!;
              const next = points[index + 1]!;
              const nextMidX = (current.x + next.x) / 2;
              const nextMidY = (current.y + next.y) / 2;
              drawingContext.quadraticCurveTo(current.x, current.y, nextMidX, nextMidY);
              midX = nextMidX;
              midY = nextMidY;
            }

            drawingContext.lineTo(points[points.length - 1]!.x, points[points.length - 1]!.y);
          }

          drawingContext.stroke();
        }
      }

      if (shapeDebugData) {
        drawingContext.strokeStyle = "rgba(0, 255, 255, 0.7)";
        drawingContext.lineWidth = 2;
        drawingContext.beginPath();

        for (let index = 0; index < shapeDebugData.truthCentered.length; index += 1) {
          const point = shapeDebugData.truthCentered[index]!;

          if (index === 0) {
            drawingContext.moveTo(320 + point.x, 240 + point.y);
          } else {
            drawingContext.lineTo(320 + point.x, 240 + point.y);
          }
        }

        drawingContext.stroke();
        drawingContext.fillStyle = "rgba(255, 0, 255, 0.7)";

        for (const point of shapeDebugData.drawnScaled) {
          drawingContext.beginPath();
          drawingContext.arc(320 + point.x, 240 + point.y, 2, 0, Math.PI * 2);
          drawingContext.fill();
        }
      }
    }

    function drawHand(landmarks: NormalizedLandmark[], isRight: boolean, drawing: boolean) {
      overlayContext.strokeStyle = "#c4a0ff";
      overlayContext.lineWidth = 2;

      for (const [start, end] of HAND_CONNECTIONS) {
        const startPoint = landmarks[start];
        const endPoint = landmarks[end];

        if (!startPoint || !endPoint) {
          continue;
        }

        overlayContext.beginPath();
        overlayContext.moveTo(startPoint.x * VIDEO_WIDTH - DRAW_OFFSET_X, startPoint.y * VIDEO_HEIGHT - DRAW_OFFSET_Y);
        overlayContext.lineTo(endPoint.x * VIDEO_WIDTH - DRAW_OFFSET_X, endPoint.y * VIDEO_HEIGHT - DRAW_OFFSET_Y);
        overlayContext.stroke();
      }

      for (let index = 0; index < landmarks.length; index += 1) {
        const landmark = landmarks[index]!;
        const x = landmark.x * VIDEO_WIDTH - DRAW_OFFSET_X;
        const y = landmark.y * VIDEO_HEIGHT - DRAW_OFFSET_Y;

        if (index === 8) {
          overlayContext.fillStyle = isRight
            ? drawing
              ? "#ffd700"
              : "#ff3333"
            : drawing
              ? "#33ff33"
              : "#3388ff";
          overlayContext.beginPath();
          overlayContext.arc(x, y, 8, 0, Math.PI * 2);
          overlayContext.fill();
        } else {
          overlayContext.fillStyle = "#c4a0ff";
          overlayContext.beginPath();
          overlayContext.arc(x, y, 4, 0, Math.PI * 2);
          overlayContext.fill();
        }
      }
    }

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera access is not available in this browser.");
      }

      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: DRAW_WIDTH, height: DRAW_HEIGHT },
      });
      runtimeVideo.srcObject = stream;
      await runtimeVideo.play();
      setTrackingStatus("Draw with your index finger, then hold an open palm to grade.");
    }

    function detect() {
      if (cancelled || !handLandmarker) {
        return;
      }

      const now = performance.now();
      updateAndDrawAttack();

      if (runtimeVideo.currentTime === lastVideoTime) {
        animationFrameRef.current = window.requestAnimationFrame(detect);
        return;
      }

      lastVideoTime = runtimeVideo.currentTime;
      const results = handLandmarker.detectForVideo(runtimeVideo, now);
      gestureFrameCount += 1;

      if (gestureRecognizer && gestureFrameCount % 3 === 0) {
        try {
          const gestureResults = gestureRecognizer.recognizeForVideo(runtimeVideo, now + 0.1);
          let palmNow = false;

          for (const gestureList of gestureResults.gestures ?? []) {
            if (gestureList[0]?.categoryName === "Open_Palm") {
              palmNow = true;
              break;
            }
          }

          if (palmNow && !openPalmDetected) {
            openPalmStart = now;
            gradeAnim = null;
          }

          openPalmDetected = palmNow;
        } catch {
          // Ignore occasional Mediapipe timing errors between gesture frames.
        }
      }

      const hasDrawing = trails.Left.some((point) => point !== null) || trails.Right.some((point) => point !== null);

      if (
        openPalmDetected &&
        openPalmStart > 0 &&
        now - openPalmStart >= 850 &&
        !palmScored &&
        hasDrawing
      ) {
        palmScored = true;
        const score = scoreDrawing(trails, equationConfigRef.current);
        setScoreDisplay(`Score: ${score.total} (Shape: ${score.shape}, Pos: ${score.position})`);

        if (score.drawnScaled && score.truthCentered) {
          shapeDebugData = {
            drawnScaled: score.drawnScaled,
            truthCentered: score.truthCentered,
          };
        }

        const animationDuration = score.total < 50 ? 3500 : 2000;
        gradeAnim = { score: score.total, startTime: now, duration: animationDuration };

        if (score.total >= 50 && selectedTargetIdRef.current && !disabledRef.current) {
          const targetUserId = selectedTargetIdRef.current;
          const targetName = selectedTargetNameRef.current;

          setLockedTargetId(targetUserId);
          launchAttack(score.total);
          registerTimeout(
            window.setTimeout(() => {
              if (!targetUserId || cancelled) {
                return;
              }

              void onSuccessfulScoreRef
                .current(targetUserId, score.total)
                .then(() => {
                  if (!cancelled) {
                    setLocalError("");
                    setTrackingStatus(
                      `Graph cast landed on ${targetName} with a ${score.total}% score.`,
                    );
                  }
                })
                .catch((error: unknown) => {
                  if (!cancelled) {
                    setLocalError(
                      error instanceof Error
                        ? error.message
                        : "The graph score could not be applied to the match.",
                    );
                  }
                });
            }, 900),
          );
        } else if (score.total >= 50 && !selectedTargetIdRef.current) {
          setLocalError("Choose an opponent first so your next passing graph can deal damage.");
        } else if (score.total >= 50 && disabledRef.current) {
          setLocalError("The match is not ready for another graph attack yet.");
        } else {
          setLocalError("You need a score above 50% to damage your opponent.");
        }

        scheduleNextRound(animationDuration + 300);
      }

      if (!openPalmDetected) {
        openPalmStart = 0;

        if (!gradeAnim) {
          palmScored = false;
        }
      }

      overlayContext.clearRect(0, 0, DRAW_WIDTH, DRAW_HEIGHT);

      if (openPalmDetected && openPalmStart > 0 && !palmScored && hasDrawing) {
        const alpha = Math.min(1, (now - openPalmStart) / 850);
        overlayContext.save();
        overlayContext.scale(-1, 1);
        overlayContext.globalAlpha = alpha;
        overlayContext.font = "bold 48px system-ui";
        overlayContext.fillStyle = "#ffd700";
        overlayContext.textAlign = "center";
        overlayContext.textBaseline = "middle";
        overlayContext.fillText("Grading...", -320, 240);
        overlayContext.restore();
      }

      const handsPresent: Record<HandLabel, boolean> = { Left: false, Right: false };

      if (results.landmarks) {
        for (let handIndex = 0; handIndex < results.landmarks.length; handIndex += 1) {
          const label = results.handednesses[handIndex]?.[0]?.categoryName as HandLabel | undefined;

          if (label !== "Left" && label !== "Right") {
            continue;
          }

          handsPresent[label] = true;
          const landmarks = results.landmarks[handIndex] ?? [];
          const drawing = checkDrawing(landmarks);
          let x = landmarks[8]!.x * VIDEO_WIDTH - DRAW_OFFSET_X;
          let y = landmarks[8]!.y * VIDEO_HEIGHT - DRAW_OFFSET_Y;

          if (smoothed[label]) {
            x = smoothed[label]!.x + EMA_ALPHA * (x - smoothed[label]!.x);
            y = smoothed[label]!.y + EMA_ALPHA * (y - smoothed[label]!.y);
          }

          smoothed[label] = { x, y };
          const inBounds = x >= -20 && x <= 660 && y >= -20 && y <= 500;
          const inDrawArea = x >= 0 && x <= DRAW_WIDTH && y >= 0 && y <= DRAW_HEIGHT;

          if (!inBounds) {
            if (wasDrawing[label]) {
              trails[label].push(null);
            }

            resetTrackingState(label);

            for (let particleIndex = particles.length - 1; particleIndex >= 0; particleIndex -= 1) {
              particles[particleIndex]!.life = Math.min(particles[particleIndex]!.life, 0.1);
            }

            drawHand(landmarks, label === "Right", false);
            continue;
          }

          if (!inDrawArea) {
            lastPos[label] = { x, y };
            lastPosTime[label] = now;
            drawHand(landmarks, label === "Right", false);
            continue;
          }

          let isOutlier = false;

          if (lastPos[label] && lastPosTime[label] > 0) {
            const dt = (now - lastPosTime[label]) / 1000;
            const dx = x - lastPos[label]!.x;
            const dy = y - lastPos[label]!.y;
            const jumpDistance = Math.sqrt(dx * dx + dy * dy);

            if (dt > 0) {
              velocity[label] = jumpDistance / dt;
            }

            const directionMagnitude = Math.sqrt(
              direction[label].x ** 2 + direction[label].y ** 2,
            );

            if (jumpDistance > OUTLIER_MIN_JUMP && directionMagnitude > 0.01) {
              const dot =
                (dx * direction[label].x + dy * direction[label].y) /
                (jumpDistance * directionMagnitude);

              if (dot < OUTLIER_ANGLE_COS) {
                isOutlier = true;
              }
            }

            if (!isOutlier && jumpDistance > 2) {
              direction[label].x = direction[label].x * 0.7 + dx * 0.3;
              direction[label].y = direction[label].y * 0.7 + dy * 0.3;
            }
          }

          if (isOutlier) {
            x = lastPos[label]!.x;
            y = lastPos[label]!.y;
          } else {
            lastPos[label] = { x, y };
            lastPosTime[label] = now;
          }

          if (drawing !== rawDrawing[label]) {
            rawDrawing[label] = drawing;
            rawChangeTime[label] = now;
          }

          if (rawDrawing[label] && !stableDrawing[label]) {
            stableDrawing[label] = true;
            trailHistory[label] = [];
          }

          if (stableDrawing[label]) {
            trailHistory[label].push({ time: now, len: trails[label].length });

            while (
              trailHistory[label].length > 0 &&
              trailHistory[label][0]!.time < now - TRIM_LOOKBACK_MS - DEBOUNCE_MS
            ) {
              trailHistory[label].shift();
            }
          }

          if (
            !rawDrawing[label] &&
            stableDrawing[label] &&
            now - rawChangeTime[label] >= DEBOUNCE_MS
          ) {
            const cutoffTime = rawChangeTime[label] - TRIM_LOOKBACK_MS;
            let trimTo = trails[label].length;

            for (const entry of trailHistory[label]) {
              if (entry.time >= cutoffTime) {
                trimTo = entry.len;
                break;
              }
            }

            trails[label].length = trimTo;
            smoothStroke(trails[label]);
            trails[label].push(null);
            lastTrailPoint[label] = null;
            trailHistory[label] = [];
            stableDrawing[label] = false;
            wasDrawing[label] = false;
          }

          const stable = stableDrawing[label];

          if (stable) {
            let priorPoint = lastTrailPoint[label];

            if (priorPoint && now - lastTrailTime[label] > TRAIL_TIMEOUT_MS) {
              trails[label].push(null);
              priorPoint = null;
              lastTrailPoint[label] = null;
            }

            const dx = priorPoint ? x - priorPoint.x : 0;
            const dy = priorPoint ? y - priorPoint.y : 0;
            const gap = Math.sqrt(dx * dx + dy * dy);

            if (!priorPoint || gap > MIN_POINT_DIST) {
              if (priorPoint && gap > Math.max(25, velocity[label] > FAST_THRESHOLD ? 18 : 25)) {
                const steps = Math.ceil(gap / 25);

                for (let step = 1; step < steps; step += 1) {
                  const interpolation = step / steps;
                  trails[label].push({
                    x: priorPoint.x + dx * interpolation,
                    y: priorPoint.y + dy * interpolation,
                  });
                }
              }

              trails[label].push({ x, y });
              lastTrailPoint[label] = { x, y };
              lastTrailTime[label] = now;
              spawnParticles(x, y, label, velocity[label]);
            }
          } else if (wasDrawing[label] && !stable) {
            smoothStroke(trails[label]);
            trails[label].push(null);
            lastTrailPoint[label] = null;
          }

          wasDrawing[label] = stable;
          drawHand(landmarks, label === "Right", drawing);
        }
      }

      for (const label of ["Left", "Right"] satisfies HandLabel[]) {
        if (!handsPresent[label] && wasDrawing[label]) {
          trails[label].push(null);
          resetTrackingState(label);
        }
      }

      updateAndDrawParticles();

      if (gradeAnim && palmScored) {
        const elapsed = now - gradeAnim.startTime;

        if (elapsed > gradeAnim.duration) {
          gradeAnim = null;
        } else {
          const isFail = gradeAnim.score < 50;
          const countUpEnd = 800;
          const displayNum = Math.round(Math.min(1, elapsed / countUpEnd) * gradeAnim.score);
          const fadeStart = gradeAnim.duration * 0.75;
          const fadeOut =
            elapsed > fadeStart
              ? 1 - (elapsed - fadeStart) / (gradeAnim.duration - fadeStart)
              : 1;
          const scaleT = elapsed / gradeAnim.duration;
          const scale =
            scaleT < 0.05 ? 0.5 + (scaleT / 0.05) * 0.7 : 1.2 - (Math.min(scaleT, 0.15) - 0.05);
          const color =
            displayNum >= 80 ? "#33ff33" : displayNum >= 50 ? "#ffd700" : "#ff3333";

          overlayContext.save();
          overlayContext.scale(-1, 1);
          overlayContext.globalAlpha = fadeOut;
          overlayContext.font = `bold ${Math.round(72 * Math.max(1, scale))}px system-ui`;
          overlayContext.fillStyle = color;
          overlayContext.shadowColor = color;
          overlayContext.shadowBlur = 20;
          overlayContext.textAlign = "center";
          overlayContext.textBaseline = "middle";
          overlayContext.fillText(`${displayNum}%`, -320, 200);

          if (isFail && elapsed > countUpEnd && Math.floor((elapsed - countUpEnd) / 300) % 2 === 0) {
            const xScale = elapsed - countUpEnd < 150 ? 0.3 + ((elapsed - countUpEnd) / 150) * 0.7 : 1;
            overlayContext.font = `bold ${Math.round(160 * xScale)}px system-ui`;
            overlayContext.fillStyle = "#ff0000";
            overlayContext.shadowColor = "#ff0000";
            overlayContext.shadowBlur = 30;
            overlayContext.fillText("✗", -320, 200);
          }

          overlayContext.shadowBlur = 0;
          overlayContext.globalAlpha = 1;
          overlayContext.restore();
        }
      }

      renderTrails();
      animationFrameRef.current = window.requestAnimationFrame(detect);
    }

    async function init() {
      try {
        setTrackingStatus("Loading graph equations...");
        const equationResponse = await fetch(apiUrl("/data/advanced_equations.csv"), {
          credentials: "include",
        });

        if (!equationResponse.ok) {
          throw new Error(
            `Could not load graph equations (${equationResponse.status}). The battle prompts are unavailable right now.`,
          );
        }

        const equationCsv = await equationResponse.text();
        const families = parseEquationCsv(equationCsv);

        if (!families.length) {
          throw new Error(
            "The graph equation bank is empty. Check data/advanced_equations.csv and try again.",
          );
        }

        familiesRef.current = families;
        drawGrid(gridContext);
        chooseNextEquation();
        setTrackingStatus("Loading MediaPipe hand tracking...");

        const visionModule = await import("@mediapipe/tasks-vision");
        const vision = await visionModule.FilesetResolver.forVisionTasks("/mediapipe/wasm");

        handLandmarker = await visionModule.HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: HAND_MODEL_URL,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 2,
        });

        gestureRecognizer = await visionModule.GestureRecognizer.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: GESTURE_MODEL_URL,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 1,
        });

        setTrackingStatus("MediaPipe loaded. Starting camera...");
        await startCamera();

        if (!cancelled) {
          animationFrameRef.current = window.requestAnimationFrame(detect);
        }
      } catch (error) {
        if (!cancelled) {
          setLocalError(
            error instanceof Error
              ? error.message
              : "The graph battle camera could not be initialized.",
          );
          setTrackingStatus("Graph battle is offline.");
        }
      }
    }

    resetSessionRef.current = resetSession;
    nextEquationRef.current = () => {
      resetSession();
      chooseNextEquation();
    };

    resizeAttackCanvas();
    drawGrid(gridContext);
    void init();
    window.addEventListener("resize", resizeAttackCanvas);

    return () => {
      cancelled = true;
      clearRegisteredTimeouts();

      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      window.removeEventListener("resize", resizeAttackCanvas);
      handLandmarker?.close();
      gestureRecognizer?.close();

      for (const track of stream?.getTracks() ?? []) {
        track.stop();
      }

      runtimeVideo.srcObject = null;
    };
  }, []);

  const selectedOpponentHealth = selectedOpponent
    ? Math.round(getHealthPercent(lobbyMatch, selectedOpponent.userId))
    : 0;

  return (
    <section className={styles.cvPanel}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.label}>Graph Battle</p>
          <h2>Trace the equation to cast damage</h2>
        </div>
        <span className={styles.state}>{selectedOpponent ? "Target locked" : "No target"}</span>
      </div>

      <div className={styles.cvBattleLayout}>
        <div ref={containerRef} className={styles.cvContainer}>
          <video ref={videoRef} className={styles.cvVideo} autoPlay muted playsInline />
          <canvas
            ref={gridRef}
            className={styles.cvGrid}
            width={DRAW_WIDTH}
            height={DRAW_HEIGHT}
          />
          <canvas
            ref={drawingRef}
            className={styles.cvDrawing}
            width={DRAW_WIDTH}
            height={DRAW_HEIGHT}
          />
          <canvas
            ref={overlayRef}
            className={styles.cvOverlay}
            width={DRAW_WIDTH}
            height={DRAW_HEIGHT}
          />
        </div>

        <div className={styles.cvSideColumn}>
          <div ref={opponentContainerRef} className={styles.cvOpponent}>
            {selectedOpponent ? (
              <div className={styles.cvOpponentCard}>
                <p className={styles.label}>Enemy Focus</p>
                <strong>{formatPlayerName(selectedOpponent)}</strong>
                <span className={styles.meta}>Aim your graph here</span>
                <div className={styles.healthTrack} aria-hidden="true">
                  <div className={styles.healthFill} style={{ width: `${selectedOpponentHealth}%` }} />
                </div>
              </div>
            ) : (
              <div className={styles.cvOpponentCard}>
                <p className={styles.label}>Enemy Focus</p>
                <strong>Waiting for target</strong>
                <span className={styles.meta}>Pick an opponent from the player list.</span>
              </div>
            )}
          </div>

          <div
            className={styles.cvEquation}
            dangerouslySetInnerHTML={{
              __html:
                equationMarkup ||
                katex.renderToString("y = x", { throwOnError: false, displayMode: true }),
            }}
          />
        </div>
      </div>

      <canvas ref={attackCanvasRef} className={styles.cvAttackCanvas} />

      <div className={styles.cvControls}>
        <div className={styles.cvControlGroup}>
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => {
              setLocalError("");
              resetSessionRef.current();
            }}
          >
            Clear
          </button>
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => {
              setLocalError("");
              nextEquationRef.current();
            }}
          >
            New Equation
          </button>
        </div>
        <span className={styles.scoreDisplay}>{scoreDisplay || "Score: waiting for trace"}</span>
      </div>

      <p className={styles.muted}>
        {trackingStatus} Signed in as {formatPlayerName(currentPlayer)}.
      </p>
      {localError ? <p className={styles.error}>{localError}</p> : null}
    </section>
  );
}
