import { Skeleton, SkeletonTable } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="container-vfa space-y-6 py-10">
      <Skeleton className="h-12 w-52" />
      <Skeleton className="h-16 w-full rounded-2xl" />
      <SkeletonTable rows={8} columns={5} />
    </div>
  );
}
