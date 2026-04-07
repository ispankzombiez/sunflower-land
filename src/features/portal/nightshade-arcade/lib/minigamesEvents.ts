/**
 * Minigames Event Emitter
 * Manages communication between the portal scene and minigame modals
 */

type MinigameType =
  | "poker"
  | "slots"
  | "barley-breaker"
  | "bullet-hell"
  | "roulette"
  | "blackjack"
  | "gofish"
  | "uno"
  | "solitaire"
  | "goblin-invaders"
  | "tetris"
  | "pac-man"
  | "frogger";

interface MinigameEvent {
  type: MinigameType;
  machineId?: string;
}

class MinigamesEventEmitter {
  private listeners: Map<MinigameType, Set<() => void>> = new Map();

  subscribe(gameType: MinigameType, callback: () => void): () => void {
    if (!this.listeners.has(gameType)) {
      this.listeners.set(gameType, new Set());
    }
    this.listeners.get(gameType)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(gameType)?.delete(callback);
    };
  }

  emit(event: MinigameEvent): void {
    const callbacks = this.listeners.get(event.type);
    if (callbacks) {
      callbacks.forEach((callback) => callback());
    }
  }
}

export const minigamesEventEmitter = new MinigamesEventEmitter();
