// hooks/useCulturesQuery.js — React Query wrappers for cultures API
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, API_ENDPOINTS } from "@api/client";

const CULTURES_KEY = ["cultures"];

async function fetchCultures() {
  const res = await apiFetch(API_ENDPOINTS.cultures.base);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || "Erreur chargement cultures");
  return json.data ?? [];
}

async function deleteCulture(id) {
  const res = await apiFetch(API_ENDPOINTS.cultures.byId(id), { method: "DELETE" });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || "Suppression impossible");
  return json;
}

export function useCulturesQuery() {
  return useQuery({
    queryKey: CULTURES_KEY,
    queryFn: fetchCultures,
    staleTime: 30_000,
  });
}

export function useDeleteCultureMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteCulture,
    onSuccess: () => qc.invalidateQueries({ queryKey: CULTURES_KEY }),
  });
}
