"use client";

import React from "react";
import Link from "next/link";
import { PenSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/lib/auth";

export function EditPostButton({
  projectId,
  authorId,
}: {
  projectId: number;
  authorId?: number;
}) {
  const user = useCurrentUser();

  if (!user || user.id !== authorId) {
    return null;
  }

  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      className="h-9 rounded-full px-4"
    >
      <Link href={`/write?projectId=${projectId}`}>
        <PenSquare className="h-3.5 w-3.5" />
        编辑文章
      </Link>
    </Button>
  );
}
