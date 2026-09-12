/**
 * Alien choreography from the original's tables: the scripts every TIE and
 * Darth's Ship follow, the level lists and wave sets that pick them, and the
 * start spots. Data only, generated from the object tables; do not edit by hand.
 */

export type FlagName = "RL" | "RR" | "PU" | "PD" | "YR" | "YL" | "T9" | "T0" | "MD" | "MD2" | "MD3" | "MU" | "MU2" | "MU3" | "MF" | "MF2" | "MF3";
export type StatusName = "hit" | "damaged" | "playerInSights" | "playerAhead" | "random1" | "random2" | "fired" | "playerNear" | "playerAimingAtMe" | "inView" | "playerMid";
export type RomOp =
  | { op: "ct"; frames: number; flags: FlagName[] }
  | { op: "until"; mask: StatusName[] }
  | { op: "if"; mask: StatusName[] }
  | { op: "goto"; target: number }
  | { op: "gosub"; target: number }
  | { op: "return" };

/** The whole choreography program; goto/gosub targets are indices into it. */
export const PROGRAM: readonly RomOp[] = [
  { op: "gosub", target: 193 },
  { op: "ct", frames: 67, flags: ["MF"] },
  { op: "ct", frames: 67, flags: ["MF2"] },
  { op: "ct", frames: 35, flags: ["PU", "MF"] },
  { op: "until", mask: ["playerInSights"] },
  { op: "ct", frames: 35, flags: ["T0"] },
  { op: "until", mask: ["playerNear"] },
  { op: "ct", frames: 67, flags: ["RL", "T0", "MF"] },
  { op: "until", mask: ["playerInSights"] },
  { op: "ct", frames: 35, flags: ["T0"] },
  { op: "until", mask: [] },
  { op: "goto", target: 42 },
  { op: "gosub", target: 193 },
  { op: "ct", frames: 67, flags: ["RR", "MF2"] },
  { op: "ct", frames: 35, flags: ["YR", "MF"] },
  { op: "until", mask: ["playerInSights"] },
  { op: "ct", frames: 35, flags: ["YR", "T0", "MF"] },
  { op: "until", mask: [] },
  { op: "ct", frames: 67, flags: ["RR", "MF"] },
  { op: "until", mask: ["playerInSights"] },
  { op: "ct", frames: 35, flags: ["YR", "T0", "MF"] },
  { op: "until", mask: [] },
  { op: "ct", frames: 35, flags: ["RR", "MF2"] },
  { op: "until", mask: ["playerInSights"] },
  { op: "ct", frames: 35, flags: ["YR", "T0", "MF"] },
  { op: "until", mask: [] },
  { op: "goto", target: 42 },
  { op: "gosub", target: 193 },
  { op: "ct", frames: 67, flags: ["RL", "MF2"] },
  { op: "ct", frames: 35, flags: ["YL", "MF"] },
  { op: "until", mask: ["playerInSights"] },
  { op: "ct", frames: 35, flags: ["YL", "T0", "MF"] },
  { op: "until", mask: [] },
  { op: "ct", frames: 67, flags: ["RL", "MF"] },
  { op: "until", mask: ["playerInSights"] },
  { op: "ct", frames: 35, flags: ["YL", "T0", "MF"] },
  { op: "until", mask: [] },
  { op: "ct", frames: 35, flags: ["RL", "MF2"] },
  { op: "until", mask: ["playerInSights"] },
  { op: "ct", frames: 35, flags: ["YL", "T0", "MF"] },
  { op: "until", mask: [] },
  { op: "goto", target: 42 },
  { op: "until", mask: ["playerInSights", "fired"] },
  { op: "ct", frames: 35, flags: ["RR", "T0", "MF2"] },
  { op: "until", mask: ["fired"] },
  { op: "ct", frames: 35, flags: ["RL", "MF2"] },
  { op: "goto", target: 42 },
  { op: "until", mask: [] },
  { op: "ct", frames: 19, flags: ["MU2"] },
  { op: "goto", target: 42 },
  { op: "gosub", target: 193 },
  { op: "ct", frames: 35, flags: ["MF", "MU"] },
  { op: "ct", frames: 35, flags: ["MF", "MD"] },
  { op: "ct", frames: 35, flags: ["MF", "MU"] },
  { op: "ct", frames: 35, flags: ["MF", "MD"] },
  { op: "ct", frames: 35, flags: ["PU", "MF"] },
  { op: "until", mask: ["playerInSights"] },
  { op: "ct", frames: 35, flags: ["T0"] },
  { op: "until", mask: [] },
  { op: "ct", frames: 35, flags: ["MF", "MU"] },
  { op: "ct", frames: 35, flags: ["MF", "MD"] },
  { op: "ct", frames: 67, flags: ["T0", "MF", "MU"] },
  { op: "ct", frames: 35, flags: ["MF", "MU"] },
  { op: "ct", frames: 35, flags: ["MF", "MD"] },
  { op: "until", mask: ["playerInSights"] },
  { op: "ct", frames: 35, flags: ["T0", "MU"] },
  { op: "until", mask: [] },
  { op: "goto", target: 89 },
  { op: "gosub", target: 193 },
  { op: "ct", frames: 19, flags: ["MF", "MU2"] },
  { op: "ct", frames: 19, flags: ["MF", "MD2"] },
  { op: "ct", frames: 19, flags: ["MF2", "MU2"] },
  { op: "ct", frames: 19, flags: ["MF2", "MD2"] },
  { op: "until", mask: ["playerInSights"] },
  { op: "ct", frames: 35, flags: ["T0", "MF", "MD"] },
  { op: "until", mask: [] },
  { op: "until", mask: ["playerInSights"] },
  { op: "ct", frames: 35, flags: ["T0", "MF", "MU"] },
  { op: "until", mask: [] },
  { op: "goto", target: 89 },
  { op: "gosub", target: 193 },
  { op: "ct", frames: 19, flags: ["MF", "MU2"] },
  { op: "ct", frames: 19, flags: ["MF", "MD2"] },
  { op: "ct", frames: 19, flags: ["MF2", "MU2"] },
  { op: "ct", frames: 19, flags: ["MF2", "MD2"] },
  { op: "until", mask: ["playerInSights"] },
  { op: "ct", frames: 35, flags: ["T0", "MF", "MD"] },
  { op: "until", mask: [] },
  { op: "goto", target: 89 },
  { op: "until", mask: ["playerInSights", "fired"] },
  { op: "ct", frames: 35, flags: ["RR", "T0", "MF2"] },
  { op: "until", mask: ["fired"] },
  { op: "ct", frames: 35, flags: ["RR", "MF2"] },
  { op: "goto", target: 89 },
  { op: "until", mask: [] },
  { op: "ct", frames: 19, flags: ["MU2"] },
  { op: "until", mask: ["playerNear"] },
  { op: "ct", frames: 127, flags: ["RR", "T0", "MF"] },
  { op: "until", mask: [] },
  { op: "ct", frames: 35, flags: ["RR", "T0", "MU2"] },
  { op: "ct", frames: 35, flags: ["RL", "T0", "MD2"] },
  { op: "ct", frames: 35, flags: ["RL", "T0", "MU2"] },
  { op: "ct", frames: 35, flags: ["RR", "T0", "MD2"] },
  { op: "goto", target: 89 },
  { op: "gosub", target: 193 },
  { op: "ct", frames: 19, flags: ["MF", "MU"] },
  { op: "ct", frames: 19, flags: ["MF", "MD"] },
  { op: "ct", frames: 19, flags: ["MF", "MU"] },
  { op: "ct", frames: 19, flags: ["MF", "MD"] },
  { op: "ct", frames: 35, flags: ["PU", "MF"] },
  { op: "until", mask: ["playerInSights"] },
  { op: "ct", frames: 35, flags: ["T0"] },
  { op: "until", mask: [] },
  { op: "until", mask: ["playerInSights"] },
  { op: "ct", frames: 35, flags: ["T0", "MU"] },
  { op: "until", mask: [] },
  { op: "gosub", target: 193 },
  { op: "ct", frames: 35, flags: ["RR", "T0", "MF", "MU"] },
  { op: "ct", frames: 35, flags: ["RR", "T0", "MF2", "MU"] },
  { op: "ct", frames: 35, flags: ["YR", "MF", "MU"] },
  { op: "until", mask: ["playerInSights"] },
  { op: "ct", frames: 35, flags: ["YR", "T0", "MF", "MU"] },
  { op: "until", mask: [] },
  { op: "goto", target: 132 },
  { op: "gosub", target: 193 },
  { op: "ct", frames: 35, flags: ["RL", "T0", "MF", "MU"] },
  { op: "ct", frames: 35, flags: ["RL", "T0", "MF2", "MU"] },
  { op: "ct", frames: 35, flags: ["YL", "MF", "MU"] },
  { op: "until", mask: ["playerInSights"] },
  { op: "ct", frames: 35, flags: ["YL", "T0", "MF", "MU"] },
  { op: "until", mask: [] },
  { op: "goto", target: 132 },
  { op: "until", mask: ["playerInSights", "fired"] },
  { op: "ct", frames: 35, flags: ["RR", "T0", "MF2", "MU"] },
  { op: "until", mask: ["fired"] },
  { op: "ct", frames: 35, flags: ["RL", "MF2"] },
  { op: "goto", target: 132 },
  { op: "until", mask: [] },
  { op: "ct", frames: 19, flags: ["MD2"] },
  { op: "goto", target: 132 },
  { op: "gosub", target: 193 },
  { op: "until", mask: ["playerNear"] },
  { op: "ct", frames: 127, flags: ["RR", "T0", "MF", "MU2"] },
  { op: "until", mask: [] },
  { op: "ct", frames: 127, flags: ["RR", "T0", "MU2"] },
  { op: "ct", frames: 127, flags: ["RR", "T0", "MU2"] },
  { op: "ct", frames: 127, flags: ["RR", "T0", "MU2"] },
  { op: "ct", frames: 127, flags: ["RR", "T0", "MU2"] },
  { op: "until", mask: ["playerInSights"] },
  { op: "ct", frames: 35, flags: ["RL", "T0", "MU2"] },
  { op: "until", mask: [] },
  { op: "goto", target: 212 },
  { op: "gosub", target: 193 },
  { op: "until", mask: ["playerNear"] },
  { op: "ct", frames: 127, flags: ["RR", "T0", "MF", "MU2"] },
  { op: "until", mask: [] },
  { op: "ct", frames: 67, flags: ["RL", "T0", "MU2"] },
  { op: "if", mask: ["random1"] },
  { op: "ct", frames: 35, flags: ["RR", "T0", "MU2"] },
  { op: "if", mask: [] },
  { op: "ct", frames: 67, flags: ["RL", "T0", "MU2"] },
  { op: "if", mask: ["random1"] },
  { op: "ct", frames: 35, flags: ["RL", "T0", "MU2"] },
  { op: "if", mask: [] },
  { op: "ct", frames: 67, flags: ["RL", "T0", "MU2"] },
  { op: "until", mask: ["playerInSights"] },
  { op: "ct", frames: 35, flags: ["RR", "T0", "MU2"] },
  { op: "until", mask: [] },
  { op: "goto", target: 212 },
  { op: "gosub", target: 193 },
  { op: "until", mask: ["playerNear"] },
  { op: "ct", frames: 11, flags: ["T0", "MF", "MU2"] },
  { op: "ct", frames: 11, flags: ["T0", "MF", "MD2"] },
  { op: "ct", frames: 11, flags: ["T0", "MF", "MU2"] },
  { op: "ct", frames: 11, flags: ["T0", "MF", "MD2"] },
  { op: "ct", frames: 11, flags: ["T0", "MF", "MU2"] },
  { op: "ct", frames: 11, flags: ["T0", "MF", "MD2"] },
  { op: "ct", frames: 11, flags: ["T0", "MF", "MU2"] },
  { op: "ct", frames: 11, flags: ["T0", "MF", "MD2"] },
  { op: "until", mask: [] },
  { op: "until", mask: ["hit"] },
  { op: "ct", frames: 35, flags: ["T0", "YL", "YR", "MU2"] },
  { op: "ct", frames: 35, flags: ["T0", "PU", "PD", "MU2"] },
  { op: "ct", frames: 35, flags: ["T0", "YL", "YR", "MD2"] },
  { op: "ct", frames: 35, flags: ["T0", "PU", "PD", "MD2"] },
  { op: "ct", frames: 35, flags: ["T0", "YL", "YR", "MU2"] },
  { op: "ct", frames: 35, flags: ["T0", "PU", "PD", "MU2"] },
  { op: "ct", frames: 35, flags: ["T0", "YL", "YR", "MD2"] },
  { op: "ct", frames: 35, flags: ["T0", "PU", "PD", "MD2"] },
  { op: "until", mask: ["playerInSights"] },
  { op: "ct", frames: 35, flags: ["RL", "T0", "MF"] },
  { op: "until", mask: [] },
  { op: "goto", target: 212 },
  { op: "ct", frames: 7, flags: ["T0", "MF"] },
  { op: "if", mask: ["random1"] },
  { op: "goto", target: 202 },
  { op: "if", mask: ["random2"] },
  { op: "ct", frames: 35, flags: ["T0", "MF3", "MU3"] },
  { op: "goto", target: 208 },
  { op: "if", mask: [] },
  { op: "ct", frames: 35, flags: ["T0", "MF3", "MD3"] },
  { op: "goto", target: 208 },
  { op: "if", mask: ["random2"] },
  { op: "ct", frames: 35, flags: ["T0", "RR", "MF3", "MU3"] },
  { op: "goto", target: 208 },
  { op: "if", mask: [] },
  { op: "ct", frames: 35, flags: ["T0", "RR", "MF3", "MD3"] },
  { op: "goto", target: 208 },
  { op: "if", mask: ["random2"] },
  { op: "ct", frames: 35, flags: ["T9", "RL", "MF2"] },
  { op: "if", mask: [] },
  { op: "return" },
  { op: "ct", frames: 19, flags: ["MU2"] },
  { op: "until", mask: ["playerNear"] },
  { op: "ct", frames: 67, flags: ["RL", "T0", "MF2"] },
  { op: "until", mask: ["playerInSights", "fired"] },
  { op: "ct", frames: 35, flags: ["RR", "T0", "MF2"] },
  { op: "until", mask: ["fired"] },
  { op: "ct", frames: 35, flags: ["RL", "MF"] },
  { op: "until", mask: [] },
  { op: "until", mask: ["playerNear", "playerAimingAtMe"] },
  { op: "ct", frames: 67, flags: ["RL", "T0", "MF2"] },
  { op: "until", mask: ["playerInSights", "fired", "playerAimingAtMe"] },
  { op: "ct", frames: 35, flags: ["RR", "T0", "MF2"] },
  { op: "until", mask: ["fired", "playerAimingAtMe"] },
  { op: "ct", frames: 35, flags: ["RL", "MF"] },
  { op: "until", mask: [] },
  { op: "if", mask: ["playerAimingAtMe"] },
  { op: "goto", target: 231 },
  { op: "if", mask: [] },
  { op: "goto", target: 212 },
  { op: "if", mask: ["random1"] },
  { op: "ct", frames: 35, flags: ["RR", "MU2"] },
  { op: "goto", target: 212 },
  { op: "if", mask: [] },
  { op: "ct", frames: 35, flags: ["RL", "MF2"] },
  { op: "goto", target: 212 }
];

