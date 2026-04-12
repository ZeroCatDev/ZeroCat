<template>
  <UserHoverCard :username="username" inline>
    <router-link
      :to="profileLink"
      class="user-mention-link"
      :class="{ 'user-mention-link--styled': styled }"
      @click.stop
    >
      <slot>@{{ username }}</slot>

    </router-link>
  </UserHoverCard>
</template>

<script setup>
import { computed } from "vue";
import UserHoverCard from "@/components/UserHoverCard.vue";

const props = defineProps({
  /** 用户名 */
  username: {
    type: String,
    required: true,
  },
  /** 是否为联邦用户（@user@domain 格式） */
  domain: {
    type: String,
    default: "",
  },
  /** 是否使用主题色样式 */
  styled: {
    type: Boolean,
    default: true,
  },
});

const profileLink = computed(() => {
  if (props.domain) {
    return `/${props.username}@${props.domain}`;
  }
  return `/${props.username}`;
});
</script>

<style scoped>
.user-mention-link {
  text-decoration: none;
  color: inherit;
}

.user-mention-link--styled {
  color: rgb(var(--v-theme-primary));
}

.user-mention-link:hover {
  text-decoration: underline;
}
</style>
