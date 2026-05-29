export type SeedTrack = {
  title: string;
  artist: string;
};

export type ArtistSeedEntry = {
  /** Normalised lowercase names for matching. */
  matchNames: string[];
  /** Optional Spotify artist IDs. */
  spotifyIds?: string[];
  tracks: SeedTrack[];
};

export type CollaboratorSeedEntry = {
  matchNames: string[];
  tracks: SeedTrack[];
};

export type GenreSceneSeedEntry = {
  id: string;
  label: string;
  scene?: string;
  /** Keywords matched against artist names, album titles, or node titles. */
  matchKeywords: string[];
  /** Broad family for rabbit-hole fallback filtering. */
  family?: import("./music-family").MusicFamily;
  tracks: SeedTrack[];
};

export const ARTIST_SEEDS: ArtistSeedEntry[] = [
  {
    matchNames: ["deadmau5", "joel zimmerman"],
    spotifyIds: ["2CIMQHInSUUPlPlusV6SWv"],
    tracks: [
      { title: "Ghosts 'n' Stuff", artist: "deadmau5" },
      { title: "I Remember", artist: "deadmau5 ft. Kaskade" },
      { title: "The Veldt", artist: "deadmau5 ft. Chris James" },
      { title: "Raise Your Weapon", artist: "deadmau5" },
      { title: "Faxing Berlin", artist: "deadmau5" },
    ],
  },
  {
    matchNames: ["eric prydz", "prydz"],
    tracks: [
      { title: "Opus", artist: "Eric Prydz" },
      { title: "Pjanoo", artist: "Eric Prydz" },
      { title: "Generate", artist: "Eric Prydz" },
    ],
  },
  {
    matchNames: ["porter robinson"],
    tracks: [
      { title: "Language", artist: "Porter Robinson" },
      { title: "Shelter", artist: "Porter Robinson & Madeon" },
      { title: "Sad Machine", artist: "Porter Robinson" },
    ],
  },
];

export const COLLABORATOR_SEEDS: CollaboratorSeedEntry[] = [
  {
    matchNames: ["kaskade"],
    tracks: [
      { title: "I Remember", artist: "deadmau5 ft. Kaskade" },
      { title: "Move for Me", artist: "Kaskade ft. Haley" },
      { title: "Atmosphere", artist: "Kaskade" },
    ],
  },
  {
    matchNames: ["chris james"],
    tracks: [
      { title: "The Veldt", artist: "deadmau5 ft. Chris James" },
      { title: "Dangerous", artist: "James Blunt" },
    ],
  },
  {
    matchNames: ["joel zimmerman"],
    tracks: [
      { title: "Faxing Berlin", artist: "deadmau5" },
      { title: "Not Exactly", artist: "deadmau5" },
    ],
  },
];

export const GENRE_SCENE_SEEDS: GenreSceneSeedEntry[] = [
  {
    id: "progressive-house",
    label: "Progressive House",
    scene: "Late-2000s festival progressive",
    family: "electronic",
    matchKeywords: [
      "deadmau5",
      "progressive house",
      "strobe",
      "for lack of a better name",
      "ultra",
      "mau5trap",
    ],
    tracks: [
      { title: "Opus", artist: "Eric Prydz" },
      { title: "Language", artist: "Porter Robinson" },
      { title: "Sun & Moon", artist: "Above & Beyond" },
      { title: "Not Going Home", artist: "Eric Prydz" },
      { title: "Innerbloom", artist: "RÜFÜS DU SOL" },
    ],
  },
  {
    id: "electronic-longform",
    label: "Long-form Electronic",
    scene: "Patient builds · cinematic club",
    family: "electronic",
    matchKeywords: ["electronic", "edm", "house", "techno"],
    tracks: [
      { title: "Innerbloom", artist: "RÜFÜS DU SOL" },
      { title: "Horizon", artist: "Tycho" },
      { title: "We Can Make the World Stop", artist: "The Glitch Mob" },
      { title: "Strobe", artist: "deadmau5" },
    ],
  },
  {
    id: "rock-alternative",
    label: "Rock & Alternative",
    scene: "Guitar-forward · arena energy",
    family: "rock",
    matchKeywords: [
      "rock",
      "alternative",
      "indie",
      "killers",
      "arctic monkeys",
      "foo fighters",
      "muse",
      "guitar",
    ],
    tracks: [
      { title: "Everlong", artist: "Foo Fighters" },
      { title: "Do I Wanna Know?", artist: "Arctic Monkeys" },
      { title: "Knights of Cydonia", artist: "Muse" },
      { title: "Seven Nation Army", artist: "The White Stripes" },
    ],
  },
  {
    id: "metal-heavy",
    label: "Metal & Heavy",
    scene: "Distortion · weight · intensity",
    family: "metal",
    matchKeywords: [
      "metal",
      "metallica",
      "heavy",
      "thrash",
      "distortion",
      "puppets",
      "slayer",
      "iron maiden",
    ],
    tracks: [
      { title: "Master of Puppets", artist: "Metallica" },
      { title: "Raining Blood", artist: "Slayer" },
      { title: "The Trooper", artist: "Iron Maiden" },
      { title: "Schism", artist: "TOOL" },
    ],
  },
  {
    id: "pop-mainstream",
    label: "Pop & Mainstream",
    scene: "Hooks · radio · chart energy",
    family: "pop",
    matchKeywords: [
      "pop",
      "taylor swift",
      "dua lipa",
      "ariana",
      "billie",
      "chart",
      "radio",
      "singles",
    ],
    tracks: [
      { title: "Blinding Lights", artist: "The Weeknd" },
      { title: "Levitating", artist: "Dua Lipa" },
      { title: "bad guy", artist: "Billie Eilish" },
      { title: "As It Was", artist: "Harry Styles" },
    ],
  },
  {
    id: "uk-garage-bass",
    label: "UK Garage & Bass",
    scene: "Breaks · sub-bass · late-night club",
    family: "electronic",
    matchKeywords: [
      "overmono",
      "uk garage",
      "garage",
      "bass",
      "breakbeat",
      "jungle",
      "drum and bass",
      "good lies",
    ],
    tracks: [
      { title: "So U Kno", artist: "Overmono" },
      { title: "Diamond Cut", artist: "Overmono" },
      { title: "LSD", artist: "Jamie xx" },
      { title: "Archangel", artist: "Burial" },
      { title: "Inner City Life", artist: "Goldie" },
    ],
  },
  {
    id: "default-fallback",
    label: "Electronic Discovery",
    scene: "Broad electronic palette",
    family: "electronic",
    matchKeywords: [],
    tracks: [
      { title: "Midnight City", artist: "M83" },
      { title: "Teardrop", artist: "Massive Attack" },
      { title: "Breathe", artist: "Télépopmusik" },
    ],
  },
];

export const DEFAULT_GENRE_SEED_ID = "default-fallback";
