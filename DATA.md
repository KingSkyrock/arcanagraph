# Data Guide

This repo contains CSV files for tracing overlays, equation practice, and word prompts.

The goal is to give the CV pipeline a simple source of truth for what the player should draw with their finger.

## Files

- `data/shapes.csv`
  Kid-friendly shapes to trace and memorize.
- `data/equations.csv`
  Intro graph shapes from common math equations.
- `data/advanced_equations.csv`
  Harder graph shapes for more advanced players.
- `data/letter_tracing.csv`
  Uppercase letter tracing prompts.
- `data/number_tracing.csv`
  Number tracing prompts from `0` to `9`.
- `data/country_names.csv`
  Country names grouped by difficulty with uppercase tracing text.
- `data/us_state_names.csv`
  U.S. state names grouped by difficulty with uppercase tracing text.
- `data/overlay_curriculum.csv`
  Combined legacy file containing shapes and equation rows together.
  Prefer the split CSVs above for new work.

## Shared tracing CSV format

These files use the same 8-column layout:

- `category`
  Broad content type such as `shape`, `equation`, `letter`, or `number`.
- `skill_family`
  Learning bucket used for progression and difficulty grouping.
  Examples: `basic_shape`, `linear`, `absolute_value`, `quadratic`, `letter_tracing`.
- `difficulty`
  Relative difficulty level.
  Current values are `easy`, `medium`, and `hard`.
- `item_id`
  Stable internal identifier for code and analytics.
- `display_text`
  Human-readable label or equation shown in the UI.
- `print_prompt`
  Uppercase print-style prompt intended for younger learners or overlay text.
- `trace_prompt`
  Short natural-language instruction for what the player should draw.
- `overlay_hint`
  Brief structural hint for the CV overlay renderer or evaluator.

## Shapes and equations

### `data/shapes.csv`

Use this for basic visual tracing challenges.

Examples:
- `Circle`
- `Square`
- `Triangle`
- `Heart`
- `Star`

### `data/equations.csv`

Use this for early graph-shape recognition.

The `skill_family` column is important here:
- `linear`
  Straight lines with different slopes and intercepts.
- `absolute_value`
  V-shaped graphs.
- `quadratic`
  U-shaped or upside-down U-shaped parabolas.

### `data/advanced_equations.csv`

Use this for later levels once players understand the basic graph families.

This file includes:
- harder linear forms
- harder quadratic forms
- advanced absolute value forms
- cubic curves
- square root curves
- exponential curves
- sine waves

## Letters and numbers

### `data/letter_tracing.csv`

Contains uppercase `A` through `Z`.

Recommended usage:
- show `display_text` or `print_prompt`
- overlay the letter outline
- compare the finger path against the expected stroke shape

### `data/number_tracing.csv`

Contains `0` through `9`.

Recommended usage:
- start with `easy` digits like `0`, `1`, `2`, `3`, `7`
- use `medium` and `hard` for more complex shapes like `4`, `5`, `8`, `9`

## Country and state name CSV format

These files use a 5-column layout:

- `difficulty`
  Relative challenge level based on length or word complexity.
- `name`
  Normal title-case display version.
- `uppercase_name`
  Full uppercase version for print-style tracing overlays.
- `print_prompt`
  Suggested prompt text such as `TRACE TEXAS`.
- `notes`
  Human notes about why the item is grouped at that difficulty.

## Suggested runtime usage

For the CV and gameplay pipeline:

1. Select a CSV based on mode.
   Example: `shapes.csv` for beginner tracing, `equations.csv` for math mode.
2. Filter by `difficulty`.
3. Pick an `item_id`.
4. Render `display_text` or `print_prompt` in the UI.
5. Use `trace_prompt` and `overlay_hint` to decide what outline or scoring logic to show.
6. Store progress or mastery keyed by `item_id`.

## Notes

- Keep `item_id` stable once gameplay starts.
- Add new rows instead of renaming existing IDs when possible.
- If the CV system eventually needs stroke-order metadata, add new columns instead of replacing the current ones.
