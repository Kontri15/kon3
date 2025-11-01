import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export function useBlocksForDateRange(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ["blocks", format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd")],
    queryFn: async () => {
      const startStr = format(startDate, "yyyy-MM-dd");
      const endStr = format(endDate, "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("blocks")
        .select("*")
        .gte("start_at", `${startStr}T00:00:00`)
        .lte("start_at", `${endStr}T23:59:59`)
        .order("start_at", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });
}
