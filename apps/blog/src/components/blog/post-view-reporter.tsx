"use client";

import * as React from "react";
import { reportProjectView } from "@/lib/analytics";

/**
 * Reports a project/post view to the ZeroCat analytics system
 * when the component mounts. De-duplicates within a session.
 */
export function PostViewReporter({ projectId }: { projectId: string | number }) {
  React.useEffect(() => {
    if (!projectId) return;
    void reportProjectView(projectId);
  }, [projectId]);

  return null;
}
