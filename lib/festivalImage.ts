export type FestivalImageConfig = {
  url: string;
  gradient: string;
  mood: string;    // French / default
  moodEn: string;  // English
  overlayStrength: number; // 0–1, darkness of the image overlay
};

export function getMood(config: FestivalImageConfig, lang: "en" | "fr" = "en"): string {
  return lang === "fr" ? config.mood : config.moodEn;
}

// Each genre gets a curated Unsplash photo + a rich CSS gradient fallback.
// The gradient shows instantly (no network), the image loads over it.
const GENRE_CONFIGS: Record<string, FestivalImageConfig> = {
  Electronic: {
    url: "https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?auto=format&fit=crop&w=900&q=75",
    gradient: "linear-gradient(160deg, #0f0c29 0%, #302b63 60%, #24243e 100%)",
    mood: "Immersif · Hypnotique · Électrique",
    moodEn: "Immersive · Hypnotic · Electric",
    overlayStrength: 0.55,
  },
  Techno: {
    url: "https://images.unsplash.com/photo-1542479748-f71e573da5df?auto=format&fit=crop&w=900&q=75",
    gradient: "linear-gradient(160deg, #0a0a0a 0%, #1a0a30 60%, #0a1030 100%)",
    mood: "Sombre · Pulsant · Sans frontières",
    moodEn: "Dark · Pulsing · Borderless",
    overlayStrength: 0.7,
  },
  Jazz: {
    url: "https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?auto=format&fit=crop&w=900&q=75",
    gradient: "linear-gradient(160deg, #1a0a00 0%, #5C2E00 55%, #8B6914 100%)",
    mood: "Soulful · Vivant · Intemporel",
    moodEn: "Soulful · Live · Timeless",
    overlayStrength: 0.5,
  },
  Rock: {
    url: "https://images.unsplash.com/photo-1504891939695-fb0ebaf1b39a?auto=format&fit=crop&w=900&q=75",
    gradient: "linear-gradient(160deg, #1a0010 0%, #6B0000 60%, #200122 100%)",
    mood: "Brut · Fort · Inoubliable",
    moodEn: "Raw · Loud · Unforgettable",
    overlayStrength: 0.6,
  },
  Metal: {
    url: "https://images.unsplash.com/photo-1493676304819-0d7a8d026dcf?auto=format&fit=crop&w=900&q=75",
    gradient: "linear-gradient(160deg, #0a0a0a 0%, #1a1010 100%)",
    mood: "Intense · Cathartique · Sans compromis",
    moodEn: "Intense · Cathartic · Uncompromising",
    overlayStrength: 0.7,
  },
  Classical: {
    url: "https://images.unsplash.com/photo-1507838153414-b4b713384a76?auto=format&fit=crop&w=900&q=75",
    gradient: "linear-gradient(160deg, #0f2027 0%, #203a43 55%, #2c5364 100%)",
    mood: "Précision · Émotion · Beauté pure",
    moodEn: "Precision · Emotion · Pure beauty",
    overlayStrength: 0.45,
  },
  Folk: {
    url: "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?auto=format&fit=crop&w=900&q=75",
    gradient: "linear-gradient(160deg, #1a2a10 0%, #2d5016 55%, #4a7c3f 100%)",
    mood: "Ancré · Sincère · Humain",
    moodEn: "Rooted · Honest · Human",
    overlayStrength: 0.5,
  },
  Pop: {
    url: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=900&q=75",
    gradient: "linear-gradient(160deg, #200050 0%, #6f00d2 55%, #d400d4 100%)",
    mood: "Accrocheur · Lumineux · Contagieux",
    moodEn: "Catchy · Bright · Infectious",
    overlayStrength: 0.5,
  },
  "Hip-Hop": {
    url: "https://images.unsplash.com/photo-1571935441005-ea44068c2bf3?auto=format&fit=crop&w=900&q=75",
    gradient: "linear-gradient(160deg, #0a0a0a 0%, #1a1a1a 55%, #2a2a2a 100%)",
    mood: "Culture · Flow · Authenticité",
    moodEn: "Culture · Flow · Authenticity",
    overlayStrength: 0.65,
  },
  Rap: {
    url: "https://images.unsplash.com/photo-1571935441005-ea44068c2bf3?auto=format&fit=crop&w=900&q=75",
    gradient: "linear-gradient(160deg, #0a0a0a 0%, #1a1a2e 100%)",
    mood: "Texte · Énergie · Vérité",
    moodEn: "Lyrics · Energy · Truth",
    overlayStrength: 0.65,
  },
  "R&B": {
    url: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=900&q=75",
    gradient: "linear-gradient(160deg, #1a0030 0%, #4a0060 55%, #7B0080 100%)",
    mood: "Velouté · Profond · Enveloppant",
    moodEn: "Silky · Deep · Enveloping",
    overlayStrength: 0.5,
  },
  Reggae: {
    url: "https://images.unsplash.com/photo-1505236858219-8359eb29e329?auto=format&fit=crop&w=900&q=75",
    gradient: "linear-gradient(160deg, #004000 0%, #006600 55%, #c8a000 100%)",
    mood: "Racines · Vibration · Liberté",
    moodEn: "Roots · Vibration · Freedom",
    overlayStrength: 0.45,
  },
  "World Music": {
    url: "https://images.unsplash.com/photo-1533928298208-27ff66555d8d?auto=format&fit=crop&w=900&q=75",
    gradient: "linear-gradient(160deg, #1a0a00 0%, #8B1A4A 55%, #2c1654 100%)",
    mood: "Global · Riche · Vivant",
    moodEn: "Global · Rich · Alive",
    overlayStrength: 0.5,
  },
  "Musique du monde": {
    url: "https://images.unsplash.com/photo-1533928298208-27ff66555d8d?auto=format&fit=crop&w=900&q=75",
    gradient: "linear-gradient(160deg, #1a0a00 0%, #8B1A4A 55%, #2c1654 100%)",
    mood: "Global · Riche · Vivant",
    moodEn: "Global · Rich · Alive",
    overlayStrength: 0.5,
  },
  "Multi-Genre": {
    url: "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?auto=format&fit=crop&w=900&q=75",
    gradient: "linear-gradient(160deg, #1a1060 0%, #4a0060 40%, #9B1060 100%)",
    mood: "Éclectique · Ouvert · Festif",
    moodEn: "Eclectic · Open · Festive",
    overlayStrength: 0.5,
  },
  Country: {
    url: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&w=900&q=75",
    gradient: "linear-gradient(160deg, #2a1500 0%, #6B3500 55%, #c87000 100%)",
    mood: "Racines · Chaleur · Communauté",
    moodEn: "Roots · Warmth · Community",
    overlayStrength: 0.5,
  },
};

const DEFAULT_CONFIG: FestivalImageConfig = {
  url: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=900&q=75",
  gradient: "linear-gradient(160deg, #1a1a2e 0%, #16213e 55%, #0f3460 100%)",
  mood: "Art · Son · Communauté",
  moodEn: "Art · Sound · Community",
  overlayStrength: 0.55,
};

export function getFestivalImage(genre: string | null | undefined): FestivalImageConfig {
  if (!genre) return DEFAULT_CONFIG;
  if (GENRE_CONFIGS[genre]) return GENRE_CONFIGS[genre];
  const lower = genre.toLowerCase();
  for (const [key, config] of Object.entries(GENRE_CONFIGS)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
      return config;
    }
  }
  return DEFAULT_CONFIG;
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

  // English
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
