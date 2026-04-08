/* eslint-disable react/jsx-no-literals */
import React, { useState } from "react";
import { useSelector } from "@xstate/react";
import { InnerPanel, OuterPanel } from "components/ui/Panel";
import { Label } from "components/ui/Label";
import { ModalOverlay } from "components/ui/ModalOverlay";
import { NIGHTSHADE_ARCADE_SHOP } from "../lib/nightshadeArcadeShop";
import type {
  PortalMachineState,
  MachineInterpreter,
} from "../lib/nightshadeArcadePortalMachine";
import { PIXEL_SCALE } from "../constants";
import { ITEM_DETAILS } from "features/game/types/images";
import type { InventoryItemName } from "../types/portalItemTypes";
import classNames from "classnames";
import RavenCoinIcon from "assets/icons/RavenCoin.webp";
import { SUNNYSIDE } from "assets/sunnyside";
import { useAppTranslation } from "lib/i18n/useAppTranslations";

const _state = (state: PortalMachineState) => state.context.state;

interface NightshadeArcadeShopProps {
  onClose: () => void;
  portalService?: MachineInterpreter;
}

type Tier = "basic" | "rare" | "epic" | "mega";

const TIER_LABELS: Record<
  Tier,
  { label: string; type: "default" | "info" | "vibrant" | "warning" | "danger" }
> = {
  basic: { label: "Basic Items", type: "default" },
  rare: { label: "Rare Items", type: "info" },
  epic: { label: "Epic Items", type: "vibrant" },
  mega: { label: "Mega Items", type: "warning" },
};

