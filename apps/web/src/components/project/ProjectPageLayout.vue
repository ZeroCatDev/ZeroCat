<template>
  <v-container>
    <div class="project-layout">
      <div class="project-main">
        <slot name="main" />
      </div>
      <div class="project-sidebar">
        <slot name="sidebar" />
      </div>
    </div>
  </v-container>
</template>

<style scoped>
.project-layout {
  display: flex;
  gap: 24px;
}
.project-main {
  flex: 0 0 72%;
  max-width: 72%;
  min-width: 0;
}
.project-sidebar {
  flex: 0 0 calc(28% - 24px);
  max-width: calc(28% - 24px);
  min-width: 0;
}
@media (max-width: 959px) {
  .project-layout {
    flex-direction: column;
    gap: 16px;
  }
  .project-main,
  .project-sidebar {
    flex: 1 1 100%;
    max-width: 100%;
  }
}
</style>
