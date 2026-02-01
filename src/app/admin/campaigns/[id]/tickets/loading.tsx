import { Skeleton } from '@/components/ui/skeleton';

export default function CampaignTicketsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="size-9 w-9" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-9 w-[180px]" />
        <Skeleton className="h-9 w-[120px]" />
      </div>
      <div className="rounded-md border">
        <div className="p-4 space-y-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
