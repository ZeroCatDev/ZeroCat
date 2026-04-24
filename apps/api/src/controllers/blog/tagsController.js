import {prisma} from "../../services/prisma.js";

export const getTags = async (req, res) => {
  try {
    const tagsAggregation = await prisma.ow_projects_tags.groupBy({
      by: ['tagId'],
      _count: {
        projectId: true
      },
      where: {
        project: {
          type: "article",
          state: "public"
        }
      },
      orderBy: {
        _count: {
          projectId: 'desc'
        }
      }
    });

    const tagIds = tagsAggregation.map(t => t.tagId);
    if (tagIds.length === 0) {
      return res.json({ status: "success", data: [] });
    }

    const tags = await prisma.ow_tags.findMany({
      where: { id: { in: tagIds } }
    });

    const result = tags.map(tag => {
      const agg = tagsAggregation.find(ta => ta.tagId === tag.id);
      return {
        ...tag,
        count: agg ? agg._count.projectId : 0
      };
    }).sort((a, b) => b.count - a.count);

    res.json({ status: "success", data: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "Failed to get tags" });
  }
};
