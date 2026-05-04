import { supabase } from './supabase';

/** Root layout listens so `hasProfile` updates immediately after onboarding upsert (avoids route bounce). */
const profileRowListeners = new Set<() => void>();

export function subscribeProfileRowUpdated(listener: () => void) {
  profileRowListeners.add(listener);
  return () => {
    profileRowListeners.delete(listener);
  };
}

function emitProfileRowUpdated() {
  for (const listener of profileRowListeners) {
    try {
      listener();
    } catch {
      // ignore listener errors
    }
  }
}

/** Normalize Supabase / PostgREST / network failures for UI alerts. */
export function formatAuthProfileError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.length > 0) return error;
  if (typeof error === 'object' && error !== null) {
    const o = error as Record<string, unknown>;
    const parts = [o.message, o.code, o.details, o.hint].filter((x) => typeof x === 'string' && String(x).length > 0) as string[];
    if (parts.length) return parts.join(' — ');
  }
  return 'Unknown error';
}

export async function getCurrentSession() {
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(formatAuthProfileError(error));
  }

  return data.session;
}

export async function saveOnboardingProfile(userId: string, profile: {
  name: string;
  age: number | null;
  bloodType: string;
  allergies: string[];
  currentMedications: string[];
  chronicConditions: string[];
  emergencyContactName: string;
  emergencyContactPhone: string;
  locationConsent: boolean;
}) {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  // Validates JWT with Supabase Auth so PostgREST RLS sees a fresh user for the upsert.
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    throw new Error(`Auth: ${formatAuthProfileError(userError)}`);
  }
  if (userData.user?.id !== userId) {
    throw new Error('Signed-in user does not match profile save. Please sign in again.');
  }

  const { error } = await supabase.from('profiles').upsert(
    {
      id: userId,
      display_name: profile.name.trim() || null,
      age: profile.age,
      chronic_conditions: profile.chronicConditions,
      allergies: profile.allergies,
      current_medications: profile.currentMedications,
      blood_type: profile.bloodType?.trim() || null,
      emergency_contact_name: profile.emergencyContactName,
      emergency_contact_phone: profile.emergencyContactPhone,
      location_consent: profile.locationConsent,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );

  if (error) {
    throw new Error(formatAuthProfileError(error));
  }

  emitProfileRowUpdated();
  return true;
}
