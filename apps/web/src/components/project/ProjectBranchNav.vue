<template>
  <div class="mb-2" style="display: flex; justify-content: space-between">
    <div>
      <v-menu :close-on-content-click="false">
        <template v-slot:activator="{ props }">
          <v-btn
            append-icon="mdi-menu-down"
            class="text-none"
            prepend-icon="mdi-git"
            rounded="lg"
            v-bind="props"
            variant="tonal"
          >
            <template v-slot:prepend>
              <v-icon/>
            </template>
            {{ currentBranch }}
          </v-btn>
        </template>

        <v-list dense>
          <v-list-item
            v-for="item in branches"
            :key="item"
            :active="item.name === currentBranch"
            :subtitle="item.description"
            :title="item.name"
            :value="item.name"
            @click="navigateToBranch(item.name)"
          ></v-list-item>
        </v-list>
      </v-menu>
      <v-btn
        :to="`/${username}/${projectname}/branches`"
        class="ml-2"
        variant="text"
      >{{ branches.length }}个分支
      </v-btn
      >
    </div>
    <v-menu :close-on-content-click="false">
      <template v-slot:activator="{ props }">
        <v-btn
          append-icon="mdi-menu-down"
          class="text-none"
          prepend-icon="mdi-history"
          rounded="lg"
          v-bind="props"
          variant="tonal"
        >
          <template v-slot:prepend>
            <v-icon/>
          </template>
          {{ branchHistory.length }} 次提交
        </v-btn>
      </template>

      <v-list dense>
        <v-list-item
          v-for="item in branchHistory"
          :key="item"
          :active="item.id === currentCommitId"
          :subtitle="`${item.commit_date} - #${item.author_id}`"
          :title="item.commit_message"
          @click="navigateToCommit(item.id)"
        ></v-list-item>
      </v-list>
    </v-menu>
  </div>
</template>

<script>
export default {
  name: 'ProjectBranchNav',
  props: {
    username: {
      type: String,
      required: true
    },
    projectname: {
      type: String,
      required: true
    },
    currentBranch: {
      type: String,
      required: true
    },
    currentCommitId: {
      type: String,
      default: 'latest'
    },
    branches: {
      type: Array,
      required: true
    },
    branchHistory: {
      type: Array,
      required: true
    }
  },
  methods: {
    navigateToBranch(branchName) {
      this.$router.push(
        `/${this.username}/${this.projectname}/tree/${branchName}`
      );
    },
    navigateToCommit(commitId) {
      this.$router.push(
        `/${this.username}/${this.projectname}/commit/${commitId}`
      );
    }
  }
}
</script>
