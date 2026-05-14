import { memo, useEffect, useState } from "react";

const failedAvatarUrls = new Set<string>();

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
  const [imageFailed, setImageFailed] = useState(() =>
    Boolean(avatarUrl && failedAvatarUrls.has(avatarUrl))
  );

  useEffect(() => {
    setImageFailed(Boolean(avatarUrl && failedAvatarUrls.has(avatarUrl)));
  }, [avatarUrl]);

  const fallbackInitial = initial.trim().slice(0, 1).toUpperCase() || "?";
  const showImage = Boolean(avatarUrl && !imageFailed);

  return (
    <div className="flex min-w-0 items-center gap-2">
      {showImage ? (
        <img
          src={avatarUrl ?? undefined}
          alt=""
          loading="lazy"
          className="h-5 w-5 flex-shrink-0 rounded-full border border-zinc-700 bg-zinc-900 object-cover"
          onError={() => {
            if (avatarUrl) {
              failedAvatarUrls.add(avatarUrl);
            }
            setImageFailed(true);
          }}
        />
      ) : (
        <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-[10px] font-semibold uppercase text-zinc-400">
          {fallbackInitial}
        </span>
      )}
      <span className="min-w-0 truncate">{author || "Unknown"}</span>
    </div>
  );
}

export default memo(CommitAuthorCell);
