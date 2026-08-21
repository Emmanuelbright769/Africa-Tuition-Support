export type BackToSchoolSpellingQuestion = {
  id: string;
  prompt: string;
  choices: string[];
  answer: number;
};

// The programme needs a large, maintainable spelling pool rather than a small
// fixed questionnaire. These are familiar, age-appropriate roots; regular
// inflections provide additional legitimate spelling practice words.
const COUNTABLE_NOUNS = `apple animal answer apron artist baby bag banana basket beach bear bee bicycle bird birthday blanket bottle bread bridge brother bucket butterfly button cake calendar camera candle capital captain carpet carrot castle cat chair cheese chicken child chimney chocolate circle city classroom clock cloud coat coconut coin collar colour computer cousin country crayon cupboard curtain cousin dance doctor dolphin door dragon drawer dress drum duck elephant engine envelope exercise eye family farmer feather fence field finger fire fish flag flower forest fork friend frog fruit garden gate girl glass glove goat gold grandmother grape grass ground group guitar hair hammer hand hat heart helicopter hen hill holiday home honey horse hospital house island jacket jam jewel journey juice key kettle kitchen kite ladder lake lamp leaf letter library lion lizard lunch machine magazine map market medal member message mirror monkey moon morning mother mountain mouse music name needle neighbour nest newspaper night notebook nurse ocean office orange owl page paint paper parent park parrot party passenger pencil person photograph picture pillow pineapple planet plant plate playground pocket potato present printer prize pumpkin pupil puppet queen question rabbit radio rainbow recipe river road robot rocket room ruler sandwich school scientist sea season seed sheep shelf shirt shoe shop sister skirt sky snake snow soap soldier spoon squirrel star station stone story street student sugar summer sun table teacher telephone television tent theatre tiger tomato toothbrush towel toy train tree trousers trumpet turtle umbrella uniform vegetable village violin visitor wall wallet water watermelon weather website window winter woman wood world writer yard zebra`;

const ACTION_WORDS = `accept act add admire agree answer arrive ask bake balance believe belong blink boil borrow bounce brush build call camp care carry change chase cheer check clean climb close collect colour compare cook copy count cover crawl cross dance decide deliver describe discover divide draw dress drink drop earn enjoy enter escape exercise explain face fetch fill finish fix follow gather give glow greet guess happen help hike hope imagine improve include invite jump keep kick knock laugh learn listen live look love manage march measure melt mix move name need notice obey open pack paint pass pick place plant play point pour practice prepare pull push race rain reach read receive remember repeat rest return ride ring roll run save scare search see send share shout show sing sit skate smile sort spell splash spread stand start stay step stop study swim talk taste teach thank think throw tidy touch travel try turn visit wait walk wash watch wave wear whisper whistle wish work worry write`;

const DESCRIBING_WORDS = `able active afraid awake bad basic beautiful big blue brave bright brilliant brown busy calm careful cheerful clean clever close cloudy cold colourful comfortable common complete confident cool correct cosy creative crooked curious dangerous dark deep different difficult dirty dry early easy empty equal excellent excited extra fair famous fancy fast favourite fine flat fluffy free fresh friendly full funny gentle giant glad good graceful great green happy hard healthy heavy helpful high honest hot huge hungry important interesting kind large late lazy light little lonely long loud lovely lucky magic many modern muddy narrow neat nervous new nice noisy normal old orange patient peaceful perfect pink plain polite popular powerful pretty proud purple quick quiet rare ready real red regular rich round rude safe salty same scared secret serious sharp shiny short shy sick silent silly simple sleepy slow small smart smooth soft special spicy square strange strong sunny sweet tall tasty thankful thirsty tidy tiny tired together tough tricky true useful warm weak wet white wide wild wise wonderful worried wrong yellow young`;

function pluralize(word: string): string {
  if (/(s|x|z|ch|sh)$/i.test(word)) return `${word}es`;
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`;
  if (/f$/i.test(word)) return `${word.slice(0, -1)}ves`;
  if (/fe$/i.test(word)) return `${word.slice(0, -2)}ves`;
  return `${word}s`;
}

function presentParticiple(word: string): string {
  if (/ie$/i.test(word)) return `${word.slice(0, -2)}ying`;
  if (/e$/i.test(word) && !/(ee|ye)$/i.test(word)) return `${word.slice(0, -1)}ing`;
  if (/(run|sit|swim|begin|stop|plan)$/i.test(word)) return `${word}${word.slice(-1)}ing`;
  return `${word}ing`;
}

function pastTense(word: string): string {
  if (/e$/i.test(word)) return `${word}d`;
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ied`;
  if (/(run|sit|swim|begin|stop|plan)$/i.test(word)) return `${word}${word.slice(-1)}ed`;
  return `${word}ed`;
}

export const BACK_TO_SCHOOL_SPELLING_WORDS = Array.from(new Set([
  ...COUNTABLE_NOUNS.split(" "),
  ...COUNTABLE_NOUNS.split(" ").map(pluralize),
  ...ACTION_WORDS.split(" "),
  ...ACTION_WORDS.split(" ").map(presentParticiple),
  ...ACTION_WORDS.split(" ").map(pastTense),
  ...DESCRIBING_WORDS.split(" "),
].map(word => word.toLowerCase()).filter(word => /^[a-z]+$/.test(word))));

if (BACK_TO_SCHOOL_SPELLING_WORDS.length <= 1000) {
  throw new Error("Back to school kiddies spelling bank must contain more than 1,000 unique spellings");
}

function wordHash(word: string): number {
  return word.split("").reduce<number>((hash, letter) => ((hash * 31) + letter.charCodeAt(0)) >>> 0, 7);
}

function distractorsFor(word: string): string[] {
  const letters = word.split("");
  const midpoint = Math.max(1, Math.floor(letters.length / 2));
  const withoutLetter = [...letters.slice(0, midpoint), ...letters.slice(midpoint + 1)].join("");
  const swapped = [...letters.slice(0, midpoint - 1), letters[midpoint], letters[midpoint - 1], ...letters.slice(midpoint + 1)].join("");
  const doubled = [...letters.slice(0, midpoint), letters[midpoint], ...letters.slice(midpoint + 1)].join("");
  const ending = word.endsWith("y") ? `${word.slice(0, -1)}ie` : `${word}e`;
  return Array.from(new Set([withoutLetter, swapped, doubled, ending].filter(item => item !== word && item.length > 1))).slice(0, 3);
}

export function spellingQuestionFor(word: string): BackToSchoolSpellingQuestion {
  const distractors = distractorsFor(word);
  while (distractors.length < 3) distractors.push(`${word.slice(0, -1)}${String.fromCharCode(97 + distractors.length)}`);
  const answer = wordHash(word) % 4;
  const choices = [...distractors];
  choices.splice(answer, 0, word);
  return {
    id: `spell-${word}`,
    prompt: "Choose the correctly spelled word.",
    choices,
    answer,
  };
}

export function selectSpellingQuestions(level: "junior" | "senior", count = 25): BackToSchoolSpellingQuestion[] {
  const eligible = BACK_TO_SCHOOL_SPELLING_WORDS.filter(word => level === "junior"
    ? word.length >= 3 && word.length <= 8
    : word.length >= 6 && word.length <= 15);
  const pool = [...eligible];
  for (let index = pool.length - 1; index > 0; index--) {
    const picked = Math.floor(Math.random() * (index + 1));
    [pool[index], pool[picked]] = [pool[picked], pool[index]];
  }
  return pool.slice(0, count).map(spellingQuestionFor);
}