/** Script entry points by the original's label names. */
export const ENTRY: Record<string, number> = {
  "TCH2A1": 0,
  "TCH1A1": 1,
  "TCH2A2": 12,
  "TCH1A2": 13,
  "TCH2A3": 27,
  "TCH1A3": 28,
  "TCH1AZ": 42,
  "TCH2B1": 50,
  "TCH1B1": 51,
  "TCH2B2": 68,
  "TCH1B2": 69,
  "TCH2B3": 80,
  "TCH1B3": 81,
  "TCH1BZ": 89,
  "TCH2C1": 104,
  "TCH1C1": 105,
  "TCH2C2": 116,
  "TCH1C2": 117,
  "TCH2C3": 124,
  "TCH1C3": 125,
  "TCH1CZ": 132,
  "TCH2D1": 140,
  "TCH1D1": 141,
  "TCH2D2": 152,
  "TCH1D2": 153,
  "TCH2D3": 169,
  "TCH1D3": 170,
  "SPLIT": 193,
  "TCH1DZ": 212
};

export const START_SPOTS: Record<string, { x: number; y: number; z: number }> = {
  "TBG1A1": {
    "x": 31744,
    "y": 0,
    "z": 1024
  },
  "TBG1A2": {
    "x": 31744,
    "y": -1024,
    "z": 0
  },
  "TBG1A3": {
    "x": 31744,
    "y": 1024,
    "z": 0
  },
  "TBG1B1": {
    "x": 31744,
    "y": 0,
    "z": 1024
  },
  "TBG1B2": {
    "x": 31744,
    "y": -1024,
    "z": 0
  },
  "TBG1B3": {
    "x": 31744,
    "y": 1024,
    "z": 0
  },
  "TBG1C1": {
    "x": 31744,
    "y": 0,
    "z": 1024
  },
  "TBG1C2": {
    "x": 31744,
    "y": -1024,
    "z": 0
  },
  "TBG1C3": {
    "x": 31744,
    "y": 1024,
    "z": 0
  },
  "TBG1D1": {
    "x": 31744,
    "y": -2048,
    "z": 0
  },
  "TBG1D2": {
    "x": 31744,
    "y": 2048,
    "z": 0
  },
  "TBG1D3": {
    "x": 31744,
    "y": 0,
    "z": 2048
  }
};

