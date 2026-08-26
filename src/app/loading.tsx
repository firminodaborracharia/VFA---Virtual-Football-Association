import { SkeletonGrid, Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="container-vfa py-10">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      <div className="mt-8">
        <SkeletonGrid count={8} />
      </div>
    </div>
  );
}
