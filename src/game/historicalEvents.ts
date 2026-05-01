/**
 * Real 20th-century events keyed by year/month. They fire as cinematic
 * cards on the matching tick, giving the campaign a "history class with a
 * game" overlay. Most are pure flavor — a card appears, the player learns
 * something, the campaign continues. A few have light gameplay effects
 * (Black Tuesday hits gold worldwide; Spanish Flu hits population).
 *
 * Country targets use Natural Earth ISO_A3 codes ('USA', 'RUS', 'GBR', ...).
 * Effects only fire if the matching tile still exists; otherwise the card
 * still shows but the effect is a no-op.
 */

export type HistoricalEffectKind =
  | 'tech_bonus'
  | 'gold_bonus'
  | 'gold_penalty_world'
  | 'pop_penalty_world'
  | 'control_drop'
  | 'reputation_drop';

export type HistoricalEffect = {
  kind: HistoricalEffectKind;
  /** ISO_A3 of the country whose nation receives the effect, when applicable. */
  country?: string;
  /** Magnitude — interpreted by the kind. */
  amount: number;
};

export type HistoricalEvent = {
  id: string;
  year: number;
  month: number; // 0-indexed
  title: string;
  flavor: string;
  /** Optional gameplay effect; when absent, the card is purely cosmetic. */
  effect?: HistoricalEffect;
  /** Era-defining moments — these flash on-screen briefly. Everything else
   *  lives only in the newspaper archive. */
  major?: boolean;
};

/**
 * Hand-curated, intentionally light-touch. ~25 events spread across the
 * arc 1900-1945 so the player encounters something memorable every few
 * minutes of play time.
 */
