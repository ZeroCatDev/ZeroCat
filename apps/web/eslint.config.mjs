import vuetify from "eslint-config-vuetify";

export default await vuetify(
  {
    autoimports: true,
  },
  {
    rules: {
      "vue/multi-word-component-names": "off",
    },
  }
);
