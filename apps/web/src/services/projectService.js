import request from "../axios/axios.js";
import { get } from "./serverConfig";
let s3BucketUrl = '';

  s3BucketUrl = get('s3.staticurl');

// 通用项目对象模板
const defaultProject = (id) => ({
  id,
  title: "未知项目",
  description: "未知项目",
  authorid: 0,
  type: "scratch",
  license: "unknow",
  state: "unknow",
  view_count: 0,
  time: 0,
  tags: [],
  source: "unknow",
  author: {
    id: 0,
    username: "未知用户",
    display_name: "未知用户",
    bio: "",
    avatar: "",
    regTime: null
  },
});

// 获取项目详情函数
export async function getProjectInfo(ids) {
  if (Array.isArray(ids)) {
    try {
      const {data} = await request.post(`/project/batch`, {
        projectIds: ids,
      });
      return data.data;
    } catch (error) {
      return ids.map((id) => defaultProject(id));
    }
  } else {
    try {
      const {data} = await request.get(`/project/id/${ids}`);
      return data;
    } catch (error) {
      return defaultProject(ids);
    }
  }
}

export async function getProjectListById(id) {
  try {
    const {data} = await request.get(`/projectlist/lists/listid/${id}`);
    return data.data;
  } catch (error) {
    console.error("获取项目列表失败:", error);
    return {projects: []};
  }
}

// 使用 [username]/[projectname] 获取项目信息函数
export async function getProjectInfoByNamespace(username, projectname) {
  try {
    const {data} = await request.get(
      `/project/namespace/${username}/${projectname}`
    );
    return data;
  } catch (error) {
    return defaultProject(0); // 返回默认项目对象
  }
}

export async function initProject(projectid, type) {
  try {
    const {data} = await request.post(
      `/project/initlize?projectid=${projectid}&type=${type}`
    );
    return data;
  } catch (error) {
    return defaultProject(0); // 返回默认项目对象
  }
}

export const saveFile = async (projectFile) => {
  const response = await request({
    url: "/project/savefile",
    data: {source: projectFile},
    method: "post",
    headers: {
      "Content-Type": "application/json",
    },
  });
  return response.data;
};

export const commit = async (projectId, commitInfo) => {
  const response = await request({
    url: "/project/commit/id/" + projectId,
    data: {
      branch: commitInfo.branch,
      projectid: projectId,
      accessFileToken: commitInfo.accessFileToken,
      message: commitInfo.message,
      parent_commit: commitInfo.parent_commit,
    },
    method: "put",
  });
  return response.data;
};

export const getBranchs = async (projectId) => {
  const response = await request({
    url: `/project/branches?projectid=${projectId}`,
    method: "get",
  });
  return response.data;
};

export const getProjectFile = async (projectId, branch, commitid) => {
  const response = await request({
    url: `/project/${projectId}/${branch}/${commitid}`,
    method: "get",
  });
  const projectFileData = response.data;
  const fileResponse = await request({
    url: `/project/files/${projectFileData.commit.commit_file}?accessFileToken=${projectFileData.accessFileToken}`,
    method: "get",
  });
  return {
    projectFileData,
    fileData: fileResponse.data.file,
    branchInfo: response,
  };
};

export const getCommitInfo = async (projectId, commitid) => {
  const response = await request({
    url: `/project/commit?projectid=${projectId}&commitid=${commitid}`,
    method: "get",
  });
  return response.data;
};
export const getBranchHistoryByCommit = async (projectId, commitid) => {
  console.log(`Fetching commits for projectId: ${projectId}`);
  const response = await request({
    url: `/project/commits?projectid=${projectId}`,
    method: "get",
  });

  const commits = response.data.data;
  console.log(`Fetched ${commits.length} commits`);

  const findCommitById = (id) => {
    console.log(`Finding commit by id: ${id}`);
    return commits.find((commit) => commit.id === id);
  };

  const getCommitHistory = (commitid) => {
    console.log(`Building commit history starting from commitid: ${commitid}`);
    const commitHistory = [];
    let currentCommit = findCommitById(commitid);

    while (currentCommit) {
      console.log(`Adding commit to history: ${currentCommit.id}`);
      commitHistory.push(currentCommit);
      if (!currentCommit.parent_commit_id) {
        console.log(`No parent commit found for commitid: ${currentCommit.id}`);
        break;
      }
      currentCommit = findCommitById(currentCommit.parent_commit_id);
    }

    return commitHistory;
  };

  return getCommitHistory(commitid);
};

export const createBranch = async (projectId, branchName, sourceBranch) => {
  const response = await request({
    url: `/project/branches`,
    method: "post",
    data: {
      projectid: projectId,
      name: branchName,
      branch: sourceBranch,
    },
  });
  return response.data;
};

export const deleteBranch = async (projectId, branchName) => {
  const response = await request({
    url: `/project/branches`,
    method: "delete",
    data: {
      projectid: projectId,
      branch: branchName,
    },
  });
  return response.data;
};

export async function getProjectAnalytics(projectId, startDate, endDate) {
  try {
    const response = await request.get(`/project/analytics/${projectId}`, {
      params: {
        start_date: startDate,
        end_date: endDate
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching project analytics:', error);
    throw error;
  }
}

export async function getProjectStats(projectId) {
  try {
    const response = await request.get(`/project/stats/${projectId}`);
    return response.data.data;
  } catch (error) {
    console.error('Error fetching project stats:', error);
    return {
      pageviews: 0,
      visitors: 0
    };
  }
}

export async function queryProjects(type, target, limit = 20, offset = 0) {
  try {
    const response = await request.get('/project/query', {
      params: {
        type,
        target,
        limit,
        offset
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error querying projects:', error);
    return {
      status: 'error',
      message: error.message,
      data: {
        projects: [],
        total: 0,
        limit,
        offset
      }
    };
  }
}

/**
 * 获取项目文件内容
 * @param {number} projectId - 项目ID
 * @param {string} branch - 分支名称
 * @param {string} commitId - 提交ID或'latest'
 * @returns {Promise<{code: string, language: string}>}
 */
export async function getProjectContent(projectId, branch = 'main', commitId = 'latest') {
  try {
    // 获取提交信息和访问令牌
    const commitResponse = await request.get(`/project/${projectId}/${branch}/${commitId}`);

    if (!commitResponse.data.commit || !commitResponse.data.commit.commit_file) {
      throw new Error('No commit information available');
    }

    const {commit_file: sha256} = commitResponse.data.commit;
    const {accessFileToken} = commitResponse.data;

    // 获取文件内容
    const fileResponse = await request.get(`/project/files/${sha256}`, {
      params: {
        accessFileToken,
        content: true
      }
    });

    // 从文件名或内容中推断语言
    const fileExtension = sha256.split('.').pop().toLowerCase();
    const languageMap = {
      'py': 'python',
      'js': 'javascript',
      'java': 'java',
      'go': 'golang',
      'rs': 'rust',
      'rb': 'ruby'
    };

    return {
      code: fileResponse.data,
      language: languageMap[fileExtension] || 'python'
    };
  } catch (error) {
    console.error('Failed to get project content:', error);
    return {
      code: '',
      language: 'python'
    };
  }
}

export function getS3staticurl(image) {
 return `${s3BucketUrl}/assets/${image.slice(0, 2)}/${image.slice(2,4)}/${image}`;
}