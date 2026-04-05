"use client";

import Particles, { initParticlesEngine } from "@tsparticles/react";
import type { ISourceOptions } from "@tsparticles/engine";
import { loadFull } from "tsparticles";
import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

type Side = "left" | "right";

type EffectLifetimeWindow = {
  cleanupDuration: number;
  emissionDuration: number;
  particleLifetimeMax: number;
  particleLifetimeMin: number;
};

type DamageEffect = EffectLifetimeWindow & {
  drift: number;
  gravity: number;
  id: string;
  quantity: number;
  side: Side;
  speed: number;
  spread: number;
  x: number;
  y: number;
};

type SpellEffect = EffectLifetimeWindow & {
  drift: number;
  id: string;
  pullSize: number;
  quantity: number;
  source: Side;
  speed: number;
  spread: number;
  targetY: number;
  wobble: number;
  y: number;
};

type SwirlEffect = EffectLifetimeWindow & {
  id: string;
  quantity: number;
  radius: number;
  side: Side;
  speed: number;
  wobble: number;
};

type TeamPanelProps = {
  side: Side;
  label: string;
  subtitle: string;
  callout: string;
  engineReady: boolean;
  damageEffects: DamageEffect[];
  onCastSpell: () => void;
  onDamage: () => void;
  onSwirl: () => void;
  swirlEffects: SwirlEffect[];
};

const MAX_EFFECT_MS = 4_600;
const EFFECT_END_BUFFER_MS = 180;
const SPELL_COLOR_PALETTE = [
  "#ff4f5e",
  "#ff7a45",
  "#ffc56b",
  "#6bc8ff",
  "#4f7cff",
  "#7b6dff",
];

const randomBetween = (min: number, max: number) =>
  Math.round(Math.random() * (max - min) + min);

const randomFloat = (min: number, max: number) =>
  Number((Math.random() * (max - min) + min).toFixed(2));

const millisecondsToSeconds = (value: number) => Number((value / 1000).toFixed(2));

const makeId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const createLifetimeWindow = ({
  emissionMin,
  particleLifetimeMax,
  particleLifetimeMin,
  sequenceMaxDuration,
}: {
  emissionMin: number;
  particleLifetimeMax: number;
  particleLifetimeMin: number;
  sequenceMaxDuration: number;
}): EffectLifetimeWindow => {
  const emissionMax = Math.max(
    emissionMin,
    sequenceMaxDuration - particleLifetimeMax - EFFECT_END_BUFFER_MS,
  );
  const emissionDuration = randomBetween(emissionMin, emissionMax);

  return {
    cleanupDuration: emissionDuration + particleLifetimeMax + EFFECT_END_BUFFER_MS,
    emissionDuration,
    particleLifetimeMax,
    particleLifetimeMin,
  };
};

const createParticleLife = (effect: EffectLifetimeWindow) => ({
  count: 1,
  delay: {
    sync: true,
    value: 0,
  },
  duration: {
    sync: false,
    value: {
      max: millisecondsToSeconds(effect.particleLifetimeMax),
      min: millisecondsToSeconds(effect.particleLifetimeMin),
    },
  },
});

