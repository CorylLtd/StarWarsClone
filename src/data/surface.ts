/**
 * Death Star surface shapes and tables traced from the original's object
 * tables and ground code. Data only; do not edit the numbers by hand.
 *
 * Building model units are in the original's frame (X forward, Y right, Z up);
 * one model unit is 240 universe units, and z is measured from the ground.
 * Maze positions are universe units: `right` along +Y, `forward` along +X.
 */

/** The 16-point spire every building is cut from. Point 0 is the centre on the ground. */
export const GROUND_POINTS: readonly (readonly [number, number, number])[] = [[0,0,0],[-8,0,0],[0,8,0],[0,-8,0],[-4,0,58],[0,4,58],[0,-4,58],[-4,0,52],[0,4,52],[0,-4,52],[-5,0,14],[0,5,14],[0,-5,14],[-6,0,6],[0,6,6],[0,-6,6]];

/** Universe units per building model unit. */
export const BUILDING_UNIT = 240;

export interface BuildingPart {
  /** 'base' takes the yellow distance-faded colour, 'top' the tower hat colour. */
  readonly part: 'base' | 'top';
  readonly lines: readonly (readonly [number, number])[];
}

export const TOWER: readonly BuildingPart[] = [
  { part: 'base', lines: [[1,3],[3,15],[15,12],[12,9],[7,10],[10,13],[13,1],[1,2],[2,14],[14,11],[11,8]] },
  { part: 'top', lines: [[9,6],[6,4],[4,7],[8,5],[5,4],[7,9],[7,8]] },
];

export const TOWER_STUB: readonly BuildingPart[] = [{ part: 'base', lines: [[1,3],[3,15],[15,12],[12,9],[9,7],[7,10],[10,13],[13,1],[1,2],[2,14],[14,11],[11,8],[8,7]] }];

export const BUNKER: readonly BuildingPart[] = [{ part: 'top', lines: [[1,2],[2,14],[14,13],[13,1],[1,3],[3,15],[15,13],[14,15]] }];

export interface FragmentModel {
  readonly scale: number;
  readonly points: readonly (readonly [number, number, number])[];
  readonly lines: readonly (readonly [number, number])[];
}

export const TOWER_PIECE_LEFT: FragmentModel = { scale: 12, points: [[0,0,0],[5,-20,30],[25,0,30],[-35,20,30],[5,-20,-30],[25,0,-30],[-35,20,-30]], lines: [[1,2],[2,3],[3,1],[1,4],[4,5],[5,2],[5,6],[6,3],[6,4]] };

export const TOWER_PIECE_CENTRE: FragmentModel = { scale: 12, points: [[0,0,0],[10,-20,30],[30,0,30],[10,20,30],[-50,0,30],[10,-20,-30],[30,0,-30],[10,20,-30],[-50,0,-30]], lines: [[1,2],[2,3],[3,4],[4,1],[1,5],[5,6],[6,2],[6,7],[7,3],[7,8],[8,4],[8,5]] };

export const TOWER_PIECE_RIGHT: FragmentModel = { scale: 12, points: [[0,0,0],[5,20,30],[25,0,30],[-35,-20,30],[5,20,-30],[25,0,-30],[-35,-20,-30]], lines: [[1,2],[2,3],[3,1],[1,4],[4,5],[5,2],[5,6],[6,3],[6,4]] };

export const BUNKER_PIECE_LEFT: FragmentModel = { scale: 12, points: [[0,0,0],[22,-45,30],[22,5,30],[-58,35,30],[22,-45,-30],[22,5,-30],[-58,35,-30]], lines: [[1,2],[2,3],[3,1],[1,4],[4,5],[5,2],[5,6],[6,3],[6,4]] };

export const BUNKER_PIECE_CENTRE: FragmentModel = { scale: 12, points: [[0,0,0],[28,-30,30],[28,30,30],[-52,0,30],[28,-30,-30],[28,30,-30],[-52,0,-30]], lines: [[1,2],[2,3],[3,1],[1,4],[4,5],[5,2],[5,6],[6,3],[6,4]] };

export const BUNKER_PIECE_RIGHT: FragmentModel = { scale: 12, points: [[0,0,0],[22,45,30],[22,-5,30],[-58,-35,30],[22,45,-30],[22,-5,-30],[-58,-35,-30]], lines: [[1,2],[2,3],[3,1],[1,4],[4,5],[5,2],[5,6],[6,3],[6,4]] };

export interface MazeEntry {
  readonly type: 'tower' | 'bishop' | 'bunker';
  readonly right: number;
  readonly forward: number;
  readonly sequence: number;
}

