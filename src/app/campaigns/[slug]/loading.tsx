import { Skeleton } from '@/components/ui/skeleton';

export default function CampaignSlugLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
        <div className="space-y-4">
          <Skeleton className="h-10 w-3/4" />
          <div className="flex flex-wrap gap-4">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-6 w-28" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-12 w-full" />
        <div className="prose prose-sm max-w-none space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="space-y-4 rounded-lg border p-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
    </div>
  );
}
