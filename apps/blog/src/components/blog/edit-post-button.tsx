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
    <>
      <span className="text-border">·</span>
      <Button asChild variant="outline" size="sm" className="h-6 px-3 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 border-indigo-200">
        <Link href={`/write?projectId=${projectId}`}>
          <PenSquare className="mr-1.5 h-3.5 w-3.5" />
          编辑文章
        </Link>
      </Button>
    </>
  );
}