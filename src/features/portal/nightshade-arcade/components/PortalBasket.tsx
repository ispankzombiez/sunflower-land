import React, { useRef, useState } from "react";
import { Box } from "components/ui/Box";
import { SUNNYSIDE } from "assets/sunnyside";
import { SplitScreenView } from "components/ui/SplitScreenView";
import { InventoryItemDetails } from "components/ui/layouts/InventoryItemDetails";
import { PIXEL_SCALE } from "../constants";
import { Label } from "components/ui/Label";
import Decimal from "decimal.js-light";
import { getKeys } from "lib/object";
import { PortalGameState } from "../types";
import { ARCADE_ITEMS } from "../types/arcadeItems";
import { ITEM_DETAILS } from "features/game/types/images";
import {
  InventoryItemName,
  FERTILISERS,
  COUPONS,
  EASTER_EGG,
  CROP_SEEDS,
  CropName,
  CROPS,
  GREENHOUSE_CROPS,
  GREENHOUSE_SEEDS,
  GreenHouseCropSeedName,
  ConsumableName,
  CONSUMABLES,
  COOKABLES,
  PIRATE_CAKE,
  ANIMAL_RESOURCES,
  COMMODITIES,
  BEANS,
  EXOTIC_CROPS,
  GREENHOUSE_FRUIT_SEEDS,
  GREENHOUSE_FRUIT,
  PATCH_FRUIT,
  PATCH_FRUIT_SEEDS,
  PatchFruitSeedName,
  SEASONAL_SEEDS,
  SeedName,
  SEEDS,
  SELLABLE_TREASURES,
  TREASURE_TOOLS,
  WORKBENCH_TOOLS,
  LOVE_ANIMAL_TOOLS,
  WORM,
  CROP_COMPOST,
  FRUIT_COMPOST,
  FISH,
  PURCHASEABLE_BAIT,
  FLOWERS,
  FLOWER_SEEDS,
  isFlowerSeed,
  ANIMAL_FOODS,
  RECIPE_CRAFTABLES,
  SEASON_ICONS,
  CLUTTER,
  PET_RESOURCES,
  PROCESSED_RESOURCES,
  CRUSTACEANS_DESCRIPTIONS,
  GameState,
} from "../types/portalItemTypes";
import {
  getCropPlotTime,
  getBasketItems,
  getFruitHarvests,
  getFoodExpBoost,
  getFruitPatchTime,
  SEED_TO_PLANT,
  getGreenhouseCropTime,
  getFlowerTime,
  BUILDING_ORDER,
} from "../lib/portalUtilities";
import { useAppTranslation } from "lib/i18n/useAppTranslations";
import { useNow } from "lib/utils/hooks/useNow";

interface Props {
  state: PortalGameState;
  selected?: string;
  onSelect: (name: string) => void;
}

/**
 * Portal inventory basket - shows Portal Items (from arcade shop) at top, then full game inventory below
 * Adapted from game's Basket.tsx with Portal Items section added
 */
