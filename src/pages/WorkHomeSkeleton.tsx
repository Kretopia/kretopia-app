// Lightweight skeleton shared by WorkHome (account-type check), and by
// BrandWorkHome/CreatorWorkHome (their own data loads) -- avoids the
// "black screen" flash from the full-page CreativeLoader.
export const WorkHomeSkeleton = ({ variant = "studio" }: { variant?: "studio" | "hiring" | "shell" }) => (
  <div className="max-w-2xl mx-auto px-4 pt-6 pb-24 space-y-6">
    <div className="space-y-2">
      <div className="h-3 w-24 rounded bg-muted animate-pulse" />
      <div className="h-7 w-56 rounded bg-muted animate-pulse" />
      <div className="h-4 w-40 rounded bg-muted animate-pulse" />
    </div>
    {variant !== "shell" && (
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-[78px] min-w-[136px] flex-1 rounded-xl bg-muted animate-pulse"
            style={{ animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>
    )}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {Array.from({ length: variant === "hiring" ? 3 : 4 }).map((_, i) => (
        <div
          key={i}
          className="h-44 rounded-2xl bg-muted animate-pulse"
          style={{ animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  </div>
);

export default WorkHomeSkeleton;
