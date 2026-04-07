/* eslint-disable react/jsx-no-literals */
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSelector } from "@xstate/react";
import { Button } from "components/ui/Button";
import { InnerPanel, OuterPanel } from "components/ui/Panel";
import { NPCIcon } from "features/island/bumpkin/components/NPC";
import ravenCoinIcon from "features/portal/nightshade-arcade/assets/RavenCoin.webp";
import { useVipAccess } from "lib/utils/hooks/useVipAccess";
import {
  purchase,
  startAttempt,
  submitScore,
} from "features/portal/lib/portalUtil";
import {
  EXTRA_REWARD_ATTEMPT_FLOWER_COST,
  getRemainingPaidAttemptsForMinigame,
} from "../poker/session";
import { PortalContext } from "../../lib/NightshadeArcadePortalProvider";
import { PortalMachineState } from "../../lib/nightshadeArcadePortalMachine";
import {
  BULLET_HELL_CURSES,
  BULLET_HELL_MAX_FLOOR,
  BULLET_HELL_RAVEN_COIN_REWARD,
  BulletHellCurseType,
  BulletHellMode,
  FLOOR_ROOM_RANGES,
  getBulletHellDailyCurse,
  getBulletHellDailyTargetFloor,
  isBulletHellRewardRunAvailable,
} from "./session";
import { BumpkinParts } from "lib/utils/tokenUriBuilder";
import { NPC_WEARABLES } from "lib/npcs";

const _portalState = (state: PortalMachineState) => state.context.state;

const ROOM_WIDTH_MIN = 620;
const ROOM_WIDTH_MAX = 860;
const ROOM_HEIGHT_MIN = 360;
const ROOM_HEIGHT_MAX = 520;
const PLAYER_SIZE = 40;
const PLAYER_SPEED = 240;
const PLAYER_SHOT_SPEED = 420;
const ENEMY_SPEED = 80;
const ENEMY_SHOT_SPEED = 190;
const PLAYER_IFRAME_MS = 900;
const SHOOT_COOLDOWN_MS = 220;
const ENEMY_SHOOT_COOLDOWN_MS = 950;
const DOOR_WIDTH = 76;
const DOOR_THICKNESS = 14;
const DOOR_TRIGGER_MARGIN = 8;
const DOOR_TRANSITION_COOLDOWN_MS = 220;
const BOMB_FUSE_MS = 3000;
const BOMB_EXPLOSION_RADIUS = 92;
const BOMB_REVEAL_DISTANCE = 72;
const BOMB_DAMAGE = 4;
const BOMB_FLASH_MS = 260;
const BOMB_PLAYER_KNOCKBACK = 68;
const BOMB_ENEMY_KNOCKBACK = 48;

const DIRECTIONS = ["up", "down", "left", "right"] as const;
type Direction = (typeof DIRECTIONS)[number];

const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

const DIRECTION_DELTA: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

type RoomType =
  | "spawn"
  | "combat"
  | "item"
  | "shop"
  | "challenge"
  | "mini-boss"
  | "sacrifice"
  | "cursed"
  | "secret"
  | "vault"
  | "devil"
  | "angel"
  | "boss";

type RoomLayout = "square" | "wide" | "tall" | "octagon";

type RoomNode = {
  id: number;
  type: RoomType;
  visited: boolean;
  cleared: boolean;
  hasBossKey: boolean;
  doorUnlocked: boolean;
  enemies: number;
  x: number;
  y: number;
  width: number;
  height: number;
  layout: RoomLayout;
  neighbors: Partial<Record<Direction, number>>;
};

type FloorState = {
  floor: number;
  curse: BulletHellCurseType | null;
  rooms: RoomNode[];
  bossIndex: number;
};

type Bullet = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fromEnemy: boolean;
};

type Bomb = {
  id: number;
  x: number;
  y: number;
  fuseMs: number;
};

type Explosion = {
  id: number;
  x: number;
  y: number;
  ttlMs: number;
  radius: number;
};

type Enemy = {
  id: number;
  x: number;
  y: number;
  hp: number;
  speed: number;
  shootMs: number;
};

type Runtime = {
  playerX: number;
  playerY: number;
  playerIFrameMs: number;
  hearts: number;
  coins: number;
  keys: number;
  bombReveal: number;
  hasBossKey: boolean;
  floorIndex: number;
  roomIndex: number;
  floors: FloorState[];
  enemies: Enemy[];
  bullets: Bullet[];
  bombs: Bomb[];
  explosions: Explosion[];
  shootCooldownMs: number;
  doorTransitionCooldownMs: number;
  nextBulletId: number;
  nextBombId: number;
  facing: -1 | 1;
  playerWon: boolean;
  gameOver: boolean;
  deepestClearedFloor: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const createRng = (seed: number) => {
  let value = seed >>> 0;

  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) / 4294967296;
  };
};

const toSeed = (text: string) => {
  return text.split("").reduce((acc, ch) => {
    return Math.imul(acc, 31) + ch.charCodeAt(0);
  }, 811);
};

const randomRoomLayout = (rng: () => number): RoomLayout => {
  const roll = rng();
  if (roll < 0.25) return "square";
  if (roll < 0.5) return "wide";
  if (roll < 0.75) return "tall";
  return "octagon";
};

const randomRoomSize = (layout: RoomLayout, rng: () => number) => {
  const widthRoll = ROOM_WIDTH_MIN + Math.floor(rng() * (ROOM_WIDTH_MAX - ROOM_WIDTH_MIN + 1));
  const heightRoll = ROOM_HEIGHT_MIN + Math.floor(rng() * (ROOM_HEIGHT_MAX - ROOM_HEIGHT_MIN + 1));

  if (layout === "square") {
    const side = Math.round((widthRoll + heightRoll) / 2);
    return {
      width: clamp(side, ROOM_WIDTH_MIN, ROOM_WIDTH_MAX),
      height: clamp(side, ROOM_HEIGHT_MIN, ROOM_HEIGHT_MAX),
    };
  }

  if (layout === "wide") {
    return {
      width: clamp(widthRoll + 40, ROOM_WIDTH_MIN, ROOM_WIDTH_MAX),
      height: clamp(heightRoll - 30, ROOM_HEIGHT_MIN, ROOM_HEIGHT_MAX),
    };
  }

  if (layout === "tall") {
    return {
      width: clamp(widthRoll - 30, ROOM_WIDTH_MIN, ROOM_WIDTH_MAX),
      height: clamp(heightRoll + 40, ROOM_HEIGHT_MIN, ROOM_HEIGHT_MAX),
    };
  }

  return {
    width: clamp(widthRoll, ROOM_WIDTH_MIN, ROOM_WIDTH_MAX),
    height: clamp(heightRoll, ROOM_HEIGHT_MIN, ROOM_HEIGHT_MAX),
  };
};

