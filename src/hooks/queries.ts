import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { hasSupabaseConfig, supabase } from '../lib/supabase';
import { useUser } from '../store';

export const queryKeys = {
  profile: (userId: string) => ['profile', userId] as const,
  sessions: (userId: string) => ['sessions', userId] as const,
  messages: (sessionId: string) => ['messages', sessionId] as const,
  facilities: (lat: number, lng: number) => ['facilities', lat, lng] as const,
  pharmacyStock: () => ['pharmacy-stock'] as const,
};

export function useProfileQuery() {
  const user = useUser();

  return useQuery({
    queryKey: queryKeys.profile(user?.id ?? ''),
    queryFn: async () => {
      if (!user?.id || !hasSupabaseConfig || !supabase) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && hasSupabaseConfig && !!supabase,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateProfile() {
  const user = useUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      if (!hasSupabaseConfig || !supabase || !user?.id) throw new Error('Supabase not configured');
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user?.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile(user?.id ?? '') });
    },
  });
}

export function useSessionsQuery() {
  const user = useUser();

  return useQuery({
    queryKey: queryKeys.sessions(user?.id ?? ''),
    queryFn: async () => {
      if (!hasSupabaseConfig || !supabase || !user?.id) return [];
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*, chat_messages(content, role, created_at, structured_response)')
        .eq('user_id', user?.id)
        .order('started_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id && hasSupabaseConfig && !!supabase,
  });
}

export function usePharmacyStockQuery() {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: queryKeys.pharmacyStock(),
    queryFn: async () => {
      if (!hasSupabaseConfig || !supabase) return [];
      const { data, error } = await supabase
        .from('pharmacy_stock')
        .select('*, pharmacies(name, neighbourhood, latitude, longitude, opening_hours)')
        .gt('quantity', 0)
        .order('quantity', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60 * 1000,
    enabled: hasSupabaseConfig && !!supabase,
  });
}

export function useFacilitiesQuery(lat?: number, lng?: number, tags?: string[]) {
  return useQuery({
    queryKey: queryKeys.facilities(lat ?? 9.0248, lng ?? 38.7468),
    queryFn: async () => {
      if (!hasSupabaseConfig || !supabase) return [];
      let query = supabase.from('facilities').select('*');
      if (tags && tags.length > 0) {
        query = query.overlaps('capability_tags', tags);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: hasSupabaseConfig && !!supabase,
    staleTime: 10 * 60 * 1000,
  });
}

