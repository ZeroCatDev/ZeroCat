import request from "@/axios/axios";
import {get} from '@/services/serverConfig';

export async function getStudio(id) {
  const baseUrl = get('scratchproxy.url');
  return request.get(baseUrl + `/studios/${id}`);
}

export async function getStudioProjects(id, page = 1, limit = 16) {
  const baseUrl = get('scratchproxy.url');
  return request.get(baseUrl + `/studios/${id}/projects?&offset=${page * 16 - 16}&limit=${limit}`);
}

export async function getStudioCurators(id, page = 1, limit = 16) {
  const baseUrl = get('scratchproxy.url');
  return request.get(baseUrl + `/studios/${id}/curators?&offset=${page * 16 - 16}&limit=${limit}`);
}

export async function getStudioManagers(id, page = 1, limit = 16) {
  const baseUrl = get('scratchproxy.url');
  return request.get(baseUrl + `/studios/${id}/managers?&offset=${page * 16 - 16}&limit=${limit}`);
}
