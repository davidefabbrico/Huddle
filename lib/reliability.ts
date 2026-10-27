// Reliability ("affidabilità"): what the points mean. People: their own points; groups: the
// members' average (a venue's page: the venue's points). Computed in the database (earned_points).

export interface ReliabilityLevel {
  stars: number; // 0–3
  label: string;
  description: string;
  minPoints: number;
}

export const RELIABILITY: ReliabilityLevel[] = [
  { stars: 0, label: 'Da conoscere', description: 'Ancora pochi eventi: tutto da scoprire.', minPoints: 0 },
  { stars: 1, label: 'Affidabile', description: 'Partecipa e mantiene la parola.', minPoints: 15 },
  { stars: 2, label: 'Molto affidabile', description: 'Presenza costante, organizza e viene ringraziato/a.', minPoints: 50 },
  { stars: 3, label: 'Una garanzia', description: 'Punto di riferimento: se dice “Ci sono”, c’è.', minPoints: 120 },
];

export function reliabilityFor(points: number): ReliabilityLevel {
  return [...RELIABILITY].reverse().find((level) => points >= level.minPoints) ?? RELIABILITY[0];
}

// "★★☆"
export const starsLabel = (stars: number) => '★'.repeat(stars) + '☆'.repeat(3 - stars);
