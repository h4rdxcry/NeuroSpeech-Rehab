/**
 * 100-Level Bilingual Speech Rehabilitation Curriculum (Tamil & English).
 *
 * Clinically sequenced from basic bilabial plosives through multi-syllabic sentences.
 * Each level defines kinematic targets (LAR, MWR, Jaw), expected viseme category,
 * Tamil script, English equivalent, and phonetic transliteration.
 */

export interface LevelKinematicTarget {
  minLar: number;
  maxLar: number;
  minMwr: number;
  maxMwr: number;
  minJawMm: number;
}

export type VisemeCategory = "bilabial" | "open" | "spread" | "rounded" | "lingual" | "multisyllabic";

export interface CurriculumLevel {
  level: number;
  tier: 1 | 2 | 3 | 4 | 5;
  tierTitle: string;
  englishText: string;
  tamilText: string;
  transliteration: string;
  meaning: string;
  targetViseme: VisemeCategory;
  targetKinematics: LevelKinematicTarget;
  clinicalCue: string;
  difficulty: "easy" | "medium" | "advanced";
}

export const REHAB_TIER_DESCRIPTIONS: Record<number, { title: string; badge: string; desc: string }> = {
  1: {
    title: "Bilabial Foundations & Plosives",
    badge: "Levels 1–20",
    desc: "Restores lip closure, seal strength, and unvoiced/voiced plosive phonation (/m/, /p/, /b/).",
  },
  2: {
    title: "Vowel Resonance & Jaw Excursion",
    badge: "Levels 21–40",
    desc: "Expands mandibular vertical drop, acoustic resonance cavity, and lateral spread (/a/, /i/, /u/).",
  },
  3: {
    title: "Lingual & Dental Precision",
    badge: "Levels 41–60",
    desc: "Refines tongue tip coordination behind upper incisors and alveolar ridge (/t/, /d/, /s/, /n/).",
  },
  4: {
    title: "Multisyllabic Motor Pacing",
    badge: "Levels 61–80",
    desc: "Develops continuous phonation across compound word boundaries and rhythmic syllable pacing.",
  },
  5: {
    title: "Functional Sentences & Full Recovery",
    badge: "Levels 81–100",
    desc: "Mastery of natural, expressive conversational speech for complete daily functional recovery.",
  },
};

