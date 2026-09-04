import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export function useIsPlatformAdmin() {
  return useQuery({
    queryKey: ["is-platform-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_platform_admin");
      if (error) return false;
      return Boolean(data);
    },
    staleTime: 300_000,
  });
}