/** The maze tables: which buildings stand where, and at which wrap count they awaken. */
export const MAZES: Record<string, readonly MazeEntry[]> = {
 "TDIFF": [
  {
   "type": "bunker",
   "right": -20480,
   "forward": 4096,
   "sequence": 1
  },
  {
   "type": "bunker",
   "right": -8192,
   "forward": 4096,
   "sequence": 1
  },
  {
   "type": "bunker",
   "right": 8192,
   "forward": 4096,
   "sequence": 1
  },
  {
   "type": "bunker",
   "right": 20480,
   "forward": 4096,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -24576,
   "forward": 6144,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": 24576,
   "forward": 6144,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -18432,
   "forward": 8192,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": 18432,
   "forward": 8192,
   "sequence": 2
  },
  {
   "type": "bunker",
   "right": -16384,
   "forward": 12288,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": 0,
   "forward": 12288,
   "sequence": 0
  },
  {
   "type": "bunker",
   "right": 16384,
   "forward": 12288,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -26624,
   "forward": 14336,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": -4096,
   "forward": 14336,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 4096,
   "forward": 14336,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 26624,
   "forward": 14336,
   "sequence": 3
  },
  {
   "type": "bunker",
   "right": -28672,
   "forward": 16384,
   "sequence": 3
  },
  {
   "type": "bunker",
   "right": 28672,
   "forward": 16384,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": -28672,
   "forward": 20480,
   "sequence": 1
  },
  {
   "type": "bishop",
   "right": 0,
   "forward": 20480,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 28672,
   "forward": 20480,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -7168,
   "forward": 21504,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 7168,
   "forward": 21504,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -16384,
   "forward": 22528,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 16384,
   "forward": 22528,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": -10240,
   "forward": 26624,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 10240,
   "forward": 26624,
   "sequence": 0
  },
  {
   "type": "bishop",
   "right": -4096,
   "forward": 28672,
   "sequence": 2
  },
  {
   "type": "bishop",
   "right": 4096,
   "forward": 28672,
   "sequence": 2
  }
 ],
 "T3DIFF": [
  {
   "type": "bunker",
   "right": -20480,
   "forward": 4096,
   "sequence": 1
  },
  {
   "type": "bunker",
   "right": -8192,
   "forward": 4096,
   "sequence": 1
  },
  {
   "type": "bunker",
   "right": 8192,
   "forward": 4096,
   "sequence": 1
  },
  {
   "type": "bunker",
   "right": 20480,
   "forward": 4096,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -24576,
   "forward": 6144,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": 24576,
   "forward": 6144,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -18432,
   "forward": 8192,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": 18432,
   "forward": 8192,
   "sequence": 2
  },
  {
   "type": "bunker",
   "right": -16384,
   "forward": 12288,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": 0,
   "forward": 12288,
   "sequence": 0
  },
  {
   "type": "bunker",
   "right": 16384,
   "forward": 12288,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -26624,
   "forward": 14336,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": -4096,
   "forward": 14336,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 4096,
   "forward": 14336,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 26624,
   "forward": 14336,
   "sequence": 3
  },
  {
   "type": "bunker",
   "right": -28672,
   "forward": 16384,
   "sequence": 3
  },
  {
   "type": "bunker",
   "right": 28672,
   "forward": 16384,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": -28672,
   "forward": 20480,
   "sequence": 1
  },
  {
   "type": "bishop",
   "right": 0,
   "forward": 20480,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 28672,
   "forward": 20480,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -7168,
   "forward": 21504,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 7168,
   "forward": 21504,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -16384,
   "forward": 22528,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 16384,
   "forward": 22528,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": -10240,
   "forward": 26624,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 10240,
   "forward": 26624,
   "sequence": 0
  },
  {
   "type": "bishop",
   "right": -4096,
   "forward": 28672,
   "sequence": 2
  },
  {
   "type": "bishop",
   "right": 4096,
   "forward": 28672,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -28672,
   "forward": 32768,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": -10240,
   "forward": 32768,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 10240,
   "forward": 32768,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 28672,
   "forward": 32768,
   "sequence": 2
  }
 ],
 "TCLUSTR": [
  {
   "type": "tower",
   "right": -30720,
   "forward": 12288,
   "sequence": 2
  },
  {
   "type": "bunker",
   "right": -26624,
   "forward": 12288,
   "sequence": 2
  },
  {
   "type": "bunker",
   "right": -22528,
   "forward": 12288,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -18432,
   "forward": 12288,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -6144,
   "forward": 12288,
   "sequence": 0
  },
  {
   "type": "bunker",
   "right": -2048,
   "forward": 12288,
   "sequence": 0
  },
  {
   "type": "bunker",
   "right": 2048,
   "forward": 12288,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 6144,
   "forward": 12288,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 18432,
   "forward": 12288,
   "sequence": 3
  },
  {
   "type": "bunker",
   "right": 22528,
   "forward": 12288,
   "sequence": 3
  },
  {
   "type": "bunker",
   "right": 26624,
   "forward": 12288,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": 30720,
   "forward": 12288,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": -28672,
   "forward": 16384,
   "sequence": 2
  },
  {
   "type": "bunker",
   "right": -24576,
   "forward": 16384,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -20480,
   "forward": 16384,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -4096,
   "forward": 16384,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 4096,
   "forward": 16384,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 20480,
   "forward": 16384,
   "sequence": 3
  },
  {
   "type": "bunker",
   "right": 24576,
   "forward": 16384,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": 28672,
   "forward": 16384,
   "sequence": 3
  },
  {
   "type": "bunker",
   "right": -13312,
   "forward": 21504,
   "sequence": 1
  },
  {
   "type": "bunker",
   "right": 13312,
   "forward": 21504,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -24576,
   "forward": 24576,
   "sequence": 1
  },
  {
   "type": "bunker",
   "right": -8192,
   "forward": 24576,
   "sequence": 0
  },
  {
   "type": "bunker",
   "right": 8192,
   "forward": 24576,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 24576,
   "forward": 24576,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -8192,
   "forward": 29696,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 8192,
   "forward": 29696,
   "sequence": 1
  }
 ],
 "T3CLUSTR": [
  {
   "type": "tower",
   "right": -30720,
   "forward": 12288,
   "sequence": 2
  },
  {
   "type": "bunker",
   "right": -26624,
   "forward": 12288,
   "sequence": 2
  },
  {
   "type": "bunker",
   "right": -22528,
   "forward": 12288,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -18432,
   "forward": 12288,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -6144,
   "forward": 12288,
   "sequence": 0
  },
  {
   "type": "bunker",
   "right": -2048,
   "forward": 12288,
   "sequence": 0
  },
  {
   "type": "bunker",
   "right": 2048,
   "forward": 12288,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 6144,
   "forward": 12288,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 18432,
   "forward": 12288,
   "sequence": 3
  },
  {
   "type": "bunker",
   "right": 22528,
   "forward": 12288,
   "sequence": 3
  },
  {
   "type": "bunker",
   "right": 26624,
   "forward": 12288,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": 30720,
   "forward": 12288,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": -28672,
   "forward": 16384,
   "sequence": 2
  },
  {
   "type": "bunker",
   "right": -24576,
   "forward": 16384,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -20480,
   "forward": 16384,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -4096,
   "forward": 16384,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 4096,
   "forward": 16384,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 20480,
   "forward": 16384,
   "sequence": 3
  },
  {
   "type": "bunker",
   "right": 24576,
   "forward": 16384,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": 28672,
   "forward": 16384,
   "sequence": 3
  },
  {
   "type": "bunker",
   "right": -13312,
   "forward": 21504,
   "sequence": 1
  },
  {
   "type": "bunker",
   "right": 13312,
   "forward": 21504,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -24576,
   "forward": 24576,
   "sequence": 1
  },
  {
   "type": "bunker",
   "right": -8192,
   "forward": 24576,
   "sequence": 0
  },
  {
   "type": "bunker",
   "right": 8192,
   "forward": 24576,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 24576,
   "forward": 24576,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -8192,
   "forward": 29696,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 8192,
   "forward": 29696,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -26624,
   "forward": 32768,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -18432,
   "forward": 32768,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": 18432,
   "forward": 32768,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": 26624,
   "forward": 32768,
   "sequence": 3
  }
 ],
 "TBUNK": [
  {
   "type": "bunker",
   "right": 12288,
   "forward": 1024,
   "sequence": 1
  },
  {
   "type": "bunker",
   "right": 8192,
   "forward": 3072,
   "sequence": 0
  },
  {
   "type": "bunker",
   "right": -26624,
   "forward": 4096,
   "sequence": 1
  },
  {
   "type": "bunker",
   "right": 18432,
   "forward": 5120,
   "sequence": 1
  },
  {
   "type": "bunker",
   "right": -20480,
   "forward": 6144,
   "sequence": 3
  },
  {
   "type": "bunker",
   "right": -12288,
   "forward": 6144,
   "sequence": 0
  },
  {
   "type": "bunker",
   "right": -16384,
   "forward": 8192,
   "sequence": 1
  },
  {
   "type": "bunker",
   "right": 14336,
   "forward": 9216,
   "sequence": 2
  },
  {
   "type": "bunker",
   "right": 28672,
   "forward": 9216,
   "sequence": 2
  },
  {
   "type": "bunker",
   "right": 0,
   "forward": 10240,
   "sequence": 0
  },
  {
   "type": "bunker",
   "right": -30720,
   "forward": 12288,
   "sequence": 1
  },
  {
   "type": "bunker",
   "right": 32768,
   "forward": 16384,
   "sequence": 1
  },
  {
   "type": "bunker",
   "right": 24576,
   "forward": 17408,
   "sequence": 2
  },
  {
   "type": "bunker",
   "right": -28672,
   "forward": 18432,
   "sequence": 1
  },
  {
   "type": "bunker",
   "right": -22528,
   "forward": 18432,
   "sequence": 3
  },
  {
   "type": "bunker",
   "right": 20480,
   "forward": 19456,
   "sequence": 2
  },
  {
   "type": "bunker",
   "right": -8192,
   "forward": 20480,
   "sequence": 3
  },
  {
   "type": "bunker",
   "right": 0,
   "forward": 20480,
   "sequence": 2
  },
  {
   "type": "bunker",
   "right": 10240,
   "forward": 20480,
   "sequence": 0
  },
  {
   "type": "bunker",
   "right": -18432,
   "forward": 26624,
   "sequence": 3
  },
  {
   "type": "bunker",
   "right": -10240,
   "forward": 26624,
   "sequence": 0
  },
  {
   "type": "bunker",
   "right": -24576,
   "forward": 28672,
   "sequence": 3
  },
  {
   "type": "bunker",
   "right": -6144,
   "forward": 28672,
   "sequence": 0
  },
  {
   "type": "bunker",
   "right": 6144,
   "forward": 28672,
   "sequence": 3
  },
  {
   "type": "bunker",
   "right": 22528,
   "forward": 28672,
   "sequence": 3
  },
  {
   "type": "bunker",
   "right": -2048,
   "forward": 30720,
   "sequence": 0
  },
  {
   "type": "bunker",
   "right": 16384,
   "forward": 30720,
   "sequence": 2
  },
  {
   "type": "bunker",
   "right": 26624,
   "forward": 30720,
   "sequence": 2
  }
 ],
 "TTWRCTY": [
  {
   "type": "tower",
   "right": -28672,
   "forward": 0,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": -20480,
   "forward": 0,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": -12288,
   "forward": 0,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": -4096,
   "forward": 0,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 4096,
   "forward": 0,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 12288,
   "forward": 0,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 20480,
   "forward": 0,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 28672,
   "forward": 0,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": -14336,
   "forward": 4096,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -16384,
   "forward": 10240,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -30720,
   "forward": 12288,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -22528,
   "forward": 12288,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": 18432,
   "forward": 12288,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": 26624,
   "forward": 12288,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -24576,
   "forward": 16384,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": 16384,
   "forward": 16384,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": 24576,
   "forward": 16384,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": 32768,
   "forward": 16384,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": 0,
   "forward": 24576,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": -31744,
   "forward": 26624,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": -26624,
   "forward": 28672,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -18432,
   "forward": 28672,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -10240,
   "forward": 28672,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -2048,
   "forward": 28672,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 6144,
   "forward": 28672,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 14336,
   "forward": 28672,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 22528,
   "forward": 28672,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 30720,
   "forward": 28672,
   "sequence": 1
  }
 ],
 "T3TWRCTY": [
  {
   "type": "tower",
   "right": -28672,
   "forward": 0,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": -20480,
   "forward": 0,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": -12288,
   "forward": 0,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": -4096,
   "forward": 0,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 4096,
   "forward": 0,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 12288,
   "forward": 0,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 20480,
   "forward": 0,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 28672,
   "forward": 0,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": -14336,
   "forward": 4096,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -16384,
   "forward": 10240,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -30720,
   "forward": 12288,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -22528,
   "forward": 12288,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": 18432,
   "forward": 12288,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": 26624,
   "forward": 12288,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -24576,
   "forward": 16384,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": 16384,
   "forward": 16384,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": 24576,
   "forward": 16384,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": 32768,
   "forward": 16384,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": 0,
   "forward": 24576,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": -31744,
   "forward": 26624,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": -26624,
   "forward": 28672,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -18432,
   "forward": 28672,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -10240,
   "forward": 28672,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -2048,
   "forward": 28672,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 6144,
   "forward": 28672,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 14336,
   "forward": 28672,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 22528,
   "forward": 28672,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 30720,
   "forward": 28672,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -6144,
   "forward": 12288,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": 2048,
   "forward": 12288,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -2048,
   "forward": 16384,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": 6144,
   "forward": 16384,
   "sequence": 3
  }
 ],
 "TSYMTRC": [
  {
   "type": "bunker",
   "right": -22528,
   "forward": 2048,
   "sequence": 2
  },
  {
   "type": "bunker",
   "right": 22528,
   "forward": 2048,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -6144,
   "forward": 3072,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 6144,
   "forward": 3072,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": -15360,
   "forward": 5120,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 15360,
   "forward": 5120,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": -22528,
   "forward": 10240,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": 22528,
   "forward": 10240,
   "sequence": 2
  },
  {
   "type": "bunker",
   "right": 0,
   "forward": 12288,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": -8192,
   "forward": 14336,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 8192,
   "forward": 14336,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": -16384,
   "forward": 18432,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": 16384,
   "forward": 18432,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": -28672,
   "forward": 20480,
   "sequence": 3
  },
  {
   "type": "bunker",
   "right": -10240,
   "forward": 20480,
   "sequence": 1
  },
  {
   "type": "bunker",
   "right": 10240,
   "forward": 20480,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 28672,
   "forward": 20480,
   "sequence": 2
  },
  {
   "type": "bunker",
   "right": -4096,
   "forward": 22528,
   "sequence": 2
  },
  {
   "type": "bunker",
   "right": 4096,
   "forward": 22528,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -18432,
   "forward": 26624,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 18432,
   "forward": 26624,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": -30720,
   "forward": 28672,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": -24576,
   "forward": 28672,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -12288,
   "forward": 28672,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": 0,
   "forward": 28672,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 12288,
   "forward": 28672,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": 24576,
   "forward": 28672,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 30720,
   "forward": 28672,
   "sequence": 3
  }
 ],
 "T3SYMTRC": [
  {
   "type": "bunker",
   "right": -22528,
   "forward": 2048,
   "sequence": 2
  },
  {
   "type": "bunker",
   "right": 22528,
   "forward": 2048,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -6144,
   "forward": 3072,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 6144,
   "forward": 3072,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": -15360,
   "forward": 5120,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 15360,
   "forward": 5120,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": -22528,
   "forward": 10240,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": 22528,
   "forward": 10240,
   "sequence": 2
  },
  {
   "type": "bunker",
   "right": 0,
   "forward": 12288,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": -8192,
   "forward": 14336,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 8192,
   "forward": 14336,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": -16384,
   "forward": 18432,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": 16384,
   "forward": 18432,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": -28672,
   "forward": 20480,
   "sequence": 3
  },
  {
   "type": "bunker",
   "right": -10240,
   "forward": 20480,
   "sequence": 1
  },
  {
   "type": "bunker",
   "right": 10240,
   "forward": 20480,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 28672,
   "forward": 20480,
   "sequence": 2
  },
  {
   "type": "bunker",
   "right": -4096,
   "forward": 22528,
   "sequence": 2
  },
  {
   "type": "bunker",
   "right": 4096,
   "forward": 22528,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -18432,
   "forward": 26624,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 18432,
   "forward": 26624,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": -30720,
   "forward": 28672,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": -24576,
   "forward": 28672,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -12288,
   "forward": 28672,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": 0,
   "forward": 28672,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 12288,
   "forward": 28672,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": 24576,
   "forward": 28672,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 30720,
   "forward": 28672,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": -20480,
   "forward": 32768,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": -6144,
   "forward": 32768,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 6144,
   "forward": 32768,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 20480,
   "forward": 32768,
   "sequence": 0
  }
 ],
 "TTRAP": [
  {
   "type": "tower",
   "right": -26624,
   "forward": 24576,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": 26624,
   "forward": 4096,
   "sequence": 2
  },
  {
   "type": "bunker",
   "right": -12288,
   "forward": 8192,
   "sequence": 1
  },
  {
   "type": "bunker",
   "right": -28672,
   "forward": 12288,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -8192,
   "forward": 12288,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 8192,
   "forward": 12288,
   "sequence": 0
  },
  {
   "type": "bunker",
   "right": 28672,
   "forward": 12288,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -18432,
   "forward": 14336,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 18432,
   "forward": 14336,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -28672,
   "forward": 16384,
   "sequence": 3
  },
  {
   "type": "bunker",
   "right": -6144,
   "forward": 16384,
   "sequence": 0
  },
  {
   "type": "bunker",
   "right": 6144,
   "forward": 16384,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 18432,
   "forward": 16384,
   "sequence": 1
  },
  {
   "type": "bunker",
   "right": -8192,
   "forward": 20480,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": -4096,
   "forward": 20480,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 4096,
   "forward": 20480,
   "sequence": 0
  },
  {
   "type": "bunker",
   "right": 8192,
   "forward": 20480,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": -30720,
   "forward": 24576,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": -24576,
   "forward": 24576,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -16384,
   "forward": 24576,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -12288,
   "forward": 24576,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -2048,
   "forward": 24576,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 2048,
   "forward": 24576,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 12288,
   "forward": 24576,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 16384,
   "forward": 24576,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 24576,
   "forward": 24576,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": 32768,
   "forward": 24576,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": 0,
   "forward": 28672,
   "sequence": 0
  }
 ],
 "T3TRAP": [
  {
   "type": "tower",
   "right": -26624,
   "forward": 24576,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": 26624,
   "forward": 4096,
   "sequence": 2
  },
  {
   "type": "bunker",
   "right": -12288,
   "forward": 8192,
   "sequence": 1
  },
  {
   "type": "bunker",
   "right": -28672,
   "forward": 12288,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -8192,
   "forward": 12288,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 8192,
   "forward": 12288,
   "sequence": 0
  },
  {
   "type": "bunker",
   "right": 28672,
   "forward": 12288,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -18432,
   "forward": 14336,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 18432,
   "forward": 14336,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -28672,
   "forward": 16384,
   "sequence": 3
  },
  {
   "type": "bunker",
   "right": -6144,
   "forward": 16384,
   "sequence": 0
  },
  {
   "type": "bunker",
   "right": 6144,
   "forward": 16384,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 18432,
   "forward": 16384,
   "sequence": 1
  },
  {
   "type": "bunker",
   "right": -8192,
   "forward": 20480,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": -4096,
   "forward": 20480,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 4096,
   "forward": 20480,
   "sequence": 0
  },
  {
   "type": "bunker",
   "right": 8192,
   "forward": 20480,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": -30720,
   "forward": 24576,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": -24576,
   "forward": 24576,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -16384,
   "forward": 24576,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -12288,
   "forward": 24576,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -2048,
   "forward": 24576,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 2048,
   "forward": 24576,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 12288,
   "forward": 24576,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 16384,
   "forward": 24576,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 24576,
   "forward": 24576,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": 32768,
   "forward": 24576,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": 0,
   "forward": 28672,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": -22528,
   "forward": 32768,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": -8192,
   "forward": 32768,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": 8192,
   "forward": 32768,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": 22528,
   "forward": 32768,
   "sequence": 3
  }
 ],
 "TWEDGE": [
  {
   "type": "tower",
   "right": -18432,
   "forward": 0,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": 18432,
   "forward": 0,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -24576,
   "forward": 4096,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": -8192,
   "forward": 4096,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -2048,
   "forward": 4096,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 2048,
   "forward": 4096,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 8192,
   "forward": 4096,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -14336,
   "forward": 8192,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 14336,
   "forward": 8192,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -7168,
   "forward": 11264,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 7168,
   "forward": 11264,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": -28672,
   "forward": 12288,
   "sequence": 3
  },
  {
   "type": "bunker",
   "right": 0,
   "forward": 16384,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 0,
   "forward": 20480,
   "sequence": 1
  },
  {
   "type": "bunker",
   "right": 32768,
   "forward": 20480,
   "sequence": 3
  },
  {
   "type": "bunker",
   "right": -6144,
   "forward": 24576,
   "sequence": 1
  },
  {
   "type": "bunker",
   "right": 6144,
   "forward": 24576,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 32768,
   "forward": 24576,
   "sequence": 3
  },
  {
   "type": "bunker",
   "right": -30720,
   "forward": 28672,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -24576,
   "forward": 28672,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": -20480,
   "forward": 28672,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": -4096,
   "forward": 28672,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": 4096,
   "forward": 28672,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": 20480,
   "forward": 28672,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 24576,
   "forward": 28672,
   "sequence": 0
  },
  {
   "type": "bunker",
   "right": 30720,
   "forward": 28672,
   "sequence": 2
  },
  {
   "type": "bunker",
   "right": -8192,
   "forward": 30720,
   "sequence": 3
  },
  {
   "type": "bunker",
   "right": 8192,
   "forward": 30720,
   "sequence": 3
  }
 ],
 "T3WEDGE": [
  {
   "type": "tower",
   "right": -18432,
   "forward": 0,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": 18432,
   "forward": 0,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -24576,
   "forward": 4096,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": -8192,
   "forward": 4096,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -2048,
   "forward": 4096,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 2048,
   "forward": 4096,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 8192,
   "forward": 4096,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -14336,
   "forward": 8192,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 14336,
   "forward": 8192,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -7168,
   "forward": 11264,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 7168,
   "forward": 11264,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": -28672,
   "forward": 12288,
   "sequence": 3
  },
  {
   "type": "bunker",
   "right": 0,
   "forward": 16384,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 0,
   "forward": 20480,
   "sequence": 1
  },
  {
   "type": "bunker",
   "right": 32768,
   "forward": 20480,
   "sequence": 3
  },
  {
   "type": "bunker",
   "right": -6144,
   "forward": 24576,
   "sequence": 1
  },
  {
   "type": "bunker",
   "right": 6144,
   "forward": 24576,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 32768,
   "forward": 24576,
   "sequence": 3
  },
  {
   "type": "bunker",
   "right": -30720,
   "forward": 28672,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -24576,
   "forward": 28672,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": -20480,
   "forward": 28672,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": -4096,
   "forward": 28672,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": 4096,
   "forward": 28672,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": 20480,
   "forward": 28672,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 24576,
   "forward": 28672,
   "sequence": 0
  },
  {
   "type": "bunker",
   "right": 30720,
   "forward": 28672,
   "sequence": 2
  },
  {
   "type": "bunker",
   "right": -8192,
   "forward": 30720,
   "sequence": 3
  },
  {
   "type": "bunker",
   "right": 8192,
   "forward": 30720,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": -20480,
   "forward": 16384,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -16384,
   "forward": 16384,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": 12288,
   "forward": 16384,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": 16384,
   "forward": 16384,
   "sequence": 2
  }
 ],
 "TSQUARE": [
  {
   "type": "bunker",
   "right": -32768,
   "forward": 8192,
   "sequence": 2
  },
  {
   "type": "bunker",
   "right": -24576,
   "forward": 8192,
   "sequence": 1
  },
  {
   "type": "bunker",
   "right": -20480,
   "forward": 8192,
   "sequence": 1
  },
  {
   "type": "bunker",
   "right": 20480,
   "forward": 8192,
   "sequence": 1
  },
  {
   "type": "bunker",
   "right": 24576,
   "forward": 8192,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -32768,
   "forward": 12288,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -24576,
   "forward": 12288,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -20480,
   "forward": 12288,
   "sequence": 1
  },
  {
   "type": "bunker",
   "right": -12288,
   "forward": 12288,
   "sequence": 1
  },
  {
   "type": "bunker",
   "right": -8192,
   "forward": 12288,
   "sequence": 0
  },
  {
   "type": "bunker",
   "right": 0,
   "forward": 12288,
   "sequence": 0
  },
  {
   "type": "bunker",
   "right": 8192,
   "forward": 12288,
   "sequence": 0
  },
  {
   "type": "bunker",
   "right": 12288,
   "forward": 12288,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 20480,
   "forward": 12288,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 24576,
   "forward": 12288,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -12288,
   "forward": 16384,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -8192,
   "forward": 16384,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 0,
   "forward": 16384,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 8192,
   "forward": 16384,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 12288,
   "forward": 16384,
   "sequence": 2
  },
  {
   "type": "bunker",
   "right": 22528,
   "forward": 18432,
   "sequence": 2
  },
  {
   "type": "bunker",
   "right": 28672,
   "forward": 21504,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -28672,
   "forward": 24576,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": 28672,
   "forward": 24576,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": -4096,
   "forward": 26624,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 4096,
   "forward": 26624,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": -16384,
   "forward": 28672,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 16384,
   "forward": 28672,
   "sequence": 1
  }
 ],
 "T3SQUARE": [
  {
   "type": "bunker",
   "right": -32768,
   "forward": 8192,
   "sequence": 2
  },
  {
   "type": "bunker",
   "right": -24576,
   "forward": 8192,
   "sequence": 1
  },
  {
   "type": "bunker",
   "right": -20480,
   "forward": 8192,
   "sequence": 1
  },
  {
   "type": "bunker",
   "right": 20480,
   "forward": 8192,
   "sequence": 1
  },
  {
   "type": "bunker",
   "right": 24576,
   "forward": 8192,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -32768,
   "forward": 12288,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -24576,
   "forward": 12288,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -20480,
   "forward": 12288,
   "sequence": 1
  },
  {
   "type": "bunker",
   "right": -12288,
   "forward": 12288,
   "sequence": 1
  },
  {
   "type": "bunker",
   "right": -8192,
   "forward": 12288,
   "sequence": 0
  },
  {
   "type": "bunker",
   "right": 0,
   "forward": 12288,
   "sequence": 0
  },
  {
   "type": "bunker",
   "right": 8192,
   "forward": 12288,
   "sequence": 0
  },
  {
   "type": "bunker",
   "right": 12288,
   "forward": 12288,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 20480,
   "forward": 12288,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 24576,
   "forward": 12288,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -12288,
   "forward": 16384,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -8192,
   "forward": 16384,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 0,
   "forward": 16384,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 8192,
   "forward": 16384,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 12288,
   "forward": 16384,
   "sequence": 2
  },
  {
   "type": "bunker",
   "right": 22528,
   "forward": 18432,
   "sequence": 2
  },
  {
   "type": "bunker",
   "right": 28672,
   "forward": 21504,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -28672,
   "forward": 24576,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": 28672,
   "forward": 24576,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": -4096,
   "forward": 26624,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 4096,
   "forward": 26624,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": -16384,
   "forward": 28672,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 16384,
   "forward": 28672,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -24576,
   "forward": 32768,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": -8192,
   "forward": 32768,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": 8192,
   "forward": 32768,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": 24576,
   "forward": 32768,
   "sequence": 3
  }
 ],
 "TVALLEY": [
  {
   "type": "tower",
   "right": 0,
   "forward": 0,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -32768,
   "forward": 6144,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": -10240,
   "forward": 8192,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 10240,
   "forward": 8192,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -28672,
   "forward": 12288,
   "sequence": 2
  },
  {
   "type": "bunker",
   "right": 24576,
   "forward": 12288,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": 28672,
   "forward": 12288,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -20480,
   "forward": 14336,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": -8192,
   "forward": 14336,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 8192,
   "forward": 14336,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 20480,
   "forward": 14336,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": -6144,
   "forward": 18432,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 6144,
   "forward": 18432,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": -30720,
   "forward": 20480,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -24576,
   "forward": 20480,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": -16384,
   "forward": 20480,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 16384,
   "forward": 20480,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 24576,
   "forward": 20480,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": 30720,
   "forward": 20480,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -7168,
   "forward": 23552,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 7168,
   "forward": 23552,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": -4096,
   "forward": 24576,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 4096,
   "forward": 24576,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 31744,
   "forward": 24576,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": -14336,
   "forward": 28672,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -2048,
   "forward": 28672,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 2048,
   "forward": 28672,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 14336,
   "forward": 28672,
   "sequence": 1
  }
 ],
 "T3VALLEY": [
  {
   "type": "tower",
   "right": 0,
   "forward": 0,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -32768,
   "forward": 6144,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": -10240,
   "forward": 8192,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 10240,
   "forward": 8192,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -28672,
   "forward": 12288,
   "sequence": 2
  },
  {
   "type": "bunker",
   "right": 24576,
   "forward": 12288,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": 28672,
   "forward": 12288,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -20480,
   "forward": 14336,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": -8192,
   "forward": 14336,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 8192,
   "forward": 14336,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 20480,
   "forward": 14336,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": -6144,
   "forward": 18432,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 6144,
   "forward": 18432,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": -30720,
   "forward": 20480,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -24576,
   "forward": 20480,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": -16384,
   "forward": 20480,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 16384,
   "forward": 20480,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 24576,
   "forward": 20480,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": 30720,
   "forward": 20480,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -7168,
   "forward": 23552,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 7168,
   "forward": 23552,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": -4096,
   "forward": 24576,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 4096,
   "forward": 24576,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 31744,
   "forward": 24576,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": -14336,
   "forward": 28672,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -2048,
   "forward": 28672,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 2048,
   "forward": 28672,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 14336,
   "forward": 28672,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -24576,
   "forward": 0,
   "sequence": 3
  },
  {
   "type": "tower",
   "right": -16384,
   "forward": 0,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": 16384,
   "forward": 0,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": 24576,
   "forward": 0,
   "sequence": 3
  }
 ],
 "TTURNON": [
  {
   "type": "tower",
   "right": -8192,
   "forward": 4096,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 8192,
   "forward": 4096,
   "sequence": 1
  },
  {
   "type": "bunker",
   "right": -16384,
   "forward": 8192,
   "sequence": 1
  },
  {
   "type": "bunker",
   "right": 16384,
   "forward": 8192,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -8192,
   "forward": 10240,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 8192,
   "forward": 10240,
   "sequence": 0
  },
  {
   "type": "bunker",
   "right": -28672,
   "forward": 12288,
   "sequence": 2
  },
  {
   "type": "bunker",
   "right": -24576,
   "forward": 12288,
   "sequence": 2
  },
  {
   "type": "bunker",
   "right": 24576,
   "forward": 12288,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -20480,
   "forward": 14336,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 20480,
   "forward": 14336,
   "sequence": 1
  },
  {
   "type": "bunker",
   "right": -12288,
   "forward": 16384,
   "sequence": 0
  },
  {
   "type": "bunker",
   "right": 0,
   "forward": 16384,
   "sequence": 0
  },
  {
   "type": "bunker",
   "right": 12288,
   "forward": 16384,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 32768,
   "forward": 16384,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -30720,
   "forward": 20480,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": 0,
   "forward": 20480,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 30720,
   "forward": 20480,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -16384,
   "forward": 24576,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 16384,
   "forward": 24576,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": -12288,
   "forward": 26624,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 12288,
   "forward": 26624,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": -28672,
   "forward": 28672,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -24576,
   "forward": 28672,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -4096,
   "forward": 28672,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 4096,
   "forward": 28672,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 24576,
   "forward": 28672,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 28672,
   "forward": 28672,
   "sequence": 1
  }
 ],
 "T3TURNON": [
  {
   "type": "tower",
   "right": -8192,
   "forward": 4096,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 8192,
   "forward": 4096,
   "sequence": 1
  },
  {
   "type": "bunker",
   "right": -16384,
   "forward": 8192,
   "sequence": 1
  },
  {
   "type": "bunker",
   "right": 16384,
   "forward": 8192,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -8192,
   "forward": 10240,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 8192,
   "forward": 10240,
   "sequence": 0
  },
  {
   "type": "bunker",
   "right": -28672,
   "forward": 12288,
   "sequence": 2
  },
  {
   "type": "bunker",
   "right": -24576,
   "forward": 12288,
   "sequence": 2
  },
  {
   "type": "bunker",
   "right": 24576,
   "forward": 12288,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -20480,
   "forward": 14336,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 20480,
   "forward": 14336,
   "sequence": 1
  },
  {
   "type": "bunker",
   "right": -12288,
   "forward": 16384,
   "sequence": 0
  },
  {
   "type": "bunker",
   "right": 0,
   "forward": 16384,
   "sequence": 0
  },
  {
   "type": "bunker",
   "right": 12288,
   "forward": 16384,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 32768,
   "forward": 16384,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -30720,
   "forward": 20480,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": 0,
   "forward": 20480,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 30720,
   "forward": 20480,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -16384,
   "forward": 24576,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 16384,
   "forward": 24576,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": -12288,
   "forward": 26624,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 12288,
   "forward": 26624,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": -28672,
   "forward": 28672,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -24576,
   "forward": 28672,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -4096,
   "forward": 28672,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 4096,
   "forward": 28672,
   "sequence": 0
  },
  {
   "type": "tower",
   "right": 24576,
   "forward": 28672,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": 28672,
   "forward": 28672,
   "sequence": 1
  },
  {
   "type": "tower",
   "right": -18432,
   "forward": 4096,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": 22528,
   "forward": 4096,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": -26624,
   "forward": 8192,
   "sequence": 2
  },
  {
   "type": "tower",
   "right": 28672,
   "forward": 8192,
   "sequence": 2
  }
 ]
};

/** Maze by displayed wave number; wave 1 has no surface, waves 21 and up pick randomly among the last six. */
export const MAZE_BY_WAVE: Record<number, string> = {"2": "TBUNK", "3": "TSQUARE", "4": "TCLUSTR", "5": "TTURNON", "6": "TWEDGE", "7": "TDIFF", "8": "TTRAP", "9": "TSYMTRC", "10": "TVALLEY", "11": "TTWRCTY", "12": "T3SQUARE", "13": "T3CLUSTR", "14": "T3TURNON", "15": "T3WEDGE", "16": "T3DIFF", "17": "T3TRAP", "18": "T3SYMTRC", "19": "T3VALLEY", "20": "T3TWRCTY"};

export const RANDOM_MAZES: readonly string[] = ['T3DIFF', 'T3TRAP', 'T3SYMTRC', 'T3VALLEY', 'T3TWRCTY', 'T3WEDGE'];
