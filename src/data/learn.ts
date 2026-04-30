import { Accessory, LearnArticle, QuizQuestion } from '../types';

export const accessories: Accessory[] = [
  {
    id: 'sterile-gauze',
    name: 'Sterile gauze pads',
    useCase: 'Covering bleeding wounds and burns',
    notes: 'Keep several sealed packs in a dry pouch.',
  },
  {
    id: 'oral-rehydration',
    name: 'Oral rehydration salts',
    useCase: 'Replacing fluids during diarrhea, vomiting, or heat illness',
    notes: 'Mix only with clean water and follow the sachet amount.',
  },
  {
    id: 'digital-thermometer',
    name: 'Digital thermometer',
    useCase: 'Checking fever trends before contacting care',
    notes: 'Clean before and after every use.',
  },
  {
    id: 'burn-dressing',
    name: 'Non-stick burn dressing',
    useCase: 'Protecting minor burns after cooling',
    notes: 'Do not apply butter, oil, or toothpaste to burns.',
  },
  {
    id: 'medical-gloves',
    name: 'Disposable medical gloves',
    useCase: 'Reducing contact with blood or body fluids',
    notes: 'Use one pair per care event and discard safely.',
  },
];

export const learnArticles: LearnArticle[] = [
  {
    id: 'bleeding',
    title: 'Bleeding',
    category: 'First aid',
    summary: 'Control bleeding with pressure and clean covering while watching for shock.',
    body: 'Bleeding needs calm pressure, clean covering, and fast escalation if it is heavy or does not slow.',
    steps: [
      'Wash or sanitize hands if possible.',
      'Put on gloves or use a clean barrier.',
      'Press firmly with gauze or clean cloth.',
      'Raise the injured area if it does not increase pain.',
      'Keep pressure until help arrives or bleeding stops.',
    ],
    warningSigns: ['Bleeding sprays or pulses', 'Person becomes faint', 'Bleeding continues after 10 minutes'],
    relatedAccessoryIds: ['sterile-gauze', 'medical-gloves'],
  },
  {
    id: 'burns',
    title: 'Burns',
    category: 'First aid',
    summary: 'Cool the burn with running water and cover it with a clean non-stick dressing.',
    body: 'Most minor burns benefit from early cooling and clean protection. Severe burns need urgent care.',
    steps: [
      'Cool the burn under clean running water for 20 minutes.',
      'Remove tight jewelry or clothing near the burn if it is not stuck.',
      'Cover with a non-stick dressing.',
      'Avoid ice, butter, oils, or toothpaste.',
    ],
    warningSigns: ['Burn affects face or genitals', "Burn is larger than the person's palm", 'Skin looks white, black, or leathery'],
    relatedAccessoryIds: ['burn-dressing', 'sterile-gauze'],
  },
  {
    id: 'fever',
    title: 'Fever',
    category: 'Home monitoring',
    summary: 'Measure temperature, hydrate, and watch for danger signs.',
    body: 'Fever is a signal, not a diagnosis. Track temperature and symptoms together.',
    steps: [
      'Measure temperature with a thermometer.',
      'Offer fluids regularly.',
      'Use light clothing and avoid over-wrapping.',
      'Contact care if fever is high, persistent, or paired with danger signs.',
    ],
    warningSigns: ['Stiff neck', 'Confusion', 'Difficulty breathing', 'Infant under 3 months with fever'],
    relatedAccessoryIds: ['digital-thermometer', 'oral-rehydration'],
  },
  {
    id: 'breathing',
    title: 'Breathing difficulty',
    category: 'Emergency signs',
    summary: 'Breathing difficulty can become serious quickly and needs fast assessment.',
    body: 'Trouble breathing should be treated as urgent, especially with chest pain, blue lips, or severe weakness.',
    steps: [
      'Help the person sit upright.',
      'Loosen tight clothing around the chest and neck.',
      'Keep the person calm and still.',
      'Seek emergency help if symptoms are severe or worsening.',
    ],
    warningSigns: ['Blue lips', 'Chest pain', 'Cannot speak full sentences', 'Severe drowsiness'],
    relatedAccessoryIds: ['digital-thermometer'],
  },
  {
    id: 'dehydration',
    title: 'Dehydration',
    category: 'Home monitoring',
    summary: 'Replace fluids early and escalate if weakness or confusion appears.',
    body: 'Dehydration may follow diarrhea, vomiting, fever, or heat. Oral rehydration can help mild cases.',
    steps: [
      'Give small frequent sips of clean water or ORS.',
      'Avoid alcohol and very sugary drinks.',
      'Monitor urination and alertness.',
      'Seek care for infants, older adults, or worsening symptoms.',
    ],
    warningSigns: ['Very little urine', 'Confusion', 'Sunken eyes', 'Unable to keep fluids down'],
    relatedAccessoryIds: ['oral-rehydration', 'digital-thermometer'],
  },
];

export const quizQuestions: QuizQuestion[] = [
  {
    id: 'q1',
    question: 'What is the first step for heavy bleeding?',
    options: ['Apply firm pressure', 'Wash with hot water', 'Leave it uncovered'],
    answerIndex: 0,
  },
  {
    id: 'q2',
    question: 'How long should a minor burn be cooled?',
    options: ['2 minutes', '20 minutes', 'Until it dries'],
    answerIndex: 1,
  },
  {
    id: 'q3',
    question: 'Which fever sign needs urgent help?',
    options: ['Mild sweating', 'Stiff neck', 'Feeling thirsty'],
    answerIndex: 1,
  },
  {
    id: 'q4',
    question: 'What is safest for mild dehydration?',
    options: ['Small frequent ORS sips', 'Alcohol', 'No fluids'],
    answerIndex: 0,
  },
  {
    id: 'q5',
    question: 'What breathing sign is dangerous?',
    options: ['Sneezing once', 'Blue lips', 'Mild tiredness'],
    answerIndex: 1,
  },
];
