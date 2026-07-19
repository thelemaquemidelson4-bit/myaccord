export const SPORTS = [
  "Football",
  "Basketball",
  "Tennis",
  "Rugby",
  "Handball",
  "Volleyball",
  "Athlétisme",
  "Natation",
  "Cyclisme",
  "Boxe",
  "Judo",
  "Golf",
];

export const LEVELS = ["Amateur", "Semi-pro", "Professionnel", "Élite"];

export const GENDERS = ["Homme", "Femme"];

export const POSITIONS: Record<string, string[]> = {
  Football: ["Gardien", "Défenseur", "Milieu", "Attaquant", "Ailier"],
  Basketball: ["Meneur", "Arrière", "Ailier", "Ailier fort", "Pivot"],
  Rugby: ["Pilier", "Talonneur", "Deuxième ligne", "Demi de mêlée", "Ouvreur", "Ailier"],
  Handball: ["Gardien", "Arrière", "Demi-centre", "Ailier", "Pivot"],
  Volleyball: ["Passeur", "Attaquant", "Central", "Libéro", "Réceptionneur"],
  Tennis: ["Simple", "Double"],
  Athlétisme: ["Sprint", "Fond", "Saut", "Lancer"],
  Natation: ["Nage libre", "Dos", "Brasse", "Papillon"],
  Cyclisme: ["Sprinteur", "Grimpeur", "Rouleur"],
  Boxe: ["Poids léger", "Poids moyen", "Poids lourd"],
  Judo: ["-60kg", "-73kg", "-90kg", "+100kg"],
  Golf: ["Amateur", "Pro"],
};

export const SPORT_ICONS: Record<string, string> = {
  Football: "football",
  Basketball: "basketball",
  Tennis: "tennisball",
  Rugby: "american-football",
  Handball: "hand-left",
  Volleyball: "baseball",
  Athlétisme: "walk",
  Natation: "water",
  Cyclisme: "bicycle",
  Boxe: "fitness",
  Judo: "body",
  Golf: "golf",
};

export const FALLBACK_HERO =
  "https://images.pexels.com/photos/918798/pexels-photo-918798.jpeg";