const pickUniqueRoomIndex = (
  rng: () => number,
  roomCount: number,
  blocked: Set<number>,
) => {
  const available: number[] = [];

  for (let i = 0; i < roomCount; i++) {
    if (!blocked.has(i)) {
      available.push(i);
    }
  }

  if (available.length === 0) {
    return 0;
  }

  const index = available[Math.floor(rng() * available.length)];
  blocked.add(index);

  return index;
};

const getNeighborCount = (room: RoomNode) =>
  Object.values(room.neighbors).filter((id) => id !== undefined).length;

const pickDeadEndRoomIndex = (
  rng: () => number,
  rooms: RoomNode[],
  blocked: Set<number>,
) => {
  const deadEnds = rooms
    .filter((room) => !blocked.has(room.id) && getNeighborCount(room) === 1)
    .map((room) => room.id);

  if (deadEnds.length > 0) {
    const index = deadEnds[Math.floor(rng() * deadEnds.length)];
    blocked.add(index);
    return index;
  }

  return pickUniqueRoomIndex(rng, rooms.length, blocked);
};

const shuffleDirections = (rng: () => number): Direction[] => {
  const copy: Direction[] = [...DIRECTIONS];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }

  return copy;
};

const buildConnectedRoomGraph = (
  roomCount: number,
  rng: () => number,
): Pick<FloorState, "rooms" | "bossIndex"> => {
  const rooms: RoomNode[] = Array.from({ length: roomCount }, (_, id) => {
    const layout = randomRoomLayout(rng);
    const size = randomRoomSize(layout, rng);

    return {
      id,
      type: "combat",
      visited: false,
      cleared: false,
      hasBossKey: false,
      doorUnlocked: true,
      enemies: 0,
      x: 0,
      y: 0,
      width: size.width,
      height: size.height,
      layout,
      neighbors: {},
    };
  });

  const occupied = new Map<string, number>();
  occupied.set("0,0", 0);

  for (let roomId = 1; roomId < roomCount; roomId++) {
    let placed = false;

    for (let attempt = 0; attempt < 80 && !placed; attempt++) {
      const anchorId = Math.floor(rng() * roomId);
      const anchor = rooms[anchorId];
      const directionOrder = shuffleDirections(rng);

      for (const direction of directionOrder) {
        if (anchor.neighbors[direction] !== undefined) continue;

        const delta = DIRECTION_DELTA[direction];
        const nextX = anchor.x + delta.x;
        const nextY = anchor.y + delta.y;
        const key = `${nextX},${nextY}`;

        if (occupied.has(key)) continue;

        const room = rooms[roomId];
        room.x = nextX;
        room.y = nextY;
        room.neighbors[OPPOSITE_DIRECTION[direction]] = anchorId;
        anchor.neighbors[direction] = roomId;
        occupied.set(key, roomId);
        placed = true;
        break;
      }
    }

    if (!placed) {
      const anchorId = roomId - 1;
      const anchor = rooms[anchorId];
      let nextX = anchor.x + 1;
      const nextY = anchor.y;

      while (occupied.has(`${nextX},${nextY}`)) {
        nextX += 1;
      }

      const room = rooms[roomId];
      room.x = nextX;
      room.y = nextY;
      room.neighbors.left = anchorId;
      anchor.neighbors.right = roomId;
      occupied.set(`${nextX},${nextY}`, roomId);
    }
  }

  const distances = new Array(roomCount).fill(Number.POSITIVE_INFINITY);
  const queue: number[] = [0];
  distances[0] = 0;

  while (queue.length > 0) {
    const currentId = queue.shift() as number;
    const current = rooms[currentId];

    for (const direction of DIRECTIONS) {
      const neighborId = current.neighbors[direction];
      if (neighborId === undefined) continue;

      const nextDistance = distances[currentId] + 1;
      if (nextDistance < distances[neighborId]) {
        distances[neighborId] = nextDistance;
        queue.push(neighborId);
      }
    }
  }

  let bossIndex = 1;
  for (let i = 1; i < roomCount; i++) {
    if (distances[i] > distances[bossIndex]) {
      bossIndex = i;
    }
  }

  return { rooms, bossIndex };
};

const createFloor = (
  floor: number,
  rng: () => number,
  mode: BulletHellMode,
): FloorState => {
  const range = FLOOR_ROOM_RANGES[floor];
  const roomCount =
    range.min + Math.floor(rng() * Math.max(1, range.max - range.min + 1));

  const { rooms, bossIndex } = buildConnectedRoomGraph(roomCount, rng);

  rooms.forEach((room) => {
    room.enemies = 2 + floor;
  });

  rooms[0] = {
    ...rooms[0],
    type: "spawn",
    enemies: 0,
    cleared: true,
    visited: true,
  };

  rooms[bossIndex] = {
    ...rooms[bossIndex],
    type: "boss",
    enemies: 4 + floor,
  };

  const blocked = new Set<number>([0, bossIndex]);

  const itemIndex = pickUniqueRoomIndex(rng, roomCount, blocked);
  rooms[itemIndex] = {
    ...rooms[itemIndex],
    type: "item",
    enemies: 2 + floor,
    doorUnlocked: false,
  };

  const shopIndex = pickUniqueRoomIndex(rng, roomCount, blocked);
  rooms[shopIndex] = { ...rooms[shopIndex], type: "shop", enemies: 0, cleared: true };

  const challengeIndex = pickUniqueRoomIndex(rng, roomCount, blocked);
  rooms[challengeIndex] = {
    ...rooms[challengeIndex],
    type: "challenge",
    enemies: 3 + floor,
  };

  if (rng() < 0.3) {
    const miniBossIndex = pickUniqueRoomIndex(rng, roomCount, blocked);
    rooms[miniBossIndex] = {
      ...rooms[miniBossIndex],
      type: "mini-boss",
      enemies: 2 + floor,
    };
  }

  if (rng() < 0.25) {
    const sacrificeIndex = pickUniqueRoomIndex(rng, roomCount, blocked);
    rooms[sacrificeIndex] = {
      ...rooms[sacrificeIndex],
      type: "sacrifice",
      enemies: 0,
      cleared: true,
    };
  }

  if (rng() < 0.3) {
    const cursedIndex = pickUniqueRoomIndex(rng, roomCount, blocked);
    rooms[cursedIndex] = {
      ...rooms[cursedIndex],
      type: "cursed",
      enemies: 2 + floor,
    };
  }

  const secretIndex = pickDeadEndRoomIndex(rng, rooms, blocked);
  const secretEnemies = rng() < 0.5 ? 0 : 2 + floor;
  rooms[secretIndex] = {
    ...rooms[secretIndex],
    type: "secret",
    enemies: secretEnemies,
    cleared: false,
    doorUnlocked: false,
  };

  if (rng() < 0.15) {
    const vaultIndex = pickUniqueRoomIndex(rng, roomCount, blocked);
    rooms[vaultIndex] = {
      ...rooms[vaultIndex],
      type: "vault",
      enemies: 0,
      cleared: false,
      doorUnlocked: false,
    };
  }

  if (rng() < 0.22) {
    const faithIndex = pickUniqueRoomIndex(rng, roomCount, blocked);
    rooms[faithIndex] = {
      ...rooms[faithIndex],
      type: rng() < 0.5 ? "devil" : "angel",
      enemies: 0,
      cleared: true,
    };
  }

  const bossKeyIndex = pickUniqueRoomIndex(rng, roomCount, blocked);
  rooms[bossKeyIndex] = { ...rooms[bossKeyIndex], hasBossKey: true };

  return {
    floor,
    curse: mode === "reward" ? getBulletHellDailyCurse(floor) : null,
    rooms,
    bossIndex,
  };
};

