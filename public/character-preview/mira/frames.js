window.MIRA_PREVIEW = {
  "version": 2,
  "identity": "mira",
  "status": "approval-prototype",
  "background": "#eeeae0",
  "images": {
    "study": "study.png",
    "motions": "motions.png",
    "walk": "walk.png",
    "walkQuarter": "walk-quarter.png"
  },
  "directions": [
    "SW",
    "NW",
    "NE",
    "SE"
  ],
  "notes": "68 source poses: walking has SW/NW/NE/SE x 8 frames; rotation has four diagonal idle views. Other actions still face E. Opaque cream review sheets, not production RGBA sprites. Rects and anchors use source-image pixels. Fixed scale per clip preserves drawn anticipation/crouching. The walking draft still needs clearer opposite-leg contacts and silhouette cleanup.",
  "clips": {
    "rotation": {
      "image": "motions",
      "fps": 2,
      "nominalHeight": 188,
      "frames": [
        {
          "rect": [
            268,
            12,
            95,
            191
          ],
          "anchor": [
            307,
            201
          ]
        },
        {
          "rect": [
            622,
            10,
            96,
            192
          ],
          "anchor": [
            669,
            201
          ]
        },
        {
          "rect": [
            993,
            10,
            96,
            192
          ],
          "anchor": [
            1048,
            201
          ]
        },
        {
          "rect": [
            1366,
            12,
            100,
            190
          ],
          "anchor": [
            1428,
            201
          ]
        }
      ]
    },
    "idle": {
      "image": "motions",
      "fps": 4,
      "nominalHeight": 188,
      "frames": [
        {
          "rect": [
            54,
            212,
            104,
            194
          ],
          "anchor": [
            122,
            404
          ]
        },
        {
          "rect": [
            240,
            212,
            104,
            194
          ],
          "anchor": [
            308,
            404
          ]
        },
        {
          "rect": [
            425,
            214,
            104,
            192
          ],
          "anchor": [
            494,
            404
          ]
        },
        {
          "rect": [
            610,
            212,
            105,
            194
          ],
          "anchor": [
            680,
            404
          ]
        },
        {
          "rect": [
            795,
            212,
            103,
            194
          ],
          "anchor": [
            865,
            404
          ]
        },
        {
          "rect": [
            980,
            212,
            105,
            194
          ],
          "anchor": [
            1050,
            404
          ]
        },
        {
          "rect": [
            1167,
            212,
            103,
            194
          ],
          "anchor": [
            1236,
            404
          ]
        },
        {
          "rect": [
            1356,
            212,
            104,
            194
          ],
          "anchor": [
            1425,
            404
          ]
        }
      ]
    },
    "work": {
      "image": "motions",
      "fps": 8,
      "nominalHeight": 188,
      "frames": [
        {
          "rect": [
            53,
            418,
            106,
            191
          ],
          "anchor": [
            120,
            608
          ]
        },
        {
          "rect": [
            239,
            418,
            109,
            191
          ],
          "anchor": [
            305,
            608
          ]
        },
        {
          "rect": [
            425,
            420,
            123,
            189
          ],
          "anchor": [
            491,
            608
          ]
        },
        {
          "rect": [
            603,
            408,
            135,
            201
          ],
          "anchor": [
            676,
            608
          ]
        },
        {
          "rect": [
            791,
            420,
            140,
            189
          ],
          "anchor": [
            862,
            608
          ]
        },
        {
          "rect": [
            986,
            428,
            165,
            182
          ],
          "anchor": [
            1050,
            608
          ]
        },
        {
          "rect": [
            1172,
            418,
            125,
            192
          ],
          "anchor": [
            1234,
            608
          ]
        },
        {
          "rect": [
            1360,
            420,
            106,
            189
          ],
          "anchor": [
            1425,
            608
          ]
        }
      ]
    },
    "greet": {
      "image": "motions",
      "fps": 7,
      "nominalHeight": 188,
      "frames": [
        {
          "rect": [
            54,
            619,
            104,
            193
          ],
          "anchor": [
            122,
            810
          ]
        },
        {
          "rect": [
            244,
            619,
            117,
            193
          ],
          "anchor": [
            310,
            810
          ]
        },
        {
          "rect": [
            429,
            618,
            115,
            194
          ],
          "anchor": [
            495,
            810
          ]
        },
        {
          "rect": [
            612,
            618,
            127,
            194
          ],
          "anchor": [
            680,
            810
          ]
        },
        {
          "rect": [
            800,
            618,
            123,
            194
          ],
          "anchor": [
            865,
            810
          ]
        },
        {
          "rect": [
            983,
            622,
            132,
            190
          ],
          "anchor": [
            1050,
            810
          ]
        },
        {
          "rect": [
            1174,
            621,
            107,
            191
          ],
          "anchor": [
            1238,
            810
          ]
        },
        {
          "rect": [
            1360,
            621,
            103,
            191
          ],
          "anchor": [
            1428,
            810
          ]
        }
      ]
    },
    "cargo": {
      "image": "motions",
      "fps": 5,
      "nominalHeight": 188,
      "frames": [
        {
          "rect": [
            43,
            816,
            152,
            187
          ],
          "anchor": [
            117,
            1001
          ]
        },
        {
          "rect": [
            240,
            832,
            134,
            171
          ],
          "anchor": [
            304,
            1001
          ]
        },
        {
          "rect": [
            429,
            850,
            130,
            153
          ],
          "anchor": [
            489,
            1001
          ]
        },
        {
          "rect": [
            610,
            822,
            122,
            180
          ],
          "anchor": [
            676,
            1001
          ]
        },
        {
          "rect": [
            792,
            816,
            128,
            187
          ],
          "anchor": [
            862,
            1001
          ]
        },
        {
          "rect": [
            984,
            839,
            142,
            164
          ],
          "anchor": [
            1050,
            1001
          ]
        },
        {
          "rect": [
            1177,
            854,
            134,
            149
          ],
          "anchor": [
            1237,
            1001
          ]
        },
        {
          "rect": [
            1353,
            816,
            151,
            187
          ],
          "anchor": [
            1421,
            1001
          ]
        }
      ]
    },
    "walk": {
      "image": "walkQuarter",
      "fps": 10,
      "nominalHeight": 240,
      "frames": [
        {
          "rect": [
            42,
            14,
            139,
            245
          ],
          "anchor": [
            109,
            256
          ]
        },
        {
          "rect": [
            234,
            14,
            135,
            245
          ],
          "anchor": [
            298,
            256
          ]
        },
        {
          "rect": [
            429,
            12,
            128,
            247
          ],
          "anchor": [
            485,
            256
          ]
        },
        {
          "rect": [
            601,
            14,
            137,
            245
          ],
          "anchor": [
            670,
            256
          ]
        },
        {
          "rect": [
            792,
            14,
            138,
            245
          ],
          "anchor": [
            861,
            256
          ]
        },
        {
          "rect": [
            984,
            13,
            134,
            246
          ],
          "anchor": [
            1047,
            256
          ]
        },
        {
          "rect": [
            1173,
            12,
            134,
            247
          ],
          "anchor": [
            1232,
            256
          ]
        },
        {
          "rect": [
            1355,
            13,
            140,
            246
          ],
          "anchor": [
            1422,
            256
          ]
        }
      ],
      "facings": {
        "SW": [
          {
            "rect": [
              42,
              14,
              139,
              245
            ],
            "anchor": [
              109,
              256
            ]
          },
          {
            "rect": [
              234,
              14,
              135,
              245
            ],
            "anchor": [
              298,
              256
            ]
          },
          {
            "rect": [
              429,
              12,
              128,
              247
            ],
            "anchor": [
              485,
              256
            ]
          },
          {
            "rect": [
              601,
              14,
              137,
              245
            ],
            "anchor": [
              670,
              256
            ]
          },
          {
            "rect": [
              792,
              14,
              138,
              245
            ],
            "anchor": [
              861,
              256
            ]
          },
          {
            "rect": [
              984,
              13,
              134,
              246
            ],
            "anchor": [
              1047,
              256
            ]
          },
          {
            "rect": [
              1173,
              12,
              134,
              247
            ],
            "anchor": [
              1232,
              256
            ]
          },
          {
            "rect": [
              1355,
              13,
              140,
              246
            ],
            "anchor": [
              1422,
              256
            ]
          }
        ],
        "NW": [
          {
            "rect": [
              42,
              261,
              141,
              245
            ],
            "anchor": [
              103,
              503
            ]
          },
          {
            "rect": [
              233,
              262,
              142,
              244
            ],
            "anchor": [
              297,
              503
            ]
          },
          {
            "rect": [
              427,
              265,
              136,
              241
            ],
            "anchor": [
              486,
              503
            ]
          },
          {
            "rect": [
              605,
              262,
              140,
              244
            ],
            "anchor": [
              665,
              503
            ]
          },
          {
            "rect": [
              791,
              262,
              141,
              244
            ],
            "anchor": [
              851,
              503
            ]
          },
          {
            "rect": [
              987,
              263,
              137,
              243
            ],
            "anchor": [
              1047,
              503
            ]
          },
          {
            "rect": [
              1175,
              265,
              136,
              241
            ],
            "anchor": [
              1234,
              503
            ]
          },
          {
            "rect": [
              1354,
              262,
              144,
              244
            ],
            "anchor": [
              1415,
              503
            ]
          }
        ],
        "NE": [
          {
            "rect": [
              42,
              510,
              137,
              245
            ],
            "anchor": [
              120,
              752
            ]
          },
          {
            "rect": [
              233,
              510,
              141,
              245
            ],
            "anchor": [
              311,
              752
            ]
          },
          {
            "rect": [
              426,
              511,
              132,
              244
            ],
            "anchor": [
              502,
              752
            ]
          },
          {
            "rect": [
              608,
              510,
              141,
              245
            ],
            "anchor": [
              689,
              752
            ]
          },
          {
            "rect": [
              791,
              510,
              145,
              245
            ],
            "anchor": [
              877,
              752
            ]
          },
          {
            "rect": [
              983,
              510,
              139,
              245
            ],
            "anchor": [
              1061,
              752
            ]
          },
          {
            "rect": [
              1169,
              510,
              130,
              245
            ],
            "anchor": [
              1248,
              752
            ]
          },
          {
            "rect": [
              1355,
              510,
              139,
              245
            ],
            "anchor": [
              1436,
              752
            ]
          }
        ],
        "SE": [
          {
            "rect": [
              31,
              757,
              142,
              243
            ],
            "anchor": [
              106,
              997
            ]
          },
          {
            "rect": [
              217,
              757,
              136,
              243
            ],
            "anchor": [
              291,
              997
            ]
          },
          {
            "rect": [
              407,
              756,
              128,
              244
            ],
            "anchor": [
              480,
              997
            ]
          },
          {
            "rect": [
              591,
              757,
              141,
              243
            ],
            "anchor": [
              667,
              997
            ]
          },
          {
            "rect": [
              782,
              757,
              141,
              243
            ],
            "anchor": [
              859,
              997
            ]
          },
          {
            "rect": [
              971,
              756,
              140,
              244
            ],
            "anchor": [
              1047,
              997
            ]
          },
          {
            "rect": [
              1163,
              757,
              132,
              243
            ],
            "anchor": [
              1236,
              997
            ]
          },
          {
            "rect": [
              1345,
              757,
              139,
              243
            ],
            "anchor": [
              1418,
              997
            ]
          }
        ]
      }
    }
  }
};
