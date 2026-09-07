"use client";

import { useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { createClient } from "@/lib/supabase/client";
import { r2Url } from "@/lib/r2";

type Player = {
  id: string;
  player_name: string;
  player_photo_r2_key: string | null;
  position_x: number | null;
  position_y: number | null;
};

// Roster management + free-form position layout. Positions are stored as 0–100
// percentages of the field box so they survive any resize; null = in the tray.
// Team creation and roster CRUD work with zero positions set (columns nullable).
export function PlayersManager({
  teamId,
  teamName,
  initialPlayers,
}: {
  teamId: string;
  teamName: string;
  initialPlayers: Player[];
}) {
  const supabase = createClient();
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [newName, setNewName] = useState("");
  const [dragging, setDragging] = useState<Player | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fieldRef = useRef<HTMLDivElement | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onField = players.filter((p) => p.position_x !== null && p.position_y !== null);
  const inTray = players.filter((p) => p.position_x === null || p.position_y === null);

  async function persistPosition(player: Player, x: number | null, y: number | null) {
    // Optimistic update; PATCH failure rolls back via refetch-free revert.
    const snapshot = players;
    setPlayers((ps) => ps.map((p) => (p.id === player.id ? { ...p, position_x: x, position_y: y } : p)));
    const { error: patchError } = await supabase
      .from("team_players")
      .update({ position_x: x, position_y: y })
      .eq("id", player.id);
    if (patchError) {
      setPlayers(snapshot);
      setError(patchError.message);
    }
  }

  function handleDragStart(e: DragStartEvent) {
    setDragging(players.find((p) => p.id === e.active.id) ?? null);
  }

  function handleDragEnd(e: DragEndEvent) {
    setDragging(null);
    const player = players.find((p) => p.id === e.active.id);
    if (!player) return;

    if (e.over?.id === "tray") {
      void persistPosition(player, null, null); // back to tray = unpositioned
      return;
    }
    if (e.over?.id !== "field") return;

    // Drop point → percentage of the field element. dnd-kit gives the pointer
    // position; the chip is anchored at its top-left, offset by half a chip
    // (~24px) so the finger point is roughly the chip centre.
    const rect = fieldRef.current?.getBoundingClientRect();
    const translated = e.active.rect.current.translated;
    if (!rect || !translated) return;
    const x = ((translated.left - rect.left + 24) / rect.width) * 100;
    const y = ((translated.top - rect.top + 24) / rect.height) * 100;
    void persistPosition(player, Math.min(96, Math.max(0, x)), Math.min(92, Math.max(0, y)));
  }

  async function addPlayer(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setError(null);
    const { data, error: insertError } = await supabase
      .from("team_players")
      .insert({ team_id: teamId, player_name: newName.trim() })
      .select("id, player_name, player_photo_r2_key, position_x, position_y")
      .single();
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setPlayers((ps) => [...ps, data]);
    setNewName("");
  }

  async function removePlayer(id: string) {
    const snapshot = players;
    setPlayers((ps) => ps.filter((p) => p.id !== id));
    const { error: deleteError } = await supabase.from("team_players").delete().eq("id", id);
    if (deleteError) {
      setPlayers(snapshot);
      setError(deleteError.message);
    }
  }

  async function uploadPhoto(player: Player, file: File) {
    setError(null);
    const res = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId, playerId: player.id, contentType: file.type }),
    });
    if (!res.ok) {
      setError("Photo upload failed — check back later or try a smaller image.");
      return;
    }
    const { url, key } = await res.json();
    const put = await fetch(url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
    if (!put.ok) {
      setError("Photo upload failed.");
      return;
    }
    const { error: patchError } = await supabase
      .from("team_players")
      .update({ player_photo_r2_key: key })
      .eq("id", player.id);
    if (patchError) setError(patchError.message);
    else setPlayers((ps) => ps.map((p) => (p.id === player.id ? { ...p, player_photo_r2_key: key } : p)));
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <h1 className="text-2xl font-semibold">{teamName} — players &amp; positions</h1>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_16rem]">
        <Field fieldRef={fieldRef} onField={onField} />
        <Tray players={inTray} onRemove={removePlayer} onPhoto={uploadPhoto} />
      </div>

      <form onSubmit={addPlayer} className="mt-6 flex max-w-md gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Player name"
          className="flex-1 rounded border px-3 py-2"
        />
        <button type="submit" className="rounded bg-green-700 px-4 py-2 font-medium text-white hover:bg-green-800">
          Add
        </button>
      </form>

      <DragOverlay>
        {dragging ? <PlayerChip player={dragging} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

// Field DOM node lives in the parent — drag-end needs its rect to convert the
// drop point into percentage coordinates.
function Field({
  onField,
  fieldRef,
}: {
  onField: Player[];
  fieldRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "field" });
  return (
    <div
      ref={(el) => {
        fieldRef.current = el;
        setNodeRef(el);
      }}
      className={`relative aspect-[3/4] w-full overflow-hidden rounded-xl border-2 ${
        isOver ? "border-green-600" : "border-green-800/40"
      } bg-gradient-to-b from-green-700 to-green-800`}
    >
      {/* Pitch markings — inline SVG, no external image, scales with the box. */}
      <svg viewBox="0 0 300 400" className="absolute inset-0 h-full w-full text-white/50" aria-hidden>
        <rect x="4" y="4" width="292" height="392" fill="none" stroke="currentColor" strokeWidth="2" />
        <line x1="4" y1="200" x2="296" y2="200" stroke="currentColor" strokeWidth="2" />
        <circle cx="150" cy="200" r="30" fill="none" stroke="currentColor" strokeWidth="2" />
        <rect x="60" y="4" width="180" height="50" fill="none" stroke="currentColor" strokeWidth="2" />
        <rect x="60" y="346" width="180" height="50" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="150" cy="4" r="4" fill="currentColor" />
        <circle cx="150" cy="396" r="4" fill="currentColor" />
      </svg>

      {onField.map((p) => (
        <FieldChip key={p.id} player={p} />
      ))}
    </div>
  );
}

