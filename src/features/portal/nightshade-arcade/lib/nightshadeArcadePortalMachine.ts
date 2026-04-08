import { assign, createMachine, Interpreter, State } from "xstate";
import { getJwt, getUrl, loadPortal } from "../../actions/loadPortal";
import { CONFIG } from "lib/config";
import { decodeToken } from "features/auth/actions/login";
import { Decimal } from "decimal.js-light";
import { NIGHTSHADE_ARCADE_SHOP } from "./nightshadeArcadeShop";
import { PortalGameState } from "../types";
import { OFFLINE_FARM } from "features/game/lib/landData";
import { MinigameName } from "../types";
import { Minigame } from "features/game/types/game";
import { InventoryItemName } from "features/game/types/game";
import { MAX_PAID_REWARD_ATTEMPTS_PER_DAY } from "../mini-games/poker/session";

type ArcadeTier = "basic" | "rare" | "epic" | "mega";

const getArcadeMinigame = (
  state: PortalGameState,
  name: MinigameName,
): Minigame => {
  return (
    state.minigames.games[name] ?? {
      history: {},
      highscore: 0,
    }
  );
};

export interface Context {
  id: number;
  jwt: string;
  state: PortalGameState;
}

export type PortalEvent =
  | { type: "RETRY" }
  | { type: "dailyRavenCoins.claimed"; reward: number }
  | { type: "chapterItem.bought"; name: InventoryItemName; tier: ArcadeTier }
  | { type: "arcadeMinigame.started"; name: MinigameName }
  | {
      type: "arcadeMinigame.attemptPurchased";
      name: MinigameName;
      flowerCost: number;
    }
  | { type: "arcadeMinigame.ravenCoinWon"; amount: number };

export type PortalState = {
  value: "initialising" | "error" | "unauthorised" | "loading" | "playing";
  context: Context;
};

export type MachineInterpreter = Interpreter<
  Context,
  any,
  PortalEvent,
  PortalState
>;

export type PortalMachineState = State<Context, PortalEvent, PortalState>;

