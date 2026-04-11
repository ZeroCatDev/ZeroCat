/**
 * .eslint.js
 *
 * ESLint configuration file.
 */

module.exports = {
  env: {
    node: true,
  },
  extends: [
    'vuetify',
    './.eslintrc-auto-import.json',
    'prettier',
  ],
  rules: {
    'vue/multi-word-component-names': 'off',
  },
}
