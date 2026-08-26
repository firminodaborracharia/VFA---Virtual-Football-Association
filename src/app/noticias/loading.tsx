import { SkeletonCard, SkeletonGrid, Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="container-vfa space-y-6 py-10">
      <Skeleton className="h-12 w-60" />
      <SkeletonCard className="h-64" />
      <SkeletonGrid count={6} />
    </div>
  );
}
