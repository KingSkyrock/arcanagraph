"use client";

import { useState } from "react";
import styles from "./page.module.css";

type StyleOption = {
  id: string;
  name: string;
  primary: string;
  accent: string;
  detail: string;
  swatches: string[];
};

const GRID_SIZE = 16;

const HAT_OPTIONS: StyleOption[] = [
  {
    accent: "#e7cbff",
    detail: "#fff7a3",
    id: "wizard",
    name: "Wizard Cap",
    primary: "#5938ff",
    swatches: ["#5938ff", "#e7cbff", "#fff7a3"],
  },
  {
    accent: "#ffd6a4",
    detail: "#fff3db",
    id: "beanie",
    name: "Warm Beanie",
    primary: "#ff9b43",
    swatches: ["#ff9b43", "#ffd6a4", "#fff3db"],
  },
  {
    accent: "#ffe677",
    detail: "#ff4d8f",
    id: "crown",
    name: "Pixel Crown",
    primary: "#ffcc24",
    swatches: ["#ffcc24", "#ffe677", "#ff4d8f"],
  },
  {
    accent: "#b2ffc6",
    detail: "#f1ffb9",
    id: "hood",
    name: "Forest Hood",
    primary: "#18a866",
    swatches: ["#18a866", "#b2ffc6", "#f1ffb9"],
  },
  {
    accent: "#aee2ff",
    detail: "#ffe26f",
    id: "cap",
    name: "Scout Cap",
    primary: "#2e8dff",
    swatches: ["#2e8dff", "#aee2ff", "#ffe26f"],
  },
];

const SHIRT_OPTIONS: StyleOption[] = [
  {
    accent: "#dce5ff",
    detail: "#ffe96d",
    id: "arcane",
    name: "Arcane Tunic",
    primary: "#4b63ff",
    swatches: ["#4b63ff", "#dce5ff", "#ffe96d"],
  },
  {
    accent: "#ffd9b0",
    detail: "#fff0de",
    id: "ember",
    name: "Ember Vest",
    primary: "#ff6a36",
    swatches: ["#ff6a36", "#ffd9b0", "#fff0de"],
  },
  {
    accent: "#d9ffe0",
    detail: "#f4ffcf",
    id: "grove",
    name: "Grove Jersey",
    primary: "#35b26e",
    swatches: ["#35b26e", "#d9ffe0", "#f4ffcf"],
  },
  {
    accent: "#ffe497",
    detail: "#fff6c7",
    id: "sun",
    name: "Sun Tabard",
    primary: "#f0b515",
    swatches: ["#f0b515", "#ffe497", "#fff6c7"],
  },
  {
    accent: "#e5d7ff",
    detail: "#ff9fe9",
    id: "void",
    name: "Void Jacket",
    primary: "#7b4cff",
    swatches: ["#7b4cff", "#e5d7ff", "#ff9fe9"],
  },
];

const SHOE_OPTIONS: StyleOption[] = [
  {
    accent: "#8e5a31",
    detail: "#d2ae7e",
    id: "boots",
    name: "Trail Boots",
    primary: "#5b3412",
    swatches: ["#5b3412", "#8e5a31", "#d2ae7e"],
  },
  {
    accent: "#d8ebff",
    detail: "#ff6174",
    id: "runners",
    name: "Rune Runners",
    primary: "#ffffff",
    swatches: ["#ffffff", "#d8ebff", "#ff6174"],
  },
  {
    accent: "#f6f8ff",
    detail: "#9dc9ff",
    id: "greaves",
    name: "Moon Greaves",
    primary: "#bdc6d6",
    swatches: ["#bdc6d6", "#f6f8ff", "#9dc9ff"],
  },
  {
    accent: "#ffd05e",
    detail: "#fff2c4",
    id: "sandals",
    name: "Sun Sandals",
    primary: "#d38719",
    swatches: ["#d38719", "#ffd05e", "#fff2c4"],
  },
  {
    accent: "#ffc4e9",
    detail: "#ffffff",
    id: "sneaks",
    name: "Glow Sneaks",
    primary: "#ff5fc7",
    swatches: ["#ff5fc7", "#ffc4e9", "#ffffff"],
  },
];

