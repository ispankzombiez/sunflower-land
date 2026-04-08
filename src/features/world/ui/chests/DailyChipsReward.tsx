import React, { useContext } from "react";
import { useSelector } from "@xstate/react";
import { Context } from "features/game/GameProvider";
import { SpeakingModal } from "features/game/components/SpeakingModal";
import { Decimal } from "decimal.js-light";

interface Props {
  onClose: () => void;
}

const _gameState = (state: any) => state?.context?.state;

export const DailyRavenCoinReward: React.FC<Props> = ({ onClose }) => {
  const { gameService } = useContext(Context);

  const gameStateValue = useSelector(gameService!, _gameState);
  const gameState = gameService ? gameStateValue : undefined;

  const dateKey = new Date().toISOString().slice(0, 10);

  // Daily RavenCoin logic
  const lastClaimDate = gameState?.dailyRavenCoinsLastClaimDate || null;
  const isEligibleForDailyRavenCoins =
    !lastClaimDate || lastClaimDate !== dateKey;

  const dailyRavenCoinReward = new Decimal(1000);

  const onClaimDailyRavenCoins = () => {
    gameService.send("dailyRavenCoins.claimed", {
      reward: dailyRavenCoinReward.toNumber(),
    });
    onClose();
  };

  if (!isEligibleForDailyRavenCoins) {
    // Already claimed today
    return (
      <SpeakingModal
        onClose={onClose}
        message={[
          {
            text: "You've already claimed your daily RavenCoin reward. Come back tomorrow.",
          },
        ]}
      />
    );
  }

  // Eligible and has reward
  return (
    <SpeakingModal
      onClose={onClaimDailyRavenCoins}
      message={[
        {
          text: `Daily reward! You've been awarded ${dailyRavenCoinReward.toNumber()} RavenCoin!`,
          actions: [
            {
              text: "Claim",
              cb: onClaimDailyRavenCoins,
            },
          ],
        },
      ]}
    />
  );
};
