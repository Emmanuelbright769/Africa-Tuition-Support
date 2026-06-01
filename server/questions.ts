export interface ScholarQuestion {
  id: number;
  category: "verbal" | "quant";
  text: string;
  options: string[];
  correctIndex: number;
}

export const VERBAL_QUESTIONS: ScholarQuestion[] = [
  {
    id: 1, category: "verbal",
    text: "PERSPICACIOUS most nearly means:",
    options: ["Shrewd and discerning", "Easily frightened", "Loudly opinionated", "Casually indifferent"],
    correctIndex: 0,
  },
  {
    id: 2, category: "verbal",
    text: "INIMICAL : HOSTILE :: SANGUINE : ___",
    options: ["Pessimistic", "Optimistic", "Secretive", "Temperamental"],
    correctIndex: 1,
  },
  {
    id: 3, category: "verbal",
    text: "Choose the ODD one out: CRIMSON, SCARLET, VERMILLION, COBALT",
    options: ["Crimson", "Scarlet", "Vermillion", "Cobalt"],
    correctIndex: 3,
  },
  {
    id: 4, category: "verbal",
    text: "LACONIC most nearly means the OPPOSITE of:",
    options: ["Verbose", "Quiet", "Deliberate", "Energetic"],
    correctIndex: 0,
  },
  {
    id: 5, category: "verbal",
    text: "His argument was so ___ that even the skeptics were fully convinced.",
    options: ["Specious", "Verbose", "Cogent", "Insipid"],
    correctIndex: 2,
  },
  {
    id: 6, category: "verbal",
    text: "EPHEMERAL most nearly means:",
    options: ["Eternal", "Transient", "Heavenly", "Massive"],
    correctIndex: 1,
  },
  {
    id: 7, category: "verbal",
    text: "The judge's ruling was PERSPICUOUS. This means the ruling was:",
    options: ["Foolish and impulsive", "Clearly understandable", "Highly profitable", "Widely unpopular"],
    correctIndex: 1,
  },
  {
    id: 8, category: "verbal",
    text: "All Tigers are Felines. All Felines are Carnivores. Which conclusion MUST be true?",
    options: ["All Carnivores are Tigers", "Some Tigers are not Carnivores", "All Tigers are Carnivores", "No Tiger is a Feline"],
    correctIndex: 2,
  },
  {
    id: 9, category: "verbal",
    text: "AMELIORATE most nearly means:",
    options: ["Worsen gradually", "Improve or correct", "Combine forces", "Memorise completely"],
    correctIndex: 1,
  },
  {
    id: 10, category: "verbal",
    text: "OSTENTATIOUS behaviour is best described as:",
    options: ["Quiet and thoughtful", "Showy and pretentious", "Kind and compassionate", "Systematic and efficient"],
    correctIndex: 1,
  },
  {
    id: 11, category: "verbal",
    text: "Playwright : Play :: Sculptor : ___",
    options: ["Stone", "Gallery", "Chisel", "Statue"],
    correctIndex: 3,
  },
  {
    id: 12, category: "verbal",
    text: "The senator's speech was full of PLATITUDES. This means the speech was:",
    options: ["Intellectually complex", "Full of trite, overused remarks", "Brief and decisive", "Challenging to existing policies"],
    correctIndex: 1,
  },
  {
    id: 13, category: "verbal",
    text: "VITUPERATE most nearly means:",
    options: ["To praise lavishly", "To investigate carefully", "To criticise harshly", "To ignore pointedly"],
    correctIndex: 2,
  },
  {
    id: 14, category: "verbal",
    text: "OBFUSCATE most nearly means:",
    options: ["To clarify precisely", "To render obscure or unclear", "To simplify thoroughly", "To verify independently"],
    correctIndex: 1,
  },
  {
    id: 15, category: "verbal",
    text: "LOQUACIOUS : TALKER :: PARSIMONIOUS : ___",
    options: ["Spendthrift", "Miser", "Banker", "Philanthropist"],
    correctIndex: 1,
  },
  {
    id: 16, category: "verbal",
    text: "DEBILITATE most nearly means:",
    options: ["To strengthen gradually", "To inspire deeply", "To weaken or impair", "To motivate effectively"],
    correctIndex: 2,
  },
  {
    id: 17, category: "verbal",
    text: "Which sentence is grammatically correct?",
    options: [
      "Neither he nor his friends was present.",
      "Neither he nor his friends were present.",
      "Neither he or his friends were present.",
      "Neither his friends or he was present.",
    ],
    correctIndex: 1,
  },
  {
    id: 18, category: "verbal",
    text: "CIRCUMSPECT behaviour suggests someone who is:",
    options: ["Reckless and spontaneous", "Wary and attentive to all circumstances", "Outgoing and sociable", "Stubborn and unchanging"],
    correctIndex: 1,
  },
  {
    id: 19, category: "verbal",
    text: "MAGNANIMOUS most nearly means the OPPOSITE of:",
    options: ["Generous", "Heroic", "Petty and mean-spirited", "Thoughtful"],
    correctIndex: 2,
  },
  {
    id: 20, category: "verbal",
    text: "A study concludes: 'Students who eat breakfast perform better in exams.' The STRONGEST challenge to this conclusion is:",
    options: [
      "Some students who skip breakfast also perform well.",
      "The study did not control for students' sleep patterns, study hours, and prior academic ability.",
      "Breakfast is expensive for low-income families.",
      "The study only covered one school.",
    ],
    correctIndex: 1,
  },
  {
    id: 41, category: "verbal",
    text: "EQUIVOCATE most nearly means:",
    options: ["To speak with absolute certainty", "To use ambiguous language to avoid commitment", "To argue aggressively", "To remain completely silent"],
    correctIndex: 1,
  },
  {
    id: 42, category: "verbal",
    text: "TORPID most nearly means:",
    options: ["Energetic and enthusiastic", "Sluggish and inactive", "Quick to anger", "Deeply focused"],
    correctIndex: 1,
  },
  {
    id: 43, category: "verbal",
    text: "VINDICATE most nearly means:",
    options: ["To accuse formally", "To punish severely", "To clear of blame or suspicion", "To delay indefinitely"],
    correctIndex: 2,
  },
  {
    id: 44, category: "verbal",
    text: "CARTOGRAPHER : MAPS :: NUMISMATIST : ___",
    options: ["Stamps", "Coins", "Antiques", "Paintings"],
    correctIndex: 1,
  },
  {
    id: 45, category: "verbal",
    text: "The manager's decision was IMPETUOUS, meaning it was:",
    options: ["Carefully considered", "Hasty and impulsive", "Delayed unnecessarily", "Widely applauded"],
    correctIndex: 1,
  },
  {
    id: 46, category: "verbal",
    text: "RECALCITRANT most nearly means:",
    options: ["Eagerly cooperative", "Stubbornly defiant of authority", "Deeply remorseful", "Easily distracted"],
    correctIndex: 1,
  },
  {
    id: 47, category: "verbal",
    text: "No Oaks are Shrubs. All Bonsais are Oaks. Which conclusion MUST follow?",
    options: ["Some Bonsais are Shrubs", "No Bonsais are Shrubs", "All Shrubs are Oaks", "Some Oaks are Bonsais"],
    correctIndex: 1,
  },
  {
    id: 48, category: "verbal",
    text: "PROSAIC most nearly means:",
    options: ["Highly imaginative", "Technically complex", "Ordinary and dull", "Elegantly poetic"],
    correctIndex: 2,
  },
  {
    id: 49, category: "verbal",
    text: "The scientist's data ___ her hypothesis, leaving it completely unsupported.",
    options: ["Corroborated", "Vindicated", "Refuted", "Amplified"],
    correctIndex: 2,
  },
  {
    id: 50, category: "verbal",
    text: "AUSPICIOUS most nearly means the OPPOSITE of:",
    options: ["Promising", "Ill-omened", "Successful", "Celebrated"],
    correctIndex: 1,
  },
  {
    id: 51, category: "verbal",
    text: "PHLEGMATIC most nearly means:",
    options: ["Easily excited", "Calm and unemotional", "Prone to anger", "Overly talkative"],
    correctIndex: 1,
  },
  {
    id: 52, category: "verbal",
    text: "ENERVATE most nearly means:",
    options: ["To energise completely", "To drain of strength or vitality", "To encourage boldly", "To reorganise efficiently"],
    correctIndex: 1,
  },
  {
    id: 53, category: "verbal",
    text: "All politicians are public servants. Some public servants are corrupt. Which conclusion is VALID?",
    options: [
      "All politicians are corrupt.",
      "Some politicians may be corrupt.",
      "No politicians are corrupt.",
      "All public servants are politicians.",
    ],
    correctIndex: 1,
  },
  {
    id: 54, category: "verbal",
    text: "GARRULOUS : SILENT :: MISERLY : ___",
    options: ["Wealthy", "Generous", "Frugal", "Envious"],
    correctIndex: 1,
  },
  {
    id: 55, category: "verbal",
    text: "Despite years of ACRIMONY, the two parties finally reached an agreement. ACRIMONY means:",
    options: ["Patient negotiation", "Bitter hostility", "Mutual admiration", "Formal ceremony"],
    correctIndex: 1,
  },
];

