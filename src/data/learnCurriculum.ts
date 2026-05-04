/**
 * Health Academy curriculum — tracks, lessons, and quizzes (Part 3).
 */

import type { QuizQuestion } from '../types';
import { accessories } from './learn';

export type Difficulty = 'Beginner' | 'Intermediate';

export type LearningTrack = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  /** Light tint for hero / pills */
  tint: string;
  lessonIds: string[];
};

export type CurriculumLesson = {
  id: string;
  trackId: string;
  title: string;
  minutes: number;
  difficulty: Difficulty;
  summary: string;
  body: string;
  keyFacts: string[];
  steps: string[];
  warningSigns: string[];
  relatedAccessoryIds: string[];
  /** Quiz question ids bundled with this lesson */
  quizQuestionIds: string[];
};

export const LEARNING_TRACKS: LearningTrack[] = [
  {
    id: 'emergency-first-aid',
    name: 'Emergency First Aid',
    emoji: '🚑',
    color: '#DC2626',
    tint: '#FEF2F2',
    lessonIds: ['bleeding', 'burns', 'breathing', 'choking', 'shock'],
  },
  {
    id: 'infectious',
    name: 'Infectious Diseases',
    emoji: '🦠',
    color: '#EA580C',
    tint: '#FFF7ED',
    lessonIds: ['malaria', 'typhoid', 'tuberculosis', 'respiratory-infections'],
  },
  {
    id: 'medications',
    name: 'Medications',
    emoji: '💊',
    color: '#00C2A8',
    tint: '#E6FAF8',
    lessonIds: ['reading-prescriptions', 'drug-interactions', 'safe-storage'],
  },
  {
    id: 'maternal-child',
    name: 'Maternal & Child Health',
    emoji: '🤱',
    color: '#EC4899',
    tint: '#FDF2F8',
    lessonIds: ['prenatal-care', 'childbirth-signs', 'infant-care', 'child-nutrition'],
  },
  {
    id: 'mental-wellbeing',
    name: 'Mental Wellbeing',
    emoji: '🧠',
    color: '#7C3AED',
    tint: '#F5F3FF',
    lessonIds: ['recognising-stress', 'sleep-health', 'when-to-seek-help'],
  },
];