export const NightshadeArcadeShop: React.FC<NightshadeArcadeShopProps> = ({
  onClose,
  portalService,
}) => {
  const { t } = useAppTranslation();
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!portalService) {
    return (
      <OuterPanel>
        <InnerPanel className="p-2">
          <Label type="danger">Coming Soon</Label>
        </InnerPanel>
      </OuterPanel>
    );
  }

  const state = useSelector(portalService, _state);

  const ravenCoinBalance =
    typeof state.inventory.RavenCoin === "number"
      ? state.inventory.RavenCoin
      : (state.inventory.RavenCoin as any)?.toNumber?.() || 0;

  const handleBuy = (item: any, tier: Tier) => {
    const itemName = item.name;
    const cost = item.cost.items.RavenCoin || 0;
    const hasEnough = ravenCoinBalance >= cost;

    if (hasEnough) {
      portalService.send({
        type: "chapterItem.bought",
        name: itemName,
        tier: tier,
      });
      setErrorMessage(null);
      setSelectedItem(null);
    } else {
      setErrorMessage(t("error.insufficientRavenCoin"));
    }
  };

  return (
    <div className="relative">
      <OuterPanel>
        <InnerPanel className="h-[85vh] flex flex-col">
          {/* Header with Title and Close Button */}
          <div className="flex justify-between items-center mb-3 pb-2 border-b-2 border-gray-400 flex-shrink-0">
            <Label type="default">Prize Counter</Label>
            {/* Close Button */}
            <button
              onClick={onClose}
              className="flex-shrink-0 z-10"
              style={{
                width: PIXEL_SCALE * 11,
                height: PIXEL_SCALE * 11,
                padding: 0,
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              <img
                src={SUNNYSIDE.icons.close}
                alt="Close"
                style={{
                  width: "100%",
                  height: "100%",
                }}
              />
            </button>
          </div>

          {/* Coin Balance Bar */}
          <div className="flex items-center justify-end gap-2 mb-3 pb-2 border-b-2 border-gray-300 flex-shrink-0">
            <div className="flex items-center gap-1 bg-yellow-100 px-2 py-1 rounded border-2 border-yellow-700">
              <span className="text-2xl font-bold text-yellow-900 leading-none">
                {ravenCoinBalance}
              </span>
              <img
                src={RavenCoinIcon}
                alt="RavenCoin"
                style={{ width: "25px", height: "25px" }}
              />
            </div>
          </div>
          {errorMessage && (
            <div className="mb-2">
              <Label type="danger">{errorMessage}</Label>
            </div>
          )}

          {/* Scrollable Items Grid */}
          <div className="flex-1 overflow-y-auto scrollable space-y-5 pr-2">
            {(["basic", "rare", "epic", "mega"] as const).map((tier) => {
              const tierItems = NIGHTSHADE_ARCADE_SHOP[tier].items;
              const tierConfig = TIER_LABELS[tier];

              return (
                <div key={tier}>
                  <Label type={tierConfig.type} className="mb-3 text-sm">
                    {tierConfig.label}
                  </Label>

                  <div className="grid grid-cols-3 gap-3">
                    {tierItems.map((item: any, idx: number) => {
                      const itemName = item.name as InventoryItemName;
                      const cost = item.cost.items.RavenCoin || 0;
                      const canAfford = ravenCoinBalance >= cost;
                      const itemImage = ITEM_DETAILS[itemName]?.image;

                      return (
                        <button
                          key={idx}
                          onClick={() => setSelectedItem(item)}
                          className={classNames(
                            "flex flex-col items-center justify-start p-2 transition-all cursor-pointer rounded-sm",
                            {
                              "opacity-60": !canAfford,
                            },
                          )}
                          style={{
                            backgroundColor: canAfford ? "#f0f0f0" : "#ffe0e0",
                            border: "2px solid #999",
                            minHeight: "95px",
                          }}
                        >
                          {/* Item Image */}
                          <div className="mb-1 h-12 w-12 flex items-center justify-center">
                            {itemImage ? (
                              <img
                                src={itemImage}
                                alt={itemName}
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <div className="text-xs text-gray-600">
                                No Image
                              </div>
                            )}
                          </div>

                          {/* Item Name - Text scaled properly */}
                          <div className="text-xs font-bold text-center leading-tight mb-1 break-words w-full px-1 line-clamp-2">
                            {itemName}
                          </div>

                          {/* Cost Badge */}
                          <div className="text-xs font-bold text-yellow-700 bg-yellow-100 px-1 rounded mt-auto flex items-center gap-1">
                            {cost}
                            <img
                              src={RavenCoinIcon}
                              alt="RavenCoin"
                              style={{ width: "16px", height: "16px" }}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </InnerPanel>
      </OuterPanel>

      {/* Modal Overlay for Item Details */}
      <ModalOverlay
        show={!!selectedItem}
        onBackdropClick={() => setSelectedItem(null)}
      >
        {selectedItem && (
          <div className="bg-white rounded-lg border-4 border-gray-400 p-5 max-w-sm w-96 shadow-lg">
            <h3 className="font-bold text-lg mb-3 text-gray-900">
              {selectedItem.name}
            </h3>

            {/* Item Image in Modal */}
            <div className="mb-4 flex justify-center bg-gray-100 p-4 rounded">
              {ITEM_DETAILS[selectedItem.name as InventoryItemName]?.image ? (
                <img
                  src={
                    ITEM_DETAILS[selectedItem.name as InventoryItemName]?.image
                  }
                  alt={selectedItem.name}
                  style={{ maxWidth: "100px", maxHeight: "100px" }}
                  className="object-contain"
                />
              ) : (
                <div className="text-gray-400">No image available</div>
              )}
            </div>

            {/* Item Details */}
            <div className="mb-4 space-y-2 bg-gray-50 p-3 rounded">
              <p className="text-sm">
                <strong className="text-gray-700">Cost:</strong>
                <span className="ml-2 text-yellow-700 font-bold flex items-center gap-1 inline-flex">
                  {selectedItem.cost.items.RavenCoin || 0} RavenCoins
                  <img
                    src={RavenCoinIcon}
                    alt="RavenCoin"
                    style={{ width: "20px", height: "20px" }}
                  />
                </span>
              </p>
              {selectedItem.cooldownMs && (
                <p className="text-xs text-gray-600">
                  <strong>Limited Item:</strong> Once per{" "}
                  {Math.round(selectedItem.cooldownMs / (24 * 60 * 60 * 1000))}{" "}
                  day(s)
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const cost = selectedItem.cost.items.RavenCoin || 0;
                  if (ravenCoinBalance >= cost) {
                    const itemName = selectedItem.name;
                    // Find which tier this item belongs to
                    let tier: Tier = "basic";
                    for (const t of [
                      "basic",
                      "rare",
                      "epic",
                      "mega",
                    ] as const) {
                      if (
                        NIGHTSHADE_ARCADE_SHOP[t].items.some(
                          (i: any) => i.name === itemName,
                        )
                      ) {
                        tier = t;
                      }
                    }
                    handleBuy(selectedItem, tier);
                  }
                }}
                disabled={
                  ravenCoinBalance < (selectedItem.cost.items.RavenCoin || 0)
                }
                className={`flex-1 px-4 py-3 rounded font-bold text-sm transition-all ${
                  ravenCoinBalance < (selectedItem.cost.items.RavenCoin || 0)
                    ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                    : "bg-green-600 text-white cursor-pointer hover:bg-green-700 active:bg-green-800"
                }`}
              >
                Buy
              </button>
              <button
                onClick={() => setSelectedItem(null)}
                className="flex-1 px-4 py-3 rounded font-bold text-sm bg-gray-500 text-white cursor-pointer hover:bg-gray-600 active:bg-gray-700 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </ModalOverlay>
    </div>
  );
};
