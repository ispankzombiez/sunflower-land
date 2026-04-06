/**
 * Event emitter for Nightshade Arcade interactions
 * Used to communicate between NightshadeArcadeScene and NightshadeArcade component
 */
export const nightshadeArcadeEvents = {
  onChestClicked: null as (() => void) | null,
  onMinigameRequested: null as ((gameType: string) => void) | null,
  onOpenShop: null as (() => void) | null,
  isMinigameActive: false,

  setMinigameActive(active: boolean) {
    this.isMinigameActive = active;
  },

  registerChestClickHandler(callback: (() => void) | null) {
    this.onChestClicked = callback;
  },

  registerMinigameHandler(callback: ((gameType: string) => void) | null) {
    this.onMinigameRequested = callback;
  },

  registerShopHandler(callback: (() => void) | null) {
    this.onOpenShop = callback;
  },

  emitChestClicked() {
    if (this.onChestClicked) {
      this.onChestClicked();
    }
  },

  emitMinigameRequested(gameType: string) {
    if (this.onMinigameRequested) {
      this.onMinigameRequested(gameType);
    }
  },

  emitOpenShop() {
    if (this.onOpenShop) {
      this.onOpenShop();
    }
  },
};
