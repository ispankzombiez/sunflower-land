import Decimal from "decimal.js-light";
import { GameState } from "features/game/types/game";
import { produce } from "immer";

export type PokerBetPlacedAction = {
  type: "poker.betPlaced";
  amount: number;
};

type Options = {
  state: Readonly<GameState>;
  action: PokerBetPlacedAction;
  createdAt?: number;
};

export function pokerBetPlaced({
  state,
  action,
  createdAt = Date.now(),
}: Options): GameState {
  void createdAt;

  return produce(state, (draft) => {
    const currentRavenCoins = new Decimal(draft.inventory.RavenCoin ?? 0);
    const betAmount = new Decimal(action.amount);

    // Deduct the bet amount from inventory
    draft.inventory.RavenCoin = currentRavenCoins.minus(betAmount);
  });
}
