/**
 * Developer-authored workout templates for Schlag v2.
 *
 * 10 curated templates spanning common training modalities. Three templates
 * are free; seven require Schlag Pro. Templates are Sequence objects with
 * deterministic IDs so they can be identified across app versions.
 *
 * Each template is wrapped in a WorkoutTemplate that adds category metadata
 * and a free/Pro flag.
 */

import type { Sequence } from '@/types/sequence';
import type { AudioConfig } from '@/types/audio';
import type { Interval } from '@/types/interval';

// ---------------------------------------------------------------------------
// Template types
// ---------------------------------------------------------------------------

export type TemplateCategory =
  | 'tabata'
  | 'emom'
  | 'amrap'
  | 'circuit'
  | 'strength'
  | 'mobility';

export interface WorkoutTemplate {
  sequence: Sequence;
  category: TemplateCategory;
  is_free: boolean;
}

// ---------------------------------------------------------------------------
// Interval color hex values (from constants/colors.ts)
// ---------------------------------------------------------------------------

const RED = '#E63946';
const ORANGE = '#F4722B';
const YELLOW = '#F6AE2D';
const GREEN = '#2DC653';
const TEAL = '#00B4D8';
const BLUE = '#2563EB';
const INDIGO = '#4338CA';
const VIOLET = '#7C3AED';
const PINK = '#DB2777';
const SLATE = '#475569';

// ---------------------------------------------------------------------------
// Default audio config (shared by all templates)
// ---------------------------------------------------------------------------

const DEFAULT_AUDIO: AudioConfig = {
  use_voice_countdown: true,
  use_builtin_beeps: true,
  announce_interval_names: false,
  halfway_alert: false,
};

// ---------------------------------------------------------------------------
// Helper: create an interval with a deterministic ID
// ---------------------------------------------------------------------------

function makeInterval(
  templateSlug: string,
  index: number,
  name: string,
  duration_seconds: number,
  color: string,
  note: string = '',
): Interval {
  return {
    id: `${templateSlug}-interval-${index}`,
    name,
    duration_seconds,
    color,
    note,
  };
}

// ---------------------------------------------------------------------------
// Shared ISO timestamp (templates are authored, not user-created)
// ---------------------------------------------------------------------------

const AUTHORED_AT = '2026-01-01T00:00:00.000Z';

// ---------------------------------------------------------------------------
// 1. Tabata Classic (FREE)
//    20s work / 10s rest x 8 rounds. Work=Red, Rest=Teal. Total 4:00
// ---------------------------------------------------------------------------

const tabataClassicIntervals: Interval[] = [
  makeInterval('tabata-classic', 0, 'Work', 20, RED, 'All-out effort'),
  makeInterval('tabata-classic', 1, 'Rest', 10, TEAL, 'Active recovery'),
];

const tabataClassic: WorkoutTemplate = {
  category: 'tabata',
  is_free: true,
  sequence: {
    id: 'template-tabata-classic',
    name: 'Tabata Classic',
    description: '20s work / 10s rest x 8. The original Tabata protocol.',
    repeat_count: 8,
    rest_between_sets_seconds: 0,
    auto_advance: true,
    intervals: tabataClassicIntervals,
    audio_config: { ...DEFAULT_AUDIO },
    created_at: AUTHORED_AT,
    updated_at: AUTHORED_AT,
    last_used_at: null,
  },
};

// ---------------------------------------------------------------------------
// 2. EMOM 10-Minute (FREE)
//    1 interval of 60s, repeat 10x. Green. 10:00 total
// ---------------------------------------------------------------------------

const emom10Intervals: Interval[] = [
  makeInterval('emom-10', 0, 'Every Minute', 60, GREEN, 'Complete reps, rest remainder'),
];

const emom10: WorkoutTemplate = {
  category: 'emom',
  is_free: true,
  sequence: {
    id: 'template-emom-10',
    name: 'EMOM 10-Minute',
    description: '60s rounds x 10. Complete work, rest the remainder.',
    repeat_count: 10,
    rest_between_sets_seconds: 0,
    auto_advance: true,
    intervals: emom10Intervals,
    audio_config: { ...DEFAULT_AUDIO },
    created_at: AUTHORED_AT,
    updated_at: AUTHORED_AT,
    last_used_at: null,
  },
};

// ---------------------------------------------------------------------------
// 3. Strength 5x5 Rest Timer (FREE)
//    3:00 rest interval, repeat 5x. Slate. 15:00 total
// ---------------------------------------------------------------------------

const strength5x5Intervals: Interval[] = [
  makeInterval('strength-5x5', 0, 'Rest', 180, SLATE, 'Recover between sets'),
];

const strength5x5: WorkoutTemplate = {
  category: 'strength',
  is_free: true,
  sequence: {
    id: 'template-strength-5x5',
    name: 'Strength 5x5 Rest Timer',
    description: '3-minute rest timer for 5x5 strength programs.',
    repeat_count: 5,
    rest_between_sets_seconds: 0,
    auto_advance: true,
    intervals: strength5x5Intervals,
    audio_config: { ...DEFAULT_AUDIO },
    created_at: AUTHORED_AT,
    updated_at: AUTHORED_AT,
    last_used_at: null,
  },
};