function wrapIndex(index: number, length: number) {
  return (index + length) % length;
}

function paintRect(
  pixels: string[],
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
) {
  for (let row = y; row < y + height; row += 1) {
    for (let column = x; column < x + width; column += 1) {
      if (column < 0 || row < 0 || column >= GRID_SIZE || row >= GRID_SIZE) {
        continue;
      }

      pixels[row * GRID_SIZE + column] = color;
    }
  }
}

function paintDots(
  pixels: string[],
  dots: Array<[number, number]>,
  color: string,
) {
  for (const [x, y] of dots) {
    if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) {
      continue;
    }

    pixels[y * GRID_SIZE + x] = color;
  }
}

function paintHat(pixels: string[], hat: StyleOption) {
  switch (hat.id) {
    case "wizard":
      paintDots(
        pixels,
        [
          [8, 0],
          [7, 1],
          [8, 1],
          [6, 2],
          [7, 2],
          [8, 2],
          [5, 3],
          [6, 3],
          [7, 3],
          [8, 3],
          [9, 3],
          [4, 4],
          [5, 4],
          [6, 4],
          [7, 4],
          [8, 4],
          [9, 4],
          [10, 4],
          [11, 4],
        ],
        hat.primary,
      );
      paintDots(
        pixels,
        [
          [5, 5],
          [6, 5],
          [7, 5],
          [8, 5],
          [9, 5],
          [10, 5],
        ],
        hat.accent,
      );
      paintDots(
        pixels,
        [
          [9, 2],
          [10, 3],
        ],
        hat.detail,
      );
      return;
    case "beanie":
      paintRect(pixels, 5, 1, 6, 2, hat.primary);
      paintRect(pixels, 4, 3, 8, 2, hat.primary);
      paintRect(pixels, 4, 5, 8, 1, hat.accent);
      paintDots(
        pixels,
        [
          [7, 0],
          [8, 0],
        ],
        hat.detail,
      );
      return;
    case "crown":
      paintDots(
        pixels,
        [
          [4, 3],
          [5, 2],
          [6, 3],
          [7, 1],
          [8, 3],
          [9, 2],
          [10, 3],
          [11, 1],
        ],
        hat.primary,
      );
      paintRect(pixels, 4, 4, 8, 2, hat.accent);
      paintDots(
        pixels,
        [
          [5, 4],
          [7, 4],
          [9, 4],
          [11, 4],
        ],
        hat.detail,
      );
      return;
    case "hood":
      paintRect(pixels, 4, 2, 8, 4, hat.primary);
      paintDots(
        pixels,
        [
          [4, 6],
          [5, 6],
          [10, 6],
          [11, 6],
          [5, 2],
          [10, 2],
        ],
        hat.accent,
      );
      paintDots(
        pixels,
        [
          [4, 7],
          [11, 7],
        ],
        hat.detail,
      );
      return;
    default:
      paintRect(pixels, 5, 1, 5, 2, hat.primary);
      paintRect(pixels, 4, 3, 6, 2, hat.primary);
      paintRect(pixels, 9, 3, 3, 1, hat.accent);
      paintRect(pixels, 9, 4, 4, 1, hat.accent);
      paintDots(
        pixels,
        [
          [8, 1],
          [10, 4],
        ],
        hat.detail,
      );
  }
}

