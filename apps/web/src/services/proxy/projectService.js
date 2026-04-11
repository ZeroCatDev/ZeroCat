import request from "@/axios/axios";
import {get} from "@/services/serverConfig";

export async function searchProjects(text, order, page = 1, limit = 16) {
  const baseUrl = get('scratchproxy.url');
  return request.get(baseUrl + `/projects/search/projects?mode=${order}&q=${text}&offset=${page * 16 - 16}&limit=${limit}&language=zh-cn`);
}

export async function getFeaturedProjects() {
  const baseUrl = get('scratchproxy.url');
  return request.get(baseUrl + `/proxy/featured`);
}

export async function exploreProjects(tag, order, page = 1, limit = 16) {
  const baseUrl = get('scratchproxy.url');
  return request.get(baseUrl + `/projects/explore/projects?mode=${order}&q=${tag}&offset=${page * 16 - 16}&limit=${limit}&language=zh-cn`);
}

export async function getProject(id) {
  const baseUrl = get('scratchproxy.url');
  return request.get(baseUrl + `/projects/${id}`);
}

export async function getProjectSource(id, token) {
  const baseUrl = get('scratchproxy.url');
  return request.get(baseUrl + `/projects/source/${id}?token=${token}`);
}
