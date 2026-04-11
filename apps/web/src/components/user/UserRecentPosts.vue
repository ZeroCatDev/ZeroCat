<template>
  <v-card rounded="lg" border>
    <!-- Twitter-style Post Type Tabs -->
    <v-tabs
      v-model="activeTab"
      color="primary"
      density="comfortable"
      grow
      slider-color="primary"
    >
      <v-tab
        v-for="tab in availableTabs"
        :key="tab.value"
        :value="tab.value"
        class="text-none font-weight-medium"
      >
        {{ tab.label }}
      </v-tab>
    </v-tabs>

    <v-divider />

    <!-- Posts Content -->
    <PostList
      :items="posts"
      :includes="postsIncludes"
      :loading="loading"
      :loading-more="loadingMore"
      :has-more="hasMore"
      :empty-title="emptyTitle"
      :empty-text="emptyText"
      @deleted="removePost"
      @load-more="loadMore"
    />
  </v-card>
</template>

<script>
import PostList from "@/components/posts/PostList.vue";
import PostsService from "@/services/postsService";
import { localuser } from "@/services/localAccount";

export default {
  name: "UserRecentPosts",
  components: {
    PostList,
  },
  props: {
    userId: {
      type: [Number, String],
      required: true,
    },
    username: {
      type: String,
      required: true,
    },
    displayName: {
      type: String,
      default: "",
    },
  },
  data() {
    return {
      activeTab: "originals",
      posts: [],
      postsIncludes: { posts: {} },
      loading: false,
      loadingMore: false,
      cursor: null,
      hasMore: true,
    };
  },
  computed: {
    isCurrentUser() {
      return (
        localuser.user.value?.id &&
        Number(localuser.user.value.id) === Number(this.userId)
      );
    },
    availableTabs() {
      const tabs = [
        { value: "originals", label: "帖子" },
        { value: "replies", label: "回复" },
        { value: "media", label: "媒体" },
      ];
      if (this.isCurrentUser) {
        tabs.push({ value: "likes", label: "喜欢" });
        tabs.push({ value: "bookmarks", label: "收藏" });
      }
      return tabs;
    },
    emptyTitle() {
      const titles = {
        originals: "暂无帖子",
        replies: "暂无回复",
        media: "暂无媒体",
        likes: "暂无喜欢",
        bookmarks: "暂无收藏",
      };
      return titles[this.activeTab] || "暂无内容";
    },
    emptyText() {
      const name = this.displayName || "该用户";
      const texts = {
        originals: `${name}还没有发布任何帖子`,
        replies: `${name}还没有回复任何帖子`,
        media: `${name}还没有发布包含媒体的帖子`,
        likes: "还没有喜欢任何帖子",
        bookmarks: "还没有收藏任何帖子",
      };
      return texts[this.activeTab] || "这里还没有任何内容";
    },
  },
  watch: {
    userId: {
      handler() {
        this.fetchPosts(true);
      },
      immediate: true,
    },
    activeTab() {
      this.fetchPosts(true);
    },
  },
  methods: {
    async fetchPosts(isInitial = false) {
      if (!this.userId) return;

      if (isInitial) {
        this.loading = true;
        this.cursor = null;
        this.posts = [];
        this.postsIncludes = { posts: {} };
      } else {
        this.loadingMore = true;
      }

      try {
        let res;
        const params = {
          cursor: isInitial ? undefined : this.cursor,
          limit: 20,
        };

        switch (this.activeTab) {
          case "originals":
            res = await PostsService.getUserOriginals(this.userId, params);
            break;
          case "replies":
            res = await PostsService.getUserReplies(this.userId, params);
            if (res.items) {
              res = {
                posts: res.items.map((item) => item.post || item),
                includes: res.includes,
                nextCursor: res.nextCursor,
                hasMore: res.hasMore,
              };
            }
            break;
          case "media":
            res = await PostsService.getUserMedia(this.userId, params);
            break;
          case "likes":
            res = await PostsService.getUserLikes(this.userId, params);
            break;
          case "bookmarks":
            res = await PostsService.getUserBookmarks(this.userId, params);
            break;
          default:
            res = await PostsService.getUserOriginals(this.userId, params);
        }

        if (isInitial) {
          this.posts = res.posts || [];
          this.postsIncludes = res.includes || { posts: {} };
        } else {
          this.posts.push(...(res.posts || []));
          Object.assign(this.postsIncludes.posts, res.includes?.posts || {});
        }

        this.cursor = res.nextCursor;
        this.hasMore = res.hasMore;
      } catch (e) {
        console.error("Failed to fetch posts:", e);
      } finally {
        this.loading = false;
        this.loadingMore = false;
      }
    },
    loadMore() {
      if (!this.hasMore || this.loadingMore || this.loading) return;
      this.fetchPosts(false);
    },
    removePost(postId) {
      this.posts = this.posts.filter((p) => (p?.id ?? p?.postId) !== postId);
    },
  },
};
</script>