export const nightshadeArcadePortalMachine = createMachine({
  id: "nightshadeArcadeMachine",
  initial: "initialising",
  context: {
    id: 0,
    jwt: getJwt(),
    state: OFFLINE_FARM,
  },
  states: {
    initialising: {
      always: [
        {
          target: "unauthorised",
          // TODO: Also validate token
          cond: (context) => !!CONFIG.API_URL && !context.jwt,
        },
        {
          target: "loading",
        },
      ],
    },

    loading: {
      id: "loading",
      invoke: {
        src: async (context) => {
          if (!getUrl()) {
            return {
              game: OFFLINE_FARM,
            };
          }

          const { farmId } = decodeToken(context.jwt as string);

          // Load the portal data from API
          const { game } = await loadPortal({
            portalId: CONFIG.PORTAL_APP,
            token: context.jwt as string,
          });

          return { game, farmId };
        },
        onDone: [
          {
            target: "playing",
            actions: assign({
              state: (_: any, event) => event.data.game,
              id: (_: any, event) => event.data.farmId,
            }),
          },
        ],
        onError: {
          target: "error",
        },
      },
    },

    playing: {
      on: {
        "dailyRavenCoins.claimed": {
          actions: [
            assign({
              state: (context) => {
                const dateKey = new Date().toISOString().slice(0, 10);
                const lastClaimDate =
                  context.state.dailyRavenCoinsLastClaimDate ?? null;
                const isEligible =
                  lastClaimDate === null || lastClaimDate !== dateKey;

                if (isEligible) {
                  const currentRavenCoins = new Decimal(
                    context.state.inventory.RavenCoin ?? 0,
                  );
                  const dailyReward = new Decimal(1000);

                  return {
                    ...context.state,
                    inventory: {
                      ...context.state.inventory,
                      RavenCoin: currentRavenCoins.plus(dailyReward),
                    },
                    dailyRavenCoinsLastClaimDate: dateKey,
                  };
                }
                return context.state;
              },
            }),
          ],
        },
        "chapterItem.bought": {
          actions: [
            assign({
              state: (context, event: any) => {
                const { name, tier } = event as {
                  name: InventoryItemName;
                  tier: ArcadeTier;
                };

                const tierItems = NIGHTSHADE_ARCADE_SHOP[tier]?.items || [];
                const item = tierItems.find((i: any) => i.name === name);

                if (!item) {
                  return context.state;
                }

                const cost = item.cost.items.RavenCoin || 0;
                const currentRavenCoins = new Decimal(
                  context.state.inventory.RavenCoin ?? 0,
                );

                if (currentRavenCoins.lt(cost)) {
                  return context.state;
                }

                const newRavenCoins = currentRavenCoins.minus(cost);
                const currentItemCount = new Decimal(
                  context.state.inventory[name] ?? 0,
                );

                return {
                  ...context.state,
                  inventory: {
                    ...context.state.inventory,
                    RavenCoin: newRavenCoins,
                    [name]: currentItemCount.plus(1),
                  },
                };
              },
            }),
          ],
        },
        "arcadeMinigame.started": {
          actions: [
            assign({
              state: (context, event: any) => {
                const { name } = event as { name: MinigameName };
                const todayKey = new Date().toISOString().slice(0, 10);
                const minigame = getArcadeMinigame(context.state, name);
                const daily = minigame.history[todayKey] ?? {
                  attempts: 0,
                  highscore: 0,
                };

                return {
                  ...context.state,
                  minigames: {
                    ...context.state.minigames,
                    games: {
                      ...context.state.minigames.games,
                      [name]: {
                        ...minigame,
                        history: {
                          ...minigame.history,
                          [todayKey]: {
                            ...daily,
                            attempts: daily.attempts + 1,
                          },
                        },
                      },
                    },
                  },
                };
              },
            }),
          ],
        },
        "arcadeMinigame.attemptPurchased": {
          actions: [
            assign({
              state: (context, event: any) => {
                const { name, flowerCost } = event as {
                  name: MinigameName;
                  flowerCost: number;
                };

                const minigame = getArcadeMinigame(context.state, name);
                const currentFlower = new Decimal(context.state.balance ?? 0);
                const cost = new Decimal(flowerCost ?? 0);
                const todayKey = new Date().toISOString().slice(0, 10);
                const purchasesUsedToday = (minigame.purchases ?? []).reduce(
                  (total, purchase) => {
                    const purchaseDay = new Date(purchase.purchasedAt)
                      .toISOString()
                      .slice(0, 10);
                    return total + (purchaseDay === todayKey ? 1 : 0);
                  },
                  0,
                );

                if (purchasesUsedToday >= MAX_PAID_REWARD_ATTEMPTS_PER_DAY) {
                  return context.state;
                }

                if (currentFlower.lt(cost)) {
                  return context.state;
                }

                return {
                  ...context.state,
                  balance: currentFlower.minus(cost),
                  minigames: {
                    ...context.state.minigames,
                    games: {
                      ...context.state.minigames.games,
                      [name]: {
                        ...minigame,
                        purchases: [
                          ...(minigame.purchases ?? []),
                          {
                            sfl: flowerCost,
                            items: {},
                            purchasedAt: Date.now(),
                          },
                        ],
                      },
                    },
                  },
                };
              },
            }),
          ],
        },
        "arcadeMinigame.ravenCoinWon": {
          actions: [
            assign({
              state: (context, event: any) => {
                const currentRavenCoins = new Decimal(
                  context.state.inventory.RavenCoin ?? 0,
                );
                const amount = new Decimal(event.amount ?? 0);

                return {
                  ...context.state,
                  inventory: {
                    ...context.state.inventory,
                    RavenCoin: currentRavenCoins.plus(amount),
                  },
                };
              },
            }),
          ],
        },
      },
    },

    error: {
      on: {
        RETRY: {
          target: "initialising",
        },
      },
    },
    unauthorised: {},
  },
});
