import { SkeletonGrid, Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="container-vfa py-10">
      <Skeleton className="h-12 w-56" />
      <Skeleton className="mt-6 h-16 w-full rounded-2xl" />
      <div className="mt-6">
        <SkeletonGrid count={12} />
      </div>
    </div>
  );
}
