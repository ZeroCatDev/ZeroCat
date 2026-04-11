<template>
  <v-container>
    <v-btn color="primary" dark @click="drawer = !drawer">
      Toggle drawer
    </v-btn>
    <v-navigation-drawer
      v-model="drawer"
      :width="$vuetify.display.mdAndUp ? 420 : 280"
      floating
      location="end"
      temporary
    >
      <template #prepend>
        <v-card-item
          class="bg-primary py-6"
          subtitle="Lorem, ipsum dolor sit amet consectetur adipisicing elit."
          title="New project"
        >
          <template #append>
            <v-btn
              class="mt-n6"
              density="compact"
              icon="$close"
              variant="text"
              @click="drawer = false"
            />
          </template>
        </v-card-item>
      </template>
      <div class="pa-4">
        <v-text-field dirty label="Project name" variant="outlined"/>
        <v-textarea dirty label="Description" variant="outlined"/>
        <v-input>
          <v-field dirty label="Team members" variant="outlined">
            <div class="d-flex ga-2 pa-4">
              <v-avatar
                class="cursor-pointer"
                image="https://vuetifyjs.b-cdn.net/avatar/john-smirk.png"
                size="small"
              />
              <v-avatar
                class="cursor-pointer"
                image="https://vuetifyjs.b-cdn.net/avatar/john.png"
                size="small"
              />
              <v-avatar
                class="cursor-pointer"
                image="https://vuetifyjs.b-cdn.net/avatar/john-beard.png"
                size="small"
              />
              <v-avatar
                class="cursor-pointer"
                image="https://vuetifyjs.b-cdn.net/avatar/john.jpg"
                size="small"
              />
              <v-avatar
                class="border-md border-dashed border-opacity-12 cursor-pointer"
                icon="mdi-plus"
                size="small"
              />
            </div>
          </v-field>
        </v-input>
        <v-input>
          <v-field dirty label="Tags" variant="outlined">
            <v-chip-group class="pa-2" column>
              <v-chip color="primary" text="Design"/>
              <v-chip color="primary" text="Development"/>
              <v-chip color="primary" text="Marketing"/>
              <v-chip color="primary" text="SEO"/>
              <v-chip color="primary" text="Management"/>
            </v-chip-group>
          </v-field>
        </v-input>
        <v-radio-group class="ms-n4" color="primary" label="Privacy">
          <v-radio class="mb-4" value="public">
            <template #label>
              <div class="text-body-2">
                <strong>Public access</strong>
                <div>Everyone with the link will see this project</div>
              </div>
            </template>
          </v-radio>
          <v-radio class="mb-4" value="private">
            <template #label>
              <div class="text-body-2">
                <strong>Private access</strong>
                <div>Only team members can see this project</div>
              </div>
            </template>
          </v-radio>
          <v-radio class="mb-4" value="custom">
            <template #label>
              <div class="text-body-2">
                <strong>Custom access</strong>
                <div>Choose who can see this project</div>
              </div>
            </template>
          </v-radio>
        </v-radio-group>
        <v-divider class="mb-4"/>
        <v-btn
          class="text-none"
          color="primary"
          prepend-icon="mdi-link-variant"
          slim
          text="Copy link"
          variant="text"
        />
        <br/>
        <v-btn
          class="text-none"
          color="medium-emphasis"
          prepend-icon="mdi-help-circle"
          slim
          text="Learn more about sharing"
          variant="text"
        />
      </div>
      <template #append>
        <v-divider/>
        <div class="d-flex justify-end px-4 py-2 ga-4">
          <v-btn border class="text-none" flat rounded="lg" text="Cancel"/>
          <v-btn
            class="text-none"
            color="primary"
            flat
            rounded="lg"
            text="Save"
          />
        </div>
      </template>
    </v-navigation-drawer>
    <v-container class="pa-md-12">
      <v-list
        border
        class="pb-4 mx-auto"
        lines="two"
        max-width="600"
        rounded="lg"
        slim
      >
        <v-list-item>
          <template #prepend>
            <v-badge
              bordered
              class="me-n2"
              color="amber"
              icon="mdi-star"
              location="bottom end"
              offset-x="4"
              offset-y="8"
            >
              <v-avatar color="surface-variant"/>
            </v-badge>
          </template>
          <template #title>
            <strong>johnleider</strong>
            <span class="text-medium-emphasis font-weight-light">
              starred a repository
            </span>
          </template>
          <template #subtitle>
            <span class="font-weight-regular text-caption">3 hours ago</span>
          </template>
          <template #append>
            <v-btn
              class="mt-n4"
              icon="mdi-dots-horizontal"
              size="small"
              variant="text"
            />
          </template>
        </v-list-item>
        <v-list
          :lines="false"
          bg-color="surface-light"
          class="mx-4 pb-5"
          color="surface-light"
          density="compact"
          rounded="lg"
        >
          <v-list-item>
            <template #prepend>
              <v-avatar class="me-n2" color="surface-variant" size="18"/>
            </template>
            <template #title><strong>vuetifyjs/one</strong></template>
            <template #append>
              <v-btn-group
                border
                color="primary"
                density="compact"
                rounded="lg"
                size="x-small"
              >
                <v-btn
                  class="text-none"
                  prepend-icon="mdi-star-outline"
                  text="Star"
                />
                <v-divider color="surface-light" vertical/>
                <v-btn class="px-5" icon="mdi-menu-down"/>
              </v-btn-group>
            </template>
          </v-list-item>
          <div class="ps-4">
            <div class="mb-3 text-body-2">
              <span class="pe-1">✨</span> Binding the Vuetify ecosystem
            </div>
            <div class="d-flex align-center text-caption">
              <div class="me-4">
                <v-badge color="primary" dot inline/>
                TypeScript
              </div>
              <div class="d-flex align-center">
                <v-icon icon="mdi-star-outline"/>
                431
              </div>
            </div>
          </div>
        </v-list>
      </v-list>
    </v-container>
    <v-row>
      <v-col>
        <v-toolbar color="primary" dark>
          <v-toolbar-title>Test UI</v-toolbar-title>
          <v-spacer></v-spacer>
          <v-btn icon>
            <v-icon>mdi-magnify</v-icon>
          </v-btn>
          <v-btn icon>
            <v-icon>mdi-bell</v-icon>
          </v-btn>
          <v-btn icon>
            <v-icon>mdi-account-circle</v-icon>
          </v-btn>
        </v-toolbar>
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="3">
        <v-list dense>
          <v-list-item>
            <v-list-item-content>
              <v-list-item-title>Dashboard</v-list-item-title>
            </v-list-item-content>
          </v-list-item>
          <v-list-item>
            <v-list-item-content>
              <v-list-item-title>Repositories</v-list-item-title>
            </v-list-item-content>
          </v-list-item>
          <v-list-item>
            <v-list-item-content>
              <v-list-item-title>Issues</v-list-item-title>
            </v-list-item-content>
          </v-list-item>
          <v-list-item>
            <v-list-item-content>
              <v-list-item-title>Pull Requests</v-list-item-title>
            </v-list-item-content>
          </v-list-item>
        </v-list>
      </v-col>
      <v-col cols="9">
        <v-card>
          <v-card-title>Welcome to Test UI</v-card-title>
          <v-card-text>
            This is a simple UI built with Vuetify to resemble common Test
            components.
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
    <v-footer class="text-center d-flex flex-column py-sm-16 py-8">
      <v-row justify="center" no-gutters>
        <v-btn
          v-for="link in links"
          :key="link.text"
          :href="link.url"
          :text="link.text"
          class="mx-2 text-none"
          rounded
          variant="text"
        />
      </v-row>
      <div class="my-5">
        <v-btn
          v-for="social in socialIcons"
          :key="social.icon"
          :href="social.url"
          :icon="social.icon"
          class="mx-4"
          variant="text"
        />
      </div>
      <p class="text-caption">
        &copy; 2016-{{ new Date().getFullYear() }} Vuetify. All rights reserved.
      </p>
    </v-footer>
  </v-container>
</template>
<script>
export default {
  name: "TestPage",
  data() {
    return {
      drawer: false,
      links: [
        {text: "主页", url: "/"},
        {text: "在线状态", url: "https://status.wuyuan.dev"},
        {text: "博客", url: "https://wuyuan.dev"},],
      socialIcons: [
        {icon: "mdi-github", url: "https://github.com/sunwuyuan"},
      ]
    };
  },
  watch: {
    drawer(val) {
      if (val) {
        setTimeout(() => {
          this.drawer = true;
        }, 1000);
      }
    },
  },
};
</script>
<style scoped>
.v-toolbar {
  margin-bottom: 20px;
}
</style>