function createDamageOptions(effect: DamageEffect): ISourceOptions {
  return {
    autoPlay: true,
    detectRetina: true,
    fpsLimit: 120,
    fullScreen: { enable: false },
    background: { color: "transparent" },
    emitters: {
      autoPlay: true,
      direction: "bottom",
      fill: true,
      life: {
        count: 1,
        duration: millisecondsToSeconds(effect.emissionDuration),
        wait: false,
      },
      position: { x: effect.x, y: effect.y },
      rate: {
        delay: 0.08,
        quantity: effect.quantity,
      },
      shape: {
        options: {},
        replace: false,
        type: "square",
      },
      size: {
        height: 18,
        mode: "percent",
        width: effect.spread,
      },
      startCount: 0,
    },
    interactivity: {
      events: {
        onClick: { enable: false, mode: [] },
        onHover: { enable: false, mode: [] },
        resize: { enable: true },
      },
      modes: {},
    },
    particles: {
      color: {
        value: ["#ff123f", "#ff4d29", "#ff6f3f", "#ff995c"],
      },
      move: {
        decay: { min: 0.01, max: 0.05 },
        direction: "bottom",
        drift: effect.drift,
        enable: true,
        gravity: {
          acceleration: effect.gravity,
          enable: true,
          inverse: false,
          maxSpeed: effect.speed * 2.8,
        },
        outModes: {
          default: "destroy",
        },
        random: true,
        speed: { min: effect.speed * 0.65, max: effect.speed },
        straight: false,
      },
      life: createParticleLife(effect),
      number: {
        value: 0,
      },
      opacity: {
        animation: {
          destroy: "min",
          enable: true,
          speed: 1.8,
          startValue: "max",
        },
        value: { min: 0.14, max: 0.82 },
      },
      roll: {
        darken: { enable: true, value: 22 },
        enable: true,
        enlighten: { enable: false, value: 0 },
        mode: "vertical",
        speed: { min: 10, max: 22 },
      },
      shadow: {
        blur: 0,
        color: "#ff3951",
        enable: false,
        offset: { x: 0, y: 0 },
      },
      shape: {
        type: ["square"],
      },
      size: {
        animation: {
          destroy: "min",
          enable: true,
          speed: 10,
          startValue: "random",
        },
        value: { min: 2, max: 8 },
      },
      wobble: {
        distance: { min: 14, max: 28 },
        enable: true,
        speed: { angle: { min: -10, max: 10 }, move: { min: -6, max: 6 } },
      },
    },
  };
}

function createSpellOptions(effect: SpellEffect): ISourceOptions {
  const direction = effect.source === "left" ? "right" : "left";
  const angle = effect.source === "left" ? 0 : 180;
  const emitterX = effect.source === "left" ? 40 : 60;
  const absorberX = effect.source === "left" ? 74 : 26;

  return {
    autoPlay: true,
    detectRetina: true,
    fpsLimit: 120,
    fullScreen: { enable: false },
    background: { color: "transparent" },
    absorbers: {
      color: {
        value: "#ffd866",
      },
      destroy: true,
      draggable: false,
      opacity: 0,
      orbits: false,
      position: {
        x: absorberX,
        y: effect.targetY,
      },
      size: {
        density: 4,
        limit: {
          mass: 60,
          radius: effect.pullSize * 3,
        },
        value: effect.pullSize,
      },
    },
    emitters: {
      autoPlay: true,
      direction,
      fill: true,
      life: {
        count: 1,
        duration: millisecondsToSeconds(effect.emissionDuration),
        wait: false,
      },
      position: { x: emitterX, y: effect.y },
      rate: {
        delay: 0.1,
        quantity: effect.quantity,
      },
      shape: {
        options: {},
        replace: false,
        type: "square",
      },
      size: {
        height: 34,
        mode: "percent",
        width: 8,
      },
      startCount: randomBetween(1, 2),
    },
    interactivity: {
      events: {
        onClick: { enable: false, mode: [] },
        onHover: { enable: false, mode: [] },
        resize: { enable: true },
      },
      modes: {},
    },
    particles: {
      color: {
        value: SPELL_COLOR_PALETTE,
      },
      links: {
        enable: false,
      },
      move: {
        angle: {
          offset: effect.spread,
          value: angle,
        },
        decay: { min: 0.004, max: 0.02 },
        attract: {
          distance: 220,
          enable: true,
          rotate: {
            x: 780,
            y: 1500,
          },
        },
        direction: "none",
        drift: effect.drift,
        enable: true,
        outModes: {
          default: "destroy",
        },
        random: true,
        speed: { min: effect.speed * 0.65, max: effect.speed },
        straight: false,
      },
      life: createParticleLife(effect),
      number: {
        value: 0,
      },
      opacity: {
        animation: {
          destroy: "min",
          enable: true,
          speed: 0.95,
          startValue: "max",
        },
        value: { min: 0.16, max: 0.7 },
      },
      roll: {
        darken: { enable: false, value: 0 },
        enable: true,
        enlighten: { enable: true, value: 22 },
        mode: "vertical",
        speed: { min: 8, max: 18 },
      },
      shadow: {
        blur: 0,
        color: "#ffe970",
        enable: false,
        offset: { x: 0, y: 0 },
      },
      shape: {
        type: ["square"],
      },
      size: {
        animation: {
          destroy: "min",
          enable: true,
          speed: 6,
          startValue: "max",
        },
        value: { min: 2, max: 7 },
      },
      rotate: {
        animation: {
          enable: true,
          speed: { min: 12, max: 28 },
          sync: false,
        },
        direction: "random",
        path: false,
        value: { min: 0, max: 360 },
      },
      tilt: {
        animation: {
          enable: true,
          speed: { min: 16, max: 32 },
          sync: false,
        },
        direction: "random",
        enable: true,
        value: { min: 0, max: 360 },
      },
      twinkle: {
        lines: {
          enable: false,
          frequency: 0,
          opacity: 0,
        },
        particles: {
          color: "#dbe7ff",
          enable: true,
          frequency: 0.06,
          opacity: 1,
        },
      },
      wobble: {
        distance: { min: 12, max: effect.wobble },
        enable: true,
        speed: { angle: { min: -9, max: 9 }, move: { min: -6, max: 6 } },
      },
    },
  };
}

