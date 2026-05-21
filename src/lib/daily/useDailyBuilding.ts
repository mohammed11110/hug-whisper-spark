import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DailyBuilding {
  id: string;
  name: string;
}

const STORAGE_KEY = "amlaki.daily.buildingId";

/**
 * Single-building selector for the Daily Rentals section.
 * Loads buildings the user has access to (RLS-filtered) and remembers the choice.
 */
export function useDailyBuilding() {
  const [buildings, setBuildings] = useState<DailyBuilding[]>([]);
  const [buildingId, setBuildingIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("buildings")
        .select("id,name,name_en")
        .order("created_at", { ascending: true });
      if (cancelled) return;
      const list: DailyBuilding[] = (data || []).map((b: any) => ({
        id: b.id,
        name: b.name || b.name_en || "—",
      }));
      setBuildings(list);
      const stored = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      const initial = stored && list.find((b) => b.id === stored) ? stored : list[0]?.id ?? null;
      setBuildingIdState(initial);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setBuildingId = (id: string) => {
    setBuildingIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {}
  };

  return { buildings, buildingId, setBuildingId, loading };
}
