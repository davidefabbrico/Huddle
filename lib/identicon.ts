// GitHub-style pixel avatar: a 5x5 grid, mirrored left/right, with a color picked from the seed.
// Same seed -> same picture, so only the seed needs to be stored (users.avatar_seed).

export interface Identicon {
  color: string;
  cells: boolean[][]; // 5 rows x 5 columns, true = colored pixel
}

// FNV-1a: a small, stable string hash
function hash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

export function identicon(seed: string): Identicon {
  const h = hash(seed);
  const hue = h % 360;
  const color = `hsl(${hue}, 62%, 52%)`;
  // 15 bits fill the 3 left columns; columns 3-4 mirror columns 1-0
  const cells = Array.from({ length: 5 }, (_, row) => {
    const left = [0, 1, 2].map((col) => ((h >>> (row * 3 + col + 8)) & 1) === 1);
    return [left[0], left[1], left[2], left[1], left[0]];
  });
  // Avoid an almost empty picture: flip the grid if fewer than 6 pixels are on
  const on = cells.flat().filter(Boolean).length;
  return { color, cells: on < 6 ? cells.map((row) => row.map((c) => !c)) : cells };
}

// A fresh random seed for "Genera un altro"
export function randomSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}
