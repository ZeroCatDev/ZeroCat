import request from "@/axios/axios";

async function issueScratchEditorToken(projectId) {
  try {
    const { data } = await request.post("/account/editor-token", {
      project_id: Number(projectId),
    });
    if (data?.status === "success" && data?.token) {
      return data;
    }
  } catch (error) {
    console.warn("Failed to issue Scratch editor token:", error);
  }
  return null;
}

function buildScratchEditorUrl(id, editorSession) {
  let editorUrl = "/scratch/editor.html?id=" + id;
  if (localStorage.getItem("embedurl")) {
    editorUrl = localStorage.getItem("embedurl") + "/editor.html?id=" + id;
  }

  const url = new URL(editorUrl, window.location.origin);
  if (editorSession?.token) {
    url.searchParams.set("token", editorSession.token);
    url.searchParams.set("expires_at", editorSession.expires_at || "");
    url.searchParams.set("editor_project_id", String(editorSession.project_id || id));
    url.searchParams.set("can_edit", editorSession.access?.can_edit ? "1" : "0");
    url.searchParams.set("can_manage", editorSession.access?.can_manage ? "1" : "0");
    if (editorSession.user?.id) {
      url.searchParams.set("user_id", String(editorSession.user.id));
    }
  }
  return url.toString();
}

export default async function open(id, type, username, projectname) {
  if (type == "scratch" || type == "scratch3") {
    const editorWindow = window.open("about:blank");
    const editorSession = await issueScratchEditorToken(id);
    const editorUrl = buildScratchEditorUrl(id, editorSession);
    if (editorWindow) {
      editorWindow.location.href = editorUrl;
    } else {
      window.open(editorUrl);
    }
    return;
  }
  if (type == "scratch-clipcc") {
    window.open("/clipcc/index.html?id=" + id);
  }
  if (type == "scratch-02engine") {
    window.open("/02engine/index.html?id=" + id);
  }
  if (type == "python") {
    window.open("/python/edit.html?id=" + id);
  }
  if (type == "text") {
    window.open("/python/edit.html?id=" + id);
  }
  if (type == "article") {
    if (username && projectname) {
      window.location.href = `/${username}/articles/${projectname}/edit`;
    } else {
      window.location.href = `/app/articles/edit?id=${id}`;
    }
  }
}
