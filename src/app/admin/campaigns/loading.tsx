import { Skeleton } from '@/components/ui/skeleton';

export default function CampaignsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-5 w-56" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-[180px]" />
      </div>
      <div className="rounded-md border">
        <div className="space-y-0">
          <Skeleton className="h-12 w-full rounded-none" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-14 w-full rounded-none border-t border-border"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
