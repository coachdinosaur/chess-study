import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import type { PositionDocument, Square } from "./chess";
import type { ArrowAnnotation, SquareAnnotation } from "./ChessBoard3D";

export const SUPABASE_URL = "https://oxcottitwvayrrcuypmb.supabase.co";
export const SUPABASE_KEY = "sb_publishable_-0VdtXfcJH__vKlXrX5QIg_8QKXmf6z";

export type Role = "teacher" | "student";

export type RemotePointer = {
  square: Square | null;
  role: Role;
  label?: string;
};

export type BroadcastPayload =
  | {
      type: "POSITION_SYNC";
      doc: PositionDocument;
      lastAction: string;
      actor: Role;
    }
  | {
      type: "LOCK_STATE";
      studentMovesAllowed: boolean;
    }
  | {
      type: "REMOTE_POINTER";
      square: Square | null;
      role: Role;
      label?: string;
    }
  | {
      type: "ANNOTATIONS_SYNC";
      arrows: ArrowAnnotation[];
      squareHighlights: SquareAnnotation[];
      actor: Role;
    }
  | {
      type: "PRESET_SYNC";
      preset: "empty" | "start";
      actor: Role;
    };

export function normalizeRoomCode(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 16);
}

export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let random = "";
  for (let i = 0; i < 4; i++) {
    random += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `3D-${random}`;
}

export function parseLiveRoomFromUrl(urlString?: string): { roomId: string; role: Role } | null {
  const currentUrl = urlString || (typeof window !== "undefined" ? window.location.href : "");
  if (!currentUrl) return null;

  try {
    const url = new URL(currentUrl, "https://example.com");
    // 1. Check hash params (e.g. #room=3D-X7M2&role=student)
    const hash = url.hash.replace(/^#/, "");
    const hashParams = new URLSearchParams(hash);
    const hashRoom = normalizeRoomCode(hashParams.get("room"));
    const hashRole = hashParams.get("role")?.toLowerCase();

    if (hashRoom && (hashRole === "teacher" || hashRole === "student")) {
      return { roomId: hashRoom, role: hashRole as Role };
    }

    // 2. Check query params (e.g. ?room=3D-X7M2&role=student)
    const searchRoom = normalizeRoomCode(url.searchParams.get("room"));
    const searchRole = url.searchParams.get("role")?.toLowerCase();

    if (searchRoom && (searchRole === "teacher" || searchRole === "student")) {
      return { roomId: searchRoom, role: searchRole as Role };
    }
  } catch {
    return null;
  }

  return null;
}

export function createStudentLiveUrl(roomId: string, baseUrl?: string): string {
  const base = baseUrl || (typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}` : "/3d/");
  return `${base}#room=${encodeURIComponent(roomId)}&role=student`;
}

export function createTeacherLiveUrl(roomId: string, baseUrl?: string): string {
  const base = baseUrl || (typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}` : "/3d/");
  return `${base}#room=${encodeURIComponent(roomId)}&role=teacher`;
}

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 20,
        },
      },
    });
  }
  return supabaseClient;
}

export type LiveSessionCallbacks = {
  onStatusChange: (status: "connecting" | "connected" | "disconnected" | "error", message?: string) => void;
  onPeerPresenceChange: (peerOnline: boolean, peerCount: number) => void;
  onPositionSync: (doc: PositionDocument, lastAction: string, actor: Role) => void;
  onLockStateChange: (studentMovesAllowed: boolean) => void;
  onRemotePointer: (pointer: RemotePointer) => void;
  onAnnotationsSync: (arrows: ArrowAnnotation[], squareHighlights: SquareAnnotation[]) => void;
  onPresetSync: (preset: "empty" | "start", actor: Role) => void;
};

export class LiveSession {
  private roomId: string;
  private role: Role;
  private channel: RealtimeChannel | null = null;
  private callbacks: LiveSessionCallbacks;
  private active = false;

  constructor(roomId: string, role: Role, callbacks: LiveSessionCallbacks) {
    this.roomId = normalizeRoomCode(roomId);
    this.role = role;
    this.callbacks = callbacks;
  }

