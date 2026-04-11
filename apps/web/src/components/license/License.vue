<template>
  <div v-if="license">
    <v-card :subtitle="licenseKey" :title="license.title">
      <v-card-text>
        <p>{{ license.description }}</p>
        <v-card title="限制">
          <v-list dense lines="two">
            <v-list-item
              v-for="(limitation, key) in license.limitations"
              :key="key"
            >
              <v-list-item-content>
                <v-list-item-title>{{
                  rules.limitations[limitation]?.label || limitation
                  }}
                </v-list-item-title>
                <v-list-item-subtitle>{{
                  rules.limitations[limitation]?.description || ""
                  }}
                </v-list-item-subtitle>
              </v-list-item-content>
            </v-list-item>
          </v-list>
        </v-card
        >
        <v-card title="条件">
          <v-list dense lines="two">
            <v-list-item
              v-for="(condition, key) in license.conditions"
              :key="key"
            >
              <v-list-item-content>
                <v-list-item-title>{{
                  rules.conditions[condition]?.label || condition
                  }}
                </v-list-item-title>
                <v-list-item-subtitle>{{
                  rules.conditions[condition]?.description || ""
                  }}
                </v-list-item-subtitle>
              </v-list-item-content>
            </v-list-item>
          </v-list>
        </v-card
        >
        <v-card title="权限">
          <v-list dense lines="two">
            <v-list-item
              v-for="(permission, key) in license.permissions"
              :key="key"
            >
              <v-list-item-content>
                <v-list-item-title>{{
                  rules.permissions[permission]?.label || permission
                  }}
                </v-list-item-title>
                <v-list-item-subtitle>{{
                  rules.permissions[permission]?.description || ""
                  }}
                </v-list-item-subtitle>
              </v-list-item-content>
            </v-list-item>
          </v-list>
        </v-card
        >
        <v-card title="许可证原文">
          <template v-slot:text
          >
            <pre>{{ license.body }}</pre>
          </template>
        </v-card
        >
      </v-card-text>
    </v-card>
  </div>
</template>

<script>
import licenses from "./licenses.json";
import rules from "./rules.json";

export default {
  name: "License",
  props: {
    licenseKey: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      license: null,
      rules: rules,
    };
  },
  watch: {
    licenseKey: {
      handler(newVal) {
        this.updateLicenseData(newVal);
      },
      immediate: true,
    },
  },
  methods: {
    updateLicenseData(key) {
      this.license = licenses[key] || {
        "title": "项目未指定许可证",
        "spdx-id": "none",
        "hidden": false,
        "description": "项目未指定许可证，一般来说这意味着作者保留了所有权利，或者作者无权继续授予权利。在这种情况下，你应该尝试联系作者，向其获得私人授权或建议使用许可证。",
        "how": "",
        "permissions": [],
        "conditions": [],
        "limitations": [],
        "body": ""
      };
    },
  },
};
</script>

<style scoped>
/* ...existing styles... */
</style>
