"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { EmptyState } from "@/components/blog/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function CardGridSkeleton({
  count = 6,
  className = "grid gap-6 sm:grid-cols-2 lg:grid-cols-3",
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-2xl bg-card ring-border shadow-card">
          <Skeleton className="aspect-[16/9] w-full" />
          <div className="space-y-3 p-5">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-4 w-28" />
            </div>
            <Skeleton className="h-6 w-4/5" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <div className="flex items-center justify-between pt-2">
              <div className="flex gap-2">
                <Skeleton className="h-6 w-14 rounded-full" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
              <Skeleton className="h-4 w-12" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function AuthorGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-lg bg-card p-5 text-center ring-border shadow-card">
          <Skeleton className="mx-auto h-16 w-16 rounded-full" />
          <Skeleton className="mx-auto mt-3 h-5 w-28" />
          <Skeleton className="mx-auto mt-2 h-4 w-20" />
          <Skeleton className="mx-auto mt-4 h-4 w-full" />
          <Skeleton className="mx-auto mt-2 h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export function TagListSkeleton({ count = 16 }: { count?: number }) {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} className="h-9 w-24 rounded-full" />
      ))}
    </div>
  );
}

export function PageLoadError({
  title,
  description,
  onRetry,
}: {
  title: string;
  description: string;
  onRetry: () => void;
}) {
  return (
    <EmptyState
      icon={RefreshCw}
      title={title}
      description={description}
      action={
        <Button type="button" onClick={onRetry} variant="outline">
          重试
        </Button>
      }
    />
  );
}
