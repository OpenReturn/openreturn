import type { ReturnEventType, ReturnState, TrackingStatus } from "@openreturn/types";
import { conflict } from "./errors";

/** Allowed lifecycle transitions for each OpenReturn state. */
export const RETURN_STATE_TRANSITIONS: Record<ReturnState, ReturnState[]> = {
  initiated: ["label_generated", "approved", "rejected"],
  label_generated: ["shipped", "in_transit", "delivered", "rejected"],
  shipped: ["in_transit", "delivered", "rejected"],
  in_transit: ["delivered", "rejected"],
  delivered: ["inspection", "approved", "rejected"],
  inspection: ["approved", "rejected"],
  approved: ["refunded", "exchanged", "completed"],
  rejected: ["completed"],
  refunded: ["completed"],
  exchanged: ["completed"],
  completed: []
};

/** Returns whether a lifecycle transition is permitted by the protocol state machine. */
export function canTransition(from: ReturnState, to: ReturnState): boolean {
  return from === to || RETURN_STATE_TRANSITIONS[from].includes(to);
}

/** Throws a protocol conflict when a lifecycle transition is not permitted. */
export function assertTransition(from: ReturnState, to: ReturnState): void {
  if (!canTransition(from, to)) {
    throw conflict(`Invalid return state transition from ${from} to ${to}`, {
      from,
      to,
      allowed: RETURN_STATE_TRANSITIONS[from]
    });
  }
}

/** Maps a carrier tracking status onto the corresponding return lifecycle state. */
export function stateForTrackingStatus(status: TrackingStatus): ReturnState {
  switch (status) {
    case "label_created":
      return "label_generated";
    case "accepted":
      return "shipped";
    case "in_transit":
    case "out_for_delivery":
      return "in_transit";
    case "delivered":
      return "delivered";
    case "exception":
      return "in_transit";
  }
}

/** Returns the canonical event type emitted for a lifecycle state. */
export function eventTypeForState(state: ReturnState): ReturnEventType {
  switch (state) {
    case "initiated":
      return "return.initiated";
    case "label_generated":
      return "return.label_generated";
    case "shipped":
      return "return.shipped";
    case "in_transit":
      return "return.in_transit";
    case "delivered":
      return "return.delivered";
    case "inspection":
      return "return.inspection_started";
    case "approved":
      return "return.approved";
    case "rejected":
      return "return.rejected";
    case "refunded":
      return "return.refunded";
    case "exchanged":
      return "return.exchanged";
    case "completed":
      return "return.completed";
  }
}
