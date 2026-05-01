/**
 * Procedural leader names + personality flavor for every country. Generated
 * deterministically from the country id so the same world picks the same
 * leaders every campaign — that consistency makes them feel real.
 *
 * Names are loosely region-coded (a Russian country gets Slavic-sounding
 * names, an Arab country gets Arabic-sounding names) using the centroid
 * coordinates as a region cue.
 */

import type { Country } from './world';

export type LeaderTitle =
  | 'King'
  | 'Queen'
  | 'Emperor'
  | 'Empress'
  | 'Czar'
  | 'Sultan'
  | 'Shah'
  | 'Emir'
  | 'Maharaja'
  | 'President'
  | 'Premier'
  | 'Chancellor'
  | 'Marshal'
  | 'General'
  | 'Chairman'
  | 'Khan'
  | 'Caudillo'
  | 'Prime Minister';

export type Trait =
  | 'proud'
  | 'paranoid'
  | 'pragmatic'
  | 'devout'
  | 'ambitious'
  | 'cautious'
  | 'ruthless'
  | 'idealistic'
  | 'shrewd'
  | 'reckless'
  | 'honourable'
  | 'cynical'
  | 'beloved'
  | 'feared'
  | 'reformist'
  | 'reactionary';

export type Leader = {
  /** Title prefix, e.g. "Czar". */
  title: LeaderTitle;
  /** Display name, e.g. "Mikhail II". */
  name: string;
  /** 1-2 personality traits — used in flavor text and AI nudges. */
  traits: Trait[];
};

type Region =
  | 'westernEurope'
  | 'easternEurope'
  | 'northernEurope'
  | 'mediterranean'
  | 'middleEast'
  | 'southAsia'
  | 'eastAsia'
  | 'southeastAsia'
  | 'subSaharanAfrica'
  | 'northAfrica'
  | 'northAmerica'
  | 'latinAmerica'
  | 'oceania';

const NAME_POOLS: Record<
  Region,
  { firsts: string[]; numerals: boolean; titles: LeaderTitle[] }
> = {
  westernEurope: {
    firsts: [
      'Henri', 'Édouard', 'Léon', 'Maximilian', 'Friedrich', 'Wilhelm',
      'Albert', 'Charles', 'Édgar', 'Pierre', 'Otto', 'Karl',
      'Frédéric', 'Hubert', 'Auguste', 'Léopold', 'Bernhard', 'Konrad',
      'Étienne', 'Émile', 'Paul', 'Heinrich', 'Marcel', 'Lothar',
    ],
    numerals: true,
    titles: ['King', 'Emperor', 'Chancellor', 'President', 'Prime Minister'],
  },
  easternEurope: {
    firsts: [
      'Mikhail', 'Aleksei', 'Nikolai', 'Boris', 'Vasili', 'Stefan',
      'Dimitri', 'Lazar', 'Józef', 'Tomáš', 'Imre',
      'Pyotr', 'Ivan', 'Vladislav', 'Aleksandr', 'Bogdan', 'Radomir',
      'Kazimierz', 'Miloš', 'Sándor', 'Yaroslav', 'Andrei',
    ],
    numerals: true,
    titles: ['Czar', 'King', 'Premier', 'Chairman', 'Marshal'],
  },
  northernEurope: {
    firsts: [
      'Olaf', 'Gustav', 'Sigurd', 'Erik', 'Magnus', 'Knud', 'Harald',
      'Birger', 'Carl', 'Haakon', 'Frederik', 'Vilhelm', 'Christian',
      'Sten', 'Aleksander', 'Bjørn',
    ],
    numerals: true,
    titles: ['King', 'Prime Minister', 'Chancellor'],
  },
  mediterranean: {
    firsts: [
      'Vittorio', 'Umberto', 'Alfonso', 'João', 'Francisco', 'Manuel',
      'Constantine', 'Georgios', 'Pedro', 'Lorenzo', 'Eleftherios',
      'Salvador', 'Filipe', 'Niccolò', 'Andreas', 'Cosimo', 'Diogo',
      'Esteban', 'Ioannis', 'Carlo',
    ],
    numerals: true,
    titles: ['King', 'Emperor', 'Caudillo', 'President', 'Prime Minister'],
  },
  middleEast: {
    firsts: [
      'Mehmed', 'Abdulhamid', 'Ahmad', 'Faisal', 'Reza', 'Ibn Saud',
      'Hussein', 'Suleiman', 'Mahmud', 'Selim', 'Murad', 'Bayezid',
      'Ismail', 'Khaled', 'Tariq', 'Nasir', 'Yusuf', 'Karim',
    ],
    numerals: true,
    titles: ['Sultan', 'Shah', 'King', 'Emir'],
  },
  southAsia: {
    firsts: [
      'Vikram', 'Ashoka', 'Rajendra', 'Jagdish', 'Pratap', 'Ranjit',
      'Bahadur', 'Surendra', 'Mahadev', 'Indrajit', 'Aditya', 'Bhupendra',
      'Mohan', 'Tej', 'Hari',
    ],
    numerals: true,
    titles: ['Maharaja', 'King', 'Premier'],
  },
  eastAsia: {
    firsts: [
      'Yongjian', 'Hideki', 'Mutsuhito', 'Kuanghsu', 'Liang Wei',
      'Zhao Heng', 'Akihito', 'Taishō', 'Yoshihito', 'Pu Yi', 'Sun Wen',
      'Chiang', 'Mao', 'Naruhito', 'Li Yuan', 'Zhou Mei',
    ],
    numerals: false,
    titles: ['Emperor', 'Chairman', 'Premier', 'Marshal'],
  },
  southeastAsia: {
    firsts: [
      'Suriyawong', 'Mongkut', 'Chulalongkorn', 'Bao Dai', 'Sukarno',
      'Quezon', 'Ne Win', 'Norodom', 'Sihanouk', 'Phibun', 'Ramkhamhaeng',
      'Aguinaldo', 'Diponegoro',
    ],
    numerals: false,
    titles: ['King', 'Sultan', 'President', 'General'],
  },
  subSaharanAfrica: {
    firsts: [
      'Menelik', 'Yohannes', 'Shaka', 'Lobengula', 'Tewodros', 'Mansa',
      'Asantewaa', 'Behanzin', 'Samori', 'Cetshwayo', 'Kabarega',
      'Khama', 'Mzilikazi', 'Sobhuza', 'Moshoeshoe', 'Lekhanya', 'Iyasu',
    ],
    numerals: true,
    titles: ['King', 'Emperor', 'Queen', 'Chairman', 'General'],
  },
  northAfrica: {
    firsts: [
      'Idris', 'Abdelaziz', 'Mohammed', 'Hassan', 'Farouk', 'Bourguiba',
      'Abbas', 'Fuad', 'Tewfik', 'Ahmad Bey', 'Lyautey',
    ],
    numerals: true,
    titles: ['King', 'Sultan', 'President'],
  },
  northAmerica: {
    firsts: [
      'Theodore', 'Woodrow', 'Calvin', 'Franklin', 'Harry', 'James',
      'Wilfrid', 'Mackenzie', 'Warren', 'Herbert', 'Dwight', 'Lyndon',
      'Lester', 'Pierre',
    ],
    numerals: false,
    titles: ['President', 'Prime Minister'],
  },
  latinAmerica: {
    firsts: [
      'Porfirio', 'Emiliano', 'Lázaro', 'Getúlio', 'Juan', 'Hipólito',
      'Augusto', 'Rafael', 'Eloy', 'Plutarco', 'Sebastián', 'Joaquín',
      'Anastasio', 'Tiburcio', 'Lázaro', 'Tomás', 'Alfredo', 'Gabriel',
    ],
    numerals: false,
    titles: ['President', 'Caudillo', 'General', 'Marshal'],
  },
  oceania: {
    firsts: [
      'Edmund', 'Joseph', 'Andrew', 'William', 'Robert', 'Alfred',
      'Stanley', 'Michael', 'Earle', 'Billy',
    ],
    numerals: false,
    titles: ['Prime Minister', 'Premier'],
  },
};

