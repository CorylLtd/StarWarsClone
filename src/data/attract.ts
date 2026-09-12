/**
 * Attract-mode texts, layouts and timings traced from the original's message
 * tables. Data only; do not edit by hand. Positions are the lower-left of the
 * first character in vector-generator units.
 */

export interface Message {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly color: string;
}

export const INSTRUCTIONS: readonly Message[] = [
  { text: "FLIGHT INSTRUCTIONS TO RED FIVE", x: -396, y: 288, color: "red" },
  { text: "1.  YOUR X-WING IS EQUIPPED WITH AN", x: -444, y: 216, color: "red" },
  { text: "INVISIBLE DEFLECTOR SHIELD THAT", x: -420, y: 180, color: "red" },
  { text: "WILL PROTECT YOU FOR   COLLISIONS.", x: -420, y: 144, color: "red" },
  { text: "2.  DEFLECTOR STRENGTH IS LOST WHEN", x: -444, y: 72, color: "red" },
  { text: "A FIREBALL IMPACTS YOUR SHIELD OR", x: -420, y: 36, color: "red" },
  { text: "WHEN YOU STRIKE A LASER TOWER OR", x: -420, y: 0, color: "red" },
  { text: "TRENCH CATWALK.", x: -420, y: -36, color: "red" },
  { text: "3.  AIM YOUR LASERS WITH CURSOR TO", x: -444, y: -108, color: "red" },
  { text: "EXPLODE EMPIRE TIE FIGHTERS, LASER", x: -420, y: -144, color: "red" },
  { text: "TOWER TOPS AND TRENCH TURRETS.", x: -420, y: -180, color: "red" },
  { text: "4.  SHOOT FIREBALLS BEFORE THEY", x: -444, y: -252, color: "red" },
  { text: "IMPACT YOUR SHIELD.", x: -420, y: -288, color: "red" },
  { text: "5.  THE REBEL FORCE IS DEPENDING ON", x: -444, y: -360, color: "red" },
  { text: "YOU TO STOP THE EMPIRE BY BLOWING", x: -420, y: -396, color: "red" },
  { text: "UP THE DEATH STAR.", x: -420, y: -432, color: "red" }
];

export const INSTRUCTIONS_DIGIT = { x: 84, y: 144 };

export const SCORING_PAGE: readonly Message[] = [
  { text: "SCORING", x: -60, y: 280, color: "purple" },
  { text: "TIE FIGHTERS                 1,000", x: -372, y: 180, color: "purple" },
  { text: "DARTH VADER'S SHIP           2,000", x: -372, y: 120, color: "purple" },
  { text: "LASER BUNKERS                  200", x: -372, y: 60, color: "purple" },
  { text: "LASER TOWERS                   200", x: -372, y: 0, color: "purple" },
  { text: "TRENCH TURRETS                 100", x: -372, y: -60, color: "purple" },
  { text: "FIREBALLS                       33", x: -372, y: -120, color: "purple" },
  { text: "EXHAUST PORT                25,000", x: -372, y: -280, color: "purple" },
  { text: "DESTROYING ALL TOWER TOPS   50,000", x: -372, y: -350, color: "purple" }
];

/** Storyline lines: x from the vanishing point and the banner frame at which each starts. */
export const STORYLINE: readonly { text: string; x: number; start: number }[] = [
  { text: "OBI-WAN KENOBI IS GONE BUT HIS", x: -356, start: 65 },
  { text: "PRESENCE IS FELT WITHIN THE FORCE.", x: -404, start: 80 },
  { text: "THE EMPIRE'S DEATH STAR, UNDER THE", x: -404, start: 96 },
  { text: "COMMAND OF DARTH VADER, NEARS THE", x: -392, start: 112 },
  { text: "REBEL PLANET.  YOU MUST JOIN THE", x: -380, start: 128 },
  { text: "REBELLION TO STOP THE EMPIRE.", x: -344, start: 144 },
  { text: "THE FORCE WILL BE WITH YOU.", x: -320, start: 160 },
  { text: "ALWAYS", x: -68, start: 184 }
];