  public connect(): void {
    if (this.active) return;
    this.active = true;

    try {
      const client = getSupabaseClient();
      this.callbacks.onStatusChange("connecting", `Joining room ${this.roomId}...`);

      const channelName = `3d_studio_room:${this.roomId.toLowerCase()}`;
      this.channel = client.channel(channelName, {
        config: {
          broadcast: { self: false },
          presence: { key: `${this.role}-${Math.random().toString(36).slice(2, 7)}` },
        },
      });

      this.channel
        .on("broadcast", { event: "room_event" }, ({ payload }) => {
          this.handleBroadcast(payload as BroadcastPayload);
        })
        .on("presence", { event: "sync" }, () => {
          if (!this.channel) return;
          const presenceState = this.channel.presenceState();
          const keys = Object.keys(presenceState);
          // Check if any presence is from the other role
          const otherRole = this.role === "teacher" ? "student" : "teacher";
          const hasOtherRole = keys.some((k) => k.startsWith(otherRole));
          this.callbacks.onPeerPresenceChange(hasOtherRole, keys.length);
        })
        .on("presence", { event: "join" }, ({ key }) => {
          const otherRole = this.role === "teacher" ? "student" : "teacher";
          if (key.startsWith(otherRole)) {
            this.callbacks.onPeerPresenceChange(true, 2);
          }
        })
        .on("presence", { event: "leave" }, () => {
          if (!this.channel) return;
          const presenceState = this.channel.presenceState();
          const keys = Object.keys(presenceState);
          const otherRole = this.role === "teacher" ? "student" : "teacher";
          const hasOtherRole = keys.some((k) => k.startsWith(otherRole));
          this.callbacks.onPeerPresenceChange(hasOtherRole, keys.length);
        })
        .subscribe((status, err) => {
          if (status === "SUBSCRIBED") {
            this.callbacks.onStatusChange("connected", `Connected to room ${this.roomId}`);
            this.channel?.track({
              role: this.role,
              joinedAt: new Date().toISOString(),
            });
          } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
            this.callbacks.onStatusChange("disconnected", err?.message || "Disconnected");
          }
        });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Connection failed";
      this.callbacks.onStatusChange("error", message);
    }
  }

  private handleBroadcast(payload: BroadcastPayload): void {
    if (!payload || !payload.type) return;

    switch (payload.type) {
      case "POSITION_SYNC":
        this.callbacks.onPositionSync(payload.doc, payload.lastAction, payload.actor);
        break;
      case "LOCK_STATE":
        this.callbacks.onLockStateChange(payload.studentMovesAllowed);
        break;
      case "REMOTE_POINTER":
        this.callbacks.onRemotePointer({
          square: payload.square,
          role: payload.role,
          label: payload.label,
        });
        break;
      case "ANNOTATIONS_SYNC":
        this.callbacks.onAnnotationsSync(payload.arrows, payload.squareHighlights);
        break;
      case "PRESET_SYNC":
        this.callbacks.onPresetSync(payload.preset, payload.actor);
        break;
    }
  }

  public sendPosition(doc: PositionDocument, lastAction: string): void {
    if (!this.channel) return;
    this.channel.send({
      type: "broadcast",
      event: "room_event",
      payload: {
        type: "POSITION_SYNC",
        doc,
        lastAction,
        actor: this.role,
      } as BroadcastPayload,
    });
  }

  public sendLockState(studentMovesAllowed: boolean): void {
    if (!this.channel || this.role !== "teacher") return;
    this.channel.send({
      type: "broadcast",
      event: "room_event",
      payload: {
        type: "LOCK_STATE",
        studentMovesAllowed,
      } as BroadcastPayload,
    });
  }

  public sendRemotePointer(square: Square | null): void {
    if (!this.channel) return;
    this.channel.send({
      type: "broadcast",
      event: "room_event",
      payload: {
        type: "REMOTE_POINTER",
        square,
        role: this.role,
        label: this.role === "teacher" ? "Coach" : "Student",
      } as BroadcastPayload,
    });
  }

  public sendAnnotations(arrows: ArrowAnnotation[], squareHighlights: SquareAnnotation[]): void {
    if (!this.channel) return;
    this.channel.send({
      type: "broadcast",
      event: "room_event",
      payload: {
        type: "ANNOTATIONS_SYNC",
        arrows,
        squareHighlights,
        actor: this.role,
      } as BroadcastPayload,
    });
  }

  public sendPreset(preset: "empty" | "start"): void {
    if (!this.channel) return;
    this.channel.send({
      type: "broadcast",
      event: "room_event",
      payload: {
        type: "PRESET_SYNC",
        preset,
        actor: this.role,
      } as BroadcastPayload,
    });
  }

  public disconnect(): void {
    if (!this.active) return;
    this.active = false;
    if (this.channel) {
      this.channel.unsubscribe();
      const client = getSupabaseClient();
      client.removeChannel(this.channel);
      this.channel = null;
    }
    this.callbacks.onStatusChange("disconnected", "Session closed");
    this.callbacks.onPeerPresenceChange(false, 0);
  }
}
