import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface UserProfile {
  id: string;
  name?: string;
  age?: number;
  blood_type?: string;
  allergies?: string[];
  medications?: string[];
  conditions?: string[];
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  location_consent?: boolean;
  fall_detection_enabled?: boolean;
  is_admin?: boolean;
}

interface ChatSession {
  id: string;
  status: 'active' | 'deferred' | 'completed';
  final_action?: string;
  final_severity?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  structured_response?: Record<string, unknown>;
  created_at: string;
}

interface DrLucasState {
  status: 'idle' | 'thinking' | 'responding' | 'error';
}

interface AppStore {
  user: { id: string; email: string } | null;
  setUser: (user: AppStore['user']) => void;

  profile: UserProfile | null;
  setProfile: (profile: UserProfile) => void;
  updateProfile: (partial: Partial<UserProfile>) => void;

  activeSession: ChatSession | null;
  setActiveSession: (session: ChatSession | null) => void;
  messages: ChatMessage[];
  addMessage: (message: ChatMessage) => void;
  setMessages: (messages: ChatMessage[]) => void;
  clearMessages: () => void;

  drLucas: DrLucasState;
  setDrLucasStatus: (status: DrLucasState['status']) => void;

  actionCard: Record<string, unknown> | null;
  setActionCard: (card: Record<string, unknown> | null) => void;

  appMode: 'patient' | 'ambulance';
  setAppMode: (mode: AppStore['appMode']) => void;

  ambulanceDevice: {
    deviceId: string;
    pairingCode: string;
    deviceName: string;
    isOnline: boolean;
  } | null;
  setAmbulanceDevice: (device: AppStore['ambulanceDevice']) => void;
}

export const useAppStore = create<AppStore>()(
  subscribeWithSelector((set) => ({
    user: null,
    setUser: (user) => set({ user }),

    profile: null,
    setProfile: (profile) => set({ profile }),
    updateProfile: (partial) =>
      set((state) => ({
        profile: state.profile ? { ...state.profile, ...partial } : null,
      })),

    activeSession: null,
    setActiveSession: (activeSession) => set({ activeSession }),
    messages: [],
    addMessage: (message) =>
      set((state) => ({
        messages: [...state.messages, message],
      })),
    setMessages: (messages) => set({ messages }),
    clearMessages: () => set({ messages: [] }),

    drLucas: { status: 'idle' },
    setDrLucasStatus: (status) => set({ drLucas: { status } }),

    actionCard: null,
    setActionCard: (actionCard) => set({ actionCard }),

    appMode: 'patient',
    setAppMode: (appMode) => set({ appMode }),

    ambulanceDevice: null,
    setAmbulanceDevice: (ambulanceDevice) => set({ ambulanceDevice }),
  })),
);

export const useUser = () => useAppStore((s) => s.user);
export const useProfile = () => useAppStore((s) => s.profile);
export const useMessages = () => useAppStore((s) => s.messages);
export const useDrLucasStatus = () => useAppStore((s) => s.drLucas.status);
export const useActionCard = () => useAppStore((s) => s.actionCard);
export const useAppMode = () => useAppStore((s) => s.appMode);