function createSwirlOptions(effect: SwirlEffect): ISourceOptions {
  return {
    autoPlay: true,
    detectRetina: true,
    fpsLimit: 120,
    fullScreen: { enable: false },
    background: { color: "transparent" },
    emitters: {
      autoPlay: true,
      direction: "top",
      fill: true,
      life: {
        count: 1,
        duration: millisecondsToSeconds(effect.emissionDuration),
        wait: false,
      },
      position: { x: 50, y: 94 },
      rate: {
        delay: 0.12,
        quantity: effect.quantity,
      },
      shape: {
        options: {},
        replace: false,
        type: "square",
      },
      size: {
        height: 10,
        mode: "percent",
        width: effect.radius,
      },
      startCount: randomBetween(0, 1),
    },
    interactivity: {
      events: {
        onClick: { enable: false, mode: [] },
        onHover: { enable: false, mode: [] },
        resize: { enable: true },
      },
      modes: {},
    },
    particles: {
      color: {
        value: ["#ffde37", "#ffe97e", "#fff4bb", "#ffd83d"],
      },
      links: {
        enable: false,
      },
      move: {
        decay: { min: 0.02, max: 0.06 },
        direction: "top",
        drift: randomFloat(-1.8, 1.8),
        enable: true,
        gravity: {
          acceleration: 2.4,
          enable: true,
          inverse: true,
          maxSpeed: 4.2,
        },
        outModes: {
          default: "destroy",
        },
        random: true,
        speed: { min: 1.2, max: effect.speed },
        straight: false,
      },
      life: createParticleLife(effect),
      number: {
        value: 0,
      },
      opacity: {
        animation: {
          destroy: "min",
          enable: true,
          speed: 0.8,
          startValue: "random",
        },
        value: { min: 0.04, max: 0.28 },
      },
      roll: {
        darken: { enable: false, value: 0 },
        enable: true,
        enlighten: { enable: true, value: 18 },
        mode: "vertical",
        speed: { min: 4, max: 8 },
      },
      shadow: {
        blur: 0,
        color: "#ffe44f",
        enable: false,
        offset: { x: 0, y: 0 },
      },
      shape: {
        type: ["square"],
      },
      size: {
        animation: {
          destroy: "min",
          enable: true,
          speed: 4,
          startValue: "random",
        },
        value: { min: 2, max: 7 },
      },
      rotate: {
        animation: {
          enable: true,
          speed: { min: 4, max: 12 },
          sync: false,
        },
        direction: "random",
        path: false,
        value: { min: 0, max: 360 },
      },
      twinkle: {
        lines: {
          enable: false,
          frequency: 0,
          opacity: 0,
        },
        particles: {
          color: "#fff9ca",
          enable: true,
          frequency: 0.06,
          opacity: 1,
        },
      },
      wobble: {
        distance: { min: 18, max: effect.wobble },
        enable: true,
        speed: { angle: { min: -14, max: 14 }, move: { min: -8, max: 8 } },
      },
    },
  };
}

