import { useEffect, useRef, useState } from "react";
import type { NetworkClient } from "./network-model.js";
export interface SplitMember {
  id: string;
  username: string;
}
export function useBookMembers(
  client: NetworkClient,
  bookId?: string,
): SplitMember[] {
  const [members, setMembers] = useState<SplitMember[]>([]);
  const latest = useRef(client);
  latest.current = client;
  useEffect(() => {
    let canceled = false;
    setMembers([]);
    if (bookId)
      void latest.current
        .request<{ members: SplitMember[] }>(`/network/books/${bookId}/members`)
        .then((result) => {
          if (!canceled) setMembers(result.members);
        })
        .catch(() => {});
    return () => {
      canceled = true;
    };
  }, [bookId, client]);
  return members;
}
