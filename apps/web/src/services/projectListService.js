import request from "../axios/axios.js";

// 获取我的项目列表
export async function getMyProjectLists() {
  try {
    const response = await request.get('/projectlist/lists/my');
    return response.data;
  } catch (error) {
    console.error("获取我的项目列表失败:", error);
    return {status: "error", data: []};
  }
}

// 获取特定项目列表
export async function getProjectListById(id) {
  try {
    const response = await request.get(`/projectlist/lists/listid/${id}`);
    return response.data;
  } catch (error) {
    console.error("获取项目列表失败:", error);
    return {status: "error", data: {projects: []}};
  }
}

// 获取用户公开列表
export async function getUserPublicLists(userId) {
  try {
    const response = await request.get(`/projectlist/lists/userid/${userId}/public`);
    return response.data;
  } catch (error) {
    console.error("获取用户公开列表失败:", error);
    return {status: "error", data: []};
  }
}

// 创建项目列表
export async function createProjectList(listData) {
  try {
    const response = await request.post('/projectlist/lists/create', listData);
    return response.data;
  } catch (error) {
    console.error("创建项目列表失败:", error);
    return {status: "error", message: "创建失败"};
  }
}

// 更新项目列表
export async function updateProjectList(id, listData) {
  try {
    const response = await request.post(`/projectlist/lists/update/${id}`, listData);
    return response.data;
  } catch (error) {
    console.error("更新项目列表失败:", error);
    return {status: "error", message: "更新失败"};
  }
}

// 删除项目列表
export async function deleteProjectList(id) {
  try {
    const response = await request.post(`/projectlist/lists/delete`, {id});
    return response.data;
  } catch (error) {
    console.error("删除项目列表失败:", error);
    return {status: "error", message: "删除失败"};
  }
}

// 添加项目到列表
export async function addProjectToList(listId, projectId) {
  try {
    const response = await request.post('/projectlist/lists/add', {
      listid: listId,
      projectid: projectId
    });
    return response.data;
  } catch (error) {
    console.error("添加项目到列表失败:", error);
    return {status: "error", message: "添加失败"};
  }
}

// 从列表中移除项目
export async function removeProjectFromList(listId, projectId) {
  try {
    const response = await request.post('/projectlist/lists/remove', {
      listid: listId,
      projectid: projectId
    });
    return response.data;
  } catch (error) {
    console.error("从列表中移除项目失败:", error);
    return {status: "error", message: "移除失败"};
  }
}

// 收藏项目
export async function starProject(projectId) {
  try {
    const response = await request.post('/projectlist/stars/star', {projectid: projectId});
    return response.data;
  } catch (error) {
    console.error("收藏项目失败:", error);
    return {status: "error", message: "收藏失败"};
  }
}

// 取消收藏
export async function unstarProject(projectId) {
  try {
    const response = await request.post('/projectlist/stars/unstar', {projectid: projectId});
    return response.data;
  } catch (error) {
    console.error("取消收藏失败:", error);
    return {status: "error", message: "取消收藏失败"};
  }
}

// 检查收藏状态
export async function checkStarStatus(projectId) {
  try {
    const response = await request.get(`/projectlist/stars/checkstar?projectid=${projectId}`);
    return response.data;
  } catch (error) {
    console.error("检查收藏状态失败:", error);
    return {status: "error", star: false};
  }
}

// 获取项目收藏数
export async function getProjectStarCount(projectId) {
  try {
    const response = await request.get(`/projectlist/stars/project/${projectId}/stars`);
    return response.data;
  } catch (error) {
    console.error("获取项目收藏数失败:", error);
    return {status: "error", data: 0};
  }
}