// ---------------------------------------------------------------------------
// 4. Tabata Double (PRO)
//    20s work / 10s rest x 16. Two Tabata sets back-to-back. 8:00
// ---------------------------------------------------------------------------

const tabataDoubleIntervals: Interval[] = [
  makeInterval('tabata-double', 0, 'Work', 20, RED, 'All-out effort'),
  makeInterval('tabata-double', 1, 'Rest', 10, TEAL, 'Active recovery'),
];

const tabataDouble: WorkoutTemplate = {
  category: 'tabata',
  is_free: false,
  sequence: {
    id: 'template-tabata-double',
    name: 'Tabata Double',
    description: '20s work / 10s rest x 16. Two full Tabata rounds.',
    repeat_count: 16,
    rest_between_sets_seconds: 0,
    auto_advance: true,
    intervals: tabataDoubleIntervals,
    audio_config: { ...DEFAULT_AUDIO },
    created_at: AUTHORED_AT,
    updated_at: AUTHORED_AT,
    last_used_at: null,
  },
};

// ---------------------------------------------------------------------------
// 5. EMOM 20-Minute (PRO)
//    60s x 20 rounds. Blue. 20:00
// ---------------------------------------------------------------------------

const emom20Intervals: Interval[] = [
  makeInterval('emom-20', 0, 'Every Minute', 60, BLUE, 'Complete reps, rest remainder'),
];

const emom20: WorkoutTemplate = {
  category: 'emom',
  is_free: false,
  sequence: {
    id: 'template-emom-20',
    name: 'EMOM 20-Minute',
    description: '60s rounds x 20. Extended EMOM for endurance.',
    repeat_count: 20,
    rest_between_sets_seconds: 0,
    auto_advance: true,
    intervals: emom20Intervals,
    audio_config: { ...DEFAULT_AUDIO },
    created_at: AUTHORED_AT,
    updated_at: AUTHORED_AT,
    last_used_at: null,
  },
};

// ---------------------------------------------------------------------------
// 6. Circuit Training (PRO)
//    6 exercises with 15s rest between. Repeat 3x.
//    Squats(45s), Push-ups(30s), Lunges(45s), Rows(30s), Burpees(30s),
//    Plank(60s). All different colors.
// ---------------------------------------------------------------------------

const circuitIntervals: Interval[] = [
  makeInterval('circuit', 0, 'Squats', 45, RED, 'Full depth, controlled'),
  makeInterval('circuit', 1, 'Transition', 15, SLATE, 'Move to next station'),
  makeInterval('circuit', 2, 'Push-ups', 30, BLUE, 'Chest to floor'),
  makeInterval('circuit', 3, 'Transition', 15, SLATE, 'Move to next station'),
  makeInterval('circuit', 4, 'Lunges', 45, GREEN, 'Alternating legs'),
  makeInterval('circuit', 5, 'Transition', 15, SLATE, 'Move to next station'),
  makeInterval('circuit', 6, 'Rows', 30, ORANGE, 'Squeeze at the top'),
  makeInterval('circuit', 7, 'Transition', 15, SLATE, 'Move to next station'),
  makeInterval('circuit', 8, 'Burpees', 30, PINK, 'Full extension each rep'),
  makeInterval('circuit', 9, 'Transition', 15, SLATE, 'Move to next station'),
  makeInterval('circuit', 10, 'Plank', 60, VIOLET, 'Tight core, flat back'),
];

const circuit: WorkoutTemplate = {
  category: 'circuit',
  is_free: false,
  sequence: {
    id: 'template-circuit',
    name: 'Circuit Training',
    description: '6 exercises, 15s transitions. Full-body circuit x 3 rounds.',
    repeat_count: 3,
    rest_between_sets_seconds: 30,
    auto_advance: true,
    intervals: circuitIntervals,
    audio_config: { ...DEFAULT_AUDIO, announce_interval_names: true },
    created_at: AUTHORED_AT,
    updated_at: AUTHORED_AT,
    last_used_at: null,
  },
};

// ---------------------------------------------------------------------------
// 7. Powerlifting Rest (PRO)
//    5:00 rest interval, repeat 8x. Indigo. 40:00
// ---------------------------------------------------------------------------

const powerliftingIntervals: Interval[] = [
  makeInterval('powerlifting', 0, 'Rest', 300, INDIGO, 'Full recovery between sets'),
];

const powerlifting: WorkoutTemplate = {
  category: 'strength',
  is_free: false,
  sequence: {
    id: 'template-powerlifting',
    name: 'Powerlifting Rest',
    description: '5-minute rest timer for heavy compound lifts x 8 sets.',
    repeat_count: 8,
    rest_between_sets_seconds: 0,
    auto_advance: true,
    intervals: powerliftingIntervals,
    audio_config: { ...DEFAULT_AUDIO },
    created_at: AUTHORED_AT,
    updated_at: AUTHORED_AT,
    last_used_at: null,
  },
};

// ---------------------------------------------------------------------------
// 8. AMRAP 12-Minute (PRO)
//    Single 720s interval, infinite mode (repeat_count 0). Orange.
// ---------------------------------------------------------------------------

