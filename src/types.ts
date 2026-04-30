export type Severity = 'critical' | 'urgent' | 'mild';

export type TriageAction =
  | 'ask_more'
  | 'emergency'
  | 'hospital'
  | 'clinic'
  | 'pharmacy'
  | 'first_aid'
  | 'self_care';

export type SessionStatus = 'active' | 'deferred' | 'completed';

export type ChatRole = 'user' | 'assistant' | 'system';

export type ConditionRank = {
  name: string;
  confidence: number;
  rationale: string;
};

export type TriageResponse = {
  conditions: ConditionRank[];
  severity: Severity;
  confidence: number;
  next_question?: string;
  red_flags: string[];
  action: TriageAction;
  required_services: string[];
  safety_disclaimer: string;
};

export type ChatMessage = {
  id: string;
  sessionId: string;
  role: ChatRole;
  content: string;
  structuredResponse?: TriageResponse;
  createdAt: string;
};

export type ChatSession = {
  id: string;
  status: SessionStatus;
  startedAt: string;
  updatedAt: string;
  deferredUntil?: string;
  finalSeverity?: Severity;
  finalAction?: TriageAction;
  selectedFacilityId?: string;
  selectedPharmacyId?: string;
};

export type Facility = {
  id: string;
  name: string;
  type: 'hospital' | 'clinic';
  address: string;
  neighborhood: string;
  phone: string;
  latitude: number;
  longitude: number;
  capabilityTags: string[];
  etaMinutes?: number;
  distanceKm?: number;
};

export type Pharmacy = {
  id: string;
  name: string;
  neighborhood: string;
  phone: string;
  latitude: number;
  longitude: number;
};

export type PharmacyStock = {
  id: string;
  pharmacyId: string;
  drugName: string;
  brandName: string;
  quantity: number;
  unit: string;
  lastUpdated: string;
};

export type LearnArticle = {
  id: string;
  title: string;
  category: string;
  summary: string;
  body: string;
  steps: string[];
  warningSigns: string[];
  relatedAccessoryIds: string[];
};

export type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  answerIndex: number;
};

export type Accessory = {
  id: string;
  name: string;
  useCase: string;
  notes: string;
};
