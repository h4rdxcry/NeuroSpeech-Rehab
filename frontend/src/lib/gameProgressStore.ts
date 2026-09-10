/**
 * Persistent 100-Level Speech Rehabilitation Game Store.
 *
 * Tracks:
 * - Current active level (1 to 100)
 * - Highest unlocked level
 * - Star ratings per level (0 to 3 stars)
 * - High scores per level
 * - Total rehabilitation XP and streak
 *
 * Persisted in browser localStorage.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getLevelData, type CurriculumLevel } from "./rehabCurriculum";

export interface GameProgressState {
  currentLevel: number; // 1 to 100
  unlockedLevel: number; // 1 to 100
  levelStars: Record<number, number>;
  levelScores: Record<number, number>;
  totalXp: number;
  streakDays: number;
  lastPlayedDate: string;

  // Actions
  setCurrentLevel: (lvl: number) => void;
  nextLevel: () => void;
  prevLevel: () => void;
  recordLevelCompletion: (
    lvl: number,
    score: number,
    stars: number,
    xpEarned: number
  ) => { isNewUnlock: boolean; nextLvl: number };
  resetProgress: () => void;
  getCurrentLevelData: () => CurriculumLevel;
}

export const useGameProgressStore = create<GameProgressState>()(
  persist(
    (set, get) => ({
      currentLevel: 1,
      unlockedLevel: 1,
      levelStars: { 1: 0 },
      levelScores: { 1: 0 },
      totalXp: 0,
      streakDays: 1,
      lastPlayedDate: new Date().toISOString().slice(0, 10),

      setCurrentLevel: (lvl: number) => {
        const target = Math.max(1, Math.min(100, lvl));
        const unlocked = get().unlockedLevel;
        // Allow visiting any unlocked level, or if in preview allow exploring
        if (target <= unlocked || target <= 100) {
          set({ currentLevel: target });
        }
      },

      nextLevel: () => {
        const { currentLevel, unlockedLevel } = get();
        if (currentLevel < 100 && currentLevel < unlockedLevel) {
          set({ currentLevel: currentLevel + 1 });
        } else if (currentLevel < 100) {
          // If at unlocked frontier, allow advancing once mastered
          set({ currentLevel: currentLevel + 1 });
        }
      },

      prevLevel: () => {
        const { currentLevel } = get();
        if (currentLevel > 1) {
          set({ currentLevel: currentLevel - 1 });
        }
      },

      recordLevelCompletion: (lvl: number, score: number, stars: number, xpEarned: number) => {
        const state = get();
        const currentStars = state.levelStars[lvl] || 0;
        const currentScore = state.levelScores[lvl] || 0;

        const newStars = Math.max(currentStars, stars);
        const newScore = Math.max(currentScore, score);

        let newUnlocked = state.unlockedLevel;
        let isNewUnlock = false;

        // Unlock next level if level was mastered (score >= 75 or stars >= 1)
        if ((score >= 75 || stars >= 1) && lvl >= state.unlockedLevel && lvl < 100) {
          newUnlocked = lvl + 1;
          isNewUnlock = true;
        }

        const today = new Date().toISOString().slice(0, 10);
        let newStreak = state.streakDays;
        if (state.lastPlayedDate !== today) {
          newStreak = state.streakDays + 1;
        }

        set({
          levelStars: { ...state.levelStars, [lvl]: newStars },
          levelScores: { ...state.levelScores, [lvl]: newScore },
          totalXp: state.totalXp + xpEarned,
          unlockedLevel: newUnlocked,
          lastPlayedDate: today,
          streakDays: newStreak,
        });

        return { isNewUnlock, nextLvl: Math.min(100, lvl + 1) };
      },

      resetProgress: () => {
        set({
          currentLevel: 1,
          unlockedLevel: 1,
          levelStars: { 1: 0 },
          levelScores: { 1: 0 },
          totalXp: 0,
          streakDays: 1,
        });
      },

      getCurrentLevelData: () => {
        return getLevelData(get().currentLevel);
      },
    }),
    {
      name: "neurospeech_rehab_game_progress_v1",
    }
  )
);
