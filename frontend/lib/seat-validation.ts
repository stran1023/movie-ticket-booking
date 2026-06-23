import type { SeatData } from "@/lib/mock-data";

/**
 * Checks whether toggling (select/deselect) a seat is allowed without
 * creating a NEW single-seat empty gap in its row.
 *
 * A "single-seat gap" (orphan) is an empty position where both the left
 * and right neighbours are taken by occupied or selected seats.
 * Edge positions (first/last in the row) only have one neighbour,
 * so they can never be orphaned — matching the cinema rule that
 * outermost seats are always freely selectable.
 *
 * Pre-existing orphans (from other people's bookings) do not block
 * the current user's selection.
 */
export function canToggleSeat(
  seat: SeatData,
  allSeats: SeatData[],
  currentSelectedIds: Set<string>,
  isDeselecting: boolean,
): boolean {
  const rowSeats = allSeats
    .filter((s) => s.row === seat.row)
    .sort((a, b) => a.number - b.number);

  if (rowSeats.length === 0) return true;

  const positions = rowSeats.map((s) => s.number);
  const minPos = positions[0];
  const maxPos = positions[positions.length - 1];

  const takenBefore = buildTakenPositions(rowSeats, currentSelectedIds);
  const orphansBefore = findOrphans(positions, takenBefore, minPos, maxPos);

  const takenAfter = new Set(takenBefore);
  if (isDeselecting) {
    removeSeatPositions(takenAfter, seat);
  } else {
    addSeatPositions(takenAfter, seat);
  }

  const orphansAfter = findOrphans(positions, takenAfter, minPos, maxPos);

  for (const pos of orphansAfter) {
    if (!orphansBefore.has(pos)) return false;
  }
  return true;
}

function buildTakenPositions(
  rowSeats: SeatData[],
  selectedIds: Set<string>,
): Set<number> {
  const taken = new Set<number>();
  for (const s of rowSeats) {
    // A seat is only "taken" for validation if someone else owns it,
    // OR if we actively have it selected in our current Redux state.
    const takenByOthers = s.status === "occupied" || s.status === "held";
    const takenByUs = selectedIds.has(s.id);

    if (takenByOthers || takenByUs) {
      taken.add(s.number);
      if (s.type === "couple") {
        taken.add(s.number + 1);
      }
    }
  }
  return taken;
}

function addSeatPositions(taken: Set<number>, seat: SeatData): void {
  taken.add(seat.number);
  if (seat.type === "couple") {
    taken.add(seat.number + 1);
  }
}

function removeSeatPositions(taken: Set<number>, seat: SeatData): void {
  taken.delete(seat.number);
  if (seat.type === "couple") {
    taken.delete(seat.number + 1);
  }
}

/**
 * Returns positions that are orphaned: empty, with both adjacent
 * positions taken. Edge positions (min/max) are never orphaned
 * because they only have one neighbour.
 */
function findOrphans(
  allPositions: number[],
  taken: Set<number>,
  minPos: number,
  maxPos: number,
): Set<number> {
  const orphans = new Set<number>();
  for (const pos of allPositions) {
    if (taken.has(pos)) continue;
    if (pos === minPos || pos === maxPos) continue;

    const leftTaken = taken.has(pos - 1);
    const rightTaken = taken.has(pos + 1);

    if (leftTaken && rightTaken) orphans.add(pos);
  }
  return orphans;
}
