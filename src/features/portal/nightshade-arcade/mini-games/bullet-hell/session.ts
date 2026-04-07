import { GameState } from "features/game/types/game";
import { getTodayKey, isRewardRunAvailableForMinigame } from "../poker/session";

export const BULLET_HELL_RAVEN_COIN_REWARD = 1;

export type BulletHellMode = "reward" | "practice";
export type BulletHellDailyTargetFloor = 1 | 2 | 3;

export const BULLET_HELL_MAX_FLOOR = 3;

export const BULLET_HELL_CURSES = [
  "darkness",
  "unknown-hp",
  "lost-map",
] as const;

export type BulletHellCurseType = (typeof BULLET_HELL_CURSES)[number];

export const FLOOR_ROOM_RANGES: Record<number, { min: number; max: number }> = {
  1: { min: 12, max: 14 },
  2: { min: 13, max: 15 },
  3: { min: 14, max: 16 },
};

const getSeedFromToday = (now: Date | number = Date.now()) => {
  const todayKey = getTodayKey(now);

  const seed = todayKey.split("").reduce((accumulator, character) => {
    return Math.imul(accumulator, 31) + character.charCodeAt(0);
  }, 271);

  return seed >>> 0;
};

export const getBulletHellDailyTargetFloor = (
  now: Date | number = Date.now(),
): BulletHellDailyTargetFloor => {
  const seed = getSeedFromToday(now);
  const roll = seed % 100;

  if (roll < 45) return 1;
  if (roll < 75) return 2;

  return 3;
};

export const getBulletHellDailyCurse = (
  floor: number,
  now: Date | number = Date.now(),
): BulletHellCurseType | null => {
  const seed = getSeedFromToday(now) ^ Math.imul(floor, 131);
  const chanceRoll = seed % 100;

  if (chanceRoll >= 30) {
    return null;
  }

  return BULLET_HELL_CURSES[seed % BULLET_HELL_CURSES.length];
};

export const isBulletHellRewardRunAvailable = ({
  game,
  isVip,
  now = Date.now(),
}: {
  game: GameState;
  isVip: boolean;
  now?: Date | number;
}): boolean => {
  return isRewardRunAvailableForMinigame({
    game,
    minigame: "bullet-hell" as any,
    isVip,
    now,
  });
};