const spawnEnemiesForRoom = (
  room: RoomNode,
  floor: number,
  rng: () => number,
): Enemy[] => {
  if (room.cleared || room.enemies <= 0) {
    return [];
  }

  const enemies: Enemy[] = [];

  for (let i = 0; i < room.enemies; i++) {
    enemies.push({
      id: i + 1,
      x: 70 + rng() * (room.width - 140),
      y: 70 + rng() * (room.height - 180),
      hp: room.type === "boss" ? 5 + floor : room.type === "mini-boss" ? 3 + floor : 2,
      speed: ENEMY_SPEED + floor * 15,
      shootMs: 200 + rng() * 700,
    });
  }

  return enemies;
};

const getRoomLabel = (type: RoomType) => {
  switch (type) {
    case "spawn":
      return "Spawn";
    case "item":
      return "Item";
    case "shop":
      return "Shop";
    case "challenge":
      return "Challenge";
    case "mini-boss":
      return "Mini-Boss";
    case "sacrifice":
      return "Sacrifice";
    case "cursed":
      return "Cursed";
    case "secret":
      return "Secret";
    case "vault":
      return "Vault";
    case "devil":
      return "Devil";
    case "angel":
      return "Angel";
    case "boss":
      return "Boss";
    default:
      return "Combat";
  }
};

const getRoomColor = (room: RoomNode, isActive: boolean) => {
  if (!room.visited && !isActive) return "#4b4b4b";
  return "#8a8a8a";
};

const isOneTimeKeyDoor = (room: RoomNode) =>
  room.type === "item" || room.type === "vault";

const getDoorIndicator = (runtime: Runtime, targetRoom: RoomNode) => {
  if (targetRoom.type === "boss") {
    return runtime.hasBossKey ? "OPEN" : "BOSS KEY";
  }

  if (!isOneTimeKeyDoor(targetRoom)) {
    return "";
  }

  if (targetRoom.doorUnlocked) {
    return "OPEN";
  }

  if (targetRoom.type === "item") return "1 KEY";
  return "2 KEYS";
};

const canEnterRoom = (runtime: Runtime, targetRoom: RoomNode) => {
  if (targetRoom.type === "boss" && !runtime.hasBossKey) return false;
  if (targetRoom.type === "secret" && !targetRoom.doorUnlocked) return false;

  if (!targetRoom.doorUnlocked) {
    if (targetRoom.type === "vault" && runtime.keys < 2) return false;
    if (targetRoom.type === "item" && runtime.keys < 1) return false;
  }

  return true;
};

const getDoorSpawnPosition = (direction: Direction, room: RoomNode) => {
  const centerX = room.width / 2 - PLAYER_SIZE / 2;
  const centerY = room.height / 2 - PLAYER_SIZE / 2;

  if (direction === "up") {
    return { x: centerX, y: room.height - PLAYER_SIZE - DOOR_TRIGGER_MARGIN - 4 };
  }
  if (direction === "down") {
    return { x: centerX, y: DOOR_TRIGGER_MARGIN + 4 };
  }
  if (direction === "left") {
    return { x: room.width - PLAYER_SIZE - DOOR_TRIGGER_MARGIN - 4, y: centerY };
  }

  return { x: DOOR_TRIGGER_MARGIN + 4, y: centerY };
};

const getDoorCenter = (room: RoomNode, direction: Direction) => {
  if (direction === "up") {
    return { x: room.width / 2, y: 0 };
  }
  if (direction === "down") {
    return { x: room.width / 2, y: room.height };
  }
  if (direction === "left") {
    return { x: 0, y: room.height / 2 };
  }

  return { x: room.width, y: room.height / 2 };
};

const moveToRoom = (
  runtime: Runtime,
  direction: Direction,
  rng: () => number,
) => {
  const floor = runtime.floors[runtime.floorIndex];
  const room = floor.rooms[runtime.roomIndex];
  if (!room) return false;
  if (!room.cleared && room.enemies > 0) return false;

  const targetIndex = room.neighbors[direction];
  if (targetIndex === undefined) return false;

  const targetRoom = floor.rooms[targetIndex];
  if (!targetRoom) return false;
  if (!canEnterRoom(runtime, targetRoom)) return false;

  if (!targetRoom.doorUnlocked) {
    if (targetRoom.type === "vault") runtime.keys -= 2;
    if (targetRoom.type === "item") runtime.keys -= 1;
    targetRoom.doorUnlocked = true;
  }

  if (targetRoom.type === "cursed") {
    runtime.hearts = Math.max(1, runtime.hearts - 1);
  }

  runtime.roomIndex = targetIndex;
  targetRoom.visited = true;
  runtime.enemies = spawnEnemiesForRoom(targetRoom, runtime.floorIndex + 1, rng);
  runtime.bullets = [];
  runtime.bombs = [];
  runtime.explosions = [];
  const spawn = getDoorSpawnPosition(direction, targetRoom);
  runtime.playerX = spawn.x;
  runtime.playerY = spawn.y;
  runtime.doorTransitionCooldownMs = DOOR_TRANSITION_COOLDOWN_MS;

  if (targetRoom.type === "secret" && targetRoom.enemies === 0 && !targetRoom.cleared) {
    targetRoom.cleared = true;
    runtime.coins += 4;
    runtime.keys += 1;
  }

  return true;
};

