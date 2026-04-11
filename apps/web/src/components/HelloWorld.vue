<template>
  <v-container class="fill-height">
    <v-responsive class="align-centerfill-height mx-auto" max-width="900">
      <v-img class="mb-4" height="150" src="@/assets/logo.png"/>

      <div class="text-center">
        <div class="text-body-2 font-weight-light mb-n1">Welcome to</div>

        <h1 class="text-h2 font-weight-bold">ZeroCat</h1>
      </div>

      <div class="py-4"/>

      <v-row>
        <v-col cols="12">
          <v-card
            append-icon="mdi-arrow-right"
            class="py-4"
            color="surface-variant"
            prepend-icon="mdi-rocket-launch-outline"
            rounded="lg"
            to="/projects"
            variant="outlined"
          >
            <template #image>
              <v-img position="top right"/>
            </template>

            <template #title>
              <h2 class="text-h5 font-weight-bold">浏览作品</h2>
            </template>

            <template #subtitle>
              <div class="text-subtitle-1">
                立刻浏览zerocat上的
                <v-kbd> Scratch</v-kbd>
                和
                <v-kbd>
                  Python
                </v-kbd
                >
                作品！
              </div>
            </template>

            <v-overlay
              contained
              model-value
              opacity=".12"
              persistent
              scrim="primary"
            />
          </v-card>
        </v-col>
        <!--
        <v-col cols="6">
          <v-card
            append-icon="mdi-open-in-new"
            class="py-4"
            color="surface-variant"
            href="https://vuetifyjs.com/"
            prepend-icon="mdi-text-box-outline"
            rel="noopener noreferrer"
            rounded="lg"
            subtitle="Learn about all things Vuetify in our documentation."
            target="_blank"
            title="Documentation"
            variant="text"
          >
            <v-overlay
              opacity=".06"
              scrim="primary"
              contained
              model-value
              persistent
            />
          </v-card>
        </v-col>

        <v-col cols="6">
          <v-card
            append-icon="mdi-open-in-new"
            class="py-4"
            color="surface-variant"
            href="https://vuetifyjs.com/introduction/why-vuetify/#feature-guides"
            prepend-icon="mdi-star-circle-outline"
            rel="noopener noreferrer"
            rounded="lg"
            subtitle="Explore available framework Features."
            target="_blank"
            title="Features"
            variant="text"
          >
            <v-overlay
              opacity=".06"
              scrim="primary"
              contained
              model-value
              persistent
            />
          </v-card>
        </v-col>-->

        <v-col cols="6">
          <v-card
            append-icon="mdi-open-in-new"
            class="py-4"
            color="surface-variant"
            href="https://github.com/zerocatdev"
            prepend-icon="mdi-github"
            rel="noopener noreferrer"
            rounded="lg"
            subtitle="ZeroCat开放所有项目代码，欢迎star支持"
            target="_blank"
            title="开源"
            variant="text"
          >
            <v-overlay
              contained
              model-value
              opacity=".06"
              persistent
              scrim="primary"
            />
          </v-card>
        </v-col>

        <v-col cols="6">
          <v-card
            append-icon="mdi-open-in-new"
            class="py-4"
            color="surface-variant"
            href="https://wuyuan.dev"
            prepend-icon="mdi-account-outline"
            rel="noopener noreferrer"
            rounded="lg"
            subtitle="社区开发者"
            target="_blank"
            title="孙悟元"
            variant="text"
          >
            <v-overlay
              contained
              model-value
              opacity=".06"
              persistent
              scrim="primary"
            />
          </v-card>
        </v-col>
      </v-row>
    </v-responsive>
  </v-container>
</template>

<script setup>
//
</script>
