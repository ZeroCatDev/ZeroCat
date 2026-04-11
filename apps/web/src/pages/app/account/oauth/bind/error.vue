<template>
  <v-container>
    <v-card>
      <v-card-title>
        绑定失败
      </v-card-title>
      <v-card-text>
        绑定失败，请重试。
        <br/><br/>
        <div v-if="$route.query.message">
          <v-alert type="error">
            {{ $route.query.message }}
          </v-alert>
        </div>
      </v-card-text>
    </v-card>
  </v-container>
</template>
<script setup>
</script>
