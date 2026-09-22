export type RandomSource = () => number;

export function createSeededRandom(seed: string): RandomSource {
  let hash = 1779033703 ^ seed.length;
  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }

  return () => {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    hash ^= hash >>> 16;
    hash += 0x6d2b79f5;
    let value = hash;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
export function addToReservoir<T>(
  reservoir: T[],
  item: T,
  seenCount: number,
  sampleSize: number,
  random: RandomSource,
): void {
  if (reservoir.length < sampleSize) {
    reservoir.push(item);
    return;
  }
  const replacementIndex = Math.floor(random() * seenCount);
  if (replacementIndex < sampleSize) reservoir[replacementIndex] = item;
}

export function shuffleInPlace<T>(values: T[], random: RandomSource): void {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = values[index];
    const swap = values[swapIndex];
    if (current === undefined || swap === undefined) continue;
    values[index] = swap;
    values[swapIndex] = current;
  }
}
