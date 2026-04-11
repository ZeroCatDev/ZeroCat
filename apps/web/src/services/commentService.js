import request from "@/axios/axios";

// ===== Space CRUD =====

export function getSpaces() {
  return request.get("/commentservice/spaces").then((r) => r.data);
}

export function getSpace(cuid) {
  return request.get(`/commentservice/spaces/${cuid}`).then((r) => r.data);
}

export function createSpace(data) {
  return request.post("/commentservice/spaces", data).then((r) => r.data);
}

export function updateSpace(cuid, data) {
  return request.put(`/commentservice/spaces/${cuid}`, data).then((r) => r.data);
}

export function deleteSpace(cuid) {
  return request.delete(`/commentservice/spaces/${cuid}`).then((r) => r.data);
}

// ===== Space Config =====

export function getSpaceConfig(cuid) {
  return request.get(`/commentservice/spaces/${cuid}/config`).then((r) => r.data);
}

export function updateSpaceConfig(cuid, data) {
  return request.put(`/commentservice/spaces/${cuid}/config`, data).then((r) => r.data);
}

// ===== Space Stats =====

export function getSpaceStats(cuid) {
  return request.get(`/commentservice/spaces/${cuid}/stats`).then((r) => r.data);
}

// ===== Comments =====

export function getSpaceComments(cuid, params = {}) {
  return request
    .get(`/commentservice/spaces/${cuid}/comments`, { params })
    .then((r) => r.data);
}

export function updateComment(cuid, id, data) {
  return request
    .put(`/commentservice/spaces/${cuid}/comments/${id}`, data)
    .then((r) => r.data);
}

export function deleteComment(cuid, id) {
  return request
    .delete(`/commentservice/spaces/${cuid}/comments/${id}`)
    .then((r) => r.data);
}

// ===== Users =====

export function getSpaceUsers(cuid, params = {}) {
  return request
    .get(`/commentservice/spaces/${cuid}/users`, { params })
    .then((r) => r.data);
}

export function updateSpaceUser(cuid, userId, data) {
  return request
    .put(`/commentservice/spaces/${cuid}/users/${userId}`, data)
    .then((r) => r.data);
}

// ===== My Comments =====

export function getMyComments(params = {}) {
  return request
    .get("/commentservice/my/comments", { params })
    .then((r) => r.data);
}

// ===== Waline Login =====

export function walineLogin(spaceCuid) {
  return request
    .post("/commentservice/ui/login", { spaceCuid })
    .then((r) => r.data);
}

// ===== Data Import/Export =====

export function exportSpaceData(cuid) {
  return request
    .post(`/commentservice/spaces/${cuid}/data/export`)
    .then((r) => r.data);
}

export function importSpaceData(cuid, data) {
  return request
    .post(`/commentservice/spaces/${cuid}/data/import`, data)
    .then((r) => r.data);
}

export function getDataTasks(cuid) {
  return request
    .get(`/commentservice/spaces/${cuid}/data/tasks`)
    .then((r) => r.data);
}

export function getDataTask(cuid, taskId) {
  return request
    .get(`/commentservice/spaces/${cuid}/data/tasks/${taskId}`)
    .then((r) => r.data);
}

export function downloadDataTask(cuid, taskId) {
  return request.get(
    `/commentservice/spaces/${cuid}/data/tasks/${taskId}/download`,
    { responseType: "blob" },
  );
}

// ===== Admin =====

export function getAdminSensitiveWords() {
  return request
    .get("/commentservice/admin/sensitive-words")
    .then((r) => r.data);
}

export function updateAdminSensitiveWords(data) {
  return request
    .put("/commentservice/admin/sensitive-words", data)
    .then((r) => r.data);
}

export function getAdminBanDuration() {
  return request
    .get("/commentservice/admin/sensitive-ban-duration")
    .then((r) => r.data);
}

export function updateAdminBanDuration(data) {
  return request
    .put("/commentservice/admin/sensitive-ban-duration", data)
    .then((r) => r.data);
}

export function getAdminSpaces(params = {}) {
  return request
    .get("/commentservice/admin/spaces", { params })
    .then((r) => r.data);
}

export function getAdminSpace(spaceId) {
  return request
    .get(`/commentservice/admin/spaces/${spaceId}`)
    .then((r) => r.data);
}

export function updateAdminSpaceStatus(spaceId, data) {
  return request
    .put(`/commentservice/admin/spaces/${spaceId}/status`, data)
    .then((r) => r.data);
}

export function getAdminViolations(params = {}) {
  return request
    .get("/commentservice/admin/violations", { params })
    .then((r) => r.data);
}