function FieldChip({ player }: { player: Player }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: player.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        left: `${player.position_x}%`,
        top: `${player.position_y}%`,
        transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
      }}
      className="absolute touch-none select-none"
    >
      <PlayerChip player={player} />
    </div>
  );
}

function Tray({
  players,
  onRemove,
  onPhoto,
}: {
  players: Player[];
  onRemove: (id: string) => void;
  onPhoto: (player: Player, file: File) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "tray" });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border p-3 ${isOver ? "border-green-600 bg-green-50" : "border-neutral-200"}`}
    >
      <h2 className="text-sm font-medium opacity-70">Bench (drag onto field)</h2>
      <ul className="mt-2 space-y-2">
        {players.map((p) => (
          <li key={p.id} className="flex items-center gap-2">
            <TrayChip player={p} />
            <label className="cursor-pointer text-xs underline opacity-60 hover:opacity-100">
              photo
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onPhoto(p, e.target.files[0])}
              />
            </label>
            <button
              onClick={() => onRemove(p.id)}
              className="text-xs text-red-600 underline hover:no-underline"
              type="button"
            >
              remove
            </button>
          </li>
        ))}
        {players.length === 0 && <li className="text-xs opacity-50">Empty — add players below.</li>}
      </ul>
    </div>
  );
}

function TrayChip({ player }: { player: Player }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: player.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined }}
      className="touch-none select-none"
    >
      <PlayerChip player={player} />
    </div>
  );
}

function PlayerChip({ player }: { player: Player }) {
  const photo = player.player_photo_r2_key ? r2Url(player.player_photo_r2_key) : null;
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-white/95 py-1 pl-1 pr-2.5 shadow">
      {photo ? (
        <img src={photo} alt="" className="h-6 w-6 rounded-full object-cover" />
      ) : (
        <span className="grid h-6 w-6 place-items-center rounded-full bg-green-800 text-xs font-bold text-white">
          {player.player_name[0]?.toUpperCase()}
        </span>
      )}
      <span className="max-w-28 truncate text-xs font-medium">{player.player_name}</span>
    </div>
  );
}
