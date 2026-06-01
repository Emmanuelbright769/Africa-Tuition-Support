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
