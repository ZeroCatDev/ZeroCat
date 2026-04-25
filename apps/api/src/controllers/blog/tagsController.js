import { prisma } from "../../services/prisma.js";

const stableTagId = (name) => {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return hash || 1;
};

export const getTags = async (req, res) => {
  try {
    const rows = await prisma.ow_projects_tags.groupBy({
      by: ["name"],
      _count: {
        projectid: true,
      },
      _min: {
        id: true,
        created_at: true,
      },
      where: {
        name: { not: "" },
        projectid: { not: null },
        project: {
          type: "article",
          state: "public",
        },
      },
      orderBy: {
        _count: {
          projectid: "desc",
        },
      },
    });

    const data = rows
      .map((row) => {
        const name = String(row.name || "").trim();
        if (!name) return null;
        return {
          id: row._min?.id ?? stableTagId(name),
          name,
          count: row._count?.projectid ?? 0,
          created_at: row._min?.created_at ?? undefined,
        };
      })
      .filter(Boolean);

    res.json({ status: "success", data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "Failed to get tags" });
  }
};
