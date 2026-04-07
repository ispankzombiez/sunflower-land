import mapJson from "features/portal/nightshade-arcade/assets/nightshade_arcade.json";
import customTileset from "features/portal/nightshade-arcade/assets/nightshade-arcade-tilesheet.png";
import stairsDown from "features/portal/nightshade-arcade/assets/stairs_down.png";
import ravenCoinIcon from "features/portal/nightshade-arcade/assets/RavenCoin.webp";
import { SceneId } from "features/world/mmoMachine";
import { BaseScene } from "features/world/scenes/BaseScene";
import { translate } from "lib/i18n/translate";
import { minigamesEventEmitter } from "./lib/minigamesEvents";
import { nightshadeArcadeEvents } from "./lib/nightshadeArcadeEvents";
import { PortalNPC } from "./lib/PortalNPC";
import { getNightshadeArcadeSpawn } from "./lib/spawns";

export class NightshadeArcadeScene extends BaseScene {
  sceneId: SceneId = "nightshade-arcade" as SceneId;

  constructor() {
    super({
      name: "nightshade-arcade" as any,
      map: {
        json: mapJson,
        imageKey: "nightshade-tileset",
      },
      audio: { fx: { walk_key: "dirt_footstep" } },
      player: { spawn: getNightshadeArcadeSpawn() },
    });
  }

  preload() {
    // Load custom arcade tilesheet with unique key
    this.load.image("nightshade-tileset", customTileset);
    this.load.image("stairs", stairsDown);
    this.load.image("ravenCoinIcon", ravenCoinIcon);

    // Now call super.preload()
    super.preload();
  }

  // Override initialiseMap to use correct margin/spacing for custom arcade tilesheet
  initialiseMap() {
    this.map = this.make.tilemap({ key: "nightshade-arcade" });

    // Add tileset with margin:0, spacing:0 (custom arcade tilesheet settings)
    const tileset = this.map.addTilesetImage(
      "Sunnyside V3",
      "nightshade-tileset",
      16,
      16,
      0, // margin: 0
      0, // spacing: 0
    ) as Phaser.Tilemaps.Tileset;

    // Set up collider layers
    this.colliders = this.add.group();

    if (this.map.getObjectLayer("Collision")) {
      const collisionPolygons = this.map.createFromObjects("Collision", {
        scene: this,
      });
      collisionPolygons.forEach((polygon) => {
        this.colliders?.add(polygon);
        this.physics.world.enable(polygon);
        (polygon.body as Phaser.Physics.Arcade.Body).setImmovable(true);
      });
    }

    // Setup interactable layers
    if (this.map.getObjectLayer("Collision")) {
      const interactablesPolygons = this.map.createFromObjects("Collision", {});
      interactablesPolygons.forEach((polygon) => {
        const name = (polygon as any).name;

        // Only make machines and special objects interactive
        if (
          name?.includes("Machine") ||
          name === "daily chest" ||
          name?.includes("prize desk")
        ) {
          polygon
            .setInteractive({ cursor: "pointer" })
            .on("pointerdown", (p: Phaser.Input.Pointer) => {
              if (p.downElement.nodeName === "CANVAS") {
                const distance = Phaser.Math.Distance.BetweenPoints(
                  this.currentPlayer as any,
                  polygon as Phaser.GameObjects.Polygon,
                );

                if (distance > 50) {
                  this.currentPlayer?.speak(translate("base.iam.far.away"));
                  return;
                }

                // Use exact matching so names like "Machine 10" don't trigger "Machine 1".
                const machineName = (name ?? "").trim().toLowerCase();

                if (machineName === "machine 1") {
                  minigamesEventEmitter.emit({ type: "poker" });
                }

                if (machineName === "machine 2") {
                  minigamesEventEmitter.emit({ type: "blackjack" });
                }

                if (machineName === "machine 3") {
                  minigamesEventEmitter.emit({ type: "gofish" });
                }

                if (machineName === "machine 4") {
                  minigamesEventEmitter.emit({ type: "uno" });
                }

                if (machineName === "machine 5") {
                  minigamesEventEmitter.emit({ type: "solitaire" });
                }

                if (machineName === "machine 6") {
                  minigamesEventEmitter.emit({ type: "goblin-invaders" });
                }

                if (machineName === "machine 7") {
                  minigamesEventEmitter.emit({ type: "tetris" });
                }

                if (machineName === "machine 8") {
                  minigamesEventEmitter.emit({ type: "pac-man" });
                }

                if (machineName === "machine 9") {
                  minigamesEventEmitter.emit({ type: "barley-breaker" });
                }

                if (machineName === "machine 10") {
                  minigamesEventEmitter.emit({ type: "frogger" });
                }

                if (machineName === "machine 11") {
                  minigamesEventEmitter.emit({ type: "bullet-hell" });
                }
              }
            });
        }
      });
    }

    // Create all tile layers for rendering
    this.map.layers.forEach((layerData) => {
      const layer = this.map.createLayer(layerData.name, [tileset], 0, 0);
      this.layers[layerData.name] = layer as Phaser.Tilemaps.TilemapLayer;
    });

    this.triggerColliders = this.add.group();

    if (!this.map.getObjectLayer("Trigger")) return;

    this.map.getObjectLayer("Trigger")?.objects.forEach((trigger) => {
      const polygon = this.add.polygon(
        trigger.x as number,
        trigger.y as number,
        trigger.polygon as unknown as number[][],
        0xff0000,
        0,
      );

      polygon.data.set("name", trigger.name);

      this.triggerColliders?.add(polygon);
    });
  }

