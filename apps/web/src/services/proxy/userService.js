import request from "@/axios/axios";
import {get} from '@/services/serverConfig';

export async function getUser(username) {
  const baseUrl = get('scratchproxy.url');
  return request.get(baseUrl + `/users/${username}`);
}

export async function getUserProjects(username, page = 1, limit = 16) {
  const baseUrl = get('scratchproxy.url');
  return request.get(baseUrl + `/users/${username}/projects?&offset=${page * 16 - 16}&limit=${limit}`);
}

export async function getUserFollowing(username, page = 1, limit = 16) {
  const baseUrl = get('scratchproxy.url');
  return request.get(baseUrl + `/users/${username}/following?&offset=${page * 16 - 16}&limit=${limit}`);
}

export async function getUserFollowers(username, page = 1, limit = 16) {
  const baseUrl = get('scratchproxy.url');
  return request.get(baseUrl + `/users/${username}/followers?&offset=${page * 16 - 16}&limit=${limit}`);
}
