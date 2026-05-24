import type { GitTagRef, TagRefStatus } from "@/shared/types/git";

function sortTagRefsByName(tags: GitTagRef[]) {
  return [...tags].sort((left, right) => left.name.localeCompare(right.name));
}

function getMergedTagStatus(
  localObjectId: string | null,
  originObjectId: string | null,
  originAvailable: boolean,
): TagRefStatus {
  if (localObjectId && originObjectId) {
    return localObjectId === originObjectId ? "local-origin" : "conflict";
  }

  if (localObjectId) {
    return originAvailable ? "local" : "unknown";
  }

  return "origin";
}

export function mergeTagRefs(
  localTags: GitTagRef[],
  originTags: GitTagRef[],
  originAvailable: boolean,
) {
  const localByName = new Map(localTags.map((tag) => [tag.name, tag]));
  const originByName = new Map(originTags.map((tag) => [tag.name, tag]));
  const names = new Set(localByName.keys());

  if (originAvailable) {
    for (const name of originByName.keys()) {
      names.add(name);
    }
  }

  return sortTagRefsByName(
    Array.from(names).map((name) => {
      const local = localByName.get(name);
      const origin = originByName.get(name);
      const localObjectId = local?.localObjectId ?? null;
      const originObjectId = origin?.originObjectId ?? null;

      return {
        name,
        localObjectId,
        originObjectId,
        localTargetId: local?.localTargetId ?? null,
        originTargetId: origin?.originTargetId ?? null,
        status: getMergedTagStatus(localObjectId, originObjectId, originAvailable),
        isLocalAnnotated: local?.isLocalAnnotated ?? false,
      };
    }),
  );
}

export function splitTagRefsByLocation(tags: GitTagRef[]) {
  const localTags: GitTagRef[] = [];
  const originTags: GitTagRef[] = [];

  for (const tag of tags) {
    if (tag.localObjectId) {
      localTags.push({
        ...tag,
        originObjectId: null,
        originTargetId: null,
        status: "local",
      });
    }

    if (tag.originObjectId) {
      originTags.push({
        ...tag,
        localObjectId: null,
        localTargetId: null,
        originObjectId: tag.originObjectId,
        originTargetId: tag.originTargetId,
        status: "origin",
        isLocalAnnotated: false,
      });
    }
  }

  return {
    localTags: sortTagRefsByName(localTags),
    originTags: sortTagRefsByName(originTags),
  };
}

export function applyOptimisticTagDelete(
  tags: GitTagRef[],
  deletedTag: GitTagRef,
  deleteLocal: boolean,
  deleteOrigin: boolean,
) {
  return tags.flatMap((tag) => {
    if (tag.name !== deletedTag.name) return [tag];

    const localObjectId = deleteLocal ? null : tag.localObjectId;
    const originObjectId = deleteOrigin ? null : tag.originObjectId;
    if (!localObjectId && !originObjectId) return [];

    const status: TagRefStatus =
      localObjectId && originObjectId
        ? localObjectId === originObjectId
          ? "local-origin"
          : "conflict"
        : localObjectId
        ? "local"
        : "origin";

    return [
      {
        ...tag,
        localObjectId,
        originObjectId,
        localTargetId: deleteLocal ? null : tag.localTargetId,
        originTargetId: deleteOrigin ? null : tag.originTargetId,
        isLocalAnnotated: deleteLocal ? false : tag.isLocalAnnotated,
        status,
      },
    ];
  });
}

export function applyOptimisticTagRename(
  tags: GitTagRef[],
  renamedTag: GitTagRef,
  nextName: string,
) {
  const renamedLocalTag: GitTagRef = {
    ...renamedTag,
    name: nextName,
    originObjectId: null,
    originTargetId: null,
    status: renamedTag.status === "unknown" ? "unknown" : "local",
  };

  return sortTagRefsByName(
    tags.flatMap((tag) => {
      if (tag.name !== renamedTag.name) return [tag];

      if (!tag.originObjectId) return [renamedLocalTag];

      return [
        {
          ...tag,
          localObjectId: null,
          localTargetId: null,
          isLocalAnnotated: false,
          status: "origin",
        },
        renamedLocalTag,
      ];
    }),
  );
}
