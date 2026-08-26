import { SkeletonGrid, Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="container-vfa space-y-6 py-10">
      <Skeleton className="h-12 w-48" />
      <SkeletonGrid count={9} />
    </div>
  );
}