const getShootVector = (keys: Record<string, boolean>) => {
  const x = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0);
  let y = (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0);

  if (x !== 0 && y !== 0) {
    y = 0;
  }

  return { x, y };
};

const getRoomStyle = (room: RoomNode) => {
  if (room.layout === "octagon") {
    return {
      clipPath:
        "polygon(12% 0, 88% 0, 100% 12%, 100% 88%, 88% 100%, 12% 100%, 0 88%, 0 12%)",
      background:
        "radial-gradient(circle at 20% 20%, #3a3028 0%, #2d241d 55%, #251d18 100%)",
    };
  }

  if (room.layout === "wide") {
    return {
      borderRadius: 12,
      background:
        "linear-gradient(180deg, #332922 0%, #2d241d 40%, #241d18 100%)",
    };
  }

  if (room.layout === "tall") {
    return {
      borderRadius: 20,
      background:
        "linear-gradient(90deg, #342a23 0%, #2d241d 45%, #251d18 100%)",
    };
  }

  return {
    borderRadius: 6,
    background: "#2d241d",
  };
};

export const BulletHellGame: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { portalService } = useContext(PortalContext);
  const portalGameState = useSelector(portalService, _portalState);
  const isVip = useVipAccess({ game: portalGameState });

  const hasRewardRun = useMemo(
    () => isBulletHellRewardRunAvailable({ game: portalGameState, isVip }),
    [portalGameState, isVip],
  );

  const canPurchaseExtraAttempt =
    Number(portalGameState.balance ?? 0) >= EXTRA_REWARD_ATTEMPT_FLOWER_COST;

  const paidAttemptsRemaining = useMemo(
    () =>
      getRemainingPaidAttemptsForMinigame(
        portalGameState,
        "bullet-hell" as any,
      ),
    [portalGameState],
  );

  const dailyTargetFloor = useMemo(() => getBulletHellDailyTargetFloor(), []);
  const playerParts =
    (portalGameState.bumpkin?.equipped as BumpkinParts | undefined) ??
    NPC_WEARABLES["pumpkin' pete"];

  const [mode, setMode] = useState<BulletHellMode | null>(null);
  const [inSession, setInSession] = useState(false);
  const [runEnded, setRunEnded] = useState(false);
  const [frames, setFrames] = useState(0);

  const arenaRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<Runtime | null>(null);
  const rewardSettledRef = useRef(false);
  const keysRef = useRef<Record<string, boolean>>({});
  const rngRef = useRef<() => number>(() => Math.random());

  const startSession = useCallback(
    (nextMode: BulletHellMode) => {
      if (nextMode === "reward" && !hasRewardRun) return;

      const baseSeed =
        nextMode === "reward"
          ? toSeed(new Date().toISOString().slice(0, 10))
          : toSeed(`${Date.now()}-${Math.random()}`);

      rngRef.current = createRng(baseSeed);

      const floors = [1, 2, 3].map((floor) =>
        createFloor(floor, rngRef.current, nextMode),
      );
      const initialRoom = floors[0].rooms[0];

      const runtime: Runtime = {
        playerX: initialRoom.width / 2 - PLAYER_SIZE / 2,
        playerY: initialRoom.height / 2,
        playerIFrameMs: 0,
        hearts: 6,
        coins: 0,
        keys: 1,
        bombReveal: 1,
        hasBossKey: false,
        floorIndex: 0,
        roomIndex: 0,
        floors,
        enemies: [],
        bullets: [],
        bombs: [],
        explosions: [],
        shootCooldownMs: 0,
        doorTransitionCooldownMs: 0,
        nextBulletId: 1,
        nextBombId: 1,
        facing: 1,
        playerWon: false,
        gameOver: false,
        deepestClearedFloor: 0,
      };

      runtimeRef.current = runtime;
      rewardSettledRef.current = false;
      setMode(nextMode);
      setInSession(true);
      setRunEnded(false);

      portalService.send({
        type: "arcadeMinigame.started",
        name: "bullet-hell",
      });

      if (nextMode === "reward") {
        startAttempt();
      }
    },
    [hasRewardRun, portalService],
  );

  const settleReward = useCallback(() => {
    if (!runtimeRef.current || !mode || mode !== "reward") return;
    if (rewardSettledRef.current) return;

    const runtime = runtimeRef.current;
    submitScore({ score: runtime.deepestClearedFloor });

    if (runtime.playerWon && runtime.deepestClearedFloor >= dailyTargetFloor) {
      portalService.send({
        type: "arcadeMinigame.ravenCoinWon",
        amount: BULLET_HELL_RAVEN_COIN_REWARD,
      });
    }

    rewardSettledRef.current = true;
  }, [dailyTargetFloor, mode, portalService]);

  const dropBomb = useCallback(() => {
    const runtime = runtimeRef.current;
    if (!runtime || runtime.gameOver) return;
    if (runtime.bombReveal <= 0) return;

    runtime.bombReveal -= 1;
    runtime.bombs.push({
      id: runtime.nextBombId++,
      x: runtime.playerX + PLAYER_SIZE / 2,
      y: runtime.playerY + PLAYER_SIZE / 2,
      fuseMs: BOMB_FUSE_MS,
    });
  }, []);

  useEffect(() => {
    if (!inSession) return;

    let frameId = 0;
    let previous = performance.now();

    const loop = (now: number) => {
      const runtime = runtimeRef.current;
      if (!runtime) return;

      const deltaMs = Math.min(34, now - previous);
      previous = now;
      const delta = deltaMs / 1000;

      if (!runtime.gameOver) {
        const floor = runtime.floors[runtime.floorIndex];
        const room = floor.rooms[runtime.roomIndex];
        const roomWidth = room?.width ?? ROOM_WIDTH_MIN;
        const roomHeight = room?.height ?? ROOM_HEIGHT_MIN;
        const moveX =
          (keysRef.current.KeyD ? 1 : 0) - (keysRef.current.KeyA ? 1 : 0);
        const moveY =
          (keysRef.current.KeyS ? 1 : 0) - (keysRef.current.KeyW ? 1 : 0);

        runtime.playerX = clamp(
          runtime.playerX + moveX * PLAYER_SPEED * delta,
          0,
          roomWidth - PLAYER_SIZE,
        );
        runtime.playerY = clamp(
          runtime.playerY + moveY * PLAYER_SPEED * delta,
          0,
          roomHeight - PLAYER_SIZE,
        );

        runtime.playerIFrameMs = Math.max(0, runtime.playerIFrameMs - deltaMs);
        runtime.shootCooldownMs = Math.max(0, runtime.shootCooldownMs - deltaMs);
        runtime.doorTransitionCooldownMs = Math.max(
          0,
          runtime.doorTransitionCooldownMs - deltaMs,
        );

        if (runtime.enemies.length === 0 && !room.cleared && room.enemies > 0) {
          runtime.enemies = spawnEnemiesForRoom(
            room,
            runtime.floorIndex + 1,
            rngRef.current,
          );
        }

        const shootVector = getShootVector(keysRef.current);

        if (shootVector.x < 0) {
          runtime.facing = -1;
        } else if (shootVector.x > 0) {
          runtime.facing = 1;
        } else if (moveX < 0) {
          runtime.facing = -1;
        } else if (moveX > 0) {
          runtime.facing = 1;
        }

        if ((shootVector.x !== 0 || shootVector.y !== 0) && runtime.shootCooldownMs <= 0) {
          const playerCenterX = runtime.playerX + PLAYER_SIZE / 2;
          const playerCenterY = runtime.playerY + PLAYER_SIZE / 2;
          const length = Math.hypot(shootVector.x, shootVector.y) || 1;
          const bulletId = runtime.nextBulletId++;

          runtime.bullets.push({
            id: bulletId,
            x: playerCenterX,
            y: playerCenterY,
            vx: (shootVector.x / length) * PLAYER_SHOT_SPEED,
            vy: (shootVector.y / length) * PLAYER_SHOT_SPEED,
            fromEnemy: false,
          });

          runtime.shootCooldownMs = SHOOT_COOLDOWN_MS;
        }

        runtime.enemies.forEach((enemy) => {
          const px = runtime.playerX + PLAYER_SIZE / 2;
          const py = runtime.playerY + PLAYER_SIZE / 2;
          const dx = px - enemy.x;
          const dy = py - enemy.y;
          const length = Math.hypot(dx, dy) || 1;

          enemy.x += (dx / length) * enemy.speed * delta;
          enemy.y += (dy / length) * enemy.speed * delta;

          enemy.shootMs -= deltaMs;
          if (enemy.shootMs <= 0) {
            const bLen = Math.hypot(dx, dy) || 1;
            const bulletId = runtime.nextBulletId++;
            runtime.bullets.push({
              id: bulletId,
              x: enemy.x,
              y: enemy.y,
              vx: (dx / bLen) * ENEMY_SHOT_SPEED,
              vy: (dy / bLen) * ENEMY_SHOT_SPEED,
              fromEnemy: true,
            });
            enemy.shootMs = ENEMY_SHOOT_COOLDOWN_MS + rngRef.current() * 600;
          }
        });

        runtime.bullets = runtime.bullets.filter((bullet) => {
          bullet.x += bullet.vx * delta;
          bullet.y += bullet.vy * delta;

          if (
            bullet.x < -20 ||
            bullet.y < -20 ||
            bullet.x > roomWidth + 20 ||
            bullet.y > roomHeight + 20
          ) {
            return false;
          }

          if (!bullet.fromEnemy) {
            const hitEnemy = runtime.enemies.find((enemy) => {
              return Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y) < 18;
            });

            if (hitEnemy) {
              hitEnemy.hp -= 1;
              if (hitEnemy.hp <= 0) {
                runtime.coins += 1;
              }
              return false;
            }

            return true;
          }

          const playerHitDistance = Math.hypot(
            runtime.playerX + PLAYER_SIZE / 2 - bullet.x,
            runtime.playerY + PLAYER_SIZE / 2 - bullet.y,
          );

          if (playerHitDistance < 16 && runtime.playerIFrameMs <= 0) {
            runtime.hearts -= 1;
            runtime.playerIFrameMs = PLAYER_IFRAME_MS;

            if (runtime.hearts <= 0) {
              runtime.gameOver = true;
            }

            return false;
          }

          return true;
        });

        runtime.bombs = runtime.bombs.filter((bomb) => {
          bomb.fuseMs -= deltaMs;
          if (bomb.fuseMs > 0) return true;

          runtime.explosions.push({
            id: runtime.nextBombId++,
            x: bomb.x,
            y: bomb.y,
            ttlMs: BOMB_FLASH_MS,
            radius: BOMB_EXPLOSION_RADIUS,
          });

          runtime.enemies.forEach((enemy) => {
            const distance = Math.hypot(enemy.x - bomb.x, enemy.y - bomb.y);
            if (distance <= BOMB_EXPLOSION_RADIUS) {
              enemy.hp -= BOMB_DAMAGE;

              const kLen = Math.max(0.0001, distance);
              enemy.x += ((enemy.x - bomb.x) / kLen) * BOMB_ENEMY_KNOCKBACK;
              enemy.y += ((enemy.y - bomb.y) / kLen) * BOMB_ENEMY_KNOCKBACK;
              enemy.x = clamp(enemy.x, 12, roomWidth - 12);
              enemy.y = clamp(enemy.y, 12, roomHeight - 12);
            }
          });

          const playerDistance = Math.hypot(
            runtime.playerX + PLAYER_SIZE / 2 - bomb.x,
            runtime.playerY + PLAYER_SIZE / 2 - bomb.y,
          );

          if (playerDistance <= BOMB_EXPLOSION_RADIUS && runtime.playerIFrameMs <= 0) {
            runtime.hearts -= 1;
            runtime.playerIFrameMs = PLAYER_IFRAME_MS;

            const kLen = Math.max(0.0001, playerDistance);
            runtime.playerX = clamp(
              runtime.playerX +
                ((runtime.playerX + PLAYER_SIZE / 2 - bomb.x) / kLen) *
                  BOMB_PLAYER_KNOCKBACK,
              0,
              roomWidth - PLAYER_SIZE,
            );
            runtime.playerY = clamp(
              runtime.playerY +
                ((runtime.playerY + PLAYER_SIZE / 2 - bomb.y) / kLen) *
                  BOMB_PLAYER_KNOCKBACK,
              0,
              roomHeight - PLAYER_SIZE,
            );

            if (runtime.hearts <= 0) {
              runtime.gameOver = true;
            }
          }

          for (const direction of DIRECTIONS) {
            const neighborId = room.neighbors[direction];
            if (neighborId === undefined) continue;

            const neighborRoom = floor.rooms[neighborId];
            if (!neighborRoom) continue;
            if (neighborRoom.type !== "secret" || neighborRoom.doorUnlocked) continue;

            const doorCenter = getDoorCenter(room, direction);
            const distance = Math.hypot(doorCenter.x - bomb.x, doorCenter.y - bomb.y);

            if (distance <= BOMB_REVEAL_DISTANCE) {
              neighborRoom.doorUnlocked = true;
            }
          }

          return false;
        });

        runtime.explosions = runtime.explosions.filter((effect) => {
          effect.ttlMs -= deltaMs;
          return effect.ttlMs > 0;
        });

        runtime.enemies = runtime.enemies.filter((enemy) => enemy.hp > 0);

        if (runtime.enemies.length === 0 && !room.cleared && room.enemies > 0) {
          room.cleared = true;

          if (room.hasBossKey) {
            runtime.hasBossKey = true;
            runtime.keys += 1;
          }

          if (room.type === "boss") {
            runtime.deepestClearedFloor = Math.max(
              runtime.deepestClearedFloor,
              runtime.floorIndex + 1,
            );
          }

          if (room.type === "item") {
            runtime.coins += 3;
          }

          if (room.type === "vault") {
            runtime.keys += 2;
          }

          if (room.type === "cursed") {
            runtime.coins += 2;
          }

          if (room.type === "secret") {
            runtime.coins += 5;
            runtime.keys += 1;
          }
        }

        if (runtime.doorTransitionCooldownMs <= 0) {
          const movedUp =
            moveY < 0 &&
            runtime.playerY <= DOOR_TRIGGER_MARGIN &&
            moveToRoom(runtime, "up", rngRef.current);
          if (movedUp) {
            setFrames((count) => count + 1);
          }

          const movedDown =
            !movedUp &&
            moveY > 0 &&
            runtime.playerY + PLAYER_SIZE >= roomHeight - DOOR_TRIGGER_MARGIN &&
            moveToRoom(runtime, "down", rngRef.current);
          if (movedDown) {
            setFrames((count) => count + 1);
          }

          const movedLeft =
            !movedUp &&
            !movedDown &&
            moveX < 0 &&
            runtime.playerX <= DOOR_TRIGGER_MARGIN &&
            moveToRoom(runtime, "left", rngRef.current);
          if (movedLeft) {
            setFrames((count) => count + 1);
          }

          if (
            !movedUp &&
            !movedDown &&
            !movedLeft &&
            moveX > 0 &&
            runtime.playerX + PLAYER_SIZE >= roomWidth - DOOR_TRIGGER_MARGIN &&
            moveToRoom(runtime, "right", rngRef.current)
          ) {
            setFrames((count) => count + 1);
          }
        }
      }

      setFrames((count) => count + 1);
      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(frameId);
  }, [inSession]);

  useEffect(() => {
    const controlledKeys = new Set([
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
      "Space",
      "ArrowUp",
      "ArrowLeft",
      "ArrowDown",
      "ArrowRight",
    ]);

    const onKeyDown = (event: KeyboardEvent) => {
      if (inSession && controlledKeys.has(event.code)) {
        event.preventDefault();
      }

      if (inSession && event.code === "Space" && !event.repeat) {
        dropBomb();
      }

      keysRef.current[event.code] = true;
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (inSession && controlledKeys.has(event.code)) {
        event.preventDefault();
      }
      keysRef.current[event.code] = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [dropBomb, inSession]);

  const runtime = runtimeRef.current;
  const activeFloor = runtime?.floors[runtime.floorIndex];
  const activeRoom = runtime ? activeFloor?.rooms[runtime.roomIndex] : undefined;

  const canMoveDirection = useCallback(
    (direction: Direction) => {
      if (!runtime || !activeRoom || !activeFloor) return false;
      if (!activeRoom.cleared && activeRoom.enemies > 0) return false;

      const targetIndex = activeRoom.neighbors[direction];
      if (targetIndex === undefined) return false;

      const targetRoom = activeFloor.rooms[targetIndex];
      if (!targetRoom) return false;
      return canEnterRoom(runtime, targetRoom);
    },
    [activeFloor, activeRoom, runtime],
  );

  const navigateRoom = useCallback((direction: Direction) => {
    const current = runtimeRef.current;
    if (!current) return;
    moveToRoom(current, direction, rngRef.current);
  }, []);

  const descendFloor = useCallback(() => {
    const current = runtimeRef.current;
    if (!current) return;

    const floor = current.floors[current.floorIndex];
    if (!floor) return;

    const bossRoom = floor.rooms[floor.bossIndex];
    if (!bossRoom.cleared) return;

    if (current.floorIndex >= BULLET_HELL_MAX_FLOOR - 1) {
      current.playerWon = true;
      current.gameOver = true;
      setRunEnded(true);
      settleReward();
      return;
    }

    current.floorIndex += 1;
    current.roomIndex = 0;
    current.hasBossKey = false;
    current.enemies = [];
    current.bullets = [];
    current.bombs = [];
    current.explosions = [];
    const nextSpawn = current.floors[current.floorIndex].rooms[0];
    current.playerX = nextSpawn.width / 2 - PLAYER_SIZE / 2;
    current.playerY = nextSpawn.height / 2;
  }, [settleReward]);

  const returnToMenu = useCallback(() => {
    settleReward();
    setInSession(false);
    setRunEnded(false);
    setMode(null);
    runtimeRef.current = null;
  }, [settleReward]);

  useEffect(() => {
    if (!runtimeRef.current?.gameOver || runEnded) return;
    setRunEnded(true);
    settleReward();
  }, [frames, runEnded, settleReward]);

  return (
    <OuterPanel className="mx-auto w-[min(98vw,1100px)] h-[min(95vh,900px)] overflow-hidden">
      {!inSession && (
        <div className="flex h-full flex-col gap-6 overflow-y-auto p-6">
          <div className="text-center space-y-2">
            <h2 className="text-4xl font-bold">BULLET HELL</h2>
            <p className="text-sm text-gray-600">
              Clear rooms, unlock paths, reveal hidden doors, and push to the
              target floor without getting shredded.
            </p>
          </div>

          <InnerPanel className="bg-amber-50 p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-sm text-gray-700 font-semibold">
                  REWARD
                </div>
                <div className="flex items-center justify-center gap-1 text-2xl font-bold text-amber-800">
                  {BULLET_HELL_RAVEN_COIN_REWARD}
                  <img
                    src={ravenCoinIcon}
                    alt="RavenCoin"
                    className="w-6 h-6"
                  />
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-700 font-semibold">TODAY</div>
                <div className="text-2xl font-bold text-amber-800">
                  BULLET HELL
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-700 font-semibold">
                  TARGET
                </div>
                <div className="text-2xl font-bold text-amber-800">
                  {dailyTargetFloor}
                </div>
              </div>
            </div>
          </InnerPanel>

          <InnerPanel className="bg-slate-50 p-3 text-sm text-slate-700 space-y-1">
            <div className="font-semibold">How to play</div>
            <div>
              Move freely with <strong>W/A/S/D</strong> and shoot with{" "}
              <strong>Arrow Keys</strong>.
            </div>
            <div>
              Drop bombs with <strong>Space</strong>. Bombs explode after 3
              seconds, deal area damage, and can reveal hidden doors to secret
              rooms.
            </div>
            <div>
              Combat locks all doors until every enemy is defeated. Secret
              rooms are dead ends and can contain rewards or an ambush.
            </div>
            <div className="text-xs text-slate-500">
              Clear <strong>floor {dailyTargetFloor}</strong> or higher to earn
              today&apos;s reward. Curses: {BULLET_HELL_CURSES.join(", ")}.
            </div>
          </InnerPanel>

          <button
            onClick={() => startSession("reward")}
            disabled={!hasRewardRun}
            className={`w-full px-6 py-4 rounded-lg font-bold transition-all shadow-lg text-lg ${
              hasRewardRun
                ? "bg-green-500 text-white hover:bg-green-600 active:scale-95"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            <div>START REWARD RUN</div>
            <div className="mt-2 text-xs opacity-90">
              {hasRewardRun
                ? isVip
                  ? "VIP: reward run available for Bullet Hell today."
                  : "Reward run available for the arcade today."
                : isVip
                  ? "VIP: today's Bullet Hell reward run has already been used."
                  : "Today's arcade reward run has already been used."}
            </div>
          </button>

          <button
            onClick={() => startSession("practice")}
            className="w-full px-6 py-4 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 active:scale-95 transition-all shadow-lg text-lg"
          >
            <div>START PRACTICE MODE</div>
            <div className="mt-2 text-xs font-semibold opacity-90">
              Play without spending today's reward attempt.
            </div>
          </button>

          {!hasRewardRun && paidAttemptsRemaining > 0 && (
            <button
              onClick={() =>
                purchase({ sfl: EXTRA_REWARD_ATTEMPT_FLOWER_COST, items: {} })
              }
              disabled={!canPurchaseExtraAttempt}
              className={`w-full px-6 py-3 rounded-lg font-bold transition-all shadow-lg text-sm ${
                canPurchaseExtraAttempt
                  ? "bg-amber-500 text-white hover:bg-amber-600 active:scale-95"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
            >
              BUY +1 REWARD ATTEMPT ({EXTRA_REWARD_ATTEMPT_FLOWER_COST} FLOWER)
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="w-full px-6 py-2 bg-gray-400 text-white font-semibold rounded-lg hover:bg-gray-500 active:scale-95 transition-all"
            >
              EXIT
            </button>
          )}
        </div>
      )}

      {inSession && runtime && activeFloor && activeRoom && (
        <InnerPanel className="w-full h-full p-3 bg-[#0a0a1a] text-white overflow-auto">
          <div className="max-w-6xl mx-auto h-full flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs">
            <div>
              Mode: {mode} | Floor {runtime.floorIndex + 1}/{BULLET_HELL_MAX_FLOOR}
              {activeFloor.curse ? ` | Curse: ${activeFloor.curse}` : ""}
            </div>
            <div>
              Hearts: {activeFloor.curse === "unknown-hp" ? "???" : runtime.hearts}
              {" | "}Coins: {runtime.coins} | Keys: {runtime.keys} | Bombs: {runtime.bombReveal}
            </div>
          </div>

          <InnerPanel className="p-1">
            <div className="text-xs mb-1">
              Room {activeRoom.id + 1}/{activeFloor.rooms.length} ({getRoomLabel(activeRoom.type)})
              {activeRoom.hasBossKey ? " | Contains Boss Key" : ""}
              {activeRoom.type === "boss" && !runtime.hasBossKey
                ? " | Locked: Find boss key"
                : ""}
            </div>

            <div className="mb-2 border border-brown-500 bg-brown-800/40 p-1">
              <div className="text-[10px] uppercase tracking-wide mb-1">Map</div>
              <div className="relative w-full h-20">
                {(() => {
                  const visibleRooms =
                    activeFloor.curse === "lost-map"
                      ? activeFloor.rooms.filter((room) => room.id === runtime.roomIndex)
                      : activeFloor.rooms.filter(
                          (room) => room.visited || room.id === runtime.roomIndex,
                        );

                  if (visibleRooms.length === 0) return null;

                  const minX = Math.min(...visibleRooms.map((room) => room.x));
                  const maxX = Math.max(...visibleRooms.map((room) => room.x));
                  const minY = Math.min(...visibleRooms.map((room) => room.y));
                  const maxY = Math.max(...visibleRooms.map((room) => room.y));
                  const roomSize = 12;
                  const layoutWidth = (maxX - minX + 1) * roomSize;
                  const layoutHeight = (maxY - minY + 1) * roomSize;
                  const mapWidth = Math.max(140, activeRoom.width - 16);
                  const mapHeight = 80;
                  const originX = Math.max(0, (mapWidth - layoutWidth) / 2);
                  const originY = Math.max(0, (mapHeight - layoutHeight) / 2);

                  return visibleRooms.map((room) => {
                    const left = originX + (room.x - minX) * roomSize;
                    const top = originY + (room.y - minY) * roomSize;
                    const isCurrentRoom = room.id === runtime.roomIndex;

                    return (
                      <div key={`map-${room.id}`}>
                        <div
                          className="absolute border border-black/40"
                          title={getRoomLabel(room.type)}
                          style={{
                            left,
                            top,
                            width: roomSize,
                            height: roomSize,
                            background: getRoomColor(room, isCurrentRoom),
                          }}
                        />

                        {isCurrentRoom && (
                          <div
                            className="absolute rounded-full"
                            style={{
                              left: left + roomSize / 2 - 2,
                              top: top + roomSize / 2 - 2,
                              width: 4,
                              height: 4,
                              background: "#facc15",
                              boxShadow: "0 0 0 1px rgba(0,0,0,0.35)",
                            }}
                          />
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            <div
              ref={arenaRef}
              className="relative border border-brown-400"
              style={{
                width: activeRoom.width,
                height: activeRoom.height,
                ...getRoomStyle(activeRoom),
              }}
            >
              {DIRECTIONS.map((direction) => {
                const targetIndex = activeRoom.neighbors[direction];
                if (targetIndex === undefined) return null;

                const targetRoom = activeFloor.rooms[targetIndex];
                if (!targetRoom) return null;
                if (targetRoom.type === "secret" && !targetRoom.doorUnlocked) {
                  return null;
                }

                const isEnabled = canMoveDirection(direction);
                const indicator = getDoorIndicator(runtime, targetRoom);
                const doorBase: React.CSSProperties = {
                  position: "absolute",
                  background: isEnabled ? "#9f8f6a" : "#5f5648",
                  opacity: activeRoom.cleared ? 1 : 0.55,
                  cursor: isEnabled ? "pointer" : "not-allowed",
                  border: "2px solid #2a211b",
                  zIndex: 8,
                };

                if (direction === "up") {
                  doorBase.left = activeRoom.width / 2 - DOOR_WIDTH / 2;
                  doorBase.top = -1;
                  doorBase.width = DOOR_WIDTH;
                  doorBase.height = DOOR_THICKNESS;
                }

                if (direction === "down") {
                  doorBase.left = activeRoom.width / 2 - DOOR_WIDTH / 2;
                  doorBase.bottom = -1;
                  doorBase.width = DOOR_WIDTH;
                  doorBase.height = DOOR_THICKNESS;
                }

                if (direction === "left") {
                  doorBase.left = -1;
                  doorBase.top = activeRoom.height / 2 - DOOR_WIDTH / 2;
                  doorBase.width = DOOR_THICKNESS;
                  doorBase.height = DOOR_WIDTH;
                }

                if (direction === "right") {
                  doorBase.right = -1;
                  doorBase.top = activeRoom.height / 2 - DOOR_WIDTH / 2;
                  doorBase.width = DOOR_THICKNESS;
                  doorBase.height = DOOR_WIDTH;
                }

                return (
                  <div
                    key={`door-${direction}`}
                    title={`Door: ${direction}`}
                    style={doorBase}
                    onClick={() => {
                      if (!isEnabled) return;
                      navigateRoom(direction);
                    }}
                  >
                    {indicator && (
                      <div
                        className="absolute text-[11px] leading-none font-bold whitespace-nowrap pointer-events-none"
                        style={{
                          color: indicator === "OPEN" ? "#f0ffe0" : "#fff2b3",
                          textShadow: "0 1px 2px rgba(0,0,0,0.9)",
                          left: "50%",
                          top: "50%",
                          transform: "translate(-50%, -50%)",
                          background: "rgba(20, 18, 15, 0.62)",
                          border: "1px solid rgba(255,255,255,0.18)",
                          borderRadius: 4,
                          padding: "1px 4px",
                        }}
                      >
                        {indicator}
                      </div>
                    )}
                  </div>
                );
              })}

              {runtime.bombs.map((bomb) => (
                <div
                  key={bomb.id}
                  className="absolute rounded-full border border-yellow-900"
                  style={{
                    left: bomb.x - 10,
                    top: bomb.y - 10,
                    width: 20,
                    height: 20,
                    background: "#f59e0b",
                    boxShadow: "0 0 0 2px rgba(0,0,0,0.35)",
                    zIndex: 11,
                  }}
                />
              ))}

              {runtime.explosions.map((effect) => {
                const progress = 1 - effect.ttlMs / BOMB_FLASH_MS;
                const radius = effect.radius * progress;
                return (
                  <div
                    key={`explosion-${effect.id}`}
                    className="absolute rounded-full pointer-events-none"
                    style={{
                      left: effect.x - radius,
                      top: effect.y - radius,
                      width: radius * 2,
                      height: radius * 2,
                      border: "3px solid rgba(253, 224, 71, 0.95)",
                      background: "rgba(251, 191, 36, 0.14)",
                      opacity: 1 - progress,
                      zIndex: 9,
                    }}
                  />
                );
              })}

              {runtime.bullets.map((bullet) => (
                <div
                  key={bullet.id}
                  className="absolute rounded-full"
                  style={{
                    left: bullet.x - 3,
                    top: bullet.y - 3,
                    width: 6,
                    height: 6,
                    background: bullet.fromEnemy ? "#ff7d7d" : "#8df2ff",
                  }}
                />
              ))}

              {runtime.enemies.map((enemy) => (
                <div
                  key={enemy.id}
                  className="absolute rounded-full border border-red-900"
                  style={{
                    left: enemy.x - 12,
                    top: enemy.y - 12,
                    width: 24,
                    height: 24,
                    background: "#d94d4d",
                  }}
                />
              ))}

              <div
                className="absolute overflow-hidden"
                style={{
                  left: runtime.playerX,
                  top: runtime.playerY,
                  width: PLAYER_SIZE,
                  height: PLAYER_SIZE,
                  opacity: runtime.playerIFrameMs > 0 ? 0.5 : 1,
                  zIndex: 10,
                  filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.7))",
                  transform: runtime.facing === -1 ? "scaleX(-1)" : undefined,
                }}
              >
                <NPCIcon parts={playerParts} width={PLAYER_SIZE} />
              </div>

              {activeFloor.curse === "darkness" && (
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: `radial-gradient(circle at ${runtime.playerX + PLAYER_SIZE / 2}px ${runtime.playerY + PLAYER_SIZE / 2}px, rgba(0,0,0,0) 90px, rgba(0,0,0,0.75) 220px)`,
                  }}
                />
              )}
            </div>
          </InnerPanel>

          <div className="flex gap-2 justify-between">
            <Button onClick={descendFloor}>Descend</Button>
            <Button onClick={returnToMenu}>Back To Menu</Button>
            {onClose && <Button onClick={onClose}>Exit</Button>}
          </div>

          {runEnded && (
            <InnerPanel className="p-2">
              <div className="flex items-center justify-center gap-2 font-bold text-sm">
                {runtime.playerWon ? "Run Clear" : "Run Failed"}
                {mode === "reward" && runtime.playerWon && runtime.deepestClearedFloor >= dailyTargetFloor && (
                  <>
                    <img src={ravenCoinIcon} className="w-4 h-4" />
                    <span>+{BULLET_HELL_RAVEN_COIN_REWARD}</span>
                  </>
                )}
              </div>
              <div className="text-center text-xs mt-1">
                Deepest cleared floor: {runtime.deepestClearedFloor} | Daily target: {dailyTargetFloor}
              </div>
            </InnerPanel>
          )}
          </div>
        </InnerPanel>
      )}
    </OuterPanel>
  );
};