function paintShoes(pixels: string[], shoes: StyleOption) {
  switch (shoes.id) {
    case "boots":
      paintRect(pixels, 5, 13, 2, 2, shoes.primary);
      paintRect(pixels, 9, 13, 2, 2, shoes.primary);
      paintRect(pixels, 4, 15, 3, 1, shoes.accent);
      paintRect(pixels, 9, 15, 3, 1, shoes.accent);
      paintDots(
        pixels,
        [
          [5, 14],
          [10, 14],
        ],
        shoes.detail,
      );
      return;
    case "runners":
      paintRect(pixels, 4, 14, 3, 1, shoes.primary);
      paintRect(pixels, 9, 14, 3, 1, shoes.primary);
      paintRect(pixels, 4, 15, 3, 1, shoes.accent);
      paintRect(pixels, 9, 15, 3, 1, shoes.accent);
      paintDots(
        pixels,
        [
          [6, 14],
          [11, 14],
        ],
        shoes.detail,
      );
      return;
    case "greaves":
      paintRect(pixels, 5, 13, 2, 2, shoes.primary);
      paintRect(pixels, 9, 13, 2, 2, shoes.primary);
      paintRect(pixels, 4, 15, 3, 1, shoes.accent);
      paintRect(pixels, 9, 15, 3, 1, shoes.accent);
      paintDots(
        pixels,
        [
          [5, 13],
          [10, 13],
        ],
        shoes.detail,
      );
      return;
    case "sandals":
      paintRect(pixels, 5, 14, 2, 1, shoes.primary);
      paintRect(pixels, 9, 14, 2, 1, shoes.primary);
      paintRect(pixels, 4, 15, 3, 1, shoes.accent);
      paintRect(pixels, 9, 15, 3, 1, shoes.accent);
      paintDots(
        pixels,
        [
          [5, 14],
          [6, 14],
          [9, 14],
          [10, 14],
        ],
        shoes.detail,
      );
      return;
    default:
      paintRect(pixels, 4, 14, 3, 1, shoes.primary);
      paintRect(pixels, 9, 14, 3, 1, shoes.primary);
      paintRect(pixels, 4, 15, 3, 1, shoes.accent);
      paintRect(pixels, 9, 15, 3, 1, shoes.accent);
      paintDots(
        pixels,
        [
          [4, 14],
          [11, 14],
        ],
        shoes.detail,
      );
  }
}

function buildCharacterPixels(
  hat: StyleOption,
  shirt: StyleOption,
  shoes: StyleOption,
) {
  const pixels = Array.from({ length: GRID_SIZE * GRID_SIZE }, () => "transparent");
  const skin = "#f3c49b";
  const skinShade = "#d6936e";
  const hair = "#2b1450";
  const pants = "#3b2585";
  const outline = "#120628";

  paintRect(pixels, 5, 2, 6, 1, hair);
  paintRect(pixels, 4, 3, 8, 1, hair);
  paintRect(pixels, 5, 4, 6, 4, skin);
  paintDots(
    pixels,
    [
      [4, 4],
      [4, 5],
      [4, 6],
      [11, 4],
      [11, 5],
      [11, 6],
      [5, 7],
      [10, 7],
    ],
    hair,
  );

  paintDots(
    pixels,
    [
      [6, 5],
      [9, 5],
    ],
    outline,
  );
  paintDots(
    pixels,
    [
      [7, 6],
      [8, 6],
    ],
    skinShade,
  );

  paintDots(
    pixels,
    [
      [7, 8],
      [8, 8],
    ],
    skin,
  );

  paintRect(pixels, 5, 9, 6, 3, shirt.primary);
  paintRect(pixels, 5, 9, 6, 1, shirt.accent);
  paintRect(pixels, 4, 9, 1, 3, shirt.primary);
  paintRect(pixels, 11, 9, 1, 3, shirt.primary);
  paintDots(
    pixels,
    [
      [4, 12],
      [11, 12],
    ],
    skin,
  );
  paintDots(
    pixels,
    [
      [7, 10],
      [8, 10],
      [6, 11],
      [9, 11],
    ],
    shirt.detail,
  );

  paintRect(pixels, 6, 12, 4, 2, pants);
  paintRect(pixels, 6, 14, 1, 1, pants);
  paintRect(pixels, 9, 14, 1, 1, pants);
  paintDots(
    pixels,
    [
      [7, 13],
      [8, 13],
    ],
    "#816be0",
  );

  paintHat(pixels, hat);
  paintShoes(pixels, shoes);

  return pixels;
}

