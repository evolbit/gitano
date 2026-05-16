import { getFileName, getParentPath } from "@/shared/lib/path";

const WORKBRANCH_ADJECTIVES = [
  "amber",
  "brisk",
  "cedar",
  "copper",
  "crisp",
  "ember",
  "frost",
  "golden",
  "inky",
  "ivory",
  "jade",
  "linen",
  "lunar",
  "maple",
  "mossy",
  "opal",
  "pilar",
  "quiet",
  "silver",
  "tidal",
  "velvet",
  "willow",
];

const WORKBRANCH_NOUNS = [
  "atlas",
  "bird",
  "brook",
  "comet",
  "field",
  "harbor",
  "lantern",
  "meadow",
  "moon",
  "orbit",
  "pine",
  "river",
  "signal",
  "sparrow",
  "stork",
  "story",
  "summit",
  "thicket",
  "valley",
  "wave",
];

function stripTrailingSlash(path: string) {
  return path.replace(/\/+$/, "");
}

function randomIndex(max: number) {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.getRandomValues) {
    const values = new Uint32Array(1);
    cryptoApi.getRandomValues(values);
    return values[0] % max;
  }

  return Math.floor(Math.random() * max);
}

function normalizeUsedName(value: string) {
  return value.trim().toLowerCase();
}

export function getDefaultNameFromRef(refName: string) {
  const normalized = refName.replace(/^refs\/heads\//, "").replace(/^origin\//, "");
  const parts = normalized.split("/").filter(Boolean);
  const name = parts[parts.length - 1] || normalized || "worktree";
  return name.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "worktree";
}

export function getDefaultBranchFromName(name: string) {
  return name.replace(/\s+/g, "-").replace(/^\/+|\/+$/g, "") || "worktree";
}

export function buildDefaultWorktreeFolder(mainWorktreePath: string, name: string) {
  const cleanMainPath = stripTrailingSlash(mainWorktreePath);
  const repoName = getFileName(cleanMainPath);
  const parentPath = getParentPath(cleanMainPath);
  const folderName = name.replace(/[^A-Za-z0-9._-]+/g, "-") || "worktree";

  return `${parentPath}/${repoName}.worktrees/${folderName}`;
}

export function generateRandomWorkbranchName(existingNames: Iterable<string> = []) {
  const usedNames = new Set(Array.from(existingNames, normalizeUsedName));
  const maxAttempts = WORKBRANCH_ADJECTIVES.length * WORKBRANCH_NOUNS.length;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const name = `${WORKBRANCH_ADJECTIVES[randomIndex(WORKBRANCH_ADJECTIVES.length)]}-${
      WORKBRANCH_NOUNS[randomIndex(WORKBRANCH_NOUNS.length)]
    }`;

    if (!usedNames.has(normalizeUsedName(name))) {
      return name;
    }
  }

  let suffix = randomIndex(900) + 100;
  let fallback = `inky-stork-${suffix}`;
  while (usedNames.has(normalizeUsedName(fallback))) {
    suffix += 1;
    fallback = `inky-stork-${suffix}`;
  }

  return fallback;
}
