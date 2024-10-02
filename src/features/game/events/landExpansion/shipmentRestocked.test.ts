import { INITIAL_FARM } from "features/game/lib/constants";
import { SHIPMENT_STOCK, shipmentRestock } from "./shipmentRestocked";
import Decimal from "decimal.js-light";

describe("shipmentRestocked", () => {
  it("restocks a shipment", () => {
    const now = Date.now();
    const state = shipmentRestock({
      action: {
        type: "shipment.restocked",
      },
      state: {
        ...INITIAL_FARM,
        stock: {
          ...INITIAL_FARM.stock,
          "Sunflower Seed": new Decimal(5),
        },
        shipments: {
          restockedAt: new Date("2023-04-04").getTime(),
        },
      },
    });

    expect(state.shipments.restockedAt).toEqual(now);
    expect(state.stock["Sunflower Seed"]).toEqual(
      new Decimal(SHIPMENT_STOCK["Sunflower Seed"]),
    );
  });

  it("only restocks a shipment once per day", () => {
    expect(() =>
      shipmentRestock({
        action: {
          type: "shipment.restocked",
        },
        state: {
          ...INITIAL_FARM,
          shipments: {
            restockedAt: Date.now(),
          },
        },
      }),
    ).toThrow("Already restocked today");
  });
});