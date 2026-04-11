export default function open(id, type, username, projectname) {
  if (type == "scratch" || type == "scratch3") {
    let editorUrl = "/scratch/editor.html?id=" + id;
    if (localStorage.getItem("embedurl")) {
      editorUrl = localStorage.getItem("embedurl") + "/editor.html?id=" + id;
    }
    window.open(editorUrl);
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