export const COPYRIGHT: readonly Message[] = [
  { text: "STAR WARS", x: -104, y: -420, color: "green" },
  { text: "@ 1983 LUCASFILM LTD. AND ATARI,INC.", x: -404, y: -456, color: "green" },
  { text: "ALL RIGHTS RESERVED.", x: -224, y: -492, color: "green" },
  { text: "LUCASFILM TRADEMARKS USED UNDER LICENSE.", x: -464, y: -528, color: "green" }
];

export const HIGH_SCORE_TITLE = { text: "PRINCESS LEIA'S REBEL FORCE", x: -320, y: 316 };
export const HIGH_SCORE_TITLE_ENTRY = { text: "PRINCESS LEIA'S REBEL FORCE", x: -320, y: 0 };

export const HIGH_SCORE_ROWS_Y = [140, 100, 60, 20, -20, -60, -100, -140, -180, -220];
export const HIGH_SCORE_ROWS_Y_ENTRY = [-72, -108, -142, -190, -226, -260, -296, -330, -366, -402];

export const HIGH_SCORE_DEFAULTS: readonly (readonly [string, number])[] = [["OBI", 1285353], ["WAN", 1110936], ["HAN", 1024650], ["GJR", 872551], ["MLH", 813553], ["JED", 704899], ["NLA", 518000], ["EJD", 492159], ["EAR", 384766], ["RLM", 380655]];

export const INITIALS_MESSAGES: readonly Message[] = [
  { text: "MESSAGE FROM REBEL COMMAND POST", x: -368, y: 340, color: "yellow" },
  { text: "YOU ARE A TRUE REBEL PILOT", x: -308, y: 280, color: "purple" },
  { text: "THE FORCE IS WITH YOU", x: -248, y: 220, color: "flashing (cycles blue,green,turquoise,red,purple,yellow,white per VG field)" },
  { text: "SHOOT YOUR INITIALS", x: -224, y: 120, color: "blue" }
];

/** The initials alphabet: A-I down the left, J-U along the bottom, V-Z up the right, then blank, RUB and END. */
export const INITIALS_ALPHABET: readonly { ch: string; x: number; y: number }[] = [{"ch": "A", "x": -292, "y": -92}, {"ch": "B", "x": -292, "y": -140}, {"ch": "C", "x": -292, "y": -188}, {"ch": "D", "x": -292, "y": -236}, {"ch": "E", "x": -292, "y": -284}, {"ch": "F", "x": -292, "y": -332}, {"ch": "G", "x": -292, "y": -380}, {"ch": "H", "x": -292, "y": -428}, {"ch": "I", "x": -292, "y": -476}, {"ch": "J", "x": -244, "y": -476}, {"ch": "K", "x": -196, "y": -476}, {"ch": "L", "x": -148, "y": -476}, {"ch": "M", "x": -100, "y": -476}, {"ch": "N", "x": -52, "y": -476}, {"ch": "O", "x": -4, "y": -476}, {"ch": "P", "x": 44, "y": -476}, {"ch": "Q", "x": 92, "y": -476}, {"ch": "R", "x": 140, "y": -476}, {"ch": "S", "x": 188, "y": -476}, {"ch": "T", "x": 236, "y": -476}, {"ch": "U", "x": 284, "y": -476}, {"ch": "V", "x": 284, "y": -428}, {"ch": "W", "x": 284, "y": -380}, {"ch": "X", "x": 284, "y": -332}, {"ch": "Y", "x": 284, "y": -284}, {"ch": "Z", "x": 284, "y": -236}, {"ch": " ", "x": 284, "y": -188}, {"ch": "RUB", "x": 284, "y": -140}, {"ch": "END", "x": 284, "y": -92}];

export const COIN_TEXT = {
  insertCoins: { text: 'INSERT COINS', x: -140, y: 480, color: 'blue' },
  gameOver: { text: 'GAME OVER', x: -104, y: 480, color: 'turquoise' },
  pullTrigger: { text: 'PULL TRIGGER TO START', x: -248, y: 480 },
  credit: { text: 'CREDIT', x: -60, y: 432 },
  credits: { text: 'CREDITS', x: -60, y: 432 },
  creditCount: { x: -128, y: 432 },
  prices: ['FREE PLAY', '2 PLAYS 1 COIN', '1 COIN 1 PLAY', '2 COINS 1 PLAY'],
  priceY: 432,
};