const ROMAN_NUMERALS = [
  'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII',
];

const TRAIT_PAIRS: Trait[][] = [
  ['proud', 'paranoid'],
  ['pragmatic', 'cautious'],
  ['ambitious', 'reckless'],
  ['ruthless', 'feared'],
  ['idealistic', 'reformist'],
  ['shrewd', 'cynical'],
  ['devout', 'reactionary'],
  ['beloved', 'idealistic'],
  ['honourable', 'cautious'],
  ['ambitious', 'shrewd'],
  ['paranoid', 'feared'],
  ['reformist', 'pragmatic'],
];

function regionFromCentroid([lon, lat]: [number, number]): Region {
  // Order matters — narrower bands first.
  if (lat >= 50 && lon >= -10 && lon <= 35) return 'northernEurope';
  if (lat >= 35 && lon >= -10 && lon <= 25) return 'westernEurope';
  if (lat >= 35 && lon > 25 && lon <= 55) return 'easternEurope';
  if (lat >= 30 && lon >= 15 && lon <= 50) return 'mediterranean';
  if (lat >= 12 && lat <= 42 && lon >= 25 && lon <= 65) return 'middleEast';
  if (lat >= 5 && lat <= 35 && lon >= 65 && lon <= 95) return 'southAsia';
  if (lat >= 18 && lon >= 95 && lon <= 145) return 'eastAsia';
  if (lat >= -12 && lat <= 25 && lon >= 95 && lon <= 145) return 'southeastAsia';
  if (lat >= 12 && lon >= -20 && lon <= 35) return 'northAfrica';
  if (lat < 12 && lon >= -20 && lon <= 50) return 'subSaharanAfrica';
  if (lat >= 25 && lon >= -170 && lon <= -50) return 'northAmerica';
  if (lat < 25 && lon >= -120 && lon <= -30) return 'latinAmerica';
  if (lat <= -10 && lon >= 110) return 'oceania';
  // Fallback
  return 'westernEurope';
}

function hash(s: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function generateLeader(country: Country): Leader {
  const region = regionFromCentroid(country.centroid);
  const pool = NAME_POOLS[region];
  const h1 = hash(country.id, 1);
  const h2 = hash(country.id, 2);
  const h3 = hash(country.id, 3);
  const h4 = hash(country.id, 4);
  const first = pool.firsts[h1 % pool.firsts.length];
  const title = pool.titles[h2 % pool.titles.length];
  const numeral = pool.numerals && h3 % 4 < 3
    ? ` ${ROMAN_NUMERALS[h3 % ROMAN_NUMERALS.length]}`
    : '';
  const name = `${first}${numeral}`;
  const traitPair = TRAIT_PAIRS[h4 % TRAIT_PAIRS.length];
  return { title, name, traits: traitPair.slice(0, 2) };
}

export function leaderLine(leader: Leader): string {
  const traits = leader.traits.join(', ');
  return `${leader.title} ${leader.name} — ${traits}`;
}
