import { Decimal } from "decimal.js-light";
import { GameState } from "features/game/types/game";
import { produce } from "immer";

export type ClaimDailyRavenCoinsAction = {
  type: "dailyRavenCoins.claimed";
  reward: number;
};

type Options = {
  state: Readonly<GameState>;
  action: ClaimDailyRavenCoinsAction;
  createdAt?: number;
};

export function claimDailyRavenCoins({
  state,
  action,
  createdAt = Date.now(),
}: Options): GameState {
  void createdAt;

  return produce(state, (draft) => {
    const dateKey = new Date().toISOString().slice(0, 10);
    const lastClaimDate = draft.dailyRavenCoinsLastClaimDate ?? null;

    // Check if player is eligible
    const isEligible = lastClaimDate === null || lastClaimDate !== dateKey;

    if (isEligible) {
      const currentRavenCoins = new Decimal(draft.inventory.RavenCoin ?? 0);
      const reward = new Decimal(action.reward ?? 0);

      if (reward.gt(0)) {
        draft.inventory.RavenCoin = currentRavenCoins.plus(reward);
      }

      draft.dailyRavenCoinsLastClaimDate = dateKey;
    }
  });
}
