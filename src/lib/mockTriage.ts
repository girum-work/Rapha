import { TriageResponse } from '../types';

const disclaimer =
  'Rapha is not a final diagnosis. If symptoms feel severe, worsening, or unsafe, seek professional emergency care now.';

export function makeMockTriage(input: string): { reply: string; structured: TriageResponse } {
  const text = input.toLowerCase();
  const isEmergency =
    text.includes('chest') ||
    text.includes('breath') ||
    text.includes('unconscious') ||
    text.includes('seizure') ||
    text.includes('bleeding');
  const isPharmacy = text.includes('prescription') || text.includes('medicine') || text.includes('drug');
  const isFirstAid = text.includes('burn') || text.includes('cut') || text.includes('first aid');

  if (isEmergency) {
    return {
      reply:
        'I need to treat this as potentially serious. I can help you choose an Addis Ababa emergency facility and prepare a simulated ambulance request after you confirm.',
      structured: {
        conditions: [
          { name: 'Potential acute emergency', confidence: 0.82, rationale: 'Symptoms include possible red flags.' },
          { name: 'Respiratory or cardiovascular distress', confidence: 0.67, rationale: 'Needs clinician assessment.' },
          { name: 'Severe injury or shock risk', confidence: 0.48, rationale: 'Urgency depends on bleeding, alertness, and pain.' },
        ],
        severity: 'critical',
        confidence: 0.82,
        red_flags: ['Chest pain, breathing difficulty, heavy bleeding, seizure, or loss of consciousness'],
        action: 'emergency',
        required_services: ['emergency', 'lab'],
        safety_disclaimer: disclaimer,
      },
    };
  }

  if (isPharmacy) {
    return {
      reply:
        'I can help read the prescription and compare nearby pharmacy stock. Upload a photo when you are ready.',
      structured: {
        conditions: [],
        severity: 'mild',
        confidence: 0.74,
        red_flags: [],
        action: 'pharmacy',
        required_services: ['pharmacy'],
        safety_disclaimer: disclaimer,
      },
    };
  }

  if (isFirstAid) {
    return {
      reply:
        'This sounds suitable for first-aid guidance while we watch for warning signs. I will show relevant steps and nearby pharmacy options if supplies are missing.',
      structured: {
        conditions: [
          { name: 'Minor wound or burn', confidence: 0.7, rationale: 'The description fits a common first-aid pathway.' },
          { name: 'Skin irritation', confidence: 0.35, rationale: 'Possible depending on redness or swelling.' },
        ],
        severity: 'mild',
        confidence: 0.7,
        red_flags: ['Large burn', 'deep wound', 'spreading redness', 'fever'],
        action: 'first_aid',
        required_services: ['pharmacy'],
        safety_disclaimer: disclaimer,
      },
    };
  }

  return {
    reply:
      'I need a little more detail before I rank likely causes. When did it start, how severe is it from 1 to 10, and do you have fever, chest pain, trouble breathing, or fainting?',
    structured: {
      conditions: [],
      severity: 'urgent',
      confidence: 0.52,
      next_question:
        'When did it start, how severe is it, and do you have fever, chest pain, trouble breathing, or fainting?',
      red_flags: ['Chest pain', 'trouble breathing', 'fainting', 'confusion'],
      action: 'ask_more',
      required_services: [],
      safety_disclaimer: disclaimer,
    },
  };
}

/** When the edge function fails — neutral copy, not clinical mock triage. */
export function triageConnectionFallback(): { reply: string; structured: TriageResponse } {
  return {
    reply: 'Dr Lucas is thinking… Tap Send again to retry.',
    structured: {
      conditions: [],
      severity: 'mild',
      confidence: 0,
      red_flags: [],
      action: 'ask_more',
      required_services: [],
      safety_disclaimer: disclaimer,
    },
  };
}