function TeamPanel({
  side,
  label,
  subtitle,
  callout,
  damageEffects,
  engineReady,
  onCastSpell,
  onDamage,
  onSwirl,
  swirlEffects,
}: TeamPanelProps) {
  const teamClass = side === "left" ? styles.leftPanel : styles.rightPanel;
  const faceClass = side === "left" ? styles.leftFacecam : styles.rightFacecam;

  return (
    <section className={`${styles.panel} ${teamClass}`}>
      <header className={styles.panelHeader}>
        <div>
          <p className={styles.teamLabel}>{label}</p>
          <h2>{subtitle}</h2>
        </div>
        <span className={styles.teamChip}>{callout}</span>
      </header>

      <div className={styles.facecamShell}>
        <div className={`${styles.facecam} ${faceClass}`}>
          {engineReady ? (
            <div className={styles.localParticles} aria-hidden="true">
              {damageEffects.map((effect) => (
                <Particles
                  key={effect.id}
                  className={styles.particleCanvas}
                  id={`damage-${effect.id}`}
                  options={createDamageOptions(effect)}
                />
              ))}

              {swirlEffects.map((effect) => (
                <Particles
                  key={effect.id}
                  className={styles.particleCanvas}
                  id={`swirl-${effect.id}`}
                  options={createSwirlOptions(effect)}
                />
              ))}
            </div>
          ) : null}

          <div className={styles.facecamBackdrop}>
            <div className={styles.facecamCore}>
              <div className={styles.avatarHalo} />
              <div className={styles.avatarOrb} />
              <span className={styles.facecamText}>Facecam feed</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.controls}>
        <button className={styles.actionButton} onClick={onCastSpell} type="button">
          Cast Spell
        </button>
        <button className={styles.actionButton} onClick={onDamage} type="button">
          Take Damage
        </button>
        <button className={styles.actionButton} onClick={onSwirl} type="button">
          Solar Swirl
        </button>
      </div>
    </section>
  );
}