  async create() {
    super.create();

    // Disable all debug rendering
    this.physics.world.drawDebug = false;

    // Portal mode: disable dark shaders and ensure bright lighting
    try {
      const pipelines = [...this.cameras.main.postPipelines];
      pipelines.forEach((pipeline) => {
        try {
          this.cameras.main.removePostPipeline(pipeline);
        } catch (e) {
          // Ignore removal errors
        }
      });
    } catch (e) {
      // Ignore if no pipelines exist
    }

    // Set camera background to bright to counteract any dark overlays
    this.cameras.main.setBackgroundColor("#ffffff");

    const _stairs = this.add.image(440, 47, "stairs");

    // Create Raven NPC as the shop keeper with dynamic animation
    const ravenNpc = new PortalNPC(this, 60, 85, "raven");

    // Make Raven clickable to open shop
    ravenNpc.setInteractive({ cursor: "pointer" }).on("pointerdown", () => {
      if (this.checkDistanceToSprite(ravenNpc as any, 50)) {
        nightshadeArcadeEvents.emitOpenShop();
      }
    });

    // RavenCoin icon display
    this.add.image(60, 103.5, "ravenCoinIcon").setScale(1);

    // Handle clickable daily chests from the Tiled map
    const objectLayer = this.map.getObjectLayer("Collision");

    if (objectLayer) {
      objectLayer.objects.forEach((obj: any) => {
        // Check if this object is a daily chest (by name)
        if (obj.name && obj.name.toLowerCase() === "daily chest") {
          const chestX = obj.x + obj.width / 2;
          const chestY = obj.y + obj.height / 2;

          // Create a zone for interaction at the same location
          const chestZone = this.add.zone(
            chestX,
            chestY,
            obj.width,
            obj.height,
          );

          chestZone
            .setInteractive({ cursor: "pointer" })
            .on("pointerdown", () => {
              if (this.checkDistanceToSprite(chestZone as any, 50)) {
                nightshadeArcadeEvents.emitChestClicked();
              }
            });
        }
      });
    }
  }
  updatePlayer(): void {
    if (nightshadeArcadeEvents.isMinigameActive) return;

    super.updatePlayer();
  }
}