function PixelCharacter({
  hat,
  shirt,
  shoes,
}: {
  hat: StyleOption;
  shirt: StyleOption;
  shoes: StyleOption;
}) {
  const pixels = buildCharacterPixels(hat, shirt, shoes);

  return (
    <div className={styles.pixelShell}>
      <div className={styles.pixelAura} aria-hidden="true" />
      <div className={styles.pixelBoard} aria-label="8-bit character preview">
        {pixels.map((color, index) => (
          <span
            key={`${color}-${index}`}
            className={styles.pixelCell}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      <div className={styles.pixelPedestal} aria-hidden="true" />
    </div>
  );
}

function OptionCarousel({
  label,
  options,
  index,
  onChange,
}: {
  label: string;
  options: StyleOption[];
  index: number;
  onChange: (nextIndex: number) => void;
}) {
  const previous = options[wrapIndex(index - 1, options.length)];
  const current = options[index];
  const next = options[wrapIndex(index + 1, options.length)];

  return (
    <section className={styles.carouselSection}>
      <header className={styles.carouselHeader}>
        <div>
          <p className={styles.carouselLabel}>{label}</p>
          <h3>{current.name}</h3>
        </div>
        <span className={styles.carouselCount}>
          {index + 1}/{options.length}
        </span>
      </header>

      <div className={styles.carouselBody}>
        <button
          aria-label={`Previous ${label.toLowerCase()}`}
          className={styles.carouselButton}
          onClick={() => onChange(wrapIndex(index - 1, options.length))}
          type="button"
        >
          ←
        </button>

        <div className={styles.carouselViewport}>
          {[previous, current, next].map((option, optionIndex) => {
            const active = optionIndex === 1;

            return (
              <article
                key={`${label}-${option.id}-${optionIndex}`}
                className={`${styles.optionCard} ${active ? styles.activeOption : ""}`}
              >
                <p>{active ? "Selected" : "Preview"}</p>
                <strong>{option.name}</strong>
                <div className={styles.swatchRow}>
                  {option.swatches.map((color) => (
                    <span
                      key={`${option.id}-${color}`}
                      className={styles.swatch}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </article>
            );
          })}
        </div>

        <button
          aria-label={`Next ${label.toLowerCase()}`}
          className={styles.carouselButton}
          onClick={() => onChange(wrapIndex(index + 1, options.length))}
          type="button"
        >
          →
        </button>
      </div>
    </section>
  );
}

export function CustomizerDemo() {
  const [hatIndex, setHatIndex] = useState(0);
  const [shirtIndex, setShirtIndex] = useState(0);
  const [shoeIndex, setShoeIndex] = useState(0);

  const hat = HAT_OPTIONS[hatIndex];
  const shirt = SHIRT_OPTIONS[shirtIndex];
  const shoes = SHOE_OPTIONS[shoeIndex];

  return (
    <section className={styles.customizer}>
      <header className={styles.customizerHeader}>
        <div>
          <p className={styles.kicker}>Loadout Lab</p>
          <h2>8-bit character customizer</h2>
        </div>
        <p className={styles.note}>
          Carousel through hats, shirts, and shoes, then use the pixel preview
          as a lightweight style mock for the character pipeline.
        </p>
      </header>

      <div className={styles.customizerGrid}>
        <article className={styles.previewPanel}>
          <p className={styles.previewLabel}>Pixel Preview</p>
          <PixelCharacter hat={hat} shirt={shirt} shoes={shoes} />

          <div className={styles.selectionSummary}>
            <span className={styles.selectionPill}>{hat.name}</span>
            <span className={styles.selectionPill}>{shirt.name}</span>
            <span className={styles.selectionPill}>{shoes.name}</span>
          </div>
        </article>

        <div className={styles.customizerControls}>
          <OptionCarousel
            index={hatIndex}
            label="Hat"
            onChange={setHatIndex}
            options={HAT_OPTIONS}
          />
          <OptionCarousel
            index={shirtIndex}
            label="Shirt"
            onChange={setShirtIndex}
            options={SHIRT_OPTIONS}
          />
          <OptionCarousel
            index={shoeIndex}
            label="Shoes"
            onChange={setShoeIndex}
            options={SHOE_OPTIONS}
          />
        </div>
      </div>
    </section>
  );
}