export const QUANT_QUESTIONS: ScholarQuestion[] = [
  {
    id: 21, category: "quant",
    text: "A train travels 300 km in 2.5 hours. What is its average speed?",
    options: ["100 km/h", "110 km/h", "120 km/h", "130 km/h"],
    correctIndex: 2,
  },
  {
    id: 22, category: "quant",
    text: "A shirt costs $45 after a 25% discount. What was its original price?",
    options: ["$55", "$60", "$65", "$70"],
    correctIndex: 1,
  },
  {
    id: 23, category: "quant",
    text: "Find the next term in the series: 2, 6, 18, 54, ___",
    options: ["108", "144", "162", "216"],
    correctIndex: 2,
  },
  {
    id: 24, category: "quant",
    text: "If 3x + 7 = 22, what is x?",
    options: ["3", "4", "5", "6"],
    correctIndex: 2,
  },
  {
    id: 25, category: "quant",
    text: "A rectangle has a perimeter of 46 cm. If its length is 14 cm, what is its width?",
    options: ["7 cm", "8 cm", "9 cm", "10 cm"],
    correctIndex: 2,
  },
  {
    id: 26, category: "quant",
    text: "What percentage is 45 of 180?",
    options: ["20%", "25%", "30%", "35%"],
    correctIndex: 1,
  },
  {
    id: 27, category: "quant",
    text: "A car depreciates from $20,000 to $14,000 in one year. What is the depreciation percentage?",
    options: ["25%", "28%", "30%", "32%"],
    correctIndex: 2,
  },
  {
    id: 28, category: "quant",
    text: "The ratio of boys to girls is 3:5. If there are 120 students total, how many are girls?",
    options: ["45", "60", "75", "90"],
    correctIndex: 2,
  },
  {
    id: 29, category: "quant",
    text: "What is the compound interest on $5,000 at 10% per annum for 2 years?",
    options: ["$950", "$1,000", "$1,050", "$1,100"],
    correctIndex: 2,
  },
  {
    id: 30, category: "quant",
    text: "The average of 5 numbers is 18. If one is removed, the average becomes 16. What was the removed number?",
    options: ["22", "24", "26", "28"],
    correctIndex: 2,
  },
  {
    id: 31, category: "quant",
    text: "In how many ways can 4 different people be arranged in a straight line?",
    options: ["12", "16", "24", "32"],
    correctIndex: 2,
  },
  {
    id: 32, category: "quant",
    text: "Pipe A fills a tank in 6 hours; Pipe B in 4 hours. How long do they take together?",
    options: ["2.0 hours", "2.4 hours", "2.8 hours", "3.0 hours"],
    correctIndex: 1,
  },
  {
    id: 33, category: "quant",
    text: "A merchant buys goods for $240 and sells them for $300. What is the profit percentage?",
    options: ["20%", "22.5%", "25%", "28%"],
    correctIndex: 2,
  },
  {
    id: 34, category: "quant",
    text: "What is √(144 + 25)?",
    options: ["11", "12", "13", "14"],
    correctIndex: 2,
  },
  {
    id: 35, category: "quant",
    text: "Solve: 2x² − 8 = 0. What are the values of x?",
    options: ["x = ±1", "x = ±2", "x = ±4", "x = 4 only"],
    correctIndex: 1,
  },
  {
    id: 36, category: "quant",
    text: "A worker earns $1,200/month and saves 15%. How much does she save in 8 months?",
    options: ["$1,260", "$1,320", "$1,380", "$1,440"],
    correctIndex: 3,
  },
  {
    id: 37, category: "quant",
    text: "A circular ring has outer radius 10 cm and inner radius 7 cm. What is its area? (π ≈ 3.14)",
    options: ["155.84 cm²", "158.12 cm²", "160.14 cm²", "162.40 cm²"],
    correctIndex: 2,
  },
  {
    id: 38, category: "quant",
    text: "A number when doubled and added to 36 gives 100. What is the number?",
    options: ["28", "30", "32", "34"],
    correctIndex: 2,
  },
  {
    id: 39, category: "quant",
    text: "If log₂(32) = x, what is x?",
    options: ["4", "5", "6", "8"],
    correctIndex: 1,
  },
  {
    id: 40, category: "quant",
    text: "A bag has 4 red and 6 blue balls. What is the probability of picking 2 red balls without replacement?",
    options: ["2/15", "4/25", "3/20", "1/6"],
    correctIndex: 0,
  },
  {
    id: 56, category: "quant",
    text: "A ladder 13 m long leans against a wall. If its foot is 5 m from the wall, how high does it reach?",
    options: ["10 m", "11 m", "12 m", "13 m"],
    correctIndex: 2,
  },
  {
    id: 57, category: "quant",
    text: "Simple interest on $2,400 at 5% per annum for 3 years is:",
    options: ["$240", "$300", "$360", "$420"],
    correctIndex: 2,
  },
  {
    id: 58, category: "quant",
    text: "The next number in the pattern 1, 4, 9, 16, 25, ___ is:",
    options: ["30", "36", "49", "64"],
    correctIndex: 1,
  },
  {
    id: 59, category: "quant",
    text: "If 20% of a number is 50, what is 35% of the same number?",
    options: ["75.5", "85.0", "87.5", "90.0"],
    correctIndex: 2,
  },
  {
    id: 60, category: "quant",
    text: "A triangle has sides 7 cm, 24 cm, and 25 cm. What is its area?",
    options: ["64 cm²", "80 cm²", "84 cm²", "96 cm²"],
    correctIndex: 2,
  },
  {
    id: 61, category: "quant",
    text: "Two numbers are in the ratio 4:7. Their sum is 99. Find the larger number.",
    options: ["36", "54", "63", "72"],
    correctIndex: 2,
  },
  {
    id: 62, category: "quant",
    text: "A bus covers 240 km at 60 km/h and returns at 80 km/h. What is the average speed for the whole journey?",
    options: ["68.6 km/h", "69.5 km/h", "70.0 km/h", "72.0 km/h"],
    correctIndex: 0,
  },
  {
    id: 63, category: "quant",
    text: "How many prime numbers are there between 20 and 40?",
    options: ["3", "4", "5", "6"],
    correctIndex: 1,
  },
  {
    id: 64, category: "quant",
    text: "A square has a diagonal of 10√2 cm. What is its area?",
    options: ["50 cm²", "100 cm²", "150 cm²", "200 cm²"],
    correctIndex: 1,
  },
  {
    id: 65, category: "quant",
    text: "Evaluate: 3³ + 4² − 2⁵",
    options: ["11", "13", "15", "17"],
    correctIndex: 0,
  },
];

function fisherYates<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pickQuestions(count: number, pool: ScholarQuestion[]): ScholarQuestion[] {
  return fisherYates(pool).slice(0, count);
}

export function stripAnswers(q: ScholarQuestion): Omit<ScholarQuestion, "correctIndex"> {
  const { correctIndex: _c, ...rest } = q;
  return rest;
}
