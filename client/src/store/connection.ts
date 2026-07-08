import { create } from "zustand";
import type { ConnectionState } from "../components/design/ConnectionStatus";

interface ConnectionStore {
  status: ConnectionState;
  setStatus: (status: ConnectionState) => void;
}

/**
 * App-wide view of the user WebSocket's health. The socket lives in the Inbox
 * screen's hook; publishing its status here lets Channels/Thread/Hub surface
 * a dropped connection instead of failing silently.
 */
export const useConnectionStore = create<ConnectionStore>((set) => ({
  status: "disconnected",
  setStatus: (status) => set({ status }),
}));
