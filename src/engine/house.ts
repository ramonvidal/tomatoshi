// All the rooms. You see one room at a time; Tomatoshi lives in one room at
// a time, and they don't have to be the same. Tapping a door moves your view
// through it; Tomatoshi moves through doors on its own.

import type { Tomatoshi } from "../friend/Tomatoshi";
import type { PropContext, PropFactory } from "../objects/prop";
import type { Bounds, Gesture } from "./input";
import { Room, type SceneDef } from "./room";
import { STAGE_HEIGHT, STAGE_WIDTH, svgEl, type Stage } from "./stage";

/** Seconds for each half of the fade between rooms. */
const FADE = 0.18;
const BLEED = 1200;

export class House {
  readonly rooms = new Map<string, Room>();
  private viewedId: string;
  private friend: Tomatoshi | null = null;
  private friendUi: SVGGElement;
  private readonly curtain: SVGRectElement;
  private fade: { phase: "out" | "in"; t: number; to: string } | null = null;
  private peekIn: { roomId: string; at: number } | null = null;
  private time = 0;
  private readonly rng: () => number;

  constructor(
    stage: Stage,
    scenes: SceneDef[],
    ctx: Omit<PropContext, "fx" | "area">,
    factories: Record<string, PropFactory>,
    backdrops: Record<string, () => SVGGElement>,
    viewedId: string,
  ) {
    this.rng = ctx.rng;
    for (const scene of scenes) {
      this.rooms.set(scene.id, new Room(scene, stage.layers.rooms, ctx, factories, backdrops));
    }
    this.viewedId = this.rooms.has(viewedId) ? viewedId : scenes[0].id;
    for (const room of this.rooms.values()) room.show(room.id === this.viewedId);

    this.friendUi = svgEl("g", { class: "friend-ui" });
    this.curtain = svgEl("rect", {
      x: -BLEED,
      y: -BLEED,
      width: STAGE_WIDTH + 2 * BLEED,
      height: STAGE_HEIGHT + 2 * BLEED,
      fill: "#2e2626",
      opacity: 0,
      "pointer-events": "none",
    });
    stage.layers.ui.append(this.friendUi, this.curtain);
  }

  get viewed(): Room {
    return this.rooms.get(this.viewedId)!;
  }

  room(id: string): Room {
    const room = this.rooms.get(id);
    if (!room) throw new Error(`Unknown room: ${id}`);
    return room;
  }

  /** Put Tomatoshi's body into the room it's in. */
  attachFriend(friend: Tomatoshi): void {
    this.friend = friend;
    this.friendUi.appendChild(friend.bubble.root);
    this.placeFriend();
    friend.viewerRoom = this.viewedId;
  }

  /** Tomatoshi went through a door: it comes out of the matching door next door. */
  friendLeft(fromRoomId: string, doorId: string): void {
    const friend = this.friend;
    if (!friend) return;
    const to = this.room(fromRoomId).props.get(doorId)?.doorTo?.();
    if (!to || !this.rooms.has(to)) return;
    const target = this.room(to);
    const arrivalDoor = target.doorTo(fromRoomId);
    const spot = (arrivalDoor ? target.spot(arrivalDoor, "leave", target.def.start) : null) ?? target.def.start;
    if (arrivalDoor) target.use(arrivalDoor, "leave", spot);
    friend.enter(target, spot);
    this.placeFriend();

    // You stayed behind: sometimes it peeks back in to see if you noticed.
    if (fromRoomId === this.viewedId && this.rng() < 0.6) {
      this.peekIn = { roomId: fromRoomId, at: this.time + 3 + this.rng() * 4 };
    }
  }

  /** Move the view to another room, with a quick fade. */
  goTo(roomId: string): void {
    if (roomId === this.viewedId || !this.rooms.has(roomId) || this.fade) return;
    this.fade = { phase: "out", t: 0, to: roomId };
  }

  /** A door was tapped: follow it. */
  doorTapped(doorId: string): void {
    const to = this.viewed.props.get(doorId)?.doorTo?.();
    if (to) this.goTo(to);
  }

  /** Gestures on the viewed room's props. Returns true if handled (or swallowed mid-fade). */
  handle(g: Gesture): boolean {
    if (this.fade) return true;
    return this.viewed.handle(g);
  }

  boundsOf(target: Gesture["target"]): Bounds | null {
    return this.viewed.boundsOf(target);
  }

  get friendVisible(): boolean {
    return !!this.friend && this.friend.room.id === this.viewedId;
  }

  update(dt: number): void {
    this.time += dt;
    const friend = this.friend;
    for (const room of this.rooms.values()) {
      const here = friend && friend.room.id === room.id;
      room.update(dt, here ? { root: friend.parts.root, y: friend.ground } : null);
    }
    this.friendUi.setAttribute("display", this.friendVisible ? "inline" : "none");
    this.updateFade(dt);

    if (this.peekIn && this.time >= this.peekIn.at) {
      const { roomId } = this.peekIn;
      this.peekIn = null;
      // Only if you're still there, and it's still away.
      if (roomId === this.viewedId && friend && friend.room.id !== roomId) {
        const door = this.viewed.doorTo(friend.room.id);
        if (door) this.viewed.props.get(door)?.peek?.();
      }
    }
  }

  private updateFade(dt: number): void {
    const f = this.fade;
    if (!f) return;
    f.t += dt;
    const k = Math.min(1, f.t / FADE);
    this.curtain.setAttribute("opacity", (f.phase === "out" ? k : 1 - k).toFixed(3));
    if (k < 1) return;
    if (f.phase === "out") {
      this.viewed.show(false);
      this.viewedId = f.to;
      this.viewed.show(true);
      if (this.friend) this.friend.viewerRoom = f.to;
      this.fade = { phase: "in", t: 0, to: f.to };
    } else {
      this.fade = null;
    }
  }

  private placeFriend(): void {
    const friend = this.friend;
    if (!friend) return;
    const room = this.room(friend.room.id);
    room.layers.shadows.appendChild(friend.parts.shadow);
    room.layers.world.appendChild(friend.parts.root);
  }
}