export const HISTORICAL_EVENTS: HistoricalEvent[] = [
  {
    id: 'h-1900-paris',
    year: 1900,
    month: 3,
    title: 'Exposition Universelle opens in Paris',
    flavor:
      'Forty-eight million visitors will pass under the new Pont Alexandre III. Electric lights, moving walkways, the Eiffel Tower painted gold — the Belle Époque on display.',
  },
  {
    id: 'h-1901-victoria',
    year: 1901,
    month: 0,
    title: 'Queen Victoria dies at Osborne House',
    flavor:
      'Sixty-three years on the throne. Half her subjects have known no other monarch. The Victorian age ends in the first month of the new century.',
  },
  {
    id: 'h-1902-mckinley',
    year: 1902,
    month: 8,
    title: 'Theodore Roosevelt assumes the presidency',
    flavor:
      'McKinley dies of his wounds in Buffalo; Roosevelt is sworn in at forty-two — the youngest American president yet. Big stick. Big plans.',
  },
  {
    id: 'h-1903-wright',
    year: 1903,
    month: 11,
    title: 'Wright brothers fly at Kitty Hawk',
    flavor:
      'Twelve seconds of powered flight over a windswept dune in North Carolina. The age of the air has begun.',
    effect: { kind: 'tech_bonus', country: 'USA', amount: 0.1 },
  },
  {
    id: 'h-1904-russojapanese',
    year: 1904,
    month: 1,
    title: 'Russo-Japanese War begins',
    flavor:
      'Imperial Russia and the rising Empire of Japan clash over Korea and Manchuria. The first modern war between an Asian power and a European one.',
  },
  {
    id: 'h-1905-bloodysunday',
    year: 1905,
    month: 0,
    title: 'Bloody Sunday in St. Petersburg',
    flavor:
      'Imperial troops fire on a peaceful petition march. Confidence in the Czar collapses; revolutionary fever rises across the empire.',
    effect: { kind: 'control_drop', country: 'RUS', amount: 30 },
  },
  {
    id: 'h-1906-sanfran',
    year: 1906,
    month: 3,
    title: 'San Francisco earthquake and fire',
    flavor:
      'The Hayward Fault tears at five-twelve in the morning. Three days of fire reduce the city to ash. Three thousand dead.',
  },
  {
    id: 'h-1907-hague',
    year: 1907,
    month: 5,
    title: 'Second Hague Convention concludes',
    flavor:
      'Forty-four nations debate the laws of war. The conventions are ratified. They will be tested within seven years.',
  },
  {
    id: 'h-1908-tunguska',
    year: 1908,
    month: 5,
    title: 'A fireball over Tunguska',
    flavor:
      'Something — a comet, a meteor, no one is sure — flattens 2,000 square kilometres of Siberian forest. The shockwave is felt across continents.',
  },
  {
    id: 'h-1909-peary',
    year: 1909,
    month: 3,
    title: 'Peary claims the North Pole',
    flavor:
      'After twenty-three years of attempts, the American admiral plants the flag on the Arctic ice — or close enough that history accepts it.',
  },
  {
    id: 'h-1910-mexicanrev',
    year: 1910,
    month: 10,
    title: 'Mexican Revolution begins',
    flavor:
      'Madero issues the Plan de San Luis. Pancho Villa and Zapata take the field. Díaz will fall within months; the fighting will last a decade.',
    effect: { kind: 'control_drop', country: 'MEX', amount: 30 },
  },
  {
    id: 'h-1911-amundsen',
    year: 1911,
    month: 11,
    title: 'Amundsen reaches the South Pole',
    flavor:
      'Five Norwegians on skis arrive at 90° south on the fourteenth of December. Scott will reach the same spot a month later — and not return.',
  },
  {
    id: 'h-1912-titanic',
    year: 1912,
    month: 3,
    title: 'RMS Titanic sinks in the North Atlantic',
    flavor:
      'The unsinkable ship strikes an iceberg on her maiden voyage. Over fifteen hundred souls are lost. The age of unbounded confidence ends.',
  },
  {
    id: 'h-1914-sarajevo',
    year: 1914,
    month: 5,
    title: 'Archduke Franz Ferdinand assassinated in Sarajevo',
    flavor:
      'A Serbian student fires two shots in a Sarajevo street. The Austro-Hungarian heir falls. The chain of alliances begins to tighten.',
    major: true,
  },
  {
    id: 'h-1914-greatwar',
    year: 1914,
    month: 7,
    title: 'The Great War begins',
    flavor:
      'Within five weeks of the assassination, Europe sleepwalks into the largest war it has ever known. Generations are conscripted; a continent puts on uniform.',
    major: true,
  },
  {
    id: 'h-1915-lusitania',
    year: 1915,
    month: 4,
    title: 'RMS Lusitania torpedoed off Ireland',
    flavor:
      'A single torpedo from U-20. Eleven hundred dead, including 128 Americans. Public opinion in the United States begins to harden.',
  },
  {
    id: 'h-1916-verdun',
    year: 1916,
    month: 1,
    title: 'The mill of Verdun',
    flavor:
      'Three hundred thousand men will die over a few square kilometres of French earth. They bleed France white — and Germany also.',
  },
  {
    id: 'h-1916-somme',
    year: 1916,
    month: 6,
    title: 'The first day on the Somme',
    flavor:
      'Twenty thousand British dead before lunch. The bloodiest single day in the British Army’s history. The advance gains a hundred yards.',
  },
  {
    id: 'h-1917-russianrev',
    year: 1917,
    month: 9,
    title: 'October Revolution in Petrograd',
    flavor:
      'The Bolsheviks seize the Winter Palace. The Russian Empire ends. A new word — Soviet — enters the vocabulary of the world.',
    effect: { kind: 'control_drop', country: 'RUS', amount: 40 },
  },
  {
    id: 'h-1918-armistice',
    year: 1918,
    month: 10,
    title: 'Armistice — eleventh hour, eleventh day, eleventh month',
    flavor:
      'The guns fall silent in a railway carriage in the forest of Compiègne. Twenty million are dead. The peace will not hold.',
    major: true,
  },
  {
    id: 'h-1918-flu',
    year: 1918,
    month: 8,
    title: 'Spanish Flu sweeps the world',
    flavor:
      'A new strain of influenza — unusually deadly, unusually fast — circles the globe along the troop-ships. Fifty million will die before it burns out.',
    effect: { kind: 'pop_penalty_world', amount: 0.04 },
  },
  {
    id: 'h-1919-versailles',
    year: 1919,
    month: 5,
    title: 'Treaty of Versailles signed',
    flavor:
      'In the Hall of Mirrors, where Germany was unified in 1871, Germany is broken in 1919. Reparations, lost colonies, blame. The seeds of the next war.',
  },
  {
    id: 'h-1920-leagueofnations',
    year: 1920,
    month: 0,
    title: 'League of Nations holds its first session',
    flavor:
      'Forty-two nations meet in Geneva. The United States, whose president imagined the body, refuses to join. The auguries are mixed.',
  },
  {
    id: 'h-1922-soviet',
    year: 1922,
    month: 11,
    title: 'Union of Soviet Socialist Republics declared',
    flavor:
      'Four republics formally bind themselves into a single state. The hammer and sickle is raised over the Kremlin.',
  },
  {
    id: 'h-1922-mussolini',
    year: 1922,
    month: 9,
    title: 'Mussolini marches on Rome',
    flavor:
      'Twenty-six thousand blackshirts converge on the capital. The king does not call out the army. Italy has its first fascist government.',
  },
  {
    id: 'h-1923-kanto',
    year: 1923,
    month: 8,
    title: 'Great Kantō earthquake levels Tokyo and Yokohama',
    flavor:
      'A magnitude 7.9 quake at noon. Charcoal stoves topple, fires sweep wooden cities. Over a hundred thousand dead.',
    effect: { kind: 'gold_penalty_world', amount: 0.05 },
  },
  {
    id: 'h-1929-blacktuesday',
    year: 1929,
    month: 9,
    title: 'Black Tuesday — Wall Street crashes',
    flavor:
      'Sixteen million shares change hands in a single panic. The American boom ends. A long winter begins for every economy bound to it.',
    effect: { kind: 'gold_penalty_world', amount: 0.18 },
    major: true,
  },
  {
    id: 'h-1927-lindbergh',
    year: 1927,
    month: 4,
    title: 'Lindbergh crosses the Atlantic alone',
    flavor:
      'Thirty-three and a half hours from Long Island to Le Bourget in the Spirit of St. Louis. A quarter million people meet him in Paris.',
  },
  {
    id: 'h-1932-empirestate',
    year: 1931,
    month: 4,
    title: 'Empire State Building opens',
    flavor:
      'A skyscraper in twenty months — through a deepening Depression. New York reaches twelve hundred and fifty feet into the sky.',
  },
  {
    id: 'h-1933-hitler',
    year: 1933,
    month: 0,
    title: 'Hitler appointed Chancellor of Germany',
    flavor:
      'The Reichstag burns. Emergency decrees follow. The Weimar Republic, never quite alive, formally dies.',
  },
  {
    id: 'h-1933-newdeal',
    year: 1933,
    month: 2,
    title: 'Roosevelt opens the New Deal',
    flavor:
      '"The only thing we have to fear is fear itself." A bank holiday is declared. The first hundred days reshape the American state.',
    effect: { kind: 'gold_bonus', country: 'USA', amount: 200 },
  },
  {
    id: 'h-1935-italy',
    year: 1935,
    month: 9,
    title: 'Italy invades Ethiopia',
    flavor:
      'Mussolini’s legions cross from Eritrea. Mustard gas, modern aircraft against tribal levies. The League of Nations protests. Nothing more.',
  },
  {
    id: 'h-1936-spanishcw',
    year: 1936,
    month: 6,
    title: 'Spanish Civil War begins',
    flavor:
      'Generals rise against the young Spanish Republic. A laboratory war, where the next decade is rehearsed in miniature.',
    effect: { kind: 'control_drop', country: 'ESP', amount: 35 },
  },
  {
    id: 'h-1937-amelia',
    year: 1937,
    month: 6,
    title: 'Amelia Earhart vanishes over the Pacific',
    flavor:
      'Halfway through her circumnavigation, her radio falls silent above the empty blue. No wreckage is ever recovered.',
  },
  {
    id: 'h-1939-poland',
    year: 1939,
    month: 8,
    title: 'Germany invades Poland',
    flavor:
      'At dawn on the first of September, the Wehrmacht crosses the border. Britain and France declare war within forty-eight hours. The world inhales.',
    major: true,
  },
  {
    id: 'h-1940-dunkirk',
    year: 1940,
    month: 4,
    title: 'The Dunkirk evacuation',
    flavor:
      '338,000 British and French troops lifted from the beaches by warships, fishing boats, weekend yachts. A defeat that becomes a legend.',
  },
  {
    id: 'h-1940-blitz',
    year: 1940,
    month: 8,
    title: 'The Blitz begins over London',
    flavor:
      'Fifty-seven nights of bombing. The city does not break. Beaverbrook’s factories build a new fighter every hour.',
  },
  {
    id: 'h-1941-pearlharbor',
    year: 1941,
    month: 11,
    title: 'Pearl Harbor — a date which will live in infamy',
    flavor:
      'Six Japanese carriers strike the Pacific Fleet at anchor. By nightfall, the United States is no longer at peace.',
    major: true,
  },
  {
    id: 'h-1942-stalingrad',
    year: 1942,
    month: 7,
    title: 'The siege of Stalingrad begins',
    flavor:
      'Two armies grind each other to dust along the Volga. Snipers, ruins, starvation — an entire campaign measured in city blocks.',
  },
  {
    id: 'h-1943-stalingradend',
    year: 1943,
    month: 1,
    title: 'Stalingrad — German Sixth Army surrenders',
    flavor:
      'Ninety-one thousand Germans walk into Soviet captivity. The high-water mark of the Reich. From here, every map shrinks westward.',
  },
  {
    id: 'h-1944-dday',
    year: 1944,
    month: 5,
    title: 'D-Day — landings at Normandy',
    flavor:
      'Five beaches, twelve nations, one tide. The largest seaborne invasion in history opens the Western Front in Europe.',
    major: true,
  },
  {
    id: 'h-1945-veday',
    year: 1945,
    month: 4,
    title: 'V-E Day — Germany surrenders',
    flavor:
      'The unconditional surrender is signed at Reims. Crowds fill London, Paris, Moscow, New York. Asia is still at war.',
  },
  {
    id: 'h-1945-hiroshima',
    year: 1945,
    month: 7,
    title: 'Hiroshima',
    flavor:
      'A single bomb, a single city. The architecture of war is reset overnight. The mushroom cloud will define the second half of the century.',
    major: true,
  },
  {
    id: 'h-1945-vjday',
    year: 1945,
    month: 7,
    title: 'V-J Day — the Pacific war ends',
    flavor:
      'On the deck of the USS Missouri in Tokyo Bay, the surrender is signed. Six years of total war close. The world counts its dead and begins again.',
  },
];

export type HistoricalEventLog = {
  /** Event ids that have already fired this campaign (deduped). */
  fired: Record<string, true>;
};

/**
 * Find the next event whose date matches the current game date.
 * Returns null if none. Skips already-fired events.
 */
export function pickHistoricalEventForDate(
  date: { year: number; month: number },
  fired: Record<string, true>,
): HistoricalEvent | null {
  for (const ev of HISTORICAL_EVENTS) {
    if (fired[ev.id]) continue;
    if (ev.year === date.year && ev.month === date.month) return ev;
  }
  return null;
}
