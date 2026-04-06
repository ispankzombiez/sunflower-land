/**
 * Nightshade Arcade portal types
 */

import { GameState } from "features/game/types/game";

export type PortalGameState = GameState;

export type MinigameName =
  | "poker"
  | "slots"
  | "barley-breaker"
  | "blackjack"
  | "roulette"
  | "gofish"
  | "uno"
  | "solitaire"
  | "goblin-invaders"
  | "tetris"
  | "pac-man"
  | "frogger";

export interface Coordinates {
  x: number;
  y: number;
}