const amrapIntervals: Interval[] = [
  makeInterval('amrap-12', 0, 'AMRAP', 720, ORANGE, 'As many rounds as possible'),
];

const amrap12: WorkoutTemplate = {
  category: 'amrap',
  is_free: false,
  sequence: {
    id: 'template-amrap-12',
    name: 'AMRAP 12-Minute',
    description: '12 minutes, as many rounds as possible. Go!',
    repeat_count: 0,
    rest_between_sets_seconds: 0,
    auto_advance: true,
    intervals: amrapIntervals,
    audio_config: { ...DEFAULT_AUDIO, halfway_alert: true },
    created_at: AUTHORED_AT,
    updated_at: AUTHORED_AT,
    last_used_at: null,
  },
};

// ---------------------------------------------------------------------------
// 9. Mobility Flow (PRO)
//    5 stretches at 45s each with 30s transitions. 2 rounds.
//    Hip Flexor(Pink), Hamstring(Green), Shoulder(Blue),
//    Thoracic(Violet), Ankle(Teal).
// ---------------------------------------------------------------------------

const mobilityIntervals: Interval[] = [
  makeInterval('mobility', 0, 'Hip Flexor', 45, PINK, 'Deep lunge stretch'),
  makeInterval('mobility', 1, 'Transition', 30, SLATE, 'Switch position'),
  makeInterval('mobility', 2, 'Hamstring', 45, GREEN, 'Forward fold or banded'),
  makeInterval('mobility', 3, 'Transition', 30, SLATE, 'Switch position'),
  makeInterval('mobility', 4, 'Shoulder', 45, BLUE, 'Wall slides or band pull-aparts'),
  makeInterval('mobility', 5, 'Transition', 30, SLATE, 'Switch position'),
  makeInterval('mobility', 6, 'Thoracic', 45, VIOLET, 'Open book rotations'),
  makeInterval('mobility', 7, 'Transition', 30, SLATE, 'Switch position'),
  makeInterval('mobility', 8, 'Ankle', 45, TEAL, 'Wall ankle mobilization'),
];

const mobilityFlow: WorkoutTemplate = {
  category: 'mobility',
  is_free: false,
  sequence: {
    id: 'template-mobility',
    name: 'Mobility Flow',
    description: '5 stretches, 45s each with 30s transitions. 2 rounds.',
    repeat_count: 2,
    rest_between_sets_seconds: 30,
    auto_advance: true,
    intervals: mobilityIntervals,
    audio_config: { ...DEFAULT_AUDIO, announce_interval_names: true },
    created_at: AUTHORED_AT,
    updated_at: AUTHORED_AT,
    last_used_at: null,
  },
};

// ---------------------------------------------------------------------------
// 10. Strength Superset (PRO)
//     Exercise A(60s), Rest(90s), Exercise B(60s), Rest(90s). 4 rounds.
//     Red/Slate alternating.
// ---------------------------------------------------------------------------

const supersetIntervals: Interval[] = [
  makeInterval('superset', 0, 'Exercise A', 60, RED, 'Primary compound lift'),
  makeInterval('superset', 1, 'Rest', 90, SLATE, 'Recover'),
  makeInterval('superset', 2, 'Exercise B', 60, RED, 'Antagonist movement'),
  makeInterval('superset', 3, 'Rest', 90, SLATE, 'Recover'),
];

const superset: WorkoutTemplate = {
  category: 'strength',
  is_free: false,
  sequence: {
    id: 'template-superset',
    name: 'Strength Superset',
    description: 'A/B superset: 60s work, 90s rest, alternating. 4 rounds.',
    repeat_count: 4,
    rest_between_sets_seconds: 0,
    auto_advance: true,
    intervals: supersetIntervals,
    audio_config: { ...DEFAULT_AUDIO },
    created_at: AUTHORED_AT,
    updated_at: AUTHORED_AT,
    last_used_at: null,
  },
};

// ---------------------------------------------------------------------------
// Exported collection
// ---------------------------------------------------------------------------

export const WORKOUT_TEMPLATES: WorkoutTemplate[] = [
  tabataClassic,
  emom10,
  strength5x5,
  tabataDouble,
  emom20,
  circuit,
  powerlifting,
  amrap12,
  mobilityFlow,
  superset,
];

/**
 * Set of template IDs that are available for free (no Pro purchase required).
 */
export const FREE_TEMPLATE_IDS: Set<string> = new Set(
  WORKOUT_TEMPLATES.filter((t) => t.is_free).map((t) => t.sequence.id),
);

/**
 * All template categories in display order for the filter pills.
 */
export const TEMPLATE_CATEGORIES: readonly TemplateCategory[] = [
  'tabata',
  'emom',
  'amrap',
  'circuit',
  'strength',
  'mobility',
] as const;

/**
 * Human-readable labels for each template category.
 */
export const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  tabata: 'Tabata',
  emom: 'EMOM',
  amrap: 'AMRAP',
  circuit: 'Circuit',
  strength: 'Strength',
  mobility: 'Mobility',
};