const LESSONS: CurriculumLesson[] = [
  {
    id: 'bleeding',
    trackId: 'emergency-first-aid',
    title: 'Bleeding control',
    minutes: 6,
    difficulty: 'Beginner',
    summary: 'Pressure, covering, and when to escalate.',
    body:
      'Bleeding needs calm pressure, clean covering, and fast escalation if it is heavy or does not slow. Protect yourself first when helping someone else.',
    keyFacts: [
      'Continuous firm pressure is more effective than repeated peeking.',
      'Raise the limb only if it does not worsen pain.',
      'Heavy or arterial bleeding is always an emergency.',
    ],
    steps: [
      'Wash or sanitize hands if possible.',
      'Put on gloves or use a clean barrier.',
      'Press firmly with gauze or clean cloth.',
      'Raise the injured area if it does not increase pain.',
      'Keep pressure until help arrives or bleeding stops.',
    ],
    warningSigns: ['Bleeding sprays or pulses', 'Person becomes faint', 'Bleeding continues after 10 minutes'],
    relatedAccessoryIds: ['sterile-gauze', 'medical-gloves'],
    quizQuestionIds: ['bleeding-q'],
  },
  {
    id: 'burns',
    trackId: 'emergency-first-aid',
    title: 'Burns',
    minutes: 7,
    difficulty: 'Beginner',
    summary: 'Cool, cover, and avoid harmful home remedies.',
    body:
      'Cool running water reduces depth progression for minor burns. Severe burns involving face, joints, or large areas need urgent facility care.',
    keyFacts: [
      'Cool with running water for about 20 minutes for minor burns.',
      'Ice can worsen tissue injury.',
      'Non-stick dressings reduce pain when changing covers.',
    ],
    steps: [
      'Cool under clean running water for 20 minutes.',
      'Remove tight jewelry near the area if not stuck to skin.',
      'Cover with a loose sterile non-stick dressing.',
      'Avoid butter, oils, or toothpaste.',
    ],
    warningSigns: ['Burn on face or genitals', 'Large area', 'White, charred, or leathery skin'],
    relatedAccessoryIds: ['burn-dressing', 'sterile-gauze'],
    quizQuestionIds: ['burns-q'],
  },
  {
    id: 'breathing',
    trackId: 'emergency-first-aid',
    title: 'Breathing difficulty',
    minutes: 8,
    difficulty: 'Intermediate',
    summary: 'Positioning, calm, and rapid escalation.',
    body:
      'Difficulty breathing can worsen quickly. Sitting upright, loosening tight clothing, and calling for emergency care when red flags appear saves lives.',
    keyFacts: [
      'Upright posture reduces work of breathing.',
      'Blue lips or inability to speak in sentences are emergencies.',
      'Stay with the person until help arrives.',
    ],
    steps: [
      'Help the person sit upright.',
      'Loosen collars and belts.',
      'Keep them calm; avoid forcing them to lie flat.',
      'Seek emergency help if severe or worsening.',
    ],
    warningSigns: ['Blue lips', 'Chest pain', 'Cannot finish sentences', 'Severe drowsiness'],
    relatedAccessoryIds: ['digital-thermometer'],
    quizQuestionIds: ['breathing-q'],
  },
  {
    id: 'choking',
    trackId: 'emergency-first-aid',
    title: 'Choking response',
    minutes: 5,
    difficulty: 'Beginner',
    summary: 'Encourage coughing, back blows, abdominal thrusts for adults.',
    body:
      'If the person can cough effectively, encourage coughing. For severe airway obstruction in adults, alternating back blows and abdominal thrusts may help until EMS arrives.',
    keyFacts: [
      'Mild obstruction often clears with coughing.',
      'Do not perform blind finger sweeps in the mouth.',
      'Infants need different techniques — seek training.',
    ],
    steps: [
      'Ask “Are you choking?” and encourage coughing if effective.',
      'Call emergency services if breathing stops or worsens.',
      'Give up to 5 firm back blows between shoulder blades.',
      'Use abdominal thrusts for adults if trained.',
    ],
    warningSigns: ['Silent choke', 'Cyanosis', 'Loss of responsiveness'],
    relatedAccessoryIds: ['medical-gloves'],
    quizQuestionIds: ['choking-q'],
  },
  {
    id: 'shock',
    trackId: 'emergency-first-aid',
    title: 'Recognising shock',
    minutes: 6,
    difficulty: 'Intermediate',
    summary: 'Pale, clammy, fast pulse — lie down and elevate legs if safe.',
    body:
      'Shock means organs are not getting enough blood flow. After trauma or severe allergy, lay the person flat, elevate legs if no spinal injury, and seek urgent care.',
    keyFacts: [
      'Do not give food or drink.',
      'Cover with a blanket to reduce heat loss.',
      'Shock after bleeding requires treating bleeding first.',
    ],
    steps: [
      'Ensure airway is open.',
      'Lay flat unless breathing is easier sitting.',
      'Elevate legs ~30 cm if no spinal injury suspected.',
      'Call emergency services.',
    ],
    warningSigns: ['Confusion', 'Weak rapid pulse', 'Cold clammy skin'],
    relatedAccessoryIds: ['sterile-gauze'],
    quizQuestionIds: ['shock-q'],
  },
  {
    id: 'malaria',
    trackId: 'infectious',
    title: 'Malaria awareness',
    minutes: 10,
    difficulty: 'Intermediate',
    summary: 'Fever patterns, nets, and testing in endemic areas.',
    body:
      'In Ethiopia, malaria risk varies by altitude and season. Bed nets, repellents, and prompt testing when fever appears reduce severe outcomes.',
    keyFacts: [
      'Not every fever is malaria — testing matters.',
      'Young children and pregnant women are higher risk.',
      'Completed treatment reduces resistance spread.',
    ],
    steps: [
      'Use insecticide-treated nets while sleeping.',
      'Seek testing if fever after travel to endemic areas.',
      'Follow clinician-directed medication exactly.',
      'Return if fever returns within weeks.',
    ],
    warningSigns: ['Altered consciousness', 'Cannot drink', 'Difficulty breathing', 'Severe anemia signs'],
    relatedAccessoryIds: ['digital-thermometer'],
    quizQuestionIds: ['malaria-q'],
  },
  {
    id: 'typhoid',
    trackId: 'infectious',
    title: 'Typhoid prevention',
    minutes: 9,
    difficulty: 'Beginner',
    summary: 'Water, food hygiene, and vaccination context.',
    body:
      'Typhoid spreads through contaminated water and food. Hand washing and safe water reduce transmission alongside vaccination where available.',
    keyFacts: [
      'Boil or treat drinking water when unsure.',
      'Avoid raw unwashed produce where sanitation is uncertain.',
      'Chronic carriers need clinical follow-up.',
    ],
    steps: [
      'Wash hands before eating and after toilet.',
      'Eat thoroughly cooked hot foods.',
      'Seek care for prolonged fever and abdominal pain.',
    ],
    warningSigns: ['Severe abdominal pain', 'Bleeding', 'Confusion'],
    relatedAccessoryIds: [],
    quizQuestionIds: ['typhoid-q'],
  },
  {
    id: 'tuberculosis',
    trackId: 'infectious',
    title: 'Tuberculosis basics',
    minutes: 11,
    difficulty: 'Intermediate',
    summary: 'Cough duration, airborne precautions, adherence.',
    body:
      'TB spreads through airborne droplets. A cough lasting more than two weeks should be evaluated. Completing long treatment courses prevents resistance.',
    keyFacts: [
      'Negative tests do not always rule TB early.',
      'Cover coughs and ventilate living spaces.',
      'Stopping antibiotics early drives resistance.',
    ],
    steps: [
      'Seek evaluation if cough >2 weeks, night sweats, or weight loss.',
      'Wear a mask in crowded settings when symptomatic.',
      'Never share TB medication.',
    ],
    warningSigns: ['Coughing blood', 'Severe weight loss', 'High fever'],
    relatedAccessoryIds: [],
    quizQuestionIds: ['tb-q'],
  },
  {
    id: 'respiratory-infections',
    trackId: 'infectious',
    title: 'Respiratory infections',
    minutes: 8,
    difficulty: 'Beginner',
    summary: 'Hydration, rest, isolation — when to escalate.',
    body:
      'Most respiratory infections are viral and self-limited. Hydration, rest, and monitoring oxygen needs matter; bacterial complications need clinicians.',
    keyFacts: [
      'Antibiotics do not treat typical colds.',
      'High fever in infants needs timely assessment.',
      'Good ventilation reduces household spread.',
    ],
    steps: [
      'Hydrate with warm fluids.',
      'Rest and isolate when possible.',
      'Monitor breathing rate and effort.',
    ],
    warningSigns: ['Struggling to breathe', 'Blue lips', 'Severe dehydration'],
    relatedAccessoryIds: ['digital-thermometer'],
    quizQuestionIds: ['resp-q'],
  },
  {
    id: 'reading-prescriptions',
    trackId: 'medications',
    title: 'Reading prescriptions',
    minutes: 7,
    difficulty: 'Beginner',
    summary: 'Dose, frequency, duration, and brand vs generic.',
    body:
      'Verify medicine name spelling, strength (mg/ml), how often, with food or empty stomach, and total duration before leaving the pharmacy.',
    keyFacts: [
      'Ask the pharmacist to read labels aloud if unsure.',
      'Photo prescriptions help avoid transcription errors.',
      'Never share antibiotics.',
    ],
    steps: [
      'Confirm patient name on packaging.',
      'Match strength with prescriber intent.',
      'Set phone reminders for intervals.',
    ],
    warningSigns: ['Unexpected severe rash after new drug', 'Swelling of lips', 'Difficulty breathing'],
    relatedAccessoryIds: [],
    quizQuestionIds: ['rx-q'],
  },
  {
    id: 'drug-interactions',
    trackId: 'medications',
    title: 'Drug interactions',
    minutes: 9,
    difficulty: 'Intermediate',
    summary: 'OTC overlap, grapefruit myths, and pharmacist checks.',
    body:
      'Bring all medicines including herbal products to visits. Some combinations raise bleeding risk or liver load.',
    keyFacts: [
      'Pain relievers stack across cold medicines.',
      'Some antibiotics reduce contraceptive reliability.',
      'Alcohol amplifies sedation with many drugs.',
    ],
    steps: [
      'Maintain an updated medication list.',
      'Ask before adding OTC products.',
      'Report allergies every visit.',
    ],
    warningSigns: ['Sudden bruising', 'Dark urine', 'Severe abdominal pain after new drugs'],
    relatedAccessoryIds: [],
    quizQuestionIds: ['interaction-q'],
  },
  {
    id: 'safe-storage',
    trackId: 'medications',
    title: 'Safe storage',
    minutes: 5,
    difficulty: 'Beginner',
    summary: 'Heat, light, children, and expiry.',
    body:
      'Store medicines away from bathrooms when humidity is high. Lock medicines away from children.',
    keyFacts: [
      'Expiry dates matter most for liquids and antibiotics.',
      'Original packaging protects from light.',
      'Dispose safely via pharmacy programs where available.',
    ],
    steps: [
      'Cool dry place unless label says refrigerate.',
      'Keep desiccants where provided.',
      'Never repurpose antibiotic leftovers.',
    ],
    warningSigns: ['Discoloration', 'Odd smell', 'Separated liquids'],
    relatedAccessoryIds: [],
    quizQuestionIds: ['storage-q'],
  },
  {
    id: 'prenatal-care',
    trackId: 'maternal-child',
    title: 'Prenatal care visits',
    minutes: 10,
    difficulty: 'Beginner',
    summary: 'ANC schedule, nutrition, danger signs.',
    body:
      'Regular antenatal visits screen blood pressure, growth, and infections. Iron-folate supplementation is commonly recommended.',
    keyFacts: [
      'High BP or swelling needs urgent review.',
      'Balanced diet supports fetal growth.',
      'Sleep on side as pregnancy advances.',
    ],
    steps: [
      'Attend scheduled ANC visits.',
      'Report headache with vision changes urgently.',
      'Take supplements as directed.',
    ],
    warningSigns: ['Vaginal bleeding', 'Severe abdominal pain', 'Reduced fetal movement'],
    relatedAccessoryIds: [],
    quizQuestionIds: ['prenatal-q'],
  },
  {
    id: 'childbirth-signs',
    trackId: 'maternal-child',
    title: 'Labour warning signs',
    minutes: 8,
    difficulty: 'Intermediate',
    summary: 'When to move toward facility delivery.',
    body:
      'Regular contractions, broken waters, or heavy bleeding before term require facility assessment.',
    keyFacts: [
      'First labour patterns vary widely.',
      'Preterm contractions need urgent evaluation.',
      'Transport plans matter at night.',
    ],
    steps: [
      'Time contraction intervals.',
      'Call facility if bleeding soaks pads.',
      'Avoid eating heavily if surgery may be needed.',
    ],
    warningSigns: ['Continuous pain without breaks', 'Heavy bleeding', 'No fetal movement'],
    relatedAccessoryIds: [],
    quizQuestionIds: ['labour-q'],
  },
  {
    id: 'infant-care',
    trackId: 'maternal-child',
    title: 'Newborn essentials',
    minutes: 9,
    difficulty: 'Beginner',
    summary: 'Breathing, warmth, feeding cues.',
    body:
      'Early breastfeeding support and warmth reduce complications. Know danger signs for neonatal infection.',
    keyFacts: [
      'Exclusive breastfeeding early unless medically contraindicated.',
      'Cord care per local guidelines.',
      'Sleep supine on firm surface.',
    ],
    steps: [
      'Skin-to-skin when stable.',
      'Feed on cue.',
      'Track wet diapers.',
    ],
    warningSigns: ['Fast breathing', 'Lethargy', 'Fever in newborn'],
    relatedAccessoryIds: ['digital-thermometer'],
    quizQuestionIds: ['infant-q'],
  },
  {
    id: 'child-nutrition',
    trackId: 'maternal-child',
    title: 'Child nutrition',
    minutes: 8,
    difficulty: 'Beginner',
    summary: 'Timely complementary feeding and growth.',
    body:
      'Age-appropriate complementary feeding after 6 months with continued breastfeeding supports growth charts.',
    keyFacts: [
      'Variety beats quantity early.',
      'Iron-rich foods matter after 6 months.',
      'Sugar-sweetened beverages displace nutrients.',
    ],
    steps: [
      'Introduce single-ingredient foods.',
      'Offer safe textures.',
      'Monitor growth at clinics.',
    ],
    warningSigns: ['Not gaining weight', 'Chronic diarrhea', 'Edema'],
    relatedAccessoryIds: [],
    quizQuestionIds: ['nutrition-q'],
  },
  {
    id: 'recognising-stress',
    trackId: 'mental-wellbeing',
    title: 'Recognising stress',
    minutes: 7,
    difficulty: 'Beginner',
    summary: 'Body signals, workload, and coping.',
    body:
      'Stress shows as sleep change, irritability, headaches, or gut upset. Naming triggers is the first step.',
    keyFacts: [
      'Short walks reset autonomic tone.',
      'Breathing exercises help before sleep.',
      'Social connection buffers stress.',
    ],
    steps: [
      'Note triggers for one week.',
      'Schedule breaks.',
      'Reduce caffeine if jittery.',
    ],
    warningSigns: ['Thoughts of self-harm', 'Panic lasting hours', 'Unable to work or care for self'],
    relatedAccessoryIds: [],
    quizQuestionIds: ['stress-q'],
  },
  {
    id: 'sleep-health',
    trackId: 'mental-wellbeing',
    title: 'Sleep health',
    minutes: 7,
    difficulty: 'Beginner',
    summary: 'Consistency beats duration alone.',
    body:
      'Regular sleep and wake times anchor circadian rhythm. Screens before bed delay melatonin.',
    keyFacts: [
      'Cool dark rooms improve depth.',
      'Heavy meals late disturb sleep.',
      'Short afternoon naps may help some adults.',
    ],
    steps: [
      'Fixed wake time.',
      'Wind-down routine 30 minutes.',
      'Limit alcohol near bedtime.',
    ],
    warningSigns: ['Witnessed apnea', 'Falling asleep unintentionally while driving'],
    relatedAccessoryIds: [],
    quizQuestionIds: ['sleep-q'],
  },
  {
    id: 'when-to-seek-help',
    trackId: 'mental-wellbeing',
    title: 'When to seek help',
    minutes: 8,
    difficulty: 'Intermediate',
    summary: 'Professional thresholds.',
    body:
      'Persistent low mood, trauma flashbacks, or substance escalation deserve structured care — therapy or medical evaluation.',
    keyFacts: [
      'Early treatment reduces episode length.',
      'Family involvement helps adherence.',
      'Crisis lines exist in many regions.',
    ],
    steps: [
      'Book primary visit if symptoms last >2 weeks.',
      'Seek urgent care if suicidal thoughts.',
      'Keep emergency contacts visible.',
    ],
    warningSigns: ['Self-harm intent', 'Psychosis', 'Sudden personality change'],
    relatedAccessoryIds: [],
    quizQuestionIds: ['mental-help-q'],
  },
];