export const REHAB_100_LEVELS: CurriculumLevel[] = [
  {
    "level": 1,
    "tier": 1,
    "tierTitle": "Tier 1: Bilabial Foundations & Plosives (/m/, /p/, /b/)",
    "englishText": "Amma",
    "tamilText": "அம்மா",
    "transliteration": "am-maa",
    "meaning": "Mother",
    "targetViseme": "bilabial",
    "targetKinematics": {
      "minLar": 0.0,
      "maxLar": 0.16,
      "minMwr": 0.35,
      "maxMwr": 0.6,
      "minJawMm": 6
    },
    "clinicalCue": "Press lips lightly for /m/, then open smoothly into /a/",
    "difficulty": "easy"
  },
  {
    "level": 2,
    "tier": 1,
    "tierTitle": "Tier 1: Bilabial Foundations & Plosives (/m/, /p/, /b/)",
    "englishText": "Appa",
    "tamilText": "அப்பா",
    "transliteration": "ap-paa",
    "meaning": "Father",
    "targetViseme": "bilabial",
    "targetKinematics": {
      "minLar": 0.0,
      "maxLar": 0.14,
      "minMwr": 0.35,
      "maxMwr": 0.6,
      "minJawMm": 6
    },
    "clinicalCue": "Firm bilabial stop for /p/ followed by open vowel release",
    "difficulty": "easy"
  },
  {
    "level": 3,
    "tier": 1,
    "tierTitle": "Tier 1: Bilabial Foundations & Plosives (/m/, /p/, /b/)",
    "englishText": "Maa",
    "tamilText": "மா",
    "transliteration": "maa",
    "meaning": "Mango / Great",
    "targetViseme": "bilabial",
    "targetKinematics": {
      "minLar": 0.0,
      "maxLar": 0.15,
      "minMwr": 0.35,
      "maxMwr": 0.6,
      "minJawMm": 8
    },
    "clinicalCue": "Sustain bilabial nasal resonance before vocalic opening",
    "difficulty": "easy"
  },
  {
    "level": 4,
    "tier": 1,
    "tierTitle": "Tier 1: Bilabial Foundations & Plosives (/m/, /p/, /b/)",
    "englishText": "Paa",
    "tamilText": "பா",
    "transliteration": "paa",
    "meaning": "Song / Verse",
    "targetViseme": "bilabial",
    "targetKinematics": {
      "minLar": 0.0,
      "maxLar": 0.15,
      "minMwr": 0.35,
      "maxMwr": 0.6,
      "minJawMm": 8
    },
    "clinicalCue": "Clear unvoiced plosive burst at oral release",
    "difficulty": "easy"
  },
  {
    "level": 5,
    "tier": 1,
    "tierTitle": "Tier 1: Bilabial Foundations & Plosives (/m/, /p/, /b/)",
    "englishText": "Baa",
    "tamilText": "பா",
    "transliteration": "baa",
    "meaning": "Come / Step",
    "targetViseme": "bilabial",
    "targetKinematics": {
      "minLar": 0.0,
      "maxLar": 0.18,
      "minMwr": 0.35,
      "maxMwr": 0.6,
      "minJawMm": 8
    },
    "clinicalCue": "Gentle voiced bilabial contact with vocal fold vibration",
    "difficulty": "easy"
  },
  {
    "level": 6,
    "tier": 1,
    "tierTitle": "Tier 1: Bilabial Foundations & Plosives (/m/, /p/, /b/)",
    "englishText": "Pappa",
    "tamilText": "பாப்பா",
    "transliteration": "paap-paa",
    "meaning": "Baby / Child",
    "targetViseme": "bilabial",
    "targetKinematics": {
      "minLar": 0.0,
      "maxLar": 0.15,
      "minMwr": 0.35,
      "maxMwr": 0.6,
      "minJawMm": 7
    },
    "clinicalCue": "Repeated bilabial plosive pacing: close, open, close, open",
    "difficulty": "easy"
  },
  {
    "level": 7,
    "tier": 1,
    "tierTitle": "Tier 1: Bilabial Foundations & Plosives (/m/, /p/, /b/)",
    "englishText": "Mala",
    "tamilText": "மலை",
    "transliteration": "ma-lai",
    "meaning": "Mountain",
    "targetViseme": "bilabial",
    "targetKinematics": {
      "minLar": 0.0,
      "maxLar": 0.2,
      "minMwr": 0.38,
      "maxMwr": 0.65,
      "minJawMm": 9
    },
    "clinicalCue": "Transition from bilabial /m/ to lateral alveolar /l/",
    "difficulty": "easy"
  },
  {
    "level": 8,
    "tier": 1,
    "tierTitle": "Tier 1: Bilabial Foundations & Plosives (/m/, /p/, /b/)",
    "englishText": "Manam",
    "tamilText": "மனம்",
    "transliteration": "ma-nam",
    "meaning": "Mind / Heart",
    "targetViseme": "bilabial",
    "targetKinematics": {
      "minLar": 0.0,
      "maxLar": 0.16,
      "minMwr": 0.35,
      "maxMwr": 0.6,
      "minJawMm": 7
    },
    "clinicalCue": "Double bilabial sandwich: /m/ at onset and /m/ at coda",
    "difficulty": "easy"
  },
  {
    "level": 9,
    "tier": 1,
    "tierTitle": "Tier 1: Bilabial Foundations & Plosives (/m/, /p/, /b/)",
    "englishText": "Panam",
    "tamilText": "பணம்",
    "transliteration": "pa-nam",
    "meaning": "Money / Wealth",
    "targetViseme": "bilabial",
    "targetKinematics": {
      "minLar": 0.0,
      "maxLar": 0.16,
      "minMwr": 0.35,
      "maxMwr": 0.6,
      "minJawMm": 7
    },
    "clinicalCue": "Plosive onset /p/ releasing into retroflex nasal and coda /m/",
    "difficulty": "easy"
  },
  {
    "level": 10,
    "tier": 1,
    "tierTitle": "Tier 1: Bilabial Foundations & Plosives (/m/, /p/, /b/)",
    "englishText": "Balam",
    "tamilText": "பலம்",
    "transliteration": "ba-lam",
    "meaning": "Strength / Power",
    "targetViseme": "bilabial",
    "targetKinematics": {
      "minLar": 0.0,
      "maxLar": 0.16,
      "minMwr": 0.35,
      "maxMwr": 0.6,
      "minJawMm": 7
    },
    "clinicalCue": "Sustain vocal cord tone through bilabial closure",
    "difficulty": "easy"
  },
  {
    "level": 11,
    "tier": 1,
    "tierTitle": "Tier 1: Bilabial Foundations & Plosives (/m/, /p/, /b/)",
    "englishText": "Pal",
    "tamilText": "பால்",
    "transliteration": "paal",
    "meaning": "Milk",
    "targetViseme": "bilabial",
    "targetKinematics": {
      "minLar": 0.0,
      "maxLar": 0.18,
      "minMwr": 0.35,
      "maxMwr": 0.6,
      "minJawMm": 8
    },
    "clinicalCue": "Plosive onset with elongated vowel and lateral coda",
    "difficulty": "easy"
  },
  {
    "level": 12,
    "tier": 1,
    "tierTitle": "Tier 1: Bilabial Foundations & Plosives (/m/, /p/, /b/)",
    "englishText": "Pazham",
    "tamilText": "பழம்",
    "transliteration": "pa-zham",
    "meaning": "Fruit",
    "targetViseme": "bilabial",
    "targetKinematics": {
      "minLar": 0.0,
      "maxLar": 0.16,
      "minMwr": 0.35,
      "maxMwr": 0.6,
      "minJawMm": 7
    },
    "clinicalCue": "Bilabial onset transitioning into retroflex approximant /zh/",
    "difficulty": "easy"
  },
  {
    "level": 13,
    "tier": 1,
    "tierTitle": "Tier 1: Bilabial Foundations & Plosives (/m/, /p/, /b/)",
    "englishText": "Mani",
    "tamilText": "மணி",
    "transliteration": "ma-ni",
    "meaning": "Bell / Jewel",
    "targetViseme": "bilabial",
    "targetKinematics": {
      "minLar": 0.0,
      "maxLar": 0.18,
      "minMwr": 0.38,
      "maxMwr": 0.65,
      "minJawMm": 8
    },
    "clinicalCue": "Gentle bilabial start into retroflex nasal",
    "difficulty": "easy"
  },
  {
    "level": 14,
    "tier": 1,
    "tierTitle": "Tier 1: Bilabial Foundations & Plosives (/m/, /p/, /b/)",
    "englishText": "Padam",
    "tamilText": "படம்",
    "transliteration": "pa-dam",
    "meaning": "Picture / Lesson",
    "targetViseme": "bilabial",
    "targetKinematics": {
      "minLar": 0.0,
      "maxLar": 0.16,
      "minMwr": 0.35,
      "maxMwr": 0.6,
      "minJawMm": 7
    },
    "clinicalCue": "Plosive /p/ to flap /d/ into final nasal bilabial closure",
    "difficulty": "easy"
  },
  {
    "level": 15,
    "tier": 1,
    "tierTitle": "Tier 1: Bilabial Foundations & Plosives (/m/, /p/, /b/)",
    "englishText": "Pattu",
    "tamilText": "பாட்டு",
    "transliteration": "paat-tu",
    "meaning": "Song / Music",
    "targetViseme": "bilabial",
    "targetKinematics": {
      "minLar": 0.0,
      "maxLar": 0.16,
      "minMwr": 0.35,
      "maxMwr": 0.6,
      "minJawMm": 7
    },
    "clinicalCue": "Bilabial opening followed by retroflex stop closure",
    "difficulty": "easy"
  },
  {
    "level": 16,
    "tier": 1,
    "tierTitle": "Tier 1: Bilabial Foundations & Plosives (/m/, /p/, /b/)",
    "englishText": "Maram",
    "tamilText": "மரம்",
    "transliteration": "ma-ram",
    "meaning": "Tree",
    "targetViseme": "bilabial",
    "targetKinematics": {
      "minLar": 0.0,
      "maxLar": 0.16,
      "minMwr": 0.35,
      "maxMwr": 0.6,
      "minJawMm": 7
    },
    "clinicalCue": "Nasal bilabial opening with alveolar tap",
    "difficulty": "easy"
  },
  {
    "level": 17,
    "tier": 1,
    "tierTitle": "Tier 1: Bilabial Foundations & Plosives (/m/, /p/, /b/)",
    "englishText": "Muthu",
    "tamilText": "முத்து",
    "transliteration": "mu-thu",
    "meaning": "Pearl",
    "targetViseme": "bilabial",
    "targetKinematics": {
      "minLar": 0.0,
      "maxLar": 0.18,
      "minMwr": 0.28,
      "maxMwr": 0.5,
      "minJawMm": 6
    },
    "clinicalCue": "Bilabial closure with lip protrusion for rounded /u/",
    "difficulty": "easy"
  },
  {
    "level": 18,
    "tier": 1,
    "tierTitle": "Tier 1: Bilabial Foundations & Plosives (/m/, /p/, /b/)",
    "englishText": "Pani",
    "tamilText": "பனி",
    "transliteration": "pa-ni",
    "meaning": "Dew / Snow",
    "targetViseme": "bilabial",
    "targetKinematics": {
      "minLar": 0.0,
      "maxLar": 0.18,
      "minMwr": 0.38,
      "maxMwr": 0.65,
      "minJawMm": 8
    },
    "clinicalCue": "Plosive onset transitioning to alveolar vowel /i/",
    "difficulty": "easy"
  },
  {
    "level": 19,
    "tier": 1,
    "tierTitle": "Tier 1: Bilabial Foundations & Plosives (/m/, /p/, /b/)",
    "englishText": "Amma Vaa",
    "tamilText": "அம்மா வா",
    "transliteration": "am-maa vaa",
    "meaning": "Mother Come",
    "targetViseme": "bilabial",
    "targetKinematics": {
      "minLar": 0.0,
      "maxLar": 0.18,
      "minMwr": 0.35,
      "maxMwr": 0.65,
      "minJawMm": 9
    },
    "clinicalCue": "Bilabial transition to labiodental /v/ gesture",
    "difficulty": "easy"
  },
  {
    "level": 20,
    "tier": 1,
    "tierTitle": "Tier 1: Bilabial Foundations & Plosives (/m/, /p/, /b/)",
    "englishText": "Appa Vaa",
    "tamilText": "அப்பா வா",
    "transliteration": "ap-paa vaa",
    "meaning": "Father Come",
    "targetViseme": "bilabial",
    "targetKinematics": {
      "minLar": 0.0,
      "maxLar": 0.18,
      "minMwr": 0.35,
      "maxMwr": 0.65,
      "minJawMm": 9
    },
    "clinicalCue": "Coordinated two-word plosive and labiodental motor sequence",
    "difficulty": "easy"
  },
  {
    "level": 21,
    "tier": 2,
    "tierTitle": "Tier 2: Vowel Resonance & Mandibular Excursion",
    "englishText": "Aadu",
    "tamilText": "ஆடு",
    "transliteration": "aa-du",
    "meaning": "Goat",
    "targetViseme": "open",
    "targetKinematics": {
      "minLar": 0.4,
      "maxLar": 0.75,
      "minMwr": 0.35,
      "maxMwr": 0.65,
      "minJawMm": 12
    },
    "clinicalCue": "Maximum vertical jaw displacement for open /aa/",
    "difficulty": "easy"
  },
  {
    "level": 22,
    "tier": 2,
    "tierTitle": "Tier 2: Vowel Resonance & Mandibular Excursion",
    "englishText": "Aaru",
    "tamilText": "ஆறு",
    "transliteration": "aa-ru",
    "meaning": "River / Six",
    "targetViseme": "open",
    "targetKinematics": {
      "minLar": 0.4,
      "maxLar": 0.75,
      "minMwr": 0.35,
      "maxMwr": 0.65,
      "minJawMm": 12
    },
    "clinicalCue": "Open oral aperture releasing into alveolar trill",
    "difficulty": "easy"
  },
  {
    "level": 23,
    "tier": 2,
    "tierTitle": "Tier 2: Vowel Resonance & Mandibular Excursion",
    "englishText": "Aalam",
    "tamilText": "ஆழம்",
    "transliteration": "aa-zham",
    "meaning": "Depth / Deep",
    "targetViseme": "open",
    "targetKinematics": {
      "minLar": 0.38,
      "maxLar": 0.75,
      "minMwr": 0.35,
      "maxMwr": 0.65,
      "minJawMm": 11
    },
    "clinicalCue": "Wide vertical opening into retroflex approximant",
    "difficulty": "easy"
  },
  {
    "level": 24,
    "tier": 2,
    "tierTitle": "Tier 2: Vowel Resonance & Mandibular Excursion",
    "englishText": "Aasai",
    "tamilText": "ஆசை",
    "transliteration": "aa-sai",
    "meaning": "Desire / Wish",
    "targetViseme": "open",
    "targetKinematics": {
      "minLar": 0.35,
      "maxLar": 0.7,
      "minMwr": 0.45,
      "maxMwr": 0.7,
      "minJawMm": 10
    },
    "clinicalCue": "Open vowel transitioning to lateral dental spread",
    "difficulty": "easy"
  },
  {
    "level": 25,
    "tier": 2,
    "tierTitle": "Tier 2: Vowel Resonance & Mandibular Excursion",
    "englishText": "Ilai",
    "tamilText": "இலை",
    "transliteration": "i-lai",
    "meaning": "Leaf",
    "targetViseme": "spread",
    "targetKinematics": {
      "minLar": 0.12,
      "maxLar": 0.32,
      "minMwr": 0.52,
      "maxMwr": 0.85,
      "minJawMm": 5
    },
    "clinicalCue": "Retract bilateral lip corners outward for spread /i/",
    "difficulty": "easy"
  },
  {
    "level": 26,
    "tier": 2,
    "tierTitle": "Tier 2: Vowel Resonance & Mandibular Excursion",
    "englishText": "Iraivan",
    "tamilText": "இறைவன்",
    "transliteration": "i-rai-van",
    "meaning": "Divine / God",
    "targetViseme": "spread",
    "targetKinematics": {
      "minLar": 0.15,
      "maxLar": 0.35,
      "minMwr": 0.5,
      "maxMwr": 0.8,
      "minJawMm": 6
    },
    "clinicalCue": "Corner spread into rhotic dipthong",
    "difficulty": "easy"
  },
  {
    "level": 27,
    "tier": 2,
    "tierTitle": "Tier 2: Vowel Resonance & Mandibular Excursion",
    "englishText": "Inimai",
    "tamilText": "இனிமை",
    "transliteration": "i-ni-mai",
    "meaning": "Sweetness",
    "targetViseme": "spread",
    "targetKinematics": {
      "minLar": 0.14,
      "maxLar": 0.35,
      "minMwr": 0.5,
      "maxMwr": 0.8,
      "minJawMm": 6
    },
    "clinicalCue": "High front vowel spread with nasal continuity",
    "difficulty": "easy"
  },
  {
    "level": 28,
    "tier": 2,
    "tierTitle": "Tier 2: Vowel Resonance & Mandibular Excursion",
    "englishText": "Idli",
    "tamilText": "இட்லி",
    "transliteration": "id-li",
    "meaning": "Steamed Rice Cake",
    "targetViseme": "spread",
    "targetKinematics": {
      "minLar": 0.15,
      "maxLar": 0.35,
      "minMwr": 0.48,
      "maxMwr": 0.78,
      "minJawMm": 6
    },
    "clinicalCue": "Spread vowel into retroflex consonant stop",
    "difficulty": "easy"
  },
  {
    "level": 29,
    "tier": 2,
    "tierTitle": "Tier 2: Vowel Resonance & Mandibular Excursion",
    "englishText": "Ural",
    "tamilText": "உரல்",
    "transliteration": "u-ral",
    "meaning": "Mortar",
    "targetViseme": "rounded",
    "targetKinematics": {
      "minLar": 0.15,
      "maxLar": 0.38,
      "minMwr": 0.22,
      "maxMwr": 0.45,
      "minJawMm": 6
    },
    "clinicalCue": "Protrude and round lips tightly for initial /u/",
    "difficulty": "easy"
  },
  {
    "level": 30,
    "tier": 2,
    "tierTitle": "Tier 2: Vowel Resonance & Mandibular Excursion",
    "englishText": "Ulagam",
    "tamilText": "உலகம்",
    "transliteration": "u-la-gam",
    "meaning": "World",
    "targetViseme": "rounded",
    "targetKinematics": {
      "minLar": 0.18,
      "maxLar": 0.4,
      "minMwr": 0.25,
      "maxMwr": 0.48,
      "minJawMm": 7
    },
    "clinicalCue": "Labial rounding transitioning into open lateral",
    "difficulty": "easy"
  },
  {
    "level": 31,
    "tier": 2,
    "tierTitle": "Tier 2: Vowel Resonance & Mandibular Excursion",
    "englishText": "Uravu",
    "tamilText": "உறவு",
    "transliteration": "u-ra-vu",
    "meaning": "Relationship",
    "targetViseme": "rounded",
    "targetKinematics": {
      "minLar": 0.16,
      "maxLar": 0.4,
      "minMwr": 0.24,
      "maxMwr": 0.48,
      "minJawMm": 6
    },
    "clinicalCue": "Double labial rounding at onset and coda",
    "difficulty": "easy"
  },
  {
    "level": 32,
    "tier": 2,
    "tierTitle": "Tier 2: Vowel Resonance & Mandibular Excursion",
    "englishText": "Uyir",
    "tamilText": "உயிர்",
    "transliteration": "u-yir",
    "meaning": "Life / Soul",
    "targetViseme": "rounded",
    "targetKinematics": {
      "minLar": 0.15,
      "maxLar": 0.36,
      "minMwr": 0.26,
      "maxMwr": 0.52,
      "minJawMm": 6
    },
    "clinicalCue": "Round lips for /u/, then spread corners for /i/",
    "difficulty": "easy"
  },
  {
    "level": 33,
    "tier": 2,
    "tierTitle": "Tier 2: Vowel Resonance & Mandibular Excursion",
    "englishText": "Eani",
    "tamilText": "ஏணி",
    "transliteration": "ea-ni",
    "meaning": "Ladder",
    "targetViseme": "spread",
    "targetKinematics": {
      "minLar": 0.18,
      "maxLar": 0.38,
      "minMwr": 0.48,
      "maxMwr": 0.78,
      "minJawMm": 7
    },
    "clinicalCue": "Mid-front vowel sustain with lateral stretch",
    "difficulty": "easy"
  },
  {
    "level": 34,
    "tier": 2,
    "tierTitle": "Tier 2: Vowel Resonance & Mandibular Excursion",
    "englishText": "Eazhu",
    "tamilText": "ஏழு",
    "transliteration": "ea-zhu",
    "meaning": "Seven",
    "targetViseme": "spread",
    "targetKinematics": {
      "minLar": 0.18,
      "maxLar": 0.38,
      "minMwr": 0.45,
      "maxMwr": 0.75,
      "minJawMm": 7
    },
    "clinicalCue": "Front vowel resonance into deep retroflex sound",
    "difficulty": "easy"
  },
  {
    "level": 35,
    "tier": 2,
    "tierTitle": "Tier 2: Vowel Resonance & Mandibular Excursion",
    "englishText": "Odam",
    "tamilText": "ஓடம்",
    "transliteration": "oa-dam",
    "meaning": "Boat",
    "targetViseme": "rounded",
    "targetKinematics": {
      "minLar": 0.2,
      "maxLar": 0.45,
      "minMwr": 0.26,
      "maxMwr": 0.48,
      "minJawMm": 8
    },
    "clinicalCue": "Mid-back rounded vowel with circular oral aperture",
    "difficulty": "easy"
  },
  {
    "level": 36,
    "tier": 2,
    "tierTitle": "Tier 2: Vowel Resonance & Mandibular Excursion",
    "englishText": "Oviyam",
    "tamilText": "ஓவியம்",
    "transliteration": "oa-vi-yam",
    "meaning": "Painting / Art",
    "targetViseme": "rounded",
    "targetKinematics": {
      "minLar": 0.2,
      "maxLar": 0.45,
      "minMwr": 0.26,
      "maxMwr": 0.52,
      "minJawMm": 8
    },
    "clinicalCue": "Round lips for /o/, transition to labiodental /v/",
    "difficulty": "easy"
  },
  {
    "level": 37,
    "tier": 2,
    "tierTitle": "Tier 2: Vowel Resonance & Mandibular Excursion",
    "englishText": "Kaatru",
    "tamilText": "காற்று",
    "transliteration": "kaat-ru",
    "meaning": "Wind / Air",
    "targetViseme": "open",
    "targetKinematics": {
      "minLar": 0.38,
      "maxLar": 0.7,
      "minMwr": 0.35,
      "maxMwr": 0.65,
      "minJawMm": 11
    },
    "clinicalCue": "Velar stop followed by deep open vowel excursion",
    "difficulty": "easy"
  },
  {
    "level": 38,
    "tier": 2,
    "tierTitle": "Tier 2: Vowel Resonance & Mandibular Excursion",
    "englishText": "Thee",
    "tamilText": "தீ",
    "transliteration": "thee",
    "meaning": "Fire",
    "targetViseme": "spread",
    "targetKinematics": {
      "minLar": 0.1,
      "maxLar": 0.28,
      "minMwr": 0.55,
      "maxMwr": 0.85,
      "minJawMm": 4
    },
    "clinicalCue": "Dental stop release directly into exaggerated lip spread",
    "difficulty": "easy"
  },
  {
    "level": 39,
    "tier": 2,
    "tierTitle": "Tier 2: Vowel Resonance & Mandibular Excursion",
    "englishText": "Poo",
    "tamilText": "பூ",
    "transliteration": "poo",
    "meaning": "Flower",
    "targetViseme": "rounded",
    "targetKinematics": {
      "minLar": 0.05,
      "maxLar": 0.25,
      "minMwr": 0.22,
      "maxMwr": 0.42,
      "minJawMm": 5
    },
    "clinicalCue": "Bilabial plosive exploding into tight circular protrusion",
    "difficulty": "easy"
  },
  {
    "level": 40,
    "tier": 2,
    "tierTitle": "Tier 2: Vowel Resonance & Mandibular Excursion",
    "englishText": "Veedu",
    "tamilText": "வீடு",
    "transliteration": "vee-du",
    "meaning": "Home / House",
    "targetViseme": "spread",
    "targetKinematics": {
      "minLar": 0.12,
      "maxLar": 0.32,
      "minMwr": 0.52,
      "maxMwr": 0.85,
      "minJawMm": 5
    },
    "clinicalCue": "Labiodental contact expanding into wide lateral smile",
    "difficulty": "easy"
  },
  {
    "level": 41,
    "tier": 3,
    "tierTitle": "Tier 3: Lingual & Dental Precision (/t/, /d/, /s/, /n/)",
    "englishText": "Vanakkam",
    "tamilText": "வணக்கம்",
    "transliteration": "va-nak-kam",
    "meaning": "Greetings / Welcome",
    "targetViseme": "lingual",
    "targetKinematics": {
      "minLar": 0.2,
      "maxLar": 0.45,
      "minMwr": 0.35,
      "maxMwr": 0.65,
      "minJawMm": 8
    },
    "clinicalCue": "Labiodental onset /v/ into alveolar nasal and velar stop",
    "difficulty": "medium"
  },
  {
    "level": 42,
    "tier": 3,
    "tierTitle": "Tier 3: Lingual & Dental Precision (/t/, /d/, /s/, /n/)",
    "englishText": "Thanni",
    "tamilText": "தண்ணீர்",
    "transliteration": "than-neer",
    "meaning": "Water",
    "targetViseme": "lingual",
    "targetKinematics": {
      "minLar": 0.18,
      "maxLar": 0.42,
      "minMwr": 0.38,
      "maxMwr": 0.68,
      "minJawMm": 8
    },
    "clinicalCue": "Dental stop tongue tip contact behind upper teeth",
    "difficulty": "medium"
  },
  {
    "level": 43,
    "tier": 3,
    "tierTitle": "Tier 3: Lingual & Dental Precision (/t/, /d/, /s/, /n/)",
    "englishText": "Thaai",
    "tamilText": "தாய்",
    "transliteration": "thaai",
    "meaning": "Mother",
    "targetViseme": "lingual",
    "targetKinematics": {
      "minLar": 0.32,
      "maxLar": 0.65,
      "minMwr": 0.4,
      "maxMwr": 0.7,
      "minJawMm": 10
    },
    "clinicalCue": "Dental release into wide diphthong /aai/",
    "difficulty": "medium"
  },
  {
    "level": 44,
    "tier": 3,
    "tierTitle": "Tier 3: Lingual & Dental Precision (/t/, /d/, /s/, /n/)",
    "englishText": "Nandri",
    "tamilText": "நன்றி",
    "transliteration": "nan-dri",
    "meaning": "Thank You",
    "targetViseme": "lingual",
    "targetKinematics": {
      "minLar": 0.18,
      "maxLar": 0.4,
      "minMwr": 0.4,
      "maxMwr": 0.7,
      "minJawMm": 7
    },
    "clinicalCue": "Alveolar nasal with voiced alveolar plosive transition",
    "difficulty": "medium"
  },
  {
    "level": 45,
    "tier": 3,
    "tierTitle": "Tier 3: Lingual & Dental Precision (/t/, /d/, /s/, /n/)",
    "englishText": "Kaalai",
    "tamilText": "காலை",
    "transliteration": "kaa-lai",
    "meaning": "Morning / Leg",
    "targetViseme": "lingual",
    "targetKinematics": {
      "minLar": 0.35,
      "maxLar": 0.68,
      "minMwr": 0.38,
      "maxMwr": 0.68,
      "minJawMm": 11
    },
    "clinicalCue": "Velar release into lateral dipthong",
    "difficulty": "medium"
  },
  {
    "level": 46,
    "tier": 3,
    "tierTitle": "Tier 3: Lingual & Dental Precision (/t/, /d/, /s/, /n/)",
    "englishText": "Nalam",
    "tamilText": "நலம்",
    "transliteration": "na-lam",
    "meaning": "Wellbeing / Good",
    "targetViseme": "lingual",
    "targetKinematics": {
      "minLar": 0.22,
      "maxLar": 0.48,
      "minMwr": 0.38,
      "maxMwr": 0.65,
      "minJawMm": 8
    },
    "clinicalCue": "Sustained nasal resonance into bilabial coda",
    "difficulty": "medium"
  },
  {
    "level": 47,
    "tier": 3,
    "tierTitle": "Tier 3: Lingual & Dental Precision (/t/, /d/, /s/, /n/)",
    "englishText": "Kodi",
    "tamilText": "கொடி",
    "transliteration": "ko-di",
    "meaning": "Flag / Vine",
    "targetViseme": "lingual",
    "targetKinematics": {
      "minLar": 0.2,
      "maxLar": 0.42,
      "minMwr": 0.3,
      "maxMwr": 0.55,
      "minJawMm": 7
    },
    "clinicalCue": "Velar plosive into retroflex flap",
    "difficulty": "medium"
  },
  {
    "level": 48,
    "tier": 3,
    "tierTitle": "Tier 3: Lingual & Dental Precision (/t/, /d/, /s/, /n/)",
    "englishText": "Thean",
    "tamilText": "தேன்",
    "transliteration": "thean",
    "meaning": "Honey",
    "targetViseme": "lingual",
    "targetKinematics": {
      "minLar": 0.2,
      "maxLar": 0.42,
      "minMwr": 0.42,
      "maxMwr": 0.72,
      "minJawMm": 7
    },
    "clinicalCue": "Dental stop with sustained mid-vowel and alveolar nasal",
    "difficulty": "medium"
  },
  {
    "level": 49,
    "tier": 3,
    "tierTitle": "Tier 3: Lingual & Dental Precision (/t/, /d/, /s/, /n/)",
    "englishText": "Nilavu",
    "tamilText": "நிலவு",
    "transliteration": "ni-la-vu",
    "meaning": "Moon",
    "targetViseme": "lingual",
    "targetKinematics": {
      "minLar": 0.18,
      "maxLar": 0.38,
      "minMwr": 0.38,
      "maxMwr": 0.65,
      "minJawMm": 7
    },
    "clinicalCue": "Tongue tip precision on alveolar ridge",
    "difficulty": "medium"
  },
  {
    "level": 50,
    "tier": 3,
    "tierTitle": "Tier 3: Lingual & Dental Precision (/t/, /d/, /s/, /n/)",
    "englishText": "Sol",
    "tamilText": "சொல்",
    "transliteration": "sol",
    "meaning": "Word / Speak",
    "targetViseme": "lingual",
    "targetKinematics": {
      "minLar": 0.18,
      "maxLar": 0.38,
      "minMwr": 0.3,
      "maxMwr": 0.52,
      "minJawMm": 6
    },
    "clinicalCue": "Palato-alveolar affricate into lateral retroflex",
    "difficulty": "medium"
  },
  {
    "level": 51,
    "tier": 3,
    "tierTitle": "Tier 3: Lingual & Dental Precision (/t/, /d/, /s/, /n/)",
    "englishText": "Vaanam",
    "tamilText": "வானம்",
    "transliteration": "vaa-nam",
    "meaning": "Sky",
    "targetViseme": "lingual",
    "targetKinematics": {
      "minLar": 0.32,
      "maxLar": 0.62,
      "minMwr": 0.38,
      "maxMwr": 0.65,
      "minJawMm": 10
    },
    "clinicalCue": "Open vowel jaw drop following labiodental onset",
    "difficulty": "medium"
  },
  {
    "level": 52,
    "tier": 3,
    "tierTitle": "Tier 3: Lingual & Dental Precision (/t/, /d/, /s/, /n/)",
    "englishText": "Thiru",
    "tamilText": "திரு",
    "transliteration": "thi-ru",
    "meaning": "Sacred / Respected",
    "targetViseme": "lingual",
    "targetKinematics": {
      "minLar": 0.16,
      "maxLar": 0.36,
      "minMwr": 0.4,
      "maxMwr": 0.68,
      "minJawMm": 6
    },
    "clinicalCue": "Crisp dental articulation with alveolar trill",
    "difficulty": "medium"
  },
  {
    "level": 53,
    "tier": 3,
    "tierTitle": "Tier 3: Lingual & Dental Precision (/t/, /d/, /s/, /n/)",
    "englishText": "Kani",
    "tamilText": "கனி",
    "transliteration": "ka-ni",
    "meaning": "Ripe Fruit",
    "targetViseme": "lingual",
    "targetKinematics": {
      "minLar": 0.25,
      "maxLar": 0.5,
      "minMwr": 0.38,
      "maxMwr": 0.65,
      "minJawMm": 8
    },
    "clinicalCue": "Velar to dental precision sequence",
    "difficulty": "medium"
  },
  {
    "level": 54,
    "tier": 3,
    "tierTitle": "Tier 3: Lingual & Dental Precision (/t/, /d/, /s/, /n/)",
    "englishText": "Siru",
    "tamilText": "சிறு",
    "transliteration": "si-ru",
    "meaning": "Small / Little",
    "targetViseme": "lingual",
    "targetKinematics": {
      "minLar": 0.14,
      "maxLar": 0.32,
      "minMwr": 0.48,
      "maxMwr": 0.78,
      "minJawMm": 5
    },
    "clinicalCue": "Sibilant /s/ tongue groove air flow",
    "difficulty": "medium"
  },
  {
    "level": 55,
    "tier": 3,
    "tierTitle": "Tier 3: Lingual & Dental Precision (/t/, /d/, /s/, /n/)",
    "englishText": "Thala",
    "tamilText": "தலை",
    "transliteration": "tha-lai",
    "meaning": "Head",
    "targetViseme": "lingual",
    "targetKinematics": {
      "minLar": 0.24,
      "maxLar": 0.52,
      "minMwr": 0.4,
      "maxMwr": 0.7,
      "minJawMm": 8
    },
    "clinicalCue": "Dental stop followed by rapid lateral glide",
    "difficulty": "medium"
  },
  {
    "level": 56,
    "tier": 3,
    "tierTitle": "Tier 3: Lingual & Dental Precision (/t/, /d/, /s/, /n/)",
    "englishText": "Nool",
    "tamilText": "நூல்",
    "transliteration": "nool",
    "meaning": "Book / Thread",
    "targetViseme": "lingual",
    "targetKinematics": {
      "minLar": 0.16,
      "maxLar": 0.36,
      "minMwr": 0.25,
      "maxMwr": 0.48,
      "minJawMm": 6
    },
    "clinicalCue": "Nasal onset with rounded back vowel",
    "difficulty": "medium"
  },
  {
    "level": 57,
    "tier": 3,
    "tierTitle": "Tier 3: Lingual & Dental Precision (/t/, /d/, /s/, /n/)",
    "englishText": "Kaalam",
    "tamilText": "காலம்",
    "transliteration": "kaa-lam",
    "meaning": "Time / Era",
    "targetViseme": "lingual",
    "targetKinematics": {
      "minLar": 0.34,
      "maxLar": 0.66,
      "minMwr": 0.36,
      "maxMwr": 0.64,
      "minJawMm": 11
    },
    "clinicalCue": "Velar open resonance to bilabial coda",
    "difficulty": "medium"
  },
  {
    "level": 58,
    "tier": 3,
    "tierTitle": "Tier 3: Lingual & Dental Precision (/t/, /d/, /s/, /n/)",
    "englishText": "Vazhi",
    "tamilText": "வழி",
    "transliteration": "va-zhi",
    "meaning": "Way / Path",
    "targetViseme": "lingual",
    "targetKinematics": {
      "minLar": 0.2,
      "maxLar": 0.45,
      "minMwr": 0.38,
      "maxMwr": 0.65,
      "minJawMm": 7
    },
    "clinicalCue": "Special retroflex liquid /zh/ tongue curling",
    "difficulty": "medium"
  },
  {
    "level": 59,
    "tier": 3,
    "tierTitle": "Tier 3: Lingual & Dental Precision (/t/, /d/, /s/, /n/)",
    "englishText": "Theni",
    "tamilText": "தேனீ",
    "transliteration": "thae-nee",
    "meaning": "Honeybee",
    "targetViseme": "lingual",
    "targetKinematics": {
      "minLar": 0.16,
      "maxLar": 0.38,
      "minMwr": 0.48,
      "maxMwr": 0.78,
      "minJawMm": 6
    },
    "clinicalCue": "Dual dental-nasal spread vowel coordination",
    "difficulty": "medium"
  },
  {
    "level": 60,
    "tier": 3,
    "tierTitle": "Tier 3: Lingual & Dental Precision (/t/, /d/, /s/, /n/)",
    "englishText": "Vetri",
    "tamilText": "வெற்றி",
    "transliteration": "vet-ri",
    "meaning": "Victory / Success",
    "targetViseme": "lingual",
    "targetKinematics": {
      "minLar": 0.18,
      "maxLar": 0.4,
      "minMwr": 0.4,
      "maxMwr": 0.7,
      "minJawMm": 7
    },
    "clinicalCue": "Alveolar plosive geminate trill coordination",
    "difficulty": "medium"
  },
  {
    "level": 61,
    "tier": 4,
    "tierTitle": "Tier 4: Multisyllabic Motor Pacing & Fluency",
    "englishText": "Kaalai Vanakkam",
    "tamilText": "காலை வணக்கம்",
    "transliteration": "kaa-lai va-nak-kam",
    "meaning": "Good Morning",
    "targetViseme": "multisyllabic",
    "targetKinematics": {
      "minLar": 0.22,
      "maxLar": 0.58,
      "minMwr": 0.35,
      "maxMwr": 0.68,
      "minJawMm": 10
    },
    "clinicalCue": "Smooth motor pacing between open vowel and labiodental word",
    "difficulty": "medium"
  },
  {
    "level": 62,
    "tier": 4,
    "tierTitle": "Tier 4: Multisyllabic Motor Pacing & Fluency",
    "englishText": "Nala Vazhvu",
    "tamilText": "நல்வாழ்வு",
    "transliteration": "nal-vaazh-vu",
    "meaning": "Healthy Life",
    "targetViseme": "multisyllabic",
    "targetKinematics": {
      "minLar": 0.2,
      "maxLar": 0.52,
      "minMwr": 0.35,
      "maxMwr": 0.65,
      "minJawMm": 8
    },
    "clinicalCue": "Maintain continuous voicing between consonants",
    "difficulty": "medium"
  },
  {
    "level": 63,
    "tier": 4,
    "tierTitle": "Tier 4: Multisyllabic Motor Pacing & Fluency",
    "englishText": "Iniya Naal",
    "tamilText": "இனிய நாள்",
    "transliteration": "i-ni-ya naal",
    "meaning": "Pleasant Day",
    "targetViseme": "multisyllabic",
    "targetKinematics": {
      "minLar": 0.2,
      "maxLar": 0.55,
      "minMwr": 0.42,
      "maxMwr": 0.75,
      "minJawMm": 9
    },
    "clinicalCue": "Spread vowel onset transitioning into long open vowel",
    "difficulty": "medium"
  },
  {
    "level": 64,
    "tier": 4,
    "tierTitle": "Tier 4: Multisyllabic Motor Pacing & Fluency",
    "englishText": "Nanban Vaa",
    "tamilText": "நண்பன் வா",
    "transliteration": "nan-ban vaa",
    "meaning": "Friend Come",
    "targetViseme": "multisyllabic",
    "targetKinematics": {
      "minLar": 0.2,
      "maxLar": 0.5,
      "minMwr": 0.35,
      "maxMwr": 0.65,
      "minJawMm": 8
    },
    "clinicalCue": "Syllable boundary pacing: nan-ban-vaa",
    "difficulty": "medium"
  },
  {
    "level": 65,
    "tier": 4,
    "tierTitle": "Tier 4: Multisyllabic Motor Pacing & Fluency",
    "englishText": "Pechu Payirchi",
    "tamilText": "பேச்சுப் பயிற்சி",
    "transliteration": "pae-chu pa-yir-chi",
    "meaning": "Speech Therapy / Practice",
    "targetViseme": "multisyllabic",
    "targetKinematics": {
      "minLar": 0.18,
      "maxLar": 0.48,
      "minMwr": 0.38,
      "maxMwr": 0.7,
      "minJawMm": 8
    },
    "clinicalCue": "Iterative bilabial-affricate rehabilitative pacing",
    "difficulty": "medium"
  },
  {
    "level": 66,
    "tier": 4,
    "tierTitle": "Tier 4: Multisyllabic Motor Pacing & Fluency",
    "englishText": "Unmai Pesu",
    "tamilText": "உண்மை பேசு",
    "transliteration": "un-mai pae-su",
    "meaning": "Speak Truth",
    "targetViseme": "multisyllabic",
    "targetKinematics": {
      "minLar": 0.18,
      "maxLar": 0.48,
      "minMwr": 0.32,
      "maxMwr": 0.65,
      "minJawMm": 7
    },
    "clinicalCue": "Retroflex nasal into bilabial plosive command",
    "difficulty": "medium"
  },
  {
    "level": 67,
    "tier": 4,
    "tierTitle": "Tier 4: Multisyllabic Motor Pacing & Fluency",
    "englishText": "Malar Maalai",
    "tamilText": "மலர் மாலை",
    "transliteration": "ma-lar maa-lai",
    "meaning": "Flower Garland",
    "targetViseme": "multisyllabic",
    "targetKinematics": {
      "minLar": 0.22,
      "maxLar": 0.56,
      "minMwr": 0.35,
      "maxMwr": 0.65,
      "minJawMm": 9
    },
    "clinicalCue": "Rhythmic double bilabial onset rhythm",
    "difficulty": "medium"
  },
  {
    "level": 68,
    "tier": 4,
    "tierTitle": "Tier 4: Multisyllabic Motor Pacing & Fluency",
    "englishText": "Kuyil Paattu",
    "tamilText": "குயில் பாட்டு",
    "transliteration": "ku-yil paat-tu",
    "meaning": "Cuckoo Song",
    "targetViseme": "multisyllabic",
    "targetKinematics": {
      "minLar": 0.2,
      "maxLar": 0.52,
      "minMwr": 0.32,
      "maxMwr": 0.65,
      "minJawMm": 8
    },
    "clinicalCue": "Velar to lateral to bilabial transition",
    "difficulty": "medium"
  },
  {
    "level": 69,
    "tier": 4,
    "tierTitle": "Tier 4: Multisyllabic Motor Pacing & Fluency",
    "englishText": "Senthamizh Sol",
    "tamilText": "செந்தமிழ் சொல்",
    "transliteration": "sen-tha-mizh sol",
    "meaning": "Pure Tamil Word",
    "targetViseme": "multisyllabic",
    "targetKinematics": {
      "minLar": 0.18,
      "maxLar": 0.46,
      "minMwr": 0.35,
      "maxMwr": 0.68,
      "minJawMm": 7
    },
    "clinicalCue": "Affricate into retroflex approximant /zh/",
    "difficulty": "medium"
  },
  {
    "level": 70,
    "tier": 4,
    "tierTitle": "Tier 4: Multisyllabic Motor Pacing & Fluency",
    "englishText": "Vaazhga Valamudan",
    "tamilText": "வாழ்க வளமுடன்",
    "transliteration": "vaazh-ga va-la-mu-dan",
    "meaning": "Live with Prosperity",
    "targetViseme": "multisyllabic",
    "targetKinematics": {
      "minLar": 0.22,
      "maxLar": 0.54,
      "minMwr": 0.35,
      "maxMwr": 0.65,
      "minJawMm": 9
    },
    "clinicalCue": "Four-syllable functional blessing fluency",
    "difficulty": "medium"
  },
  {
    "level": 71,
    "tier": 4,
    "tierTitle": "Tier 4: Multisyllabic Motor Pacing & Fluency",
    "englishText": "Neer Kudi",
    "tamilText": "நீர் குடி",
    "transliteration": "neer ku-di",
    "meaning": "Drink Water",
    "targetViseme": "multisyllabic",
    "targetKinematics": {
      "minLar": 0.18,
      "maxLar": 0.44,
      "minMwr": 0.35,
      "maxMwr": 0.65,
      "minJawMm": 7
    },
    "clinicalCue": "High vowel into velar plosive imperative",
    "difficulty": "medium"
  },
  {
    "level": 72,
    "tier": 4,
    "tierTitle": "Tier 4: Multisyllabic Motor Pacing & Fluency",
    "englishText": "Nalla Manam",
    "tamilText": "நல்ல மனம்",
    "transliteration": "nal-la ma-nam",
    "meaning": "Kind Heart",
    "targetViseme": "multisyllabic",
    "targetKinematics": {
      "minLar": 0.2,
      "maxLar": 0.5,
      "minMwr": 0.36,
      "maxMwr": 0.65,
      "minJawMm": 8
    },
    "clinicalCue": "Geminate lateral into bilabial onset",
    "difficulty": "medium"
  },
  {
    "level": 73,
    "tier": 4,
    "tierTitle": "Tier 4: Multisyllabic Motor Pacing & Fluency",
    "englishText": "Pudhiya Paathai",
    "tamilText": "புதிய பாதை",
    "transliteration": "pu-dhi-ya paa-thai",
    "meaning": "New Path",
    "targetViseme": "multisyllabic",
    "targetKinematics": {
      "minLar": 0.22,
      "maxLar": 0.54,
      "minMwr": 0.35,
      "maxMwr": 0.65,
      "minJawMm": 8
    },
    "clinicalCue": "Plosive-dental rhythmic pairing",
    "difficulty": "medium"
  },
  {
    "level": 74,
    "tier": 4,
    "tierTitle": "Tier 4: Multisyllabic Motor Pacing & Fluency",
    "englishText": "Anbu Kattu",
    "tamilText": "அன்பு காட்டு",
    "transliteration": "an-bu kaat-tu",
    "meaning": "Show Love",
    "targetViseme": "multisyllabic",
    "targetKinematics": {
      "minLar": 0.24,
      "maxLar": 0.58,
      "minMwr": 0.35,
      "maxMwr": 0.65,
      "minJawMm": 9
    },
    "clinicalCue": "Vocalic opening to bilabial to velar open",
    "difficulty": "medium"
  },
  {
    "level": 75,
    "tier": 4,
    "tierTitle": "Tier 4: Multisyllabic Motor Pacing & Fluency",
    "englishText": "Thunbam Neekku",
    "tamilText": "துன்பம் நீக்கு",
    "transliteration": "thun-bam neek-ku",
    "meaning": "Overcome Sorrow",
    "targetViseme": "multisyllabic",
    "targetKinematics": {
      "minLar": 0.18,
      "maxLar": 0.48,
      "minMwr": 0.35,
      "maxMwr": 0.68,
      "minJawMm": 7
    },
    "clinicalCue": "Dental stop to bilabial coda to high spread vowel",
    "difficulty": "medium"
  },
  {
    "level": 76,
    "tier": 4,
    "tierTitle": "Tier 4: Multisyllabic Motor Pacing & Fluency",
    "englishText": "Vetri Namadhey",
    "tamilText": "வெற்றி நமதே",
    "transliteration": "vet-ri na-ma-dhae",
    "meaning": "Victory is Ours",
    "targetViseme": "multisyllabic",
    "targetKinematics": {
      "minLar": 0.2,
      "maxLar": 0.5,
      "minMwr": 0.38,
      "maxMwr": 0.68,
      "minJawMm": 8
    },
    "clinicalCue": "Rhythmic declarative cadence",
    "difficulty": "medium"
  },
  {
    "level": 77,
    "tier": 4,
    "tierTitle": "Tier 4: Multisyllabic Motor Pacing & Fluency",
    "englishText": "Arivu Thiram",
    "tamilText": "அறிவுத் திறம்",
    "transliteration": "a-ri-vu thi-ram",
    "meaning": "Wisdom Skill",
    "targetViseme": "multisyllabic",
    "targetKinematics": {
      "minLar": 0.2,
      "maxLar": 0.52,
      "minMwr": 0.36,
      "maxMwr": 0.65,
      "minJawMm": 8
    },
    "clinicalCue": "Smooth speech motor transition across 4 syllables",
    "difficulty": "medium"
  },
  {
    "level": 78,
    "tier": 4,
    "tierTitle": "Tier 4: Multisyllabic Motor Pacing & Fluency",
    "englishText": "Seidhimadal Paaru",
    "tamilText": "செய்திமடல் பாரு",
    "transliteration": "sei-dhi-ma-dal paa-ru",
    "meaning": "Read the Newsletter",
    "targetViseme": "multisyllabic",
    "targetKinematics": {
      "minLar": 0.22,
      "maxLar": 0.54,
      "minMwr": 0.35,
      "maxMwr": 0.65,
      "minJawMm": 8
    },
    "clinicalCue": "Complex alveolar-bilabial-plosive sequencing",
    "difficulty": "medium"
  },
  {
    "level": 79,
    "tier": 4,
    "tierTitle": "Tier 4: Multisyllabic Motor Pacing & Fluency",
    "englishText": "Urangum Neram",
    "tamilText": "உறங்கும் நேரம்",
    "transliteration": "u-rang-gum nae-ram",
    "meaning": "Sleeping Time",
    "targetViseme": "multisyllabic",
    "targetKinematics": {
      "minLar": 0.2,
      "maxLar": 0.5,
      "minMwr": 0.3,
      "maxMwr": 0.62,
      "minJawMm": 8
    },
    "clinicalCue": "Rounded onset into nasal velar cluster",
    "difficulty": "medium"
  },
  {
    "level": 80,
    "tier": 4,
    "tierTitle": "Tier 4: Multisyllabic Motor Pacing & Fluency",
    "englishText": "Vaanavil Azhagu",
    "tamilText": "வானவில் அழகு",
    "transliteration": "vaa-na-vil a-zha-gu",
    "meaning": "Rainbow Beauty",
    "targetViseme": "multisyllabic",
    "targetKinematics": {
      "minLar": 0.24,
      "maxLar": 0.58,
      "minMwr": 0.35,
      "maxMwr": 0.65,
      "minJawMm": 9
    },
    "clinicalCue": "Wide jaw excursion into retroflex approximant",
    "difficulty": "medium"
  },
  {
    "level": 81,
    "tier": 5,
    "tierTitle": "Tier 5: Conversational Sentences & Functional Recovery",
    "englishText": "Enakku thanneer vendum",
    "tamilText": "எனக்கு தண்ணீர் வேண்டும்",
    "transliteration": "e-nak-ku than-neer vaen-dum",
    "meaning": "I want water",
    "targetViseme": "multisyllabic",
    "targetKinematics": {
      "minLar": 0.2,
      "maxLar": 0.54,
      "minMwr": 0.35,
      "maxMwr": 0.68,
      "minJawMm": 9
    },
    "clinicalCue": "Essential functional communication phrase for daily needs",
    "difficulty": "advanced"
  },
  {
    "level": 82,
    "tier": 5,
    "tierTitle": "Tier 5: Conversational Sentences & Functional Recovery",
    "englishText": "Naan nalamaga irukkiren",
    "tamilText": "நான் நலமாக இருக்கிறேன்",
    "transliteration": "naan na-la-maa-ga i-ruk-ki-raen",
    "meaning": "I am doing well",
    "targetViseme": "multisyllabic",
    "targetKinematics": {
      "minLar": 0.22,
      "maxLar": 0.56,
      "minMwr": 0.36,
      "maxMwr": 0.68,
      "minJawMm": 9
    },
    "clinicalCue": "Social interaction sentence with sustained breath support",
    "difficulty": "advanced"
  },
  {
    "level": 83,
    "tier": 5,
    "tierTitle": "Tier 5: Conversational Sentences & Functional Recovery",
    "englishText": "Indru migavum nalla naal",
    "tamilText": "இன்று மிகவும் நல்ல நாள்",
    "transliteration": "in-dru mi-ga-vum nal-la naal",
    "meaning": "Today is a very good day",
    "targetViseme": "multisyllabic",
    "targetKinematics": {
      "minLar": 0.22,
      "maxLar": 0.55,
      "minMwr": 0.35,
      "maxMwr": 0.68,
      "minJawMm": 9
    },
    "clinicalCue": "Compound sentence with balanced prosody and pitch",
    "difficulty": "advanced"
  },
  {
    "level": 84,
    "tier": 5,
    "tierTitle": "Tier 5: Conversational Sentences & Functional Recovery",
    "englishText": "En peyar Hari",
    "tamilText": "என் பெயர் ஹரி",
    "transliteration": "en pe-yar ha-ri",
    "meaning": "My name is Hari",
    "targetViseme": "multisyllabic",
    "targetKinematics": {
      "minLar": 0.2,
      "maxLar": 0.52,
      "minMwr": 0.38,
      "maxMwr": 0.7,
      "minJawMm": 8
    },
    "clinicalCue": "Personal identification sentence with clear vowel boundaries",
    "difficulty": "advanced"
  },
  {
    "level": 85,
    "tier": 5,
    "tierTitle": "Tier 5: Conversational Sentences & Functional Recovery",
    "englishText": "Maruthuvaridam poga vendum",
    "tamilText": "மருத்துவரிடம் போக வேண்டும்",
    "transliteration": "ma-ruth-thu-va-ri-dam poa-ga vaen-dum",
    "meaning": "Need to visit the doctor",
    "targetViseme": "multisyllabic",
    "targetKinematics": {
      "minLar": 0.2,
      "maxLar": 0.52,
      "minMwr": 0.32,
      "maxMwr": 0.65,
      "minJawMm": 8
    },
    "clinicalCue": "Multisyllabic healthcare communication statement",
    "difficulty": "advanced"
  },
  {
    "level": 86,
    "tier": 5,
    "tierTitle": "Tier 5: Conversational Sentences & Functional Recovery",
    "englishText": "Kaalai unavu saapitten",
    "tamilText": "காலை உணவு சாப்பிட்டேன்",
    "transliteration": "kaa-lai u-na-vu saap-pit-taen",
    "meaning": "I ate breakfast",
    "targetViseme": "multisyllabic",
    "targetKinematics": {
      "minLar": 0.24,
      "maxLar": 0.58,
      "minMwr": 0.35,
      "maxMwr": 0.68,
      "minJawMm": 9
    },
    "clinicalCue": "Daily routine report with open vowel excursions",
    "difficulty": "advanced"
  },
  {
    "level": 87,
    "tier": 5,
    "tierTitle": "Tier 5: Conversational Sentences & Functional Recovery",
    "englishText": "Naan thelivaga pesugiren",
    "tamilText": "நான் தெளிவாகப் பேசுகிறேன்",
    "transliteration": "naan the-li-vaa-ga pae-su-gi-raen",
    "meaning": "I speak clearly and with confidence",
    "targetViseme": "multisyllabic",
    "targetKinematics": {
      "minLar": 0.22,
      "maxLar": 0.56,
      "minMwr": 0.36,
      "maxMwr": 0.7,
      "minJawMm": 9
    },
    "clinicalCue": "Therapeutic affirmation targeting precise articulation",
    "difficulty": "advanced"
  },
  {
    "level": 88,
    "tier": 5,
    "tierTitle": "Tier 5: Conversational Sentences & Functional Recovery",
    "englishText": "En kural nalam perugiradhu",
    "tamilText": "என் குரல் நலம் பெறுகிறது",
    "transliteration": "en ku-ral na-lam pe-ru-gi-ra-dhu",
    "meaning": "My vocal health is improving",
    "targetViseme": "multisyllabic",
    "targetKinematics": {
      "minLar": 0.2,
      "maxLar": 0.52,
      "minMwr": 0.34,
      "maxMwr": 0.65,
      "minJawMm": 8
    },
    "clinicalCue": "Vocal cord resonance and pacing sustain",
    "difficulty": "advanced"
  },
  {
    "level": 89,
    "tier": 5,
    "tierTitle": "Tier 5: Conversational Sentences & Functional Recovery",
    "englishText": "Udalukku udarpayirchi mukkiyam",
    "tamilText": "உடலுக்கு உடற்பயிற்சி முக்கியம்",
    "transliteration": "u-da-luk-ku u-dar-pa-yir-chi muk-ki-yam",
    "meaning": "Exercise is important for body",
    "targetViseme": "multisyllabic",
    "targetKinematics": {
      "minLar": 0.2,
      "maxLar": 0.5,
      "minMwr": 0.3,
      "maxMwr": 0.65,
      "minJawMm": 8
    },
    "clinicalCue": "Long complex phrase testing articulatory agility",
    "difficulty": "advanced"
  },
  {
    "level": 90,
    "tier": 5,
    "tierTitle": "Tier 5: Conversational Sentences & Functional Recovery",
    "englishText": "Pudhiya seidhi enna",
    "tamilText": "புதிய செய்தி என்ன",
    "transliteration": "pu-dhi-ya sei-dhi en-na",
    "meaning": "What is the new news?",
    "targetViseme": "multisyllabic",
    "targetKinematics": {
      "minLar": 0.2,
      "maxLar": 0.52,
      "minMwr": 0.36,
      "maxMwr": 0.68,
      "minJawMm": 8
    },
    "clinicalCue": "Question intonation contour rising at sentence end",
    "difficulty": "advanced"
  },
  {
    "level": 91,
    "tier": 5,
    "tierTitle": "Tier 5: Conversational Sentences & Functional Recovery",
    "englishText": "Manadhil amaidhi irukkatum",
    "tamilText": "மனதில் அமைதி இருக்கட்டும்",
    "transliteration": "ma-na-dhil a-mai-dhi i-ruk-kat-tum",
    "meaning": "Let there be peace in mind",
    "targetViseme": "multisyllabic",
    "targetKinematics": {
      "minLar": 0.2,
      "maxLar": 0.52,
      "minMwr": 0.35,
      "maxMwr": 0.65,
      "minJawMm": 8
    },
    "clinicalCue": "Relaxed jaw displacement with diaphragmatic support",
    "difficulty": "advanced"
  },
  {
    "level": 92,
    "tier": 5,
    "tierTitle": "Tier 5: Conversational Sentences & Functional Recovery",
    "englishText": "Pasi edukkindradhu unavu thaarungal",
    "tamilText": "பசி எடுக்கின்றது உணவு தாருங்கள்",
    "transliteration": "pa-si e-duk-kin-dra-dhu u-na-vu thaa-run-gal",
    "meaning": "Feeling hungry, please give food",
    "targetViseme": "multisyllabic",
    "targetKinematics": {
      "minLar": 0.22,
      "maxLar": 0.56,
      "minMwr": 0.35,
      "maxMwr": 0.68,
      "minJawMm": 9
    },
    "clinicalCue": "Complex two-clause functional request",
    "difficulty": "advanced"
  },
  {
    "level": 93,
    "tier": 5,
    "tierTitle": "Tier 5: Conversational Sentences & Functional Recovery",
    "englishText": "Vaanilai indru kuliraga ulladhu",
    "tamilText": "வானிலை இன்று குளிராக உள்ளது",
    "transliteration": "vaa-ni-lai in-dru ku-li-raa-ga ul-la-dhu",
    "meaning": "The weather is cool today",
    "targetViseme": "multisyllabic",
    "targetKinematics": {
      "minLar": 0.24,
      "maxLar": 0.56,
      "minMwr": 0.35,
      "maxMwr": 0.68,
      "minJawMm": 9
    },
    "clinicalCue": "Descriptive observation testing consonant clusters",
    "difficulty": "advanced"
  },
  {
    "level": 94,
    "tier": 5,
    "tierTitle": "Tier 5: Conversational Sentences & Functional Recovery",
    "englishText": "Kudumbathodu magizhchiyaga vazhvom",
    "tamilText": "குடும்பத்தோடு மகிழ்ச்சியாக வாழ்வோம்",
    "transliteration": "ku-dum-bath-thoa-du ma-gizh-chi-yaa-ga vaazh-voam",
    "meaning": "Let us live happily with family",
    "targetViseme": "multisyllabic",
    "targetKinematics": {
      "minLar": 0.22,
      "maxLar": 0.54,
      "minMwr": 0.32,
      "maxMwr": 0.65,
      "minJawMm": 9
    },
    "clinicalCue": "Complex retroflex /zh/ and geminates in sentence",
    "difficulty": "advanced"
  },
  {
    "level": 95,
    "tier": 5,
    "tierTitle": "Tier 5: Conversational Sentences & Functional Recovery",
    "englishText": "Enadhu pechu thiran meendum vandhadhu",
    "tamilText": "எனது பேச்சுத் திறன் மீண்டும் வந்தது",
    "transliteration": "e-na-dhu pae-chuth thi-ran meen-dum van-dha-dhu",
    "meaning": "My speech capability has returned",
    "targetViseme": "multisyllabic",
    "targetKinematics": {
      "minLar": 0.22,
      "maxLar": 0.55,
      "minMwr": 0.36,
      "maxMwr": 0.7,
      "minJawMm": 9
    },
    "clinicalCue": "Stroke recovery empowerment milestone statement",
    "difficulty": "advanced"
  },
  {
    "level": 96,
    "tier": 5,
    "tierTitle": "Tier 5: Conversational Sentences & Functional Recovery",
    "englishText": "Malarndha mugathudan pesuvom",
    "tamilText": "மலர்ந்த முகத்துடன் பேசுவோம்",
    "transliteration": "ma-larn-dha mu-gath-thu-dan pae-su-voam",
    "meaning": "Let us speak with a smiling face",
    "targetViseme": "multisyllabic",
    "targetKinematics": {
      "minLar": 0.22,
      "maxLar": 0.54,
      "minMwr": 0.35,
      "maxMwr": 0.68,
      "minJawMm": 9
    },
    "clinicalCue": "Facial expression integration with speech motor control",
    "difficulty": "advanced"
  },
  {
    "level": 97,
    "tier": 5,
    "tierTitle": "Tier 5: Conversational Sentences & Functional Recovery",
    "englishText": "Kaalathin arumaiyai unarvom",
    "tamilText": "காலத்தின் அருமையை உணர்வோம்",
    "transliteration": "kaa-la-thin a-ru-mai-yai u-nar-voam",
    "meaning": "Let us realize the value of time",
    "targetViseme": "multisyllabic",
    "targetKinematics": {
      "minLar": 0.24,
      "maxLar": 0.58,
      "minMwr": 0.35,
      "maxMwr": 0.68,
      "minJawMm": 9
    },
    "clinicalCue": "Deep resonant vowels with clear coda consonants",
    "difficulty": "advanced"
  },
  {
    "level": 98,
    "tier": 5,
    "tierTitle": "Tier 5: Conversational Sentences & Functional Recovery",
    "englishText": "Thaimozhiyai anbudan pesuvom",
    "tamilText": "தாய்மொழியை அன்புடன் பேசுவோம்",
    "transliteration": "thaai-mo-zhi-yai an-bu-dan pae-su-voam",
    "meaning": "Let us speak mother tongue with love",
    "targetViseme": "multisyllabic",
    "targetKinematics": {
      "minLar": 0.25,
      "maxLar": 0.58,
      "minMwr": 0.36,
      "maxMwr": 0.68,
      "minJawMm": 10
    },
    "clinicalCue": "Extended oral aperture excursion and fluency",
    "difficulty": "advanced"
  },
  {
    "level": 99,
    "tier": 5,
    "tierTitle": "Tier 5: Conversational Sentences & Functional Recovery",
    "englishText": "Innoru murai koorungal",
    "tamilText": "இன்னொரு முறை கூறுங்கள்",
    "transliteration": "in-no-ru mu-rai koo-run-gal",
    "meaning": "Please say that once again",
    "targetViseme": "multisyllabic",
    "targetKinematics": {
      "minLar": 0.2,
      "maxLar": 0.52,
      "minMwr": 0.32,
      "maxMwr": 0.65,
      "minJawMm": 8
    },
    "clinicalCue": "Conversational clarification and request pacing",
    "difficulty": "advanced"
  },
  {
    "level": 100,
    "tier": 5,
    "tierTitle": "Tier 5: Conversational Sentences & Functional Recovery",
    "englishText": "Naan vetrigaramaaga therchi petren",
    "tamilText": "நான் வெற்றிகரமாகத் தேர்ச்சி பெற்றேன்",
    "transliteration": "naan vet-ri-ga-ra-maa-ga thaer-chi pet-raen",
    "meaning": "I have graduated successfully with victory!",
    "targetViseme": "multisyllabic",
    "targetKinematics": {
      "minLar": 0.24,
      "maxLar": 0.6,
      "minMwr": 0.38,
      "maxMwr": 0.72,
      "minJawMm": 11
    },
    "clinicalCue": "Grand master speech graduation sentence - 100% full recovery!",
    "difficulty": "advanced"
  }
];

export function getLevelData(levelNumber: number): CurriculumLevel {
  const clamped = Math.max(1, Math.min(100, levelNumber));
  return REHAB_100_LEVELS[clamped - 1] || REHAB_100_LEVELS[0];
}

export function getLevelsByTier(tier: 1 | 2 | 3 | 4 | 5): CurriculumLevel[] {
  return REHAB_100_LEVELS.filter((lvl) => lvl.tier === tier);
}
