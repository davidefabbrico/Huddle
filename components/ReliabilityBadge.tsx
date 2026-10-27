// Reliability of a person or group, from their points (lib/reliability.ts). Hidden at the first level.

import { reliabilityFor, starsLabel } from '../lib/reliability';
import { Badge } from './Badge';

export function ReliabilityBadge({ points, centered = false }: { points: number | undefined; centered?: boolean }) {
  if (points === undefined) return null;
  const level = reliabilityFor(points);
  if (!level.stars) return null;
  return <Badge label={`${starsLabel(level.stars)} ${level.label}`} tone="brand" centered={centered} />;
}