/** Extended quiz bank — explanations power Learn quiz UI */
export const CURRICULUM_QUIZZES: QuizQuestion[] = [
  {
    id: 'bleeding-q',
    question: 'What is the priority for heavy bleeding?',
    options: ['Firm pressure with clean cloth', 'Remove cloth every minute', 'Apply ointment'],
    answerIndex: 0,
    explanation: 'Continuous pressure slows bleeding and helps clot formation.',
  },
  {
    id: 'burns-q',
    question: 'How long should minor burns be cooled?',
    options: ['20 seconds', 'About 20 minutes', 'Do not cool'],
    answerIndex: 1,
    explanation: 'Running cool water for ~20 minutes reduces burn depth progression.',
  },
  {
    id: 'breathing-q',
    question: 'Which position helps breathing difficulty?',
    options: ['Flat on back', 'Sitting upright', 'Head lower than feet'],
    answerIndex: 1,
    explanation: 'Upright posture decreases pressure on the diaphragm.',
  },
  {
    id: 'choking-q',
    question: 'What should you try first if coughing is effective?',
    options: ['Abdominal thrusts', 'Encourage coughing', 'Finger sweep'],
    answerIndex: 1,
    explanation: 'Effective coughing can clear partial obstruction without invasive steps.',
  },
  {
    id: 'shock-q',
    question: 'What supports circulation while awaiting EMS?',
    options: ['Large meal', 'Lay flat and keep warm', 'Walk around'],
    answerIndex: 1,
    explanation: 'Flat positioning aids cerebral perfusion unless breathing needs upright posture.',
  },
  {
    id: 'malaria-q',
    question: 'Best preventive sleep measure in endemic zones?',
    options: ['Insecticide-treated net', 'Sleeping without net', 'Burning plastic indoors'],
    answerIndex: 0,
    explanation: 'ITNs dramatically reduce mosquito bites overnight.',
  },
  {
    id: 'typhoid-q',
    question: 'Typhoid spreads mainly through:',
    options: ['Skin contact only', 'Contaminated food/water', 'Air sneezing only'],
    answerIndex: 1,
    explanation: 'Fecal-oral routes dominate transmission.',
  },
  {
    id: 'tb-q',
    question: 'When should prolonged cough prompt TB evaluation?',
    options: ['After 2 days', 'More than about 2 weeks', 'Never'],
    answerIndex: 1,
    explanation: 'Chronic cough with systemic symptoms warrants testing in endemic settings.',
  },
  {
    id: 'resp-q',
    question: 'Typical colds are usually:',
    options: ['Bacterial — always need antibiotics', 'Often viral — supportive care', 'Cured by vitamins'],
    answerIndex: 1,
    explanation: 'Antibiotics do not treat most viral respiratory infections.',
  },
  {
    id: 'rx-q',
    question: 'Before leaving pharmacy you should verify:',
    options: ['Only price', 'Drug name, strength, schedule', 'Only colour of pills'],
    answerIndex: 1,
    explanation: 'Matching strength and schedule prevents dosing errors.',
  },
  {
    id: 'interaction-q',
    question: 'Why tell clinicians about OTC medicines?',
    options: ['They never interact', 'Hidden acetaminophen can overdose', 'They are always safe'],
    answerIndex: 1,
    explanation: 'Cold remedies may duplicate ingredients like acetaminophen.',
  },
  {
    id: 'storage-q',
    question: 'Poor storage often ruins:',
    options: ['Metal spoons', 'Liquid antibiotics exposed to heat', 'Glass bottles empty'],
    answerIndex: 1,
    explanation: 'Heat and humidity degrade many liquid formulations.',
  },
  {
    id: 'prenatal-q',
    question: 'Seek urgent care if pregnant with:',
    options: ['Mild nausea', 'Severe headache with vision changes', 'Baby kicking'],
    answerIndex: 1,
    explanation: 'Pre-eclampsia can present with headache and visual disturbance.',
  },
  {
    id: 'labour-q',
    question: 'Heavy vaginal bleeding in pregnancy needs:',
    options: ['Wait at home', 'Immediate facility evaluation', 'Exercise'],
    answerIndex: 1,
    explanation: 'Bleeding may indicate abruption or other emergencies.',
  },
  {
    id: 'infant-q',
    question: 'Newborn danger signs include:',
    options: ['Regular feeding', 'Fast breathing or lethargy', 'Sleeping after feed'],
    answerIndex: 1,
    explanation: 'Respiratory distress or reduced responsiveness needs urgent review.',
  },
  {
    id: 'nutrition-q',
    question: 'Complementary feeding often starts around:',
    options: ['2 weeks', '6 months with continued breastfeeding where possible', 'Never'],
    answerIndex: 1,
    explanation: 'WHO guidance supports complementary foods around 6 months.',
  },
  {
    id: 'stress-q',
    question: 'First helpful step for chronic stress:',
    options: ['Ignore triggers', 'Identify patterns and adjust load', 'Isolate completely'],
    answerIndex: 1,
    explanation: 'Awareness enables targeted coping strategies.',
  },
  {
    id: 'sleep-q',
    question: 'Screens before bed often:',
    options: ['Increase melatonin', 'Delay sleep onset', 'Guarantee deep sleep'],
    answerIndex: 1,
    explanation: 'Blue light suppresses melatonin secretion.',
  },
  {
    id: 'mental-help-q',
    question: 'Seek urgent help when:',
    options: ['Feeling sad one hour', 'Suicidal thoughts', 'Tired after exercise'],
    answerIndex: 1,
    explanation: 'Suicidal ideation requires immediate professional intervention.',
  },
];

/** Daily challenge — first 5 curriculum questions */
export const DAILY_CHALLENGE_IDS = ['bleeding-q', 'burns-q', 'breathing-q', 'malaria-q', 'rx-q'];

export const lessonsById: Record<string, CurriculumLesson> = Object.fromEntries(
  LESSONS.map((l) => [l.id, l]),
);

export function getLesson(lessonId: string): CurriculumLesson | undefined {
  return lessonsById[lessonId];
}

export function accessoryById(id: string) {
  return accessories.find((a) => a.id === id);
}

export function totalLessonCount(): number {
  return LEARNING_TRACKS.reduce((n, t) => n + t.lessonIds.length, 0);
}
