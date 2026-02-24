import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

// Fetch items
export function useItems() {
  return useQuery({
    queryKey: [api.items.list.path],
    queryFn: async () => {
      const res = await fetch(api.items.list.path, { credentials: "include" });
      if (!res.ok) {
        throw new Error("Failed to fetch items");
      }
      const data = await res.json();
      
      // Parse using Zod schema for runtime safety
      const parseResult = api.items.list.responses[200].safeParse(data);
      if (!parseResult.success) {
        console.error("Zod validation error:", parseResult.error);
        throw new Error("Invalid response format");
      }
      return parseResult.data;
    },
  });
}

// Create new item
export function useCreateItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: z.infer<typeof api.items.create.input>) => {
      // Validate input before sending
      const validated = api.items.create.input.parse(data);
      
      const res = await fetch(api.items.create.path, {
        method: api.items.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to create item");
      }
      
      const responseData = await res.json();
      return api.items.create.responses[201].parse(responseData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.items.list.path] });
      toast({
        title: "Item added",
        description: "Your new item has been successfully created.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