export const LEVEL_LISTS: Record<string, { kind: "tie" | "darth"; spot: string; script: string }[]> = {
  "TWV1A": [
    {
      "kind": "tie",
      "spot": "TBG1A1",
      "script": "TCH1A1"
    },
    {
      "kind": "tie",
      "spot": "TBG1A2",
      "script": "TCH1A2"
    },
    {
      "kind": "tie",
      "spot": "TBG1A3",
      "script": "TCH1A3"
    }
  ],
  "TWV1B": [
    {
      "kind": "tie",
      "spot": "TBG1B1",
      "script": "TCH1B1"
    },
    {
      "kind": "tie",
      "spot": "TBG1B2",
      "script": "TCH1B2"
    },
    {
      "kind": "tie",
      "spot": "TBG1B3",
      "script": "TCH1B3"
    }
  ],
  "TWV1C": [
    {
      "kind": "tie",
      "spot": "TBG1C1",
      "script": "TCH1C1"
    },
    {
      "kind": "tie",
      "spot": "TBG1C2",
      "script": "TCH1C2"
    },
    {
      "kind": "tie",
      "spot": "TBG1C3",
      "script": "TCH1C3"
    }
  ],
  "TWV1D": [
    {
      "kind": "tie",
      "spot": "TBG1D1",
      "script": "TCH1D1"
    },
    {
      "kind": "tie",
      "spot": "TBG1D2",
      "script": "TCH1D2"
    },
    {
      "kind": "tie",
      "spot": "TBG1D3",
      "script": "TCH1D3"
    }
  ],
  "TRTH1D": [
    {
      "kind": "tie",
      "spot": "TBG1D1",
      "script": "TCH1D1"
    },
    {
      "kind": "tie",
      "spot": "TBG1D2",
      "script": "TCH1D2"
    },
    {
      "kind": "darth",
      "spot": "TBG1D3",
      "script": "TCH1D3"
    }
  ],
  "TWV2A": [
    {
      "kind": "tie",
      "spot": "TBG1A1",
      "script": "TCH2A1"
    },
    {
      "kind": "tie",
      "spot": "TBG1A2",
      "script": "TCH2A2"
    },
    {
      "kind": "tie",
      "spot": "TBG1A3",
      "script": "TCH2A3"
    }
  ],
  "TWV2B": [
    {
      "kind": "tie",
      "spot": "TBG1B1",
      "script": "TCH2B1"
    },
    {
      "kind": "tie",
      "spot": "TBG1B2",
      "script": "TCH2B2"
    },
    {
      "kind": "tie",
      "spot": "TBG1B3",
      "script": "TCH2B3"
    }
  ],
  "TWV2C": [
    {
      "kind": "tie",
      "spot": "TBG1C1",
      "script": "TCH2C1"
    },
    {
      "kind": "tie",
      "spot": "TBG1C2",
      "script": "TCH2C2"
    },
    {
      "kind": "tie",
      "spot": "TBG1C3",
      "script": "TCH2C3"
    }
  ],
  "TWV2D": [
    {
      "kind": "tie",
      "spot": "TBG1D1",
      "script": "TCH2D1"
    },
    {
      "kind": "tie",
      "spot": "TBG1D2",
      "script": "TCH2D2"
    },
    {
      "kind": "tie",
      "spot": "TBG1D3",
      "script": "TCH2D3"
    }
  ],
  "TWV2Z": [
    {
      "kind": "tie",
      "spot": "TBG1A1",
      "script": "TCH2A1"
    },
    {
      "kind": "tie",
      "spot": "TBG1A2",
      "script": "TCH2A2"
    },
    {
      "kind": "tie",
      "spot": "TBG1A3",
      "script": "TCH2A3"
    },
    {
      "kind": "tie",
      "spot": "TBG1D1",
      "script": "TCH2D1"
    },
    {
      "kind": "tie",
      "spot": "TBG1D2",
      "script": "TCH2D2"
    },
    {
      "kind": "tie",
      "spot": "TBG1D3",
      "script": "TCH2D3"
    },
    {
      "kind": "tie",
      "spot": "TBG1B1",
      "script": "TCH2B1"
    },
    {
      "kind": "tie",
      "spot": "TBG1B2",
      "script": "TCH2B2"
    },
    {
      "kind": "tie",
      "spot": "TBG1B3",
      "script": "TCH2B3"
    },
    {
      "kind": "tie",
      "spot": "TBG1D1",
      "script": "TCH2D1"
    },
    {
      "kind": "tie",
      "spot": "TBG1D2",
      "script": "TCH2D2"
    },
    {
      "kind": "tie",
      "spot": "TBG1D3",
      "script": "TCH2D3"
    },
    {
      "kind": "tie",
      "spot": "TBG1C1",
      "script": "TCH2C1"
    },
    {
      "kind": "tie",
      "spot": "TBG1C2",
      "script": "TCH2C2"
    },
    {
      "kind": "tie",
      "spot": "TBG1C3",
      "script": "TCH2C3"
    },
    {
      "kind": "tie",
      "spot": "TBG1D1",
      "script": "TCH2D1"
    },
    {
      "kind": "tie",
      "spot": "TBG1D2",
      "script": "TCH2D2"
    },
    {
      "kind": "tie",
      "spot": "TBG1D3",
      "script": "TCH2D3"
    }
  ]
};

/** Wave sets: level list names per wave (0 = displayed wave 1); waves 6+ use set 5 when even and set 6 when odd. */
export const WAVE_SETS: string[][] = [["TWV1A", "TWV2B", "TWV2C", "TWV2Z"], ["TWV1B", "TRTH1D", "TWV2D", "TWV2C", "TWV2Z"], ["TWV1C", "TRTH1D", "TWV2D", "TWV2A", "TWV2B", "TWV2C", "TWV2Z"], ["TRTH1D", "TWV2D", "TWV2A", "TWV2B", "TWV2C", "TWV2Z"], ["TWV1D", "TRTH1D", "TWV2C", "TWV2D", "TWV2B", "TWV2Z"], ["TRTH1D", "TWV2D", "TWV2B", "TWV2D", "TWV2C", "TWV2Z"]];
