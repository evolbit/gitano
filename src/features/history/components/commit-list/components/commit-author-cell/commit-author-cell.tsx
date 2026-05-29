import { memo, useEffect, useState } from "react";

const failedAvatarUrls = new Set<string>();
const AVATAR_IMAGE_LOADED = "loaded";
const AVATAR_IMAGE_LOADING = "loading";
const AVATAR_IMAGE_FAILED = "failed";

type AvatarImageStatus =
  | typeof AVATAR_IMAGE_LOADED
  | typeof AVATAR_IMAGE_LOADING
  | typeof AVATAR_IMAGE_FAILED;

type CommitAuthorCellProps = {
  author: string;
  initial: string;
  avatarUrl?: string | null;
};

function CommitAuthorCell({
  author,
  initial,
  avatarUrl,
}: CommitAuthorCellProps) {
  const [imageStatus, setImageStatus] = useState<AvatarImageStatus>(() =>
    avatarUrl && !failedAvatarUrls.has(avatarUrl)
      ? AVATAR_IMAGE_LOADING
      : AVATAR_IMAGE_FAILED
  );

  useEffect(() => {
    setImageStatus(
      avatarUrl && !failedAvatarUrls.has(avatarUrl)
        ? AVATAR_IMAGE_LOADING
        : AVATAR_IMAGE_FAILED,
    );
  }, [avatarUrl]);

  const fallbackInitial = initial.trim().slice(0, 1).toUpperCase() || "?";
  const showImage = Boolean(avatarUrl && imageStatus !== AVATAR_IMAGE_FAILED);

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="relative h-5 w-5 flex-shrink-0">
        <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-[10px] font-semibold uppercase text-zinc-400">
          {fallbackInitial}
        </span>
        {showImage ? (
          <img
            key={avatarUrl}
            src={avatarUrl ?? undefined}
            alt=""
            loading="lazy"
            className={`absolute inset-0 h-5 w-5 rounded-full border border-zinc-700 bg-zinc-900 object-cover transition-opacity ${
              imageStatus === AVATAR_IMAGE_LOADED
                ? "opacity-100"
                : "opacity-0"
            }`}
            onLoad={() => setImageStatus(AVATAR_IMAGE_LOADED)}
            onError={() => {
              if (avatarUrl) {
                failedAvatarUrls.add(avatarUrl);
              }
              setImageStatus(AVATAR_IMAGE_FAILED);
            }}
          />
        ) : null}
      </span>
      <span className="min-w-0 truncate">{author || "Unknown"}</span>
    </div>
  );
}

export default memo(CommitAuthorCell);
