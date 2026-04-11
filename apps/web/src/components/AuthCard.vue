<template>
  <div class="auth-wrapper d-flex align-center justify-center pa-4">
    <v-card border class="auth-card pa-4 pt-7" max-width="448" rounded="xl">
      <v-row>
        <v-col cols="12">
          <v-cardtext>
            <h5 class="text-h5 font-weight-semibold mb-1">
              欢迎来到ZeroCat！ 👋🏻
            </h5>
            <p class="mb-0">{{ subtitle }}</p>
          </v-cardtext>
        </v-col>
      </v-row>

      <v-cardtext>
        <slot></slot>
      </v-cardtext>
    </v-card>
  </div>
</template>

<script>
export default {
  name: 'AuthCard',
  props: {
    subtitle: {
      type: String,
      required: true
    }
  }
}
</script>
