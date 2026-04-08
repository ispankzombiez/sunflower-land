/**
 * Nightshade Arcade portal types
 */

import { GameState } from "features/game/types/game";
import { MinigameName as GameMinigameName } from "features/game/types/minigames";

export type PortalGameState = GameState;

export type MinigameName = GameMinigameName;

export interface Coordinates {
  x: number;
  y: number;
}