export function DemoClient() {
  const [engineReady, setEngineReady] = useState(false);
  const [damageEffects, setDamageEffects] = useState<DamageEffect[]>([]);
  const [spellEffects, setSpellEffects] = useState<SpellEffect[]>([]);
  const [swirlEffects, setSwirlEffects] = useState<SwirlEffect[]>([]);
  const timeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadFull(engine);
    }).then(() => {
      setEngineReady(true);
    });
  }, []);

  useEffect(() => {
    return () => {
      for (const timeoutId of timeoutsRef.current) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  const queueTimeout = (callback: () => void, delay: number) => {
    const timeoutId = window.setTimeout(() => {
      timeoutsRef.current = timeoutsRef.current.filter((entry) => entry !== timeoutId);
      callback();
    }, delay);

    timeoutsRef.current.push(timeoutId);
  };

  const triggerDamage = (side: Side) => {
    const id = makeId();
    const lifetime = createLifetimeWindow({
      emissionMin: 1_400,
      particleLifetimeMax: 720,
      particleLifetimeMin: 420,
      sequenceMaxDuration: 3_600,
    });
    const effect: DamageEffect = {
      ...lifetime,
      drift: randomFloat(-0.8, 0.8),
      gravity: randomFloat(7.8, 11.6),
      id,
      quantity: randomBetween(4, 6),
      side,
      speed: randomFloat(7.2, 10.4),
      spread: randomBetween(92, 100),
      x: 50,
      y: randomBetween(6, 14),
    };

    setDamageEffects((current) => [...current, effect]);
    queueTimeout(() => {
      setDamageEffects((current) => current.filter((entry) => entry.id !== id));
    }, effect.cleanupDuration);
  };

  const triggerSpell = (source: Side) => {
    const id = makeId();
    const lifetime = createLifetimeWindow({
      emissionMin: 2_200,
      particleLifetimeMax: 980,
      particleLifetimeMin: 720,
      sequenceMaxDuration: MAX_EFFECT_MS,
    });
    const effect: SpellEffect = {
      ...lifetime,
      drift: source === "left" ? randomFloat(-1.1, 1.4) : randomFloat(-1.4, 1.1),
      id,
      pullSize: randomBetween(4, 6),
      quantity: randomBetween(2, 4),
      source,
      speed: randomFloat(8.2, 12.4),
      spread: randomBetween(26, 44),
      targetY: randomBetween(24, 78),
      wobble: randomBetween(30, 58),
      y: randomBetween(24, 78),
    };

    setSpellEffects((current) => [...current, effect]);
    queueTimeout(() => {
      setSpellEffects((current) => current.filter((entry) => entry.id !== id));
    }, effect.cleanupDuration);
  };

  const triggerSwirl = (side: Side) => {
    const id = makeId();
    const lifetime = createLifetimeWindow({
      emissionMin: 1_700,
      particleLifetimeMax: 1_150,
      particleLifetimeMin: 900,
      sequenceMaxDuration: 4_200,
    });
    const effect: SwirlEffect = {
      ...lifetime,
      id,
      quantity: randomBetween(3, 5),
      radius: randomBetween(42, 62),
      side,
      speed: randomFloat(3.2, 4.8),
      wobble: randomBetween(28, 52),
    };

    setSwirlEffects((current) => [...current, effect]);
    queueTimeout(() => {
      setSwirlEffects((current) => current.filter((entry) => entry.id !== id));
    }, effect.cleanupDuration);
  };

  return (
    <section className={styles.arena}>
      <header className={styles.arenaHeader}>
        <div>
          <p className={styles.kicker}>tsParticles Demo</p>
          <h2>Two-team spell sandbox</h2>
        </div>
        <p className={styles.note}>
          Every effect auto-clears in under five seconds and uses wobble, drift,
          spin, or angle variance so the motion stays messy instead of reading
          like one rigid vector.
        </p>
      </header>

      <div className={styles.stage}>
        {engineReady ? (
          <div className={styles.spellPlane} aria-hidden="true">
            {spellEffects.map((effect) => (
              <Particles
                key={effect.id}
                className={styles.particleCanvas}
                id={`spell-${effect.id}`}
                options={createSpellOptions(effect)}
              />
            ))}
          </div>
        ) : null}

        <TeamPanel
          callout="Rune Keep"
          damageEffects={damageEffects.filter((effect) => effect.side === "left")}
          engineReady={engineReady}
          label="Team One"
          onCastSpell={() => triggerSpell("left")}
          onDamage={() => triggerDamage("left")}
          onSwirl={() => triggerSwirl("left")}
          side="left"
          subtitle="Auric Owls"
          swirlEffects={swirlEffects.filter((effect) => effect.side === "left")}
        />

        <TeamPanel
          callout="Glyph Yard"
          damageEffects={damageEffects.filter((effect) => effect.side === "right")}
          engineReady={engineReady}
          label="Team Two"
          onCastSpell={() => triggerSpell("right")}
          onDamage={() => triggerDamage("right")}
          onSwirl={() => triggerSwirl("right")}
          side="right"
          subtitle="Static Foxes"
          swirlEffects={swirlEffects.filter((effect) => effect.side === "right")}
        />
      </div>
    </section>
  );
}
