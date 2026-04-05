"use client";

import Link from "next/link";
import katex from "katex";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  GestureRecognizer,
  HandLandmarker,
  NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import type { Socket } from "socket.io-client";
import { apiUrl } from "@/lib/api";
import {
  formatPrimaryHandLabel,
  usePrimaryHandPreference,
} from "@/lib/hand-preference";
import type { AppUser, LobbyMatch, LobbyPlayer } from "@/lib/types";
import styles from "./page.module.css";
import {
  drawGrid,
  drawGroundTruth,
  equationConfigFromDescriptor,
  filterEquationFamilies,
  formatSkillFamilyLabel,
  graphConfig,
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
  sessionUser?: AppUser | null;
  sessionReady?: boolean;
  solo?: boolean;
  soloSkillFamily?: string | null;
  category?: "beginner" | "advanced" | null;
  onSuccessfulScore: (targetUserId: string, trails: Record<string, unknown>) => Promise<{ total: number; shape: number; position: number } | undefined>;
  socket?: Socket | null;
  lobbyId?: string;
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

function formatPlayerName(player: Pick<LobbyPlayer, "displayName">) {
  return player.displayName || "Unknown player";
}

function isSoloGuestPlayer(player: Pick<LobbyPlayer, "userId">) {
  return player.userId === "solo-guest";
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

function SkillFamilyBadge({ skillFamily }: { skillFamily: string }) {
  const [hovered, setHovered] = useState(false);
  const isMulti = skillFamily.includes(',');
  const label = isMulti ? 'Custom' : formatSkillFamilyLabel(skillFamily);
  const tooltip = isMulti
    ? skillFamily.split(',').map(s => formatSkillFamilyLabel(s.trim())).join(', ')
    : undefined;

  return (
    <span
      className={styles.state}
      style={{ position: 'relative', cursor: tooltip ? 'help' : 'default' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {label}
      {tooltip && hovered ? (
        <span style={{
          position: 'absolute', bottom: 'calc(100% + 8px)',
          left: '50%', transform: 'translateX(-50%)',
          width: 220, padding: '10px 14px', borderRadius: 12,
          background: 'rgba(10, 24, 71, 0.95)',
          border: '1px solid rgba(255,255,255,0.18)',
          color: 'rgba(255,255,255,0.88)', fontSize: 13, fontWeight: 600,
          lineHeight: 1.5, pointerEvents: 'none', zIndex: 10,
          textAlign: 'center', whiteSpace: 'normal',
        }}>
          {tooltip}
        </span>
      ) : null}
    </span>
  );
}

export function GraphBattlePanel({
  currentPlayer,
  lobbyMatch,
  opponents,
  selectedTargetId,
  disabled,
  sessionUser = null,
  sessionReady = false,
  solo = false,
  soloSkillFamily = null,
  category = null,
  onSuccessfulScore,
  socket,
  lobbyId,
}: GraphBattlePanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const opponentContainerRef = useRef<HTMLDivElement | null>(null);
  const opponentCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const helpButtonRef = useRef<HTMLButtonElement | null>(null);
  const helpDialogRef = useRef<HTMLDivElement | null>(null);
  const helpCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const gridRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const attackCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const selectedTargetIdRef = useRef<string | null>(selectedTargetId);
  const selectedTargetNameRef = useRef("No target selected");
  const disabledRef = useRef(disabled);
  const onSuccessfulScoreRef = useRef(onSuccessfulScore);
  const soloRef = useRef(solo);
  const soloSkillFamilyRef = useRef<string | null>(soloSkillFamily);
  const categoryRef = useRef<"beginner" | "advanced" | null>(category);
  const resetSessionRef = useRef<() => void>(() => undefined);
  const reinitCameraRef = useRef<() => void>(() => undefined);
  const sessionReadyRef = useRef(sessionReady);
  const nextEquationRef = useRef<() => void>(() => undefined);
  const animationFrameRef = useRef<number | null>(null);
  const timeoutIdsRef = useRef<number[]>([]);
  const showHowToPlayRef = useRef(false);
  const familiesRef = useRef<EquationFamily[]>([]);
  const equationConfigRef = useRef<EquationConfig | null>(null);
  const [trackingStatus, setTrackingStatus] = useState("Setting up...");
  const [cameraBlocked, setCameraBlocked] = useState(false);
  const [scoreDisplay, setScoreDisplay] = useState("");
  const [equationMarkup, setEquationMarkup] = useState("");
  const [localError, setLocalError] = useState("");
  const [lockedTargetId, setLockedTargetId] = useState<string | null>(null);
  const [learnMode, setLearnMode] = useState(Boolean(solo));
  const learnModeRef = useRef(Boolean(solo));
  const redrawGridRef = useRef<() => void>(() => undefined);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const {
    primaryHand,
    source: primaryHandSource,
    ready: primaryHandReady,
    saving: savingPrimaryHand,
    error: primaryHandError,
    savePrimaryHand,
  } = usePrimaryHandPreference(sessionUser, sessionReady);
  const primaryHandReadyRef = useRef(primaryHandReady);

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
    soloRef.current = solo;
  }, [solo]);

  useEffect(() => {
    soloSkillFamilyRef.current = soloSkillFamily;
  }, [soloSkillFamily]);

  useEffect(() => {
    categoryRef.current = category;
  }, [category]);

  useEffect(() => {
    const wasReady = sessionReadyRef.current && primaryHandReadyRef.current;
    sessionReadyRef.current = sessionReady;
    primaryHandReadyRef.current = primaryHandReady;
    // If we just became ready and the camera hasn't started yet, kick it
    if (!wasReady && sessionReady && primaryHandReady && primaryHand) {
      reinitCameraRef.current();
    }
  }, [sessionReady, primaryHandReady, primaryHand]);

  useEffect(() => {
    if (!solo || !familiesRef.current.length) {
      return;
    }

    resetSessionRef.current();
    nextEquationRef.current();
  }, [solo, soloSkillFamily]);

  useEffect(() => {
    if (!sessionReady || !primaryHandReady) {
      setTrackingStatus("Loading your hand-tracking setup...");
      return;
    }

    if (!primaryHand) {
      setTrackingStatus("Choose your primary hand to start hand tracking.");
    }
  }, [primaryHand, primaryHandReady, sessionReady]);

  useEffect(() => {
    showHowToPlayRef.current = showHowToPlay;
  }, [showHowToPlay]);

  useEffect(() => {
    if (!showHowToPlay) {
      return;
    }

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = helpDialogRef.current;
    const preferredFocusTarget = helpCloseButtonRef.current ?? dialog;

    preferredFocusTarget?.focus();

    function getFocusableElements() {
      if (!dialog) {
        return [];
      }

      return Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("disabled"));
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowHowToPlay(false);
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusable = getFocusableElements();

      if (!focusable.length) {
        event.preventDefault();
        dialog?.focus();
        return;
      }

      const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
      const goingBackward = event.shiftKey;
      const nextIndex =
        currentIndex === -1
          ? goingBackward
            ? focusable.length - 1
            : 0
          : goingBackward
            ? (currentIndex - 1 + focusable.length) % focusable.length
            : (currentIndex + 1) % focusable.length;

      event.preventDefault();
      focusable[nextIndex]?.focus();
    }

    function restoreFocus() {
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus();
        return;
      }

      helpButtonRef.current?.focus();
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      restoreFocus();
    };
  }, [showHowToPlay]);

  useEffect(() => {
    const video = videoRef.current!;
    const gridCanvas = gridRef.current;
    const drawCanvas = drawingRef.current;
    const overlayCanvas = overlayRef.current;
    const attackCanvas = attackCanvasRef.current!;
    const battleContainer = containerRef.current!;
    const targetContainer = opponentContainerRef.current;

    if (
      !video ||
      !gridCanvas ||
      !drawCanvas ||
      !overlayCanvas ||
      !attackCanvas ||
      !battleContainer
    ) {
      return;
    }

    if (!sessionReadyRef.current || !primaryHandReadyRef.current) {
      return;
    }

    if (!primaryHand) {
      return;
    }

    const trackedHand = primaryHand;
    const nonDominantHand: HandLabel = trackedHand === "Left" ? "Right" : "Left";

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

    // non-dominant hand powerup collection state
    type ActivePowerup = { id: string; type: string; mx: number; my: number; spawnedAt: number; despawnAt: number };
    const activePowerups: ActivePowerup[] = [];
    let nonDomHover: { powerupId: string; startTime: number } | null = null;
    let powerupFeedback: { text: string; color: string; startTime: number } | null = null;
    const COLLECT_HOVER_MS = 1000;
    const POWERUP_PROXIMITY_PX = 40; // ~0.67 math units — generous for fist/palm
    let nonDomSmoothed: Point | null = null;
    const NON_DOM_EMA = 0.35;

    // bridge socket events into the detect() closure via custom events
    const onPowerupSpawn = (e: Event) => {
      const pu = (e as CustomEvent).detail;
      activePowerups.push(pu);
    };
    const onPowerupDespawn = (e: Event) => {
      const id = (e as CustomEvent).detail;
      const idx = activePowerups.findIndex((p) => p.id === id);
      if (idx >= 0) activePowerups.splice(idx, 1);
    };
    const onPowerupFeedback = (e: Event) => {
      const data = (e as CustomEvent).detail;
      const colorMap: Record<string, string> = {
        healing_potion: "#22cc44",
        multiplier_spell: "#ffd700",
        attack_spell: "#ee3333",
      };
      powerupFeedback = {
        text: data.effectDescription,
        color: colorMap[data.type] ?? "#fff",
        startTime: performance.now(),
      };
    };
    window.addEventListener("powerup:spawn", onPowerupSpawn);
    window.addEventListener("powerup:despawn", onPowerupDespawn);
    window.addEventListener("powerup:feedback", onPowerupFeedback);

    const DEBOUNCE_MS = 125;
    const TRIM_LOOKBACK_MS = 60;
    const EMA_ALPHA = 0.4;

    // --- Smoothing toggle: "ema" or "oneEuro" ---
    const SMOOTHING_MODE: "ema" | "oneEuro" = "oneEuro";

    // One Euro Filter — speed-adaptive smoothing
    // slow movement = heavy smoothing, fast movement = light smoothing
    class OneEuroFilter {
      private minCutoff: number;
      private beta: number;
      private dCutoff: number;
      private xPrev: number | null = null;
      private dxPrev: number = 0;
      private tPrev: number = 0;

      constructor(minCutoff = 1.0, beta = 0.007, dCutoff = 1.0) {
        this.minCutoff = minCutoff;
        this.beta = beta;
        this.dCutoff = dCutoff;
      }

      private alpha(cutoff: number, dt: number) {
        const tau = 1.0 / (2 * Math.PI * cutoff);
        return 1.0 / (1.0 + tau / dt);
      }

      filter(x: number, t: number): number {
        if (this.xPrev === null) {
          this.xPrev = x;
          this.tPrev = t;
          return x;
        }
        const dt = Math.max((t - this.tPrev) / 1000, 0.001); // seconds
        this.tPrev = t;

        // estimate speed
        const dx = (x - this.xPrev) / dt;
        const aD = this.alpha(this.dCutoff, dt);
        const dxSmoothed = aD * dx + (1 - aD) * this.dxPrev;
        this.dxPrev = dxSmoothed;

        // adaptive cutoff based on speed
        const cutoff = this.minCutoff + this.beta * Math.abs(dxSmoothed);
        const a = this.alpha(cutoff, dt);
        const xFiltered = a * x + (1 - a) * this.xPrev;
        this.xPrev = xFiltered;
        return xFiltered;
      }

      reset() {
        this.xPrev = null;
        this.dxPrev = 0;
        this.tPrev = 0;
      }
    }

    const oneEuroFilters: Record<HandLabel, { x: OneEuroFilter; y: OneEuroFilter }> = {
      Left: { x: new OneEuroFilter(), y: new OneEuroFilter() },
      Right: { x: new OneEuroFilter(), y: new OneEuroFilter() },
    };
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

    function registerWhenHelpClosed(action: () => void, delayMs: number) {
      const schedule = (nextDelayMs: number) => {
        registerTimeout(
          window.setTimeout(() => {
            if (cancelled) {
              return;
            }

            if (showHowToPlayRef.current) {
              schedule(180);
              return;
            }

            action();
          }, nextDelayMs),
        );
      };

      schedule(delayMs);
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
      if (learnModeRef.current) {
        drawGroundTruth(gridContext, config);
      }
    }

    function redrawCurrentGrid() {
      drawGrid(gridContext);
      if (learnModeRef.current && equationConfigRef.current) {
        drawGroundTruth(gridContext, equationConfigRef.current);
      }
    }

    function chooseNextEquation() {
      // In multiplayer, request equation from server so it controls assignment
      const currentSocket = socket;
      const currentLobbyId = lobbyId;

      if (currentSocket?.connected && currentLobbyId && !soloRef.current) {
        currentSocket.emit(
          "game:request-equation",
          { lobbyId: currentLobbyId },
          (result: any) => {
            if (cancelled) return;

            if (result?.ok && result.data?.equation) {
              const config = equationConfigFromDescriptor(result.data.equation);
              setLocalError("");
              renderEquation(config);
              setScoreDisplay("");
            } else {
              setLocalError("Could not load a new equation. Try clicking New Equation.");
            }
          },
        );
        return;
      }

      // Pick locally with category/skill family filter
      const families = familiesRef.current;

      if (!families.length) {
        return;
      }

      const filteredFamilies = filterEquationFamilies(families, {
        skillFamily: soloSkillFamilyRef.current,
        category: categoryRef.current,
      });

      if (!filteredFamilies.length) {
        setLocalError(
          soloSkillFamilyRef.current
            ? `No equations available for ${soloSkillFamilyRef.current.includes(',') ? 'the selected families' : formatSkillFamilyLabel(soloSkillFamilyRef.current)}.`
            : "No equations available for this difficulty.",
        );
        return;
      }

      setLocalError("");
      renderEquation(selectRandomEquation(filteredFamilies));
      setScoreDisplay("");
    }

    function resetTrackingState(label: HandLabel) {
      wasDrawing[label] = false;
      rawDrawing[label] = false;
      rawChangeTime[label] = 0;
      stableDrawing[label] = false;
      trailHistory[label] = [];
      smoothed[label] = null;
      oneEuroFilters[label].x.reset();
      oneEuroFilters[label].y.reset();
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
      registerWhenHelpClosed(() => {
        if (cancelled) {
          return;
        }

        resetSession();
        chooseNextEquation();
      }, delayMs);
    }

    function launchAttack(score: number) {
      if (score < 50 || !targetContainer) {
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

      // shape debug overlay (cyan/magenta) — solo mode only
      if (shapeDebugData && soloRef.current) {
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
      // only draw the index finger tip circle — no skeleton
      const tip = landmarks[8];
      if (!tip) return;

      const x = tip.x * VIDEO_WIDTH - DRAW_OFFSET_X;
      const y = tip.y * VIDEO_HEIGHT - DRAW_OFFSET_Y;

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

      await new Promise<void>((resolve) => {
        runtimeVideo.addEventListener("loadeddata", () => resolve(), { once: true });
        runtimeVideo.play().catch(() => resolve());
      });

      setTrackingStatus(
        `Tracking your ${formatPrimaryHandLabel(trackedHand).toLowerCase()}. Draw with your index finger, then hold an open palm to grade.`,
      );
    }

    function detect() {
      if (cancelled || !handLandmarker) {
        return;
      }

      const now = performance.now();

      if (showHowToPlayRef.current) {
        openPalmDetected = false;
        openPalmStart = 0;
        overlayContext.clearRect(0, 0, DRAW_WIDTH, DRAW_HEIGHT);
        animationFrameRef.current = window.requestAnimationFrame(detect);
        return;
      }

      updateAndDrawAttack();

      if (
        runtimeVideo.currentTime === lastVideoTime ||
        runtimeVideo.videoWidth === 0 ||
        runtimeVideo.videoHeight === 0
      ) {
        animationFrameRef.current = window.requestAnimationFrame(detect);
        return;
      }

      lastVideoTime = runtimeVideo.currentTime;

      let results;
      try {
        results = handLandmarker.detectForVideo(runtimeVideo, now);
      } catch {
        // Video element may be in a transient bad state (e.g. after strict-mode
        // remount).  Skip this frame rather than killing the detection loop.
        animationFrameRef.current = window.requestAnimationFrame(detect);
        return;
      }

      gestureFrameCount += 1;

      if (gestureRecognizer && gestureFrameCount % 3 === 0) {
        try {
          const gestureResults = gestureRecognizer.recognizeForVideo(runtimeVideo, now + 0.1);
          let palmNow = false;

          for (let gestureIndex = 0; gestureIndex < (gestureResults.gestures?.length ?? 0); gestureIndex += 1) {
            const gestureList = gestureResults.gestures?.[gestureIndex] ?? [];
            const gestureHand =
              gestureResults.handedness?.[gestureIndex]?.[0]?.categoryName ??
              gestureResults.handednesses?.[gestureIndex]?.[0]?.categoryName;

            if (gestureHand !== trackedHand) {
              continue;
            }

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

      // Keep refreshing the countdown start while there's nothing to grade.
      // This prevents stale openPalmStart from triggering an instant score
      // after scheduleNextRound resets the session and clears the drawing.
      if (openPalmDetected && openPalmStart > 0 && !hasDrawing) {
        openPalmStart = now;
      }

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

        if (soloRef.current) {
          // Solo mode: just show the score, no attack logic
          if (score.total >= 50) {
            setTrackingStatus(`Nice trace! You scored ${score.total}%.`);
          } else {
            setTrackingStatus(`Score: ${score.total}%. Try to get above 50%!`);
          }
          setLocalError("");
        } else if (score.total >= 50 && selectedTargetIdRef.current && !disabledRef.current) {
          const targetUserId = selectedTargetIdRef.current;
          const targetName = selectedTargetNameRef.current;

          setLockedTargetId(targetUserId);
          // Launch attack after 900ms delay to let the count-up animation finish first,
          // matching the original computervision/index.html timing.
          registerWhenHelpClosed(() => {
            if (cancelled) {
              return;
            }

            launchAttack(score.total);
          }, 900);
          registerWhenHelpClosed(() => {
            if (cancelled) {
              return;
            }

            void onSuccessfulScoreRef
              .current(targetUserId, { Left: [...trails.Left], Right: [...trails.Right] })
              .then((serverScore) => {
                if (!cancelled) {
                  setLocalError("");
                  const displayTotal = serverScore?.total ?? score.total;
                  setScoreDisplay(
                    `Score: ${displayTotal} (Shape: ${serverScore?.shape ?? score.shape}, Pos: ${serverScore?.position ?? score.position})`,
                  );
                  setTrackingStatus(
                    `Graph cast landed on ${targetName} with a ${displayTotal}% score.`,
                  );
                }
              })
              .catch((error: unknown) => {
                if (!cancelled) {
                  setLocalError(
                    error instanceof Error
                      ? error.message
                      : "Your spell failed to connect. Try again!",
                  );
                }
              });
          }, 900);
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

      // --- render powerups on overlay ---
      const nowMs = Date.now();
      for (const pu of activePowerups) {
        // mirror x for overlay canvas (CSS scaleX(-1))
        const puGridX = graphConfig.centerX + pu.mx * graphConfig.pxPerUnit;
        const puGridY = graphConfig.centerY - pu.my * graphConfig.pxPerUnit;
        const puX = DRAW_WIDTH - puGridX;
        const puY = puGridY;

        // blink when < 3 seconds remaining
        const timeLeft = pu.despawnAt - nowMs;
        if (timeLeft < 3000 && Math.floor(nowMs / 300) % 2 === 1) continue;

        // pulsing glow
        const pulse = 0.7 + 0.3 * Math.sin(now / 300);
        overlayContext.save();
        overlayContext.globalAlpha = pulse;

        if (pu.type === "healing_potion") {
          // green circle + white cross
          overlayContext.fillStyle = "#22cc44";
          overlayContext.beginPath();
          overlayContext.arc(puX, puY, 14, 0, Math.PI * 2);
          overlayContext.fill();
          overlayContext.strokeStyle = "#fff";
          overlayContext.lineWidth = 3;
          overlayContext.beginPath();
          overlayContext.moveTo(puX - 6, puY); overlayContext.lineTo(puX + 6, puY);
          overlayContext.moveTo(puX, puY - 6); overlayContext.lineTo(puX, puY + 6);
          overlayContext.stroke();
        } else if (pu.type === "multiplier_spell") {
          // gold diamond
          overlayContext.fillStyle = "#ffd700";
          overlayContext.beginPath();
          overlayContext.moveTo(puX, puY - 14);
          overlayContext.lineTo(puX + 10, puY);
          overlayContext.lineTo(puX, puY + 14);
          overlayContext.lineTo(puX - 10, puY);
          overlayContext.closePath();
          overlayContext.fill();
          overlayContext.fillStyle = "#fff";
          overlayContext.font = "bold 11px system-ui";
          overlayContext.textAlign = "center";
          overlayContext.textBaseline = "middle";
          overlayContext.fillText("×", puX, puY + 1);
        } else {
          // red circle + lightning
          overlayContext.fillStyle = "#ee3333";
          overlayContext.beginPath();
          overlayContext.arc(puX, puY, 14, 0, Math.PI * 2);
          overlayContext.fill();
          overlayContext.fillStyle = "#fff";
          overlayContext.font = "bold 16px system-ui";
          overlayContext.textAlign = "center";
          overlayContext.textBaseline = "middle";
          overlayContext.fillText("⚡", puX, puY + 1);
        }

        // collection progress arc
        if (nonDomHover && nonDomHover.powerupId === pu.id) {
          const progress = Math.min(1, (now - nonDomHover.startTime) / COLLECT_HOVER_MS);
          overlayContext.strokeStyle = "#fff";
          overlayContext.lineWidth = 3;
          overlayContext.beginPath();
          overlayContext.arc(puX, puY, 20, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
          overlayContext.stroke();
        }

        overlayContext.restore();
      }

      // --- powerup feedback text ---
      if (powerupFeedback) {
        const feedbackElapsed = now - powerupFeedback.startTime;
        if (feedbackElapsed > 1500) {
          powerupFeedback = null;
        } else {
          const alpha = 1 - feedbackElapsed / 1500;
          overlayContext.save();
          overlayContext.scale(-1, 1);
          overlayContext.globalAlpha = alpha;
          overlayContext.font = "bold 36px system-ui";
          overlayContext.fillStyle = powerupFeedback.color;
          overlayContext.shadowColor = powerupFeedback.color;
          overlayContext.shadowBlur = 15;
          overlayContext.textAlign = "center";
          overlayContext.textBaseline = "middle";
          overlayContext.fillText(powerupFeedback.text, -320, 160);
          overlayContext.shadowBlur = 0;
          overlayContext.globalAlpha = 1;
          overlayContext.restore();
        }
      }

      const handsPresent: Record<HandLabel, boolean> = { Left: false, Right: false };

      let nonDominantPos: Point | null = null;

      if (results.landmarks) {
        // --- non-dominant hand extraction (powerup collection, fully separate from drawing) ---
        if (activePowerups.length > 0) {
          let bestNonDomIndex = -1;
          let bestNonDomSize = 0;
          for (let i = 0; i < results.landmarks.length; i += 1) {
            const label = results.handednesses[i]?.[0]?.categoryName;
            if (label !== nonDominantHand) continue;
            const size = dist(results.landmarks[i]![0]!, results.landmarks[i]![9]!);
            if (size > bestNonDomSize) { bestNonDomSize = size; bestNonDomIndex = i; }
          }
          if (bestNonDomIndex >= 0) {
            const lm = results.landmarks[bestNonDomIndex]!;
            // use palm center (avg of wrist + MCP joints) — stable even in a fist
            const palmX = (lm[0]!.x + lm[5]!.x + lm[9]!.x + lm[13]!.x + lm[17]!.x) / 5;
            const palmY = (lm[0]!.y + lm[5]!.y + lm[9]!.y + lm[13]!.y + lm[17]!.y) / 5;
            let rawX = palmX * VIDEO_WIDTH - DRAW_OFFSET_X;
            let rawY = palmY * VIDEO_HEIGHT - DRAW_OFFSET_Y;
            // EMA smoothing to prevent jitter
            if (nonDomSmoothed) {
              rawX = nonDomSmoothed.x + NON_DOM_EMA * (rawX - nonDomSmoothed.x);
              rawY = nonDomSmoothed.y + NON_DOM_EMA * (rawY - nonDomSmoothed.y);
            }
            nonDomSmoothed = { x: rawX, y: rawY };
            nonDominantPos = nonDomSmoothed;
          } else {
            nonDomSmoothed = null; // reset when hand not found
          }
        }

        // --- primary hand: filter background hands, keep only largest ---
        let bestHandIndex = -1;
        let bestHandSize = 0;

        for (let handIndex = 0; handIndex < results.landmarks.length; handIndex += 1) {
          const label = results.handednesses[handIndex]?.[0]?.categoryName;
          if (label !== trackedHand) continue;
          const lm = results.landmarks[handIndex]!;
          const size = dist(lm[0]!, lm[9]!);
          if (size > bestHandSize) {
            bestHandSize = size;
            bestHandIndex = handIndex;
          }
        }

        for (let handIndex = 0; handIndex < results.landmarks.length; handIndex += 1) {
          const label = results.handednesses[handIndex]?.[0]?.categoryName as HandLabel | undefined;

          if (label !== "Left" && label !== "Right") {
            continue;
          }

          // skip non-tracked hand or smaller duplicate hands
          if (label !== trackedHand || (label === trackedHand && handIndex !== bestHandIndex)) {
            if (wasDrawing[label]) {
              trails[label].push(null);
            }

            resetTrackingState(label);
            continue;
          }

          handsPresent[label] = true;
          const landmarks = results.landmarks[handIndex] ?? [];
          const drawing = checkDrawing(landmarks);
          let x = landmarks[8]!.x * VIDEO_WIDTH - DRAW_OFFSET_X;
          let y = landmarks[8]!.y * VIDEO_HEIGHT - DRAW_OFFSET_Y;

          // smoothing: toggle between EMA and One Euro Filter
          if (SMOOTHING_MODE === "oneEuro") {
            x = oneEuroFilters[label].x.filter(x, now);
            y = oneEuroFilters[label].y.filter(y, now);
          } else {
            if (smoothed[label]) {
              x = smoothed[label]!.x + EMA_ALPHA * (x - smoothed[label]!.x);
              y = smoothed[label]!.y + EMA_ALPHA * (y - smoothed[label]!.y);
            }
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

      // --- powerup hover detection (non-dominant hand) ---
      if (nonDominantPos && activePowerups.length > 0) {
        let hovering: ActivePowerup | null = null;
        for (const pu of activePowerups) {
          // convert powerup math coords to draw-canvas pixel coords (mirrored)
          const puPx = DRAW_WIDTH - (graphConfig.centerX + pu.mx * graphConfig.pxPerUnit);
          const puPy = graphConfig.centerY - pu.my * graphConfig.pxPerUnit;
          const dx = nonDominantPos.x - puPx;
          const dy = nonDominantPos.y - puPy;
          if (Math.sqrt(dx * dx + dy * dy) < POWERUP_PROXIMITY_PX) {
            hovering = pu;
            break;
          }
        }

        if (hovering) {
          if (nonDomHover && nonDomHover.powerupId === hovering.id) {
            // same powerup — check if held long enough
            if (now - nonDomHover.startTime >= COLLECT_HOVER_MS && socket?.connected) {
              socket.emit("powerup:collect", { lobbyId, powerupId: hovering.id });
              nonDomHover = null;
            }
          } else {
            nonDomHover = { powerupId: hovering.id, startTime: now };
          }
        } else {
          nonDomHover = null;
        }
      } else {
        nonDomHover = null;
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
        setTrackingStatus("Loading equations...");
        const equationResponse = await fetch(apiUrl("/data/advanced_equations.csv"), {
          credentials: "include",
        });

        if (cancelled) return;

        if (!equationResponse.ok) {
          throw new Error(
            "Could not load equations. Please refresh and try again.",
          );
        }

        const equationCsv = await equationResponse.text();
        const families = parseEquationCsv(equationCsv);

        if (!families.length) {
          throw new Error(
            "No equations available. Please refresh and try again.",
          );
        }

        familiesRef.current = families;
        drawGrid(gridContext);
        chooseNextEquation();

        if (cancelled) return;

        setTrackingStatus("Loading hand tracking...");

        const visionModule = await import("@mediapipe/tasks-vision");
        if (cancelled) return;

        const vision = await visionModule.FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm"
        );
        if (cancelled) return;

        handLandmarker = await visionModule.HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: HAND_MODEL_URL,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 2,
        });
        if (cancelled) { handLandmarker.close(); handLandmarker = null; return; }

        gestureRecognizer = await visionModule.GestureRecognizer.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: GESTURE_MODEL_URL,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 2,
        });
        if (cancelled) { gestureRecognizer.close(); gestureRecognizer = null; return; }

        setTrackingStatus("Hand tracking ready. Starting camera...");
        await startCamera();

        if (!cancelled) {
          animationFrameRef.current = window.requestAnimationFrame(detect);
        }
      } catch (error) {
        if (!cancelled) {
          const msg = error instanceof Error ? error.message : "";
          const isDenied =
            msg.includes("Permission denied") ||
            msg.includes("NotAllowedError") ||
            msg.includes("not available");
          setCameraBlocked(isDenied || !navigator.mediaDevices?.getUserMedia);
          setLocalError(
            isDenied
              ? "Camera access was denied. Click the button above to try again."
              : msg || "The graph battle camera could not be initialized.",
          );
          setTrackingStatus("Could not start. Please refresh and try again.");
        }
      }
    }

    resetSessionRef.current = resetSession;
    nextEquationRef.current = () => {
      resetSession();
      chooseNextEquation();
    };
    redrawGridRef.current = redrawCurrentGrid;
    reinitCameraRef.current = () => {
      // Full teardown before re-init
      cancelled = true;
      clearRegisteredTimeouts();

      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      handLandmarker?.close();
      handLandmarker = null;
      gestureRecognizer?.close();
      gestureRecognizer = null;

      for (const track of stream?.getTracks() ?? []) {
        track.stop();
      }
      stream = null;
      runtimeVideo.srcObject = null;

      // Reset state and re-run
      cancelled = false;
      lastVideoTime = -1;
      openPalmDetected = false;
      openPalmStart = 0;
      palmScored = false;
      gestureFrameCount = 0;
      resetSession();

      setCameraBlocked(false);
      setLocalError("");
      setTrackingStatus("Retrying...");
      void init();
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
      window.removeEventListener("powerup:spawn", onPowerupSpawn);
      window.removeEventListener("powerup:despawn", onPowerupDespawn);
      window.removeEventListener("powerup:feedback", onPowerupFeedback);
      handLandmarker?.close();
      gestureRecognizer?.close();

      for (const track of stream?.getTracks() ?? []) {
        track.stop();
      }

      runtimeVideo.srcObject = null;
    };
    // Only restart the camera pipeline when the tracked hand changes.
    // sessionReady and primaryHandReady changes should NOT tear down the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryHand]);

  // Frame streaming: capture composite frames and send to opponent via socket
  useEffect(() => {
    if (!socket || !lobbyId || solo) {
      return;
    }

    const video = videoRef.current;
    const drawCanvas = drawingRef.current;
    const gridCanvas = gridRef.current;
    const overlayCanvas = overlayRef.current;
    const opponentCanvas = opponentCanvasRef.current;

    if (!video || !drawCanvas || !gridCanvas || !overlayCanvas || !opponentCanvas) {
      return;
    }

    const opponentCtx = opponentCanvas.getContext("2d");

    if (!opponentCtx) {
      return;
    }

    // Offscreen canvas for compositing outgoing frames
    const offscreen = document.createElement("canvas");
    offscreen.width = 320;
    offscreen.height = 240;
    const offCtx = offscreen.getContext("2d")!;

    // Proportional mapping from 860x620 video space to 320x240 thumbnail
    const subX = (DRAW_OFFSET_X / VIDEO_WIDTH) * 320;
    const subY = (DRAW_OFFSET_Y / VIDEO_HEIGHT) * 240;
    const subW = (DRAW_WIDTH / VIDEO_WIDTH) * 320;
    const subH = (DRAW_HEIGHT / VIDEO_HEIGHT) * 240;

    // Capture and emit composite frame every 250ms (~4fps)
    const captureInterval = window.setInterval(() => {
      if (!video.srcObject || video.readyState < 2) {
        return;
      }

      offCtx.clearRect(0, 0, 320, 240);

      // Draw mirrored video (match what the player sees)
      offCtx.save();
      offCtx.translate(320, 0);
      offCtx.scale(-1, 1);
      offCtx.drawImage(video, 0, 0, 320, 240);
      offCtx.restore();

      // Draw grid, trails, and overlay in the sub-region (also mirrored)
      offCtx.save();
      offCtx.translate(subX + subW, subY);
      offCtx.scale(-1, 1);
      offCtx.drawImage(gridCanvas, 0, 0, DRAW_WIDTH, DRAW_HEIGHT, 0, 0, subW, subH);
      offCtx.restore();

      offCtx.save();
      offCtx.translate(subX + subW, subY);
      offCtx.scale(-1, 1);
      offCtx.drawImage(drawCanvas, 0, 0, DRAW_WIDTH, DRAW_HEIGHT, 0, 0, subW, subH);
      offCtx.restore();

      offCtx.save();
      offCtx.translate(subX + subW, subY);
      offCtx.scale(-1, 1);
      offCtx.drawImage(overlayCanvas, 0, 0, DRAW_WIDTH, DRAW_HEIGHT, 0, 0, subW, subH);
      offCtx.restore();

      const frame = offscreen.toDataURL("image/jpeg", 0.35);
      socket.volatile.emit("game:frame", { lobbyId, frame });
    }, 250);

    // Receive opponent frames — only render frames from the currently selected opponent
    const handleFrame = ({ userId, frame }: { userId: string; frame: string }) => {
      const targetId = selectedTargetIdRef.current;
      if (targetId && userId !== targetId) {
        return;
      }

      const img = new Image();
      img.onload = () => {
        opponentCtx.clearRect(0, 0, opponentCanvas.width, opponentCanvas.height);
        opponentCtx.drawImage(img, 0, 0, opponentCanvas.width, opponentCanvas.height);
      };
      img.src = frame;
    };

    socket.on("game:frame", handleFrame);

    return () => {
      window.clearInterval(captureInterval);
      socket.off("game:frame", handleFrame);
    };
  }, [socket, lobbyId, solo]);

  // --- powerup socket listeners ---
  useEffect(() => {
    if (!socket || solo) return;

    const handleSpawn = (data: { powerup: { id: string; type: string; mx: number; my: number; spawnedAt: number; despawnAt: number } }) => {
      // push into the mutable activePowerups array inside the detect() closure
      // we use a custom event to bridge into the animation frame loop
      window.dispatchEvent(new CustomEvent("powerup:spawn", { detail: data.powerup }));
    };

    const handleDespawn = (data: { powerupId: string }) => {
      window.dispatchEvent(new CustomEvent("powerup:despawn", { detail: data.powerupId }));
    };

    const handleCollected = (data: { powerupId: string; userId: string; type: string; effectDescription: string }) => {
      window.dispatchEvent(new CustomEvent("powerup:despawn", { detail: data.powerupId }));
      // Only show the feedback animation for the player who collected it
      if (data.userId === currentPlayer.userId) {
        window.dispatchEvent(new CustomEvent("powerup:feedback", { detail: data }));
      }
    };

    socket.on("powerup:spawn", handleSpawn);
    socket.on("powerup:despawn", handleDespawn);
    socket.on("powerup:collected", handleCollected);

    return () => {
      socket.off("powerup:spawn", handleSpawn);
      socket.off("powerup:despawn", handleDespawn);
      socket.off("powerup:collected", handleCollected);
    };
  }, [socket, solo]);

  const selectedOpponentHealth = selectedOpponent
    ? Math.round(getHealthPercent(lobbyMatch, selectedOpponent.userId))
    : 0;

  return (
    <section className={styles.cvPanel}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.label}>{solo ? "Solo Practice" : "Graph Battle"}</p>
          <h2>{solo ? "Trace the equation to score points" : "Trace the equation to cast damage"}</h2>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            type="button"
            className={styles.helpButton}
            aria-label="How to play"
            ref={helpButtonRef}
            onClick={() => setShowHowToPlay(true)}
          >
            ?
          </button>
          {primaryHand ? (
            <span className={styles.state}>
              Tracking {formatPrimaryHandLabel(primaryHand)}
            </span>
          ) : null}
          {solo && soloSkillFamily ? (
            <SkillFamilyBadge skillFamily={soloSkillFamily} />
          ) : null}
          {cameraBlocked ? (
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => reinitCameraRef.current()}
            >
              Retry Camera
            </button>
          ) : null}
          {!solo && (
            <span className={styles.state}>{selectedOpponent ? "Target locked" : "No target"}</span>
          )}
        </div>
      </div>

      {!sessionReady || !primaryHandReady || !primaryHand ? (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalCard} style={{ maxWidth: 480, height: "auto", alignContent: "center" }}>
            <p className={styles.label}>Primary hand required</p>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 40px)", lineHeight: 0.95, letterSpacing: "-0.04em" }}>Which hand should we track?</h2>
            <p className={styles.muted}>
              {sessionReady
                ? "Pick your drawing hand. We will ignore input from the other one."
                : "Loading..."}
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {(["Left", "Right"] as const).map((option) => {
                const isSelected = primaryHand === option;

                return (
                  <button
                    key={option}
                    type="button"
                    className={isSelected ? styles.attackButton : styles.linkButton}
                    onClick={() => void savePrimaryHand(option)}
                    disabled={!sessionReady || savingPrimaryHand}
                  >
                    {savingPrimaryHand && isSelected
                      ? "Saving..."
                      : isSelected
                        ? `${formatPrimaryHandLabel(option)} selected`
                        : `Use ${formatPrimaryHandLabel(option)}`}
                  </button>
                );
              })}
            </div>
            {primaryHandError ? <p className={styles.error}>{primaryHandError}</p> : null}
          </div>
        </div>
      ) : null}
      {(sessionReady && primaryHandReady && primaryHand) ? (
        <>
          <div className={solo ? styles.cvBattleLayoutSolo : styles.cvBattleLayout}>
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

            {solo ? (
              <div
                className={styles.cvEquation}
                dangerouslySetInnerHTML={{
                  __html:
                    equationMarkup ||
                    katex.renderToString("y = x", { throwOnError: false, displayMode: true }),
                }}
              />
            ) : (
              <div className={styles.cvSideColumn}>
                <div ref={opponentContainerRef} className={styles.cvOpponent}>
                  <canvas
                    ref={opponentCanvasRef}
                    width={320}
                    height={240}
                    style={{
                      width: "100%",
                      height: "auto",
                      borderRadius: 12,
                      background: "#0a0a1a",
                      display: "block",
                    }}
                  />
                  <div className={styles.cvOpponentCard}>
                    {selectedOpponent ? (
                      <>
                        <strong>{formatPlayerName(selectedOpponent)}</strong>
                        <div className={styles.healthTrack} aria-hidden="true">
                          <div className={styles.healthFill} style={{ width: `${selectedOpponentHealth}%` }} />
                        </div>
                      </>
                    ) : (
                      <span className={styles.meta}>Waiting for opponent...</span>
                    )}
                  </div>
                  {lobbyMatch ? (() => {
                    const myMatch = lobbyMatch.players.find((p) => p.userId === currentPlayer.userId);
                    if (!myMatch) return null;
                    const myHealthPct = Math.max(0, Math.min(100, (myMatch.health / lobbyMatch.maxHealth) * 100));
                    return (
                      <div className={styles.cvOpponentCard}>
                        <strong>{formatPlayerName(currentPlayer)} (You)</strong>
                        <div className={styles.healthTrack} aria-hidden="true">
                          <div className={styles.healthFill} style={{ width: `${myHealthPct}%` }} />
                        </div>
                      </div>
                    );
                  })() : null}
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
            )}
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

          {solo ? (
            <div className={styles.cvLearnToggle}>
              <label className={styles.toggleLabel}>
                <span>Learn Mode</span>
                <button
                  type="button"
                  className={styles.toggleSwitch}
                  role="switch"
                  aria-checked={learnMode}
                  onClick={() => {
                    const next = !learnMode;
                    setLearnMode(next);
                    learnModeRef.current = next;
                    redrawGridRef.current();
                  }}
                >
                  <span
                    className={styles.toggleKnob}
                    style={{ transform: learnMode ? "translateX(20px)" : "translateX(0)" }}
                  />
                </button>
              </label>
              <span className={styles.learnInfo}>
                i
                <span className={styles.learnTooltip}>
                  ON: the correct graph is shown as a guide while you trace. OFF: you draw from the equation alone.
                </span>
              </span>
            </div>
          ) : null}

          <p className={styles.muted}>
            {solo && isSoloGuestPlayer(currentPlayer)
              ? `${trackingStatus} Practicing as ${formatPlayerName(currentPlayer)}.`
              : `${trackingStatus} Signed in as ${formatPlayerName(currentPlayer)}.`}
          </p>
          {primaryHandError ? <p className={styles.error}>{primaryHandError}</p> : null}
          {localError ? <p className={styles.error}>{localError}</p> : null}
          {cameraBlocked ? (
            <p className={styles.muted} style={{ fontSize: 13, lineHeight: 1.5 }}>
              Make sure your browser has camera permission enabled.
              On macOS, check System Settings &gt; Privacy &amp; Security &gt; Camera.
            </p>
          ) : null}
        </>
      ) : null}

      {showHowToPlay ? (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onClick={() => setShowHowToPlay(false)}
        >
          <div
            className={styles.modalCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="graph-battle-help-title"
            tabIndex={-1}
            ref={helpDialogRef}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.label}>How To Play</p>
                <h2 id="graph-battle-help-title">Use simple hand shapes to cast</h2>
              </div>
              <button
                type="button"
                className={styles.modalCloseButton}
                aria-label="Close how to play"
                ref={helpCloseButtonRef}
                onClick={() => setShowHowToPlay(false)}
              >
                Close
              </button>
            </div>

            <p className={styles.copy}>
              Keep your chosen hand in view of the camera. The game only listens to
              a few gestures while you trace.
            </p>

            <div className={styles.helpStepGrid}>
              <article className={styles.helpStepCard}>
                <div className={styles.helpStepIcon} aria-hidden="true">
                  ☝️
                </div>
                <div className={styles.helpStepBody}>
                  <strong>Point with your index finger to draw</strong>
                  <p className={styles.muted}>
                    Trace the graph with one pointed index finger. That is the only
                    hand shape that adds to your drawing path.
                  </p>
                </div>
              </article>

              <article className={styles.helpStepCard}>
                <div className={styles.helpStepIconGroup} aria-hidden="true">
                  <span className={styles.helpStepIcon}>✊</span>
                  <span className={styles.helpStepIcon}>✌️</span>
                </div>
                <div className={styles.helpStepBody}>
                  <strong>Fists and peace signs do nothing</strong>
                  <p className={styles.muted}>
                    If your hand is closed or making a peace sign, the game ignores
                    it. Those shapes will not draw and will not submit your answer.
                  </p>
                </div>
              </article>

              <article className={styles.helpStepCard}>
                <div className={styles.helpStepIcon} aria-hidden="true">
                  🖐️
                </div>
                <div className={styles.helpStepBody}>
                  <strong>Show an open palm to finish</strong>
                  <p className={styles.muted}>
                    Turn your palm toward the camera when you are done drawing. That
                    starts grading and tells the game to score your trace.
                  </p>
                </div>
              </article>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
