import { Skeleton, SkeletonTable } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="container-vfa space-y-8 py-10">
      <Skeleton className="h-12 w-64" />
      <SkeletonTable rows={6} />
      <SkeletonTable rows={6} />
    </div>
  );
}
