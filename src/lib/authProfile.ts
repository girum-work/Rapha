import { supabase } from './supabase';

export async function getCurrentSession() {
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw error;
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

  const { error } = await supabase.from('profiles').upsert(
    {
      id: userId,
      allergies: profile.allergies,
      current_medications: profile.currentMedications,
      blood_type: profile.bloodType || null,
      emergency_contact_name: profile.emergencyContactName,
      emergency_contact_phone: profile.emergencyContactPhone,
      location_consent: profile.locationConsent,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );

  if (error) {
    throw error;
  }

  return true;
}