export const PortalBasket: React.FC<Props> = ({
  state,
  selected,
  onSelect,
}) => {
  const divRef = useRef<HTMLDivElement>(null);
  const now = useNow({ live: true });
  const [showBoosts, setShowBoosts] = useState(false);

  const { t } = useAppTranslation();

  const { inventory } = state;

  const hasPositiveAmount = (value: unknown) =>
    new Decimal((value as Decimal | number | undefined) ?? 0).gt(0);

  // Get all arcade item names - tagged items like game's TOOLS, RESOURCES, COUPONS
  const arcadeItemSet = new Set<string>(getKeys(ARCADE_ITEMS));

  // Arcade items - only items that are in the ARCADE_ITEMS catalog AND have count > 0
  const arcadeItems = getKeys(inventory)
    .filter((item) => arcadeItemSet.has(item))
    .filter((item) => hasPositiveAmount(inventory[item as InventoryItemName]))
    .sort() as string[];

  // Game inventory - create a virtual game state to use with game basket logic
  const gameState: GameState = {
    ...state,
    season: { season: "spring", createdAt: now },
  } as unknown as GameState;

  const basketMap = getBasketItems(gameState.inventory || {});
  const basketIsEmpty =
    Object.values(basketMap).length === 0 && arcadeItems.length === 0;

  if (basketIsEmpty) {
    return (
      <div className="flex flex-col justify-evenly items-center p-2">
        <img
          src={SUNNYSIDE.icons.basket}
          alt="Empty Basket"
          style={{
            width: `${PIXEL_SCALE * 12}px`,
          }}
        />
        <span className="text-xs text-center mt-2">{"Basket is empty"}</span>
      </div>
    );
  }

  const selectedItem =
    selected ?? arcadeItems[0] ?? getKeys(basketMap)[0] ?? "Sunflower Seed";

  const isPatchFruitSeed = (selected: string): selected is PatchFruitSeedName =>
    selected in PATCH_FRUIT_SEEDS;
  const isSeed = (selected: string): selected is SeedName =>
    selected in CROP_SEEDS ||
    selected in PATCH_FRUIT_SEEDS ||
    selected in FLOWER_SEEDS ||
    selected in GREENHOUSE_SEEDS ||
    selected in GREENHOUSE_FRUIT_SEEDS ||
    isPatchFruitSeed(selected);
  const isFood = (selected: string): selected is ConsumableName =>
    selected in CONSUMABLES;

  const getHarvestTime = (seedName: SeedName) => {
    if (isFlowerSeed(seedName)) {
      return getFlowerTime(seedName, gameState).seconds;
    }

    if (isPatchFruitSeed(seedName)) {
      return getFruitPatchTime(seedName, gameState).seconds;
    }
    if (seedName in GREENHOUSE_SEEDS || seedName in GREENHOUSE_FRUIT_SEEDS) {
      const plant = SEED_TO_PLANT[seedName as GreenHouseCropSeedName];
      const { seconds } = getGreenhouseCropTime({
        crop: plant,
        game: gameState,
      });
      return seconds;
    }

    const crop = SEEDS[seedName].yield as CropName;
    return getCropPlotTime({
      crop,
      game: gameState,
      createdAt: now,
    }).time;
  };

  const harvestCounts = getFruitHarvests(gameState, selectedItem as SeedName);

  const foodExpBoost = isFood(selectedItem)
    ? getFoodExpBoost({
        food: CONSUMABLES[selectedItem as ConsumableName],
        game: gameState,
        createdAt: now,
      })
    : null;

  const handleItemClick = (item: string) => {
    setShowBoosts(false);
    onSelect(item);
  };

  const getItems = <T extends string | number | symbol, K>(
    items: Record<T, K>,
  ) => {
    return getKeys(items).filter((item) => item in basketMap);
  };

  const seeds = getItems(CROP_SEEDS);
  const fruitSeeds = getItems(PATCH_FRUIT_SEEDS);
  const greenhouseSeeds = [
    ...getItems(GREENHOUSE_FRUIT_SEEDS),
    ...getItems(GREENHOUSE_SEEDS),
  ];
  const flowerSeeds = getItems(FLOWER_SEEDS);
  const crops = [...getItems(CROPS), ...getItems(GREENHOUSE_CROPS)];
  const fruits = [...getItems(PATCH_FRUIT), ...getItems(GREENHOUSE_FRUIT)];
  const flowers = getItems(FLOWERS);
  const workbenchTools = getItems(WORKBENCH_TOOLS);
  const treasureTools = getItems(TREASURE_TOOLS);
  const animalTools = getItems(LOVE_ANIMAL_TOOLS);
  const exotic = getItems(BEANS());
  const resources = getItems(COMMODITIES).filter(
    (resource) => resource !== "Egg",
  );
  const craftingResources = getItems(RECIPE_CRAFTABLES);
  const animalResources = getItems(ANIMAL_RESOURCES);
  const animalFeeds = getItems(ANIMAL_FOODS);
  const processedFood = getItems(PROCESSED_RESOURCES);
  const crustaceans = getItems(CRUSTACEANS_DESCRIPTIONS);

  // Sort all foods by Cooking Time and Building
  const foods = getItems(COOKABLES)
    .sort((a, b) => COOKABLES[a].cookingSeconds - COOKABLES[b].cookingSeconds)
    .sort(
      (a, b) =>
        BUILDING_ORDER.indexOf(COOKABLES[a].building) -
        BUILDING_ORDER.indexOf(COOKABLES[b].building),
    );
  const pirateCake = getItems(PIRATE_CAKE);

  const fertilisers = getItems(FERTILISERS);
  const coupons = getItems(COUPONS).sort((a, b) => a.localeCompare(b));
  const easterEggs = getItems(EASTER_EGG);
  const treasure = getItems(SELLABLE_TREASURES);
  const exotics = getItems(EXOTIC_CROPS);
  const cropCompost = getItems(CROP_COMPOST);
  const fruitCompost = getItems(FRUIT_COMPOST);
  const worm = getItems(WORM);
  const purchaseableBait = getItems(PURCHASEABLE_BAIT);
  const fish = getItems(FISH).sort((a, b) => a.localeCompare(b));
  const petResources = getItems(PET_RESOURCES);

  const allSeeds = [
    ...seeds,
    ...fruitSeeds,
    ...flowerSeeds,
    ...greenhouseSeeds,
  ];
  const allTools = [...workbenchTools, ...treasureTools, ...animalTools];
  const allResources = [...resources, ...craftingResources];

  const clutter = getItems(CLUTTER);

  const itemsSection = (
    title: string,
    items: (InventoryItemName | string)[],
    icon: string,
  ) => {
    if (!items.length) {
      return <></>;
    }

    return (
      <div className="flex flex-col pl-2 mb-2 w-full" key={title}>
        <Label type="default" icon={icon} className="mb-2">
          {title}
        </Label>
        <div className="flex mb-2 flex-wrap -ml-1.5">
          {items.map((item) => {
            // All items (portal + game) use ITEM_DETAILS for images
            const itemImage = ITEM_DETAILS[item as InventoryItemName]?.image;
            const count = gameState.inventory[item as InventoryItemName];

            return (
              <Box
                count={count}
                isSelected={selectedItem === item}
                key={item}
                onClick={() => handleItemClick(item as string)}
                image={itemImage}
                parentDivRef={divRef}
              />
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <SplitScreenView
      divRef={divRef}
      tallMobileContent={true}
      wideModal={true}
      showPanel={!!selectedItem}
      panel={
        selectedItem ? (
          <InventoryItemDetails
            game={gameState}
            details={{
              item: selectedItem as InventoryItemName,
              seasons:
                selectedItem in SEEDS
                  ? getKeys(SEASONAL_SEEDS).filter((season) =>
                      SEASONAL_SEEDS[season].includes(selectedItem as SeedName),
                    )
                  : undefined,
            }}
            properties={{
              harvests: isPatchFruitSeed(selectedItem)
                ? {
                    minHarvest: harvestCounts[0],
                    maxHarvest: harvestCounts[1],
                  }
                : undefined,
              xp: foodExpBoost?.boostedExp,
              xpBoostsUsed: foodExpBoost?.boostsUsed,
              baseXp: foodExpBoost
                ? CONSUMABLES[selectedItem as ConsumableName].experience
                : undefined,
              ...(foodExpBoost && {
                showBoosts,
                setShowBoosts,
              }),
              timeSeconds: isSeed(selectedItem)
                ? getHarvestTime(selectedItem as SeedName)
                : undefined,
              showOpenSeaLink: true,
            }}
          />
        ) : (
          <div />
        )
      }
      content={
        <>
          {/* Arcade Items at the top - tagged items like game's TOOLS, RESOURCES, COUPONS */}
          {itemsSection("Arcade Items", arcadeItems, SUNNYSIDE.icons.basket)}

          {/* Game inventory sections - EXACTLY as in game */}
          {itemsSection(
            `${t(`${gameState.season.season}.seeds`)}`,
            allSeeds.filter((seed) =>
              SEASONAL_SEEDS[gameState.season.season].includes(seed),
            ),
            SEASON_ICONS[gameState.season.season],
          )}
          {itemsSection(
            t("seeds"),
            allSeeds.filter(
              (seed) => !SEASONAL_SEEDS[gameState.season.season].includes(seed),
            ),
            SUNNYSIDE.icons.seeds,
          )}

          {itemsSection(
            t("fertilisers"),
            [...cropCompost, ...fruitCompost, ...fertilisers],
            ITEM_DETAILS["Rapid Root"].image,
          )}
          {itemsSection(t("tools"), allTools, ITEM_DETAILS["Axe"].image)}
          {itemsSection(t("crops"), crops, ITEM_DETAILS.Sunflower.image)}
          {itemsSection(t("fruits"), fruits, ITEM_DETAILS["Orange"].image)}
          {itemsSection(t("flowers"), flowers, SUNNYSIDE.icons.seedling)}
          {itemsSection(
            t("exotics"),
            [...exotic, ...exotics],
            ITEM_DETAILS["White Carrot"].image,
          )}
          {itemsSection(
            t("resources"),
            allResources,
            ITEM_DETAILS["Wood"].image,
          )}
          {itemsSection(t("clutter"), clutter, ITEM_DETAILS.Dung.image)}
          {itemsSection(
            t("pet.resources"),
            petResources,
            ITEM_DETAILS["Acorn"].image,
          )}
          {itemsSection(t("animal"), animalResources, ITEM_DETAILS.Egg.image)}
          {itemsSection(t("feeds"), animalFeeds, ITEM_DETAILS.Hay.image)}
          {itemsSection(
            t("bait"),
            [...worm, ...purchaseableBait],
            ITEM_DETAILS["Earthworm"].image,
          )}
          {itemsSection(t("fish"), fish, ITEM_DETAILS["Anchovy"].image)}
          {itemsSection(
            t("crustaceans"),
            crustaceans,
            ITEM_DETAILS["Crab"].image,
          )}
          {itemsSection(
            t("processedResources"),
            processedFood,
            ITEM_DETAILS["Fish Flake"].image,
          )}
          {itemsSection(
            t("foods"),
            [...foods, ...pirateCake],
            ITEM_DETAILS["Carrot Cake"].image,
          )}
          {itemsSection(
            t("treasure"),
            treasure,
            ITEM_DETAILS["Pirate Bounty"].image,
          )}
          {itemsSection(
            t("coupons"),
            coupons,
            ITEM_DETAILS["Trading Ticket"].image,
          )}
          {itemsSection(
            t("easter.eggs"),
            easterEggs,
            ITEM_DETAILS["Red Egg"].image,
          )}
        </>
      }
    />
  );
};
