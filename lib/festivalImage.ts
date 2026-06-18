export type FestivalImageConfig = {
  url: string;
  gradient: string;
  mood: string;
  moodEn: string;
  overlayStrength: number;
};

export function getMood(config: FestivalImageConfig, lang: "en" | "fr" = "en"): string {
  return lang === "fr" ? config.mood : config.moodEn;
}

type GenrePool = {
  urls: string[];
  gradient: string;
  mood: string;
  moodEn: string;
  overlayStrength: number;
};

function u(id: string) {
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=75`;
}

const GENRE_POOLS: Record<string, GenrePool> = {
  Electronic: {
    urls: [
      u("photo-1598387993441-a364f854c3e1"),
      u("photo-1536440136628-849c177e76a1"),
      u("photo-1563841930606-67e2bce48b78"),
      u("photo-1470225620780-dba8ba36b745"),
    ],
    gradient: "linear-gradient(160deg, #0f0c29 0%, #302b63 60%, #24243e 100%)",
    mood: "Immersif · Hypnotique · Électrique",
    moodEn: "Immersive · Hypnotic · Electric",
    overlayStrength: 0.55,
  },
  Techno: {
    urls: [
      u("photo-1529973625058-a665431328fb"),
      u("photo-1478720568477-152d9b164e26"),
      u("photo-1524650359799-842906ca1c06"),
    ],
    gradient: "linear-gradient(160deg, #0a0a0a 0%, #1a0a30 60%, #0a1030 100%)",
    mood: "Sombre · Pulsant · Sans frontières",
    moodEn: "Dark · Pulsing · Borderless",
    overlayStrength: 0.7,
  },
  Jazz: {
    urls: [
      u("photo-1415201364774-f6f0bb35f28f"),
      u("photo-1528360983277-13d401cdc186"),
      u("photo-1467810563316-b5476525c0f9"),
    ],
    gradient: "linear-gradient(160deg, #1a0a00 0%, #5C2E00 55%, #8B6914 100%)",
    mood: "Soulful · Vivant · Intemporel",
    moodEn: "Soulful · Live · Timeless",
    overlayStrength: 0.5,
  },
  Rock: {
    urls: [
      u("photo-1458560871784-56d23406c091"),
      u("photo-1501386761578-eac5c94b800a"),
      u("photo-1526142684086-7ebd69df27a5"),
      u("photo-1489599849927-2ee91cede3ba"),
    ],
    gradient: "linear-gradient(160deg, #1a0010 0%, #6B0000 60%, #200122 100%)",
    mood: "Brut · Fort · Inoubliable",
    moodEn: "Raw · Loud · Unforgettable",
    overlayStrength: 0.6,
  },
  Metal: {
    urls: [
      u("photo-1493676304819-0d7a8d026dcf"),
      u("photo-1458560871784-56d23406c091"),
      u("photo-1499364615650-ec38552f4f34"),
    ],
    gradient: "linear-gradient(160deg, #0a0a0a 0%, #1a1010 100%)",
    mood: "Intense · Cathartique · Sans compromis",
    moodEn: "Intense · Cathartic · Uncompromising",
    overlayStrength: 0.7,
  },
  Classical: {
    urls: [
      u("photo-1507838153414-b4b713384a76"),
      u("photo-1484755560615-a4c64e778a6c"),
    ],
    gradient: "linear-gradient(160deg, #0f2027 0%, #203a43 55%, #2c5364 100%)",
    mood: "Précision · Émotion · Beauté pure",
    moodEn: "Precision · Emotion · Pure beauty",
    overlayStrength: 0.45,
  },
  Folk: {
    urls: [
      u("photo-1510915361894-db8b60106cb1"),
      u("photo-1499364615650-ec38552f4f34"),
      u("photo-1493225457124-a3eb161ffa5f"),
    ],
    gradient: "linear-gradient(160deg, #1a2a10 0%, #2d5016 55%, #4a7c3f 100%)",
    mood: "Ancré · Sincère · Humain",
    moodEn: "Rooted · Honest · Human",
    overlayStrength: 0.5,
  },
  Pop: {
    urls: [
      u("photo-1493225457124-a3eb161ffa5f"),
      u("photo-1541339907198-e08756dedf3f"),
      u("photo-1526142684086-7ebd69df27a5"),
    ],
    gradient: "linear-gradient(160deg, #200050 0%, #6f00d2 55%, #d400d4 100%)",
    mood: "Accrocheur · Lumineux · Contagieux",
    moodEn: "Catchy · Bright · Infectious",
    overlayStrength: 0.5,
  },
  "Hip-Hop": {
    urls: [
      u("photo-1568702846914-96b305d2aaeb"),
      u("photo-1553361371-9b22f78e8b1d"),
      u("photo-1489599849927-2ee91cede3ba"),
    ],
    gradient: "linear-gradient(160deg, #0a0a0a 0%, #1a1a1a 55%, #2a2a2a 100%)",
    mood: "Culture · Flow · Authenticité",
    moodEn: "Culture · Flow · Authenticity",
    overlayStrength: 0.65,
  },
  Rap: {
    urls: [
      u("photo-1568702846914-96b305d2aaeb"),
      u("photo-1553361371-9b22f78e8b1d"),
    ],
    gradient: "linear-gradient(160deg, #0a0a0a 0%, #1a1a2e 100%)",
    mood: "Texte · Énergie · Vérité",
    moodEn: "Lyrics · Energy · Truth",
    overlayStrength: 0.65,
  },
  "R&B": {
    urls: [
      u("photo-1516450360452-9312f5e86fc7"),
      u("photo-1524650359799-842906ca1c06"),
      u("photo-1467810563316-b5476525c0f9"),
    ],
    gradient: "linear-gradient(160deg, #1a0030 0%, #4a0060 55%, #7B0080 100%)",
    mood: "Velouté · Profond · Enveloppant",
    moodEn: "Silky · Deep · Enveloping",
    overlayStrength: 0.5,
  },
  Reggae: {
    urls: [
      u("photo-1505236858219-8359eb29e329"),
      u("photo-1533928298208-27ff66555d8d"),
    ],
    gradient: "linear-gradient(160deg, #004000 0%, #006600 55%, #c8a000 100%)",
    mood: "Racines · Vibration · Liberté",
    moodEn: "Roots · Vibration · Freedom",
    overlayStrength: 0.45,
  },
  "World Music": {
    urls: [
      u("photo-1533928298208-27ff66555d8d"),
      u("photo-1528360983277-13d401cdc186"),
      u("photo-1516450360452-9312f5e86fc7"),
    ],
    gradient: "linear-gradient(160deg, #1a0a00 0%, #8B1A4A 55%, #2c1654 100%)",
    mood: "Global · Riche · Vivant",
    moodEn: "Global · Rich · Alive",
    overlayStrength: 0.5,
  },
  "Musique du monde": {
    urls: [
      u("photo-1533928298208-27ff66555d8d"),
      u("photo-1516450360452-9312f5e86fc7"),
    ],
    gradient: "linear-gradient(160deg, #1a0a00 0%, #8B1A4A 55%, #2c1654 100%)",
    mood: "Global · Riche · Vivant",
    moodEn: "Global · Rich · Alive",
    overlayStrength: 0.5,
  },
  "Multi-Genre": {
    urls: [
      u("photo-1540039155733-5bb30b53aa14"),
      u("photo-1541339907198-e08756dedf3f"),
      u("photo-1598387993441-a364f854c3e1"),
      u("photo-1501386761578-eac5c94b800a"),
    ],
    gradient: "linear-gradient(160deg, #1a1060 0%, #4a0060 40%, #9B1060 100%)",
    mood: "Éclectique · Ouvert · Festif",
    moodEn: "Eclectic · Open · Festive",
    overlayStrength: 0.5,
  },
  Country: {
    urls: [
      u("photo-1459749411175-04bf5292ceea"),
      u("photo-1499364615650-ec38552f4f34"),
      u("photo-1510915361894-db8b60106cb1"),
    ],
    gradient: "linear-gradient(160deg, #2a1500 0%, #6B3500 55%, #c87000 100%)",
    mood: "Racines · Chaleur · Communauté",
    moodEn: "Roots · Warmth · Community",
    overlayStrength: 0.5,
  },
};

const DEFAULT_POOL: GenrePool = {
  urls: [
    u("photo-1470229722913-7c0e2dbbafd3"),
    u("photo-1526142684086-7ebd69df27a5"),
    u("photo-1489599849927-2ee91cede3ba"),
    u("photo-1501386761578-eac5c94b800a"),
  ],
  gradient: "linear-gradient(160deg, #1a1a2e 0%, #16213e 55%, #0f3460 100%)",
  mood: "Art · Son · Communauté",
  moodEn: "Art · Sound · Community",
  overlayStrength: 0.55,
};

// Explicit aliases for categories that fall through to DEFAULT without them
const GENRE_ALIASES: Record<string, string> = {
  "Various":           "Multi-Genre",
  "Cross-Genre":       "Multi-Genre",
  "EDM":               "Electronic",
  "House":             "Electronic",
  "Blues":             "Jazz",
  "Soul":              "R&B",
  "Opera":             "Classical",
  "Punk":              "Rock",
  "Punk Rock":         "Rock",
  "Alternative Rock":  "Rock",
  "Alternative":       "Rock",
  "Indie Rock":        "Rock",
  "Indie":             "Rock",
  "Hard Rock":         "Rock",
  "Gothic Rock":       "Rock",
  "Post-Hardcore":     "Rock",
  "Folk Rock":         "Rock",
  "Heavy Metal":       "Metal",
  "Death Metal":       "Metal",
  "Progressive Metal": "Metal",
  "Bluegrass":         "Folk",
  "Americana":         "Folk",
  "Jam Band":          "Multi-Genre",
  "Celtic":            "Folk",
  "Electronic Dance":  "Electronic",
  "Electro":           "Electronic",
  "Techno":            "Techno",
  "Trance":            "Electronic",
  "Drum & Bass":       "Electronic",
  "Dubstep":           "Electronic",
  "Hardstyle":         "Electronic",
  "Breakbeat":         "Electronic",
  "Rave":              "Electronic",
  "Hard Dance":        "Electronic",
  "Early Music":       "Classical",
  "Choral":            "Classical",
  "Chamber Music":     "Classical",
  "Baroque":           "Classical",
  "Classical & Opera": "Classical",
  "K-Pop":             "Pop",
  "J-Pop":             "Pop",
  "Indie Pop":         "Pop",
  "Dance":             "Pop",
  "Latin Rock":        "Rock",
  "Electroacoustic":   "Electronic",
  "Acoustic":          "Folk",
  "Christian":         "Multi-Genre",
};

function resolvePool(genre: string | null | undefined): GenrePool {
  if (!genre) return DEFAULT_POOL;
  const canonical = GENRE_ALIASES[genre] ?? genre;
  if (GENRE_POOLS[canonical]) return GENRE_POOLS[canonical];
  const lower = canonical.toLowerCase();
  for (const [key, pool] of Object.entries(GENRE_POOLS)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
      return pool;
    }
  }
  return DEFAULT_POOL;
}

export function getFestivalImage(
  genre: string | null | undefined,
  id?: number,
  heroImageUrl?: string | null,
): FestivalImageConfig {
  const pool = resolvePool(genre);
  const idx = id !== undefined ? id % pool.urls.length : 0;
  return {
    url: heroImageUrl ?? pool.urls[idx],
    gradient: pool.gradient,
    mood: pool.mood,
    moodEn: pool.moodEn,
    overlayStrength: pool.overlayStrength,
  };
}

export function getAtmosphericText(
  category: string | null,
  city: string | null,
  country: string | null,
  lang: "en" | "fr" = "en"
): string {
  const place = city || country || (lang === "fr" ? "ce lieu unique" : "this unique venue");
  const lc = (category || "").toLowerCase();

  if (lang === "fr") {
    if (lc.includes("electronic") || lc.includes("techno") || lc.includes("edm"))
      return `${place} entre dans la nuit comme peu de scènes savent le faire. Ce festival cherche des artistes capables de transformer un espace en voyage sensoriel — ceux pour qui la musique est architecture autant que son.`;
    if (lc.includes("jazz"))
      return `Le jazz, c'est l'art du moment présent. À ${place}, chaque note joue entre ce qui est écrit et ce qui naît sur scène. Un festival pour les interprètes qui savent que l'improvisation est la forme la plus honnête d'expression.`;
    if (lc.includes("rock") || lc.includes("metal"))
      return `${place} connaît l'énergie brute. Ce festival accueille des artistes qui ne jouent pas pour plaire — ils jouent pour que quelque chose se passe dans la salle. Venez avec tout ce que vous avez.`;
    if (lc.includes("classical") || lc.includes("classique"))
      return `Dans l'enceinte de ce festival à ${place}, la musique classique retrouve sa dimension intime et sa puissance. Une plateforme pour les interprètes qui cherchent à toucher juste, pas seulement à jouer juste.`;
    if (lc.includes("folk") || lc.includes("acoustic") || lc.includes("acoustique"))
      return `La musique folk à ${place} : des histoires racontées avec l'honnêteté d'une voix seule. Un public qui écoute vraiment, dans un cadre où la connexion humaine prime sur le spectacle.`;
    if (lc.includes("pop"))
      return `${place} est prêt pour vos refrains. Ce festival rassemble un public curieux, ouvert, et toujours prêt à chanter avec vous — l'endroit idéal pour tester ce que votre musique fait aux gens.`;
    if (lc.includes("hip") || lc.includes("rap"))
      return `${place} a une scène qui n'attend que les voix avec quelque chose à dire. Ce festival célèbre l'authenticité avant la technique, le propos avant le flow.`;
    if (lc.includes("world") || lc.includes("monde") || lc.includes("global"))
      return `Ce festival à ${place} célèbre la diversité comme force, pas comme concept. Un espace où les différences culturelles créent quelque chose qu'aucune scène nationale ne peut offrir.`;
    if (lc.includes("reggae"))
      return `Le soleil, les basses, et l'esprit communautaire qui fait de ${place} une scène reggae à part entière. Un festival pour les artistes qui comprennent que la musique est aussi une façon de vivre.`;
    if (lc.includes("r&b") || lc.includes("rnb") || lc.includes("soul"))
      return `La soul et le R&B demandent une chose rare : la vulnérabilité. À ${place}, ce festival crée l'espace pour les artistes qui n'ont pas peur d'aller là où ça fait quelque chose.`;
    return `Chaque année, ${place} ouvre ses portes aux artistes qui ont quelque chose à prouver. Ce festival cherche des voix singulières — celles qui font que le public repart différent de ce qu'il était en arrivant.`;
  }

  if (lc.includes("electronic") || lc.includes("techno") || lc.includes("edm"))
    return `${place} goes deep into the night. This festival wants artists who can turn a room into a shared journey — where sound becomes architecture and the floor disappears beneath you.`;
  if (lc.includes("jazz"))
    return `Jazz is the art of the present moment. At ${place}, every note lives between what's written and what emerges in the room. A festival for players who know that honesty is the most advanced technique.`;
  if (lc.includes("rock") || lc.includes("metal"))
    return `${place} knows raw energy. This festival welcomes artists who don't play to please — they play to make something happen in the room. Come with everything you've got.`;
  if (lc.includes("classical") || lc.includes("classique"))
    return `At ${place}, classical music finds its intimate power. A platform for interpreters who seek to move people, not just impress them. Precision in service of emotion.`;
  if (lc.includes("folk") || lc.includes("acoustic") || lc.includes("acoustique"))
    return `Folk music at ${place}: stories told with the honesty of a single voice. An audience that really listens, in a setting where human connection outweighs spectacle.`;
  if (lc.includes("pop"))
    return `${place} is ready for your hooks. This festival brings together a curious, open audience who will sing along before the chorus ends. The perfect place to discover what your songs do to people.`;
  if (lc.includes("hip") || lc.includes("rap"))
    return `${place} has a stage waiting for voices with something to say. This festival celebrates authenticity over technique, message over flow. If you have something to prove, this is where you prove it.`;
  if (lc.includes("world") || lc.includes("monde") || lc.includes("global"))
    return `This festival in ${place} treats cultural diversity as a creative force. A space where different musical traditions collide and create something no national stage can offer.`;
  if (lc.includes("reggae"))
    return `Sun, bass, and the communal spirit that makes ${place} a genuine reggae destination. A festival for artists who understand that music is also a way of living.`;
  if (lc.includes("r&b") || lc.includes("rnb") || lc.includes("soul"))
    return `Soul and R&B demand something rare: vulnerability. At ${place}, this festival creates space for artists who aren't afraid to go where it feels like something.`;
  return `Each year, ${place} opens its doors to artists who have something to prove. A festival that looks for singular voices — the ones that leave the audience different from how they arrived.`;
}
