import request from "../axios/axios.js";

// 通用用户对象模板
const defaultUser = (id) => ({
  id,
  display_name: "未知用户",
  bio: "用户信息未缓存",
  avatar: "",
  regTime: "2000-01-01T00:00:00.000Z",
  sex: "未知",
  username: "未知",
});

// 获取用户详情函数
export async function getUserById(ids) {
  if (Array.isArray(ids)) {
    try {
      const {data} = await request.post(`/user/batch/id`, {users: ids});
      return data.data;
    } catch (error) {
      return ids.map((id) => defaultUser(id));
    }
  } else {
    try {
      const {data} = await request.get(`/user/id/${ids}`);
      return data.data;
    } catch (error) {
      return defaultUser(ids);
    }
  }
}

export async function getUserByUsername(names) {
  if (Array.isArray(names)) {
    try {
      const {data} = await request.post(`/user/batch/name`, {users: names});
      return data.data;
    } catch (error) {
      return names.map((id) => defaultUser(id));
    }
  } else {
    try {
      const {data} = await request.get(`/user/username/${names}`);
      return data.data;
    } catch (error) {
      return defaultUser(names);
    }
  }
}
