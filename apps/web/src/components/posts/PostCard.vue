<template>
  <article
    ref="cardRootRef"
    class="post-card"
    :class="{
      'post-card--deleted': isDeleted,
      'post-card--retweet': isRetweet,
      'post-card--highlight': highlight,
      'post-card--featured': featured,
    }"
  >
    <!-- ==================== Featured (主帖) 模式 ==================== -->
    <template v-if="featured">
      <div class="post-featured">
        <!-- Header -->
        <div class="post-featured-header">
          <UserHoverCard :username="authorUsername" inline>
            <v-avatar size="48" class="post-featured-avatar" @click.stop="goUser">
              <v-img :src="authorAvatar" :alt="authorUsername" />
            </v-avatar>
          </UserHoverCard>
          <UserHoverCard :username="authorUsername" inline>
            <router-link
              :to="`/${authorUsername}`"
              class="post-featured-author-link"
              @click.stop
            >
              <div class="post-featured-display-name">{{ authorDisplayName }}</div>
              <div class="post-featured-username">@{{ authorUsername }}</div>
            </router-link>
          </UserHoverCard>
          <v-spacer />
          <v-menu
            v-if="!isDeleted"
            location="bottom end"
            @update:model-value="onMenuOpen"
          >
            <template #activator="{ props: menuProps }">
              <v-btn
                v-bind="menuProps"
                icon
                size="small"
                variant="text"
                @click.stop
              >
                <v-icon size="18">mdi-dots-horizontal</v-icon>
              </v-btn>
            </template>
            <v-list density="compact" class="post-menu-list">
              <v-list-item
                v-if="!isSelf && followStatus !== null && !isBlocked"
                :disabled="followLoading"
                @click="toggleFollow"
              >
                <template #prepend>
                  <v-icon size="18">{{ isFollowing ? "mdi-account-minus-outline" : "mdi-account-plus-outline" }}</v-icon>
                </template>
                <v-list-item-title>{{ isFollowing ? `取消关注 @${authorUsername}` : `关注 @${authorUsername}` }}</v-list-item-title>
              </v-list-item>
              <v-list-item
                v-if="!isSelf && followStatus !== null"
                :disabled="followLoading"
                :class="{ 'text-error': !isBlocked }"
                @click="toggleBlock"
              >
                <template #prepend>
                  <v-icon size="18">{{ isBlocked ? "mdi-account-check-outline" : "mdi-block-helper" }}</v-icon>
                </template>
                <v-list-item-title>{{ isBlocked ? `解除拉黑 @${authorUsername}` : `拉黑 @${authorUsername}` }}</v-list-item-title>
              </v-list-item>
              <v-list-item
                v-if="canDelete"
                class="text-error"
                @click="handleDeleteClick"
              >
                <template #prepend>
                  <v-icon size="18">mdi-delete-outline</v-icon>
                </template>
                <v-list-item-title>删除</v-list-item-title>
              </v-list-item>
              <v-list-item @click="copyLink">
                <template #prepend>
                  <v-icon size="18">mdi-link-variant</v-icon>
                </template>
                <v-list-item-title>复制链接</v-list-item-title>
              </v-list-item>
              <v-list-item @click="openAnalyticsPage">
                <template #prepend>
                  <v-icon size="18">mdi-chart-line</v-icon>
                </template>
                <v-list-item-title>查看分析</v-list-item-title>
              </v-list-item>
              <v-list-item @click="federationDialog = true">
                <template #prepend>
                  <v-icon size="18">mdi-access-point-network</v-icon>
                </template>
                <v-list-item-title>联邦社交数据</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
        </div>

        <!-- 已删除提示 -->
        <div v-if="isDeleted" class="post-deleted-notice">
          <v-icon size="16" class="mr-1">mdi-alert-circle-outline</v-icon>
          此帖文已被删除
        </div>

        <!-- 内容区 -->
        <template v-else>
          <div class="post-featured-body">
            <div
              v-if="displayContent"
              ref="postTextRef"
              class="post-featured-text"
              v-user-hover
              v-html="formattedContent"
            />

            <div
              v-if="canTranslateFeatured"
              class="post-featured-translate"
            >
              <v-btn
                variant="text"
                density="comfortable"
                prepend-icon="mdi-translate"
                :loading="translationLoading"
                @click.stop="toggleFeaturedTranslation"
              >
                {{ featuredTranslateButtonText }}
              </v-btn>
            </div>

            <div
              v-if="showTranslatedContent"
              class="post-featured-text post-featured-translation-text"
            >
              {{ translatedContent }}
            </div>

            <!-- 媒体 -->
            <div
              v-if="mediaItems.length"
              class="post-media post-featured-media"
              :class="mediaGridClass"
            >
              <div
                v-for="(media, idx) in mediaItems.slice(0, 4)"
                :key="media.id || idx"
                v-ripple
                class="post-media-item"
                @click.stop="openMediaViewer(idx)"
              >
                <v-img
                  :src="getMediaUrl(media)"
                  :cover="mediaItems.length > 1"
                  :max-height="mediaItems.length === 1 ? 600 : undefined"
                  class="post-media-img"
                >
                  <template #placeholder>
                    <div class="d-flex align-center justify-center fill-height">
                      <v-progress-circular indeterminate size="24" width="2" />
                    </div>
                  </template>
                </v-img>
                <div
                  v-if="idx === 3 && mediaItems.length > 4"
                  class="post-media-more"
                >
                  +{{ mediaItems.length - 4 }}
                </div>
              </div>
            </div>

            <!-- 嵌入内容 -->
            <PostEmbed
              v-if="embedData"
              :embed="embedData"
              class="mt-4"
              @click.stop
            />

            <!-- 引用帖子 -->
            <QuotedPost
              v-if="quotedPost"
              :post="quotedPost"
              :is-deleted="quotedPost.is_deleted"
              class="mt-4"
              @click.stop="goToQuotedPost"
            />
          </div>

          <!-- 时间 -->
          <div class="post-featured-time">
            <time :datetime="createdAt">{{ fullDateTime }}</time>
          </div>

          <!-- 统计 -->
          <div v-if="hasVisibleStats" class="post-featured-stats">
            <div v-if="stats.retweets > 0" class="post-featured-stat">
              <span class="post-featured-stat-value">{{ formatCount(stats.retweets) }}</span>
              <span class="post-featured-stat-label">转推</span>
            </div>
            <div v-if="stats.likes > 0" class="post-featured-stat">
              <span class="post-featured-stat-value">{{ formatCount(stats.likes) }}</span>
              <span class="post-featured-stat-label">喜欢</span>
            </div>
            <div v-if="stats.bookmarks > 0" class="post-featured-stat">
              <span class="post-featured-stat-value">{{ formatCount(stats.bookmarks) }}</span>
              <span class="post-featured-stat-label">书签</span>
            </div>
          </div>

          <!-- 操作栏 -->
          <div class="post-featured-actions">
            <div class="post-featured-actions-main">
              <button
                v-ripple
                class="post-featured-action post-featured-action--reply"
                @click.stop="handleFeaturedReply"
              >
                <v-icon size="22">mdi-chat-outline</v-icon>
              </button>
              <v-menu location="top">
                <template #activator="{ props: menuProps }">
                  <button
                    v-bind="menuProps"
                    v-ripple
                    class="post-featured-action post-featured-action--retweet"
                    :class="{ 'post-featured-action--active': isRetweeted }"
                    :disabled="actionLoading"
                    @click.stop
                  >
                    <v-icon size="22">mdi-repeat-variant</v-icon>
                  </button>
                </template>
                <v-list density="compact" class="post-menu-list">
                  <v-list-item @click="toggleRetweet">
                    <template #prepend>
                      <v-icon size="18">{{ isRetweeted ? 'mdi-repeat-off' : 'mdi-repeat-variant' }}</v-icon>
                    </template>
                    <v-list-item-title>{{ isRetweeted ? '取消转贴' : '转贴' }}</v-list-item-title>
                  </v-list-item>
                  <v-list-item @click="openQuoteDialog">
                    <template #prepend>
                      <v-icon size="18">mdi-format-quote-close</v-icon>
                    </template>
                    <v-list-item-title>引用</v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>
              <button
                v-ripple
                class="post-featured-action post-featured-action--like"
                :class="{ 'post-featured-action--active': isLiked }"
                @click.stop="toggleLike"
              >
                <v-icon size="22">{{ isLiked ? 'mdi-heart' : 'mdi-heart-outline' }}</v-icon>
              </button>
              <button
                v-if="stats.views > 0"
                v-ripple
                class="post-featured-action post-featured-action--views"
                aria-label="阅读量"
                @click.stop="openAnalyticsPage"
              >
                <v-icon size="20">mdi-poll</v-icon>
                <span class="post-featured-action-count">{{ formatCount(stats.views) }}</span>
              </button>
            </div>
            <div class="post-featured-actions-side">
              <button
                v-ripple
                class="post-featured-action post-featured-action--bookmark"
                :class="{ 'post-featured-action--active': isBookmarked }"
                @click.stop="toggleBookmark"
              >
                <v-icon size="22">{{ isBookmarked ? 'mdi-bookmark' : 'mdi-bookmark-outline' }}</v-icon>
              </button>
              <button
                v-ripple
                class="post-featured-action post-featured-action--share"
                @click.stop="sharePost"
              >
                <v-icon size="22">mdi-share-variant-outline</v-icon>
              </button>
            </div>
          </div>
        </template>
      </div>
    </template>

    <!-- ==================== 普通模式 ==================== -->
    <template v-else>
    <!-- 转推提示 -->
    <div v-if="retweetAuthor" class="post-retweet-indicator">
      <v-icon size="14" class="mr-2">mdi-repeat</v-icon>
      <router-link
        :to="`/${retweetAuthor.username || retweetAuthor.id}`"
        class="post-retweet-link"
        @click.stop
      >
        {{ retweetAuthor.display_name || retweetAuthor.username }} 转推了
      </router-link>
    </div>

    <!-- 回复提示 -->
    <div v-if="replyToPost && !hideReplyIndicator" class="post-reply-indicator">
      <v-icon size="14" class="mr-2">mdi-reply</v-icon>
      <span class="text-medium-emphasis">
        回复
        <router-link
          :to="`/${replyToPost.author?.username || replyToPost.author?.id}`"
          class="post-reply-link"
          @click.stop
        >
          @{{ replyToPost.author?.username || "用户" }}
        </router-link>
      </span>
    </div>

    <div v-ripple class="post-main" @click="openDetail">
      <!-- 头像 -->
      <div class="post-avatar-col">
        <UserHoverCard :username="authorUsername" inline>
          <v-avatar size="48" class="post-avatar" @click.stop="goUser">
            <v-img :src="authorAvatar" :alt="authorUsername" />
          </v-avatar>
        </UserHoverCard>
        <!-- 线程连接线 -->
        <div v-if="showThreadLine" class="post-thread-line" />
      </div>

      <!-- 内容区 -->
      <div class="post-content-col">
        <!-- 作者信息行 -->
        <div class="post-header">
          <UserHoverCard :username="authorUsername" inline>
            <router-link
              :to="`/${authorUsername}`"
              class="post-author-link"
              @click.stop
            >
              <span class="post-display-name">{{ authorDisplayName }}</span>
              <span class="post-username">@{{ authorUsername }}</span>
            </router-link>
          </UserHoverCard>
          <span class="post-separator">·</span>
          <time class="post-time" :datetime="createdAt" :title="fullDateTime">
            {{ timeAgo }}
          </time>
          <v-spacer />
          <v-menu
            v-if="!isDeleted"
            location="bottom end"
            @update:model-value="onMenuOpen"
          >
            <template #activator="{ props: menuProps }">
              <v-btn
                v-bind="menuProps"
                icon
                size="small"
                variant="text"
                class="post-menu-btn"
                @click.stop
              >
                <v-icon size="18">mdi-dots-horizontal</v-icon>
              </v-btn>
            </template>
            <v-list density="compact" class="post-menu-list">
              <!-- 关注/取关 (非自己的帖子) -->
              <v-list-item
                v-if="!isSelf && followStatus !== null && !isBlocked"
                :disabled="followLoading"
                @click="toggleFollow"
              >
                <template #prepend>
                  <v-icon size="18">{{
                    isFollowing
                      ? "mdi-account-minus-outline"
                      : "mdi-account-plus-outline"
                  }}</v-icon>
                </template>
                <v-list-item-title>{{
                  isFollowing
                    ? `取消关注 @${authorUsername}`
                    : `关注 @${authorUsername}`
                }}</v-list-item-title>
              </v-list-item>
              <!-- 拉黑/解除拉黑 (非自己的帖子) -->
              <v-list-item
                v-if="!isSelf && followStatus !== null"
                :disabled="followLoading"
                :class="{ 'text-error': !isBlocked }"
                @click="toggleBlock"
              >
                <template #prepend>
                  <v-icon size="18">{{
                    isBlocked ? "mdi-account-check-outline" : "mdi-block-helper"
                  }}</v-icon>
                </template>
                <v-list-item-title>{{
                  isBlocked
                    ? `解除拉黑 @${authorUsername}`
                    : `拉黑 @${authorUsername}`
                }}</v-list-item-title>
              </v-list-item>
              <!-- 删除 -->
              <v-list-item
                v-if="canDelete"
                class="text-error"
                @click="handleDeleteClick"
              >
                <template #prepend>
                  <v-icon size="18">mdi-delete-outline</v-icon>
                </template>
                <v-list-item-title>删除</v-list-item-title>
              </v-list-item>
              <!-- 复制链接 -->
              <v-list-item @click="copyLink">
                <template #prepend>
                  <v-icon size="18">mdi-link-variant</v-icon>
                </template>
                <v-list-item-title>复制链接</v-list-item-title>
              </v-list-item>
              <v-list-item @click="openAnalyticsPage">
                <template #prepend>
                  <v-icon size="18">mdi-chart-line</v-icon>
                </template>
                <v-list-item-title>查看分析</v-list-item-title>
              </v-list-item>
              <!-- 联邦社交数据 -->
              <v-list-item
                @click="federationDialog = true"
              >
                <template #prepend>
                  <v-icon size="18">mdi-access-point-network</v-icon>
                </template>
                <v-list-item-title>联邦社交数据</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
        </div>

        <!-- 已删除提示 -->
        <div v-if="isDeleted" class="post-deleted-notice">
          <v-icon size="16" class="mr-1">mdi-alert-circle-outline</v-icon>
          此帖文已被删除
        </div>

        <!-- 正文内容 -->
        <div v-else class="post-body">
          <div
            v-if="displayContent"
            ref="postTextRef"
            class="post-text"
            v-user-hover
            v-html="formattedContent"
          />

          <!-- 媒体展示 -->
          <div
            v-if="mediaItems.length"
            class="post-media"
            :class="mediaGridClass"
          >
            <div
              v-for="(media, idx) in mediaItems.slice(0, 4)"
              :key="media.id || idx"
              v-ripple
              class="post-media-item"
              @click.stop="openMediaViewer(idx)"
            >
              <v-img
                :src="getMediaUrl(media)"
                :cover="mediaItems.length > 1"
                :max-height="mediaItems.length === 1 ? 500 : undefined"
                class="post-media-img"
              >
                <template #placeholder>
                  <div class="d-flex align-center justify-center fill-height">
                    <v-progress-circular indeterminate size="24" width="2" />
                  </div>
                </template>
              </v-img>
              <div
                v-if="idx === 3 && mediaItems.length > 4"
                class="post-media-more"
              >
                +{{ mediaItems.length - 4 }}
              </div>
            </div>
          </div>

          <!-- 嵌入内容 -->
          <PostEmbed
            v-if="embedData && embedMode !== 'compact'"
            :embed="embedData"
            class="mt-3"
            @click.stop
          />

          <div
            v-else-if="showCompactEmbedNote"
            class="post-embed-note"
            @click.stop
          >
            <component
              :is="compactEmbedPrimaryLinkIsExternal ? 'a' : 'router-link'"
              v-if="showCompactEmbedPrimary && compactEmbedPrimaryLink"
              :href="
                compactEmbedPrimaryLinkIsExternal
                  ? compactEmbedPrimaryLink
                  : undefined
              "
              :to="
                compactEmbedPrimaryLinkIsExternal
                  ? undefined
                  : compactEmbedPrimaryLink
              "
              :target="compactEmbedPrimaryLinkIsExternal ? '_blank' : undefined"
              :rel="
                compactEmbedPrimaryLinkIsExternal
                  ? 'noopener noreferrer'
                  : undefined
              "
              class="post-embed-note-link"
              @click.stop
            >
              {{ compactEmbedPrimaryText }}
            </component>
            <span
              v-else-if="showCompactEmbedPrimary"
              class="post-embed-note-link"
              >{{ compactEmbedPrimaryText }}</span
            >

            <template v-for="marker in compactEmbedMarkers" :key="marker.key">
              <router-link
                v-if="marker.link"
                :to="marker.link"
                class="post-embed-note-link"
                @click.stop
              >
                {{ marker.text }}
              </router-link>
              <span v-else class="post-embed-note-link">{{ marker.text }}</span>
            </template>
          </div>

          <!-- 引用的帖子 -->
          <QuotedPost
            v-if="quotedPost"
            :post="quotedPost"
            :is-deleted="quotedPost.is_deleted"
            class="mt-3"
            @click.stop="goToQuotedPost"
          />
        </div>

        <!-- 操作栏 -->
        <div v-if="!isDeleted" class="post-actions">
          <div class="post-actions-main">
            <button
              v-ripple
              class="post-action post-action--reply"
              :disabled="actionLoading"
              @click.stop="openReplyDialog"
            >
              <v-icon size="18">mdi-chat-outline</v-icon>
              <span v-if="stats.replies > 0" class="post-action-count">
                {{ formatCount(stats.replies) }}
              </span>
            </button>

            <v-menu location="top">
              <template #activator="{ props: menuProps }">
                <button
                  v-bind="menuProps"
                  v-ripple
                  class="post-action post-action--retweet"
                  :class="{ 'post-action--active': isRetweeted }"
                  :disabled="actionLoading"
                  @click.stop
                >
                  <v-icon size="18">mdi-repeat-variant</v-icon>
                  <span v-if="stats.retweets > 0" class="post-action-count">
                    {{ formatCount(stats.retweets) }}
                  </span>
                </button>
              </template>
              <v-list density="compact" class="post-menu-list">
                <v-list-item @click="toggleRetweet">
                  <template #prepend>
                    <v-icon size="18">{{ isRetweeted ? 'mdi-repeat-off' : 'mdi-repeat-variant' }}</v-icon>
                  </template>
                  <v-list-item-title>{{ isRetweeted ? '取消转贴' : '转贴' }}</v-list-item-title>
                </v-list-item>
                <v-list-item @click="openQuoteDialog">
                  <template #prepend>
                    <v-icon size="18">mdi-format-quote-close</v-icon>
                  </template>
                  <v-list-item-title>引用</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>

            <button
              v-ripple
              class="post-action post-action--like"
              :class="{ 'post-action--active': isLiked }"
              :disabled="actionLoading"
              @click.stop="toggleLike"
            >
              <v-icon size="18">
                {{ isLiked ? "mdi-heart" : "mdi-heart-outline" }}
              </v-icon>
              <span v-if="stats.likes > 0" class="post-action-count">
                {{ formatCount(stats.likes) }}
              </span>
            </button>

            <button
              v-if="stats.views > 0"
              v-ripple
              class="post-action post-action--views"
              aria-label="阅读量"
              @click.stop="openAnalyticsPage"
            >
              <v-icon size="18">mdi-poll</v-icon>
              <span class="post-action-count">{{ formatCount(stats.views) }}</span>
            </button>
          </div>

          <div class="post-actions-side">
            <button
              v-ripple
              class="post-action post-action--bookmark"
              :class="{ 'post-action--active': isBookmarked }"
              :disabled="actionLoading"
              @click.stop="toggleBookmark"
            >
              <v-icon size="18">
                {{ isBookmarked ? "mdi-bookmark" : "mdi-bookmark-outline" }}
              </v-icon>
            </button>

            <button
              v-ripple
              class="post-action post-action--share"
              @click.stop="sharePost"
            >
              <v-icon size="18">mdi-share-variant-outline</v-icon>
            </button>
          </div>

        </div>
      </div>
    </div>
    </template>
  </article>

  <!-- 回复对话框 -->
  <v-dialog v-model="replyDialog" max-width="600" class="post-dialog">
    <v-card class="post-dialog-card">
      <v-card-title class="post-dialog-header">
        <v-btn icon variant="text" size="small" @click="replyDialog = false">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>
      <v-card-text class="post-dialog-content">
        <!-- 被回复的帖子预览 -->
        <div class="reply-preview">
          <div class="reply-preview-avatar">
            <v-avatar size="40">
              <v-img :src="authorAvatar" />
            </v-avatar>
            <div class="reply-preview-line" />
          </div>
          <div class="reply-preview-content">
            <div class="reply-preview-header">
              <span class="post-display-name">{{ authorDisplayName }}</span>
              <span class="post-username">@{{ authorUsername }}</span>
            </div>
            <div class="reply-preview-text">{{ displayContent }}</div>
            <div class="reply-preview-to">
              回复 <span class="text-primary">@{{ authorUsername }}</span>
            </div>
          </div>
        </div>
        <PostComposer
          ref="replyComposerRef"
          :submit="submitReply"
          placeholder="发布你的回复"
          submit-label="回复"
          :disabled="!isLogin"
          :auto-focus="true"
        />
      </v-card-text>
    </v-card>
  </v-dialog>

  <!-- 引用对话框 -->
  <v-dialog v-model="quoteDialog" max-width="600" class="post-dialog">
    <v-card class="post-dialog-card">
      <v-card-title class="post-dialog-header">
        <v-btn icon variant="text" size="small" @click="quoteDialog = false">
          <v-icon>mdi-close</v-icon>
        </v-btn>
        <span class="ml-4 text-subtitle-1">引用帖文</span>
      </v-card-title>
      <v-card-text class="post-dialog-content">
        <PostComposer
          ref="quoteComposerRef"
          :submit="submitQuote"
          placeholder="添加评论"
          submit-label="引用"
          :disabled="!isLogin"
          :auto-focus="true"
        >
          <template #append>
            <QuotedPost :post="post" compact class="mt-3" />
          </template>
        </PostComposer>
      </v-card-text>
    </v-card>
  </v-dialog>

  <!-- 媒体查看器 -->
  <v-dialog v-model="mediaViewerOpen" fullscreen>
    <div class="media-viewer" @click="mediaViewerOpen = false">
      <v-btn
        icon
        variant="text"
        class="media-viewer-close"
        @click="mediaViewerOpen = false"
      >
        <v-icon>mdi-close</v-icon>
      </v-btn>
      <v-carousel
        v-model="mediaViewerIndex"
        hide-delimiters
        :show-arrows="mediaItems.length > 1"
        height="100%"
        @click.stop
      >
        <v-carousel-item
          v-for="(media, idx) in mediaItems"
          :key="media.id || idx"
        >
          <div class="media-viewer-item">
            <v-img
              :src="getMediaUrl(media)"
              contain
              max-height="90vh"
              max-width="90vw"
            />
          </div>
        </v-carousel-item>
      </v-carousel>
    </div>
  </v-dialog>

  <!-- Federation Data Dialog -->
  <v-dialog v-model="federationDialog" max-width="500px">
    <v-card class="post-dialog-card">
        <div class="post-dialog-header">
            <span class="text-h6">联邦社交数据</span>
            <v-spacer></v-spacer>
            <v-btn icon="mdi-close" variant="text" size="small" @click="federationDialog = false"></v-btn>
        </div>
        <v-card-text class="pa-4">
            <v-list density="compact" v-if="post.platform_refs">
                <v-list-item v-if="post.platform_refs.twitter">
                    <template v-slot:prepend><v-icon color="blue">mdi-twitter</v-icon></template>
                    <v-list-item-title>Twitter</v-list-item-title>
                    <v-list-item-subtitle>
                        <a v-if="post.platform_refs.twitter.url" :href="post.platform_refs.twitter.url" target="_blank">
                            {{ post.platform_refs.twitter.id || 'Link' }}
                        </a>
                        <span v-else>{{ post.platform_refs.twitter.id }}</span>
                        <span v-if="post.platform_refs.twitter.kind" class="ml-2 text-caption">({{ post.platform_refs.twitter.kind }})</span>
                    </v-list-item-subtitle>
                </v-list-item>

                <v-list-item v-if="post.platform_refs.bluesky">
                    <template v-slot:prepend><v-icon color="light-blue">mdi-weather-cloudy</v-icon></template>
                    <v-list-item-title>Bluesky</v-list-item-title>
                    <v-list-item-subtitle>
                        <a v-if="getBskyUrl(post.platform_refs.bluesky)" :href="getBskyUrl(post.platform_refs.bluesky)" target="_blank" rel="noopener">
                            在 Bluesky 上查看
                        </a>
                        <div v-if="post.platform_refs.bluesky.uri" class="text-caption text-truncate" style="max-width: 300px;">URI: {{ post.platform_refs.bluesky.uri }}</div>
                        <div v-if="post.platform_refs.bluesky.cid" class="text-caption text-truncate" style="max-width: 300px;">CID: {{ post.platform_refs.bluesky.cid }}</div>
                    </v-list-item-subtitle>
                </v-list-item>

                <v-list-item v-if="post.platform_refs.activitypub">
                    <template v-slot:prepend><v-icon color="purple">mdi-earth</v-icon></template>
                    <v-list-item-title>ActivityPub</v-list-item-title>
                    <v-list-item-subtitle>
                        <a v-if="post.platform_refs.activitypub.url" :href="post.platform_refs.activitypub.url" target="_blank">
                            {{ post.platform_refs.activitypub.id || 'View Note' }}
                        </a>
                        <span v-else>{{ post.platform_refs.activitypub.id }}</span>
                    </v-list-item-subtitle>
                </v-list-item>
            </v-list>
            <div v-else class="text-center pa-4 text-medium-emphasis">
                无同步数据
            </div>
        </v-card-text>

        <v-divider></v-divider>

        <v-card-actions v-if="canDelete">
            <v-btn
                variant="text"
                color="primary"
                :loading="actionLoading"
                prepend-icon="mdi-share-all-outline"
                @click="manualSyncPost"
            >
                全平台同步
            </v-btn>
            <v-spacer></v-spacer>
            <v-btn
                variant="text"
                color="secondary"
                :loading="actionLoading"
                prepend-icon="mdi-earth"
                @click="pushToFederation"
            >
                推送到联邦
            </v-btn>
        </v-card-actions>
    </v-card>
  </v-dialog>

  <v-dialog v-model="viewCountDialog" max-width="420">
    <v-card class="post-dialog-card view-count-dialog-card" border>
      <v-card-title class="view-count-dialog-title">浏览量</v-card-title>
      <v-card-text class="view-count-dialog-content">
        <div v-if="viewCountLoading" class="view-count-dialog-loading">
          <v-progress-circular indeterminate color="primary" size="28" width="3" />
        </div>
        <div v-else class="view-count-value">{{ viewCountDisplayText }}</div>
        <div v-if="viewCountError" class="view-count-error">{{ viewCountError }}</div>
      </v-card-text>
      <v-card-actions class="view-count-dialog-actions">
        <v-spacer />
        <v-btn variant="text" color="primary" @click="viewCountDialog = false">关闭</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { localuser } from "@/services/localAccount";
import { getS3staticurl } from "@/services/projectService";
import PostsService from "@/services/postsService";
import { reportPostView } from '@/services/analyticsService';
import federationService from "@/services/federationService";
import { showSnackbar } from "@/composables/useNotifications";
import { useDeleteConfirm } from "@/composables/useDeleteConfirm";
import axios from "@/axios/axios";
import twemoji from "twemoji";
import { TWEMOJI_SVG_OPTIONS } from "@/utils/twemoji";
import PostComposer from "./PostComposer.vue";
import PostEmbed from "./PostEmbed.vue";
import QuotedPost from "./QuotedPost.vue";
import UserHoverCard from "@/components/UserHoverCard.vue";
import {
  getEmbedSpecialMarkers,
  isSameEmbedTarget,
  normalizeEmbedObject,
} from "@/utils/embedContext";

const props = defineProps({
  post: { type: Object, required: true },
  includes: { type: Object, default: () => ({ posts: {} }) },
  highlight: { type: Boolean, default: false },
  showThreadLine: { type: Boolean, default: false },
  hideReplyIndicator: { type: Boolean, default: false },
  retweetAuthor: { type: Object, default: null },
  embedMode: { type: String, default: "full" },
  contextProjectRouteBase: { type: String, default: "" },
  contextEmbedData: { type: Object, default: () => ({}) },
  hideCurrentContextBase: { type: Boolean, default: false },
  featured: { type: Boolean, default: false },
  enableTranslation: { type: Boolean, default: false },
});

const emit = defineEmits(["deleted", "created", "updated", "focus-reply"]);

const router = useRouter();
const route = useRoute();
const cardRootRef = ref(null);

// Dialog states
const replyDialog = ref(false);
const quoteDialog = ref(false);
const federationDialog = ref(false);
const viewCountDialog = ref(false);
const viewCountLoading = ref(false);
const viewCountError = ref("");
const viewCountDisplay = ref(0);
const actionLoading = ref(false);

const mediaViewerOpen = ref(false);
const mediaViewerIndex = ref(0);

const TRANSLATE_API_BASE = "https://translate.houlang.cloud";

// Post text ref for scratchblocks rendering
const postTextRef = ref(null);

// Delete confirmation
const { showDeleteConfirm } = useDeleteConfirm();

const replyComposerRef = ref(null);
const quoteComposerRef = ref(null);

// Auth
const isLogin = computed(() => localuser.isLogin.value);
const currentUserId = computed(() => localuser.user.value?.id);

// Post data
const postId = computed(() => props.post?.id ?? props.post?.postId);
const postType = computed(() => props.post?.type || "normal");
const isDeleted = computed(() => props.post?.is_deleted === true);
const isRetweet = computed(() => postType.value === "retweet");

// Author data
const author = computed(() => props.post?.author || props.post?.user || {});
const authorId = computed(
  () => author.value?.id ?? props.post?.userId ?? props.post?.authorId,
);
const authorUsername = computed(
  () => author.value?.username ?? props.post?.username ?? "unknown",
);
const authorDisplayName = computed(
  () =>
    author.value?.display_name ??
    author.value?.displayName ??
    authorUsername.value,
);
const authorAvatar = computed(() => {
  const avatar = author.value?.avatar;
  if (!avatar) return "/default-avatar.png";
  return localuser.getUserAvatar(avatar);
});

// Check if current view is detail view for this post
const isDetailView = computed(() => {
  return String(route.params.id) === String(postId.value);
});

// Time
const createdAt = computed(
  () =>
    props.post?.created_at ??
    props.post?.createdAt ??
    props.post?.time ??
    props.post?.created,
);

const timeAgo = computed(() => {
  if (!createdAt.value) return "";
  const date = new Date(createdAt.value);
  const now = new Date();
  const diff = now - date;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "刚刚";
  if (minutes < 60) return `${minutes}分钟`;
  if (hours < 24) return `${hours}小时`;
  if (days < 7) return `${days}天`;

  return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
});

const fullDateTime = computed(() => {
  if (!createdAt.value) return "";
  return new Date(createdAt.value).toLocaleString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
});

// Content
const displayContent = computed(() => {
  if (isDeleted.value) return null;
  return props.post?.content ?? "";
});

const translatedContent = ref("");
const translationLoading = ref(false);
const translationExpanded = ref(false);
const detectedSourceLang = ref("");
const shouldShowTranslateButton = ref(false);
const languageDetecting = ref(false);

const isChineseLanguage = (lang) => /^zh(?:$|[-_])/i.test(String(lang || ""));

const canDetectFeaturedLanguage = computed(() => {
  return (
    props.featured &&
    props.enableTranslation &&
    !isDeleted.value &&
    Boolean(translationSourceText.value)
  );
});

const canTranslateFeatured = computed(() => {
  return (
    canDetectFeaturedLanguage.value &&
    shouldShowTranslateButton.value
  );
});

const showTranslatedContent = computed(() => {
  return translationExpanded.value && Boolean(translatedContent.value);
});

const featuredTranslateButtonText = computed(() => {
  if (translationLoading.value) return "翻译中...";
  if (showTranslatedContent.value) return "收起";
  if (translatedContent.value) return "翻译";
  return "翻译";
});

const formattedContent = computed(() => {
  if (!displayContent.value) return "";
  let text = displayContent.value;

  // 提取 ```blocks...``` 代码块，用占位符替换，避免被后续处理破坏
  const scratchBlocksSegments = [];
  text = text.replace(/```blocks\n([\s\S]*?)```/g, (_, code) => {
    const index = scratchBlocksSegments.length;
    scratchBlocksSegments.push(code);
    return `\x00SCRATCHBLOCK_${index}\x00`;
  });

  // 解码 HTML 实体（多轮迭代，处理双重/多重编码如 &amp;quot; → &quot; → "）
  let _prev;
  do {
    _prev = text;
    text = text
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&#34;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  } while (text !== _prev);

  // 去除服务端可能已包含的 HTML 标签（如 ActivityPub 联邦格式化后的 <a> 标签），保留纯文本
  text = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<[^>]*>/g, '');

  // 清理残损的 HTML 属性碎片（服务端可能部分剥离标签，留下属性文本）
  // 通用模式：移除 " class="..." onclick="..." ... > 这类残留
  text = text.replace(/["']\s*(?:\w[\w-]*\s*=\s*["'][^"']*["']\s*)+>/g, '');
  // 去除因标签剥离产生的重复相邻 @提及（如 @user@domain@user@domain）
  text = text.replace(/(@\w+@[\w.-]+\.\w{2,})\s*\1/g, '$1');

  // 提取 URL，用占位符替换（必须在 HTML 转义前提取，避免 & 被转义为 &amp; 进入 href）
  const urlSegments = [];
  text = text.replace(/(https?:\/\/[^\s]+)/g, (_, url) => {
    const index = urlSegments.length;
    urlSegments.push(url);
    return `\x00URL_${index}\x00`;
  });

  // 转义HTML
  text = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // @提及：先处理联邦式 @user@domain.tld，用占位符保护，防止本地提及正则破坏已生成的 HTML
  const mentionSegments = [];
  text = text.replace(
    /@(\w+)@([\w.-]+\.\w{2,})/g,
    (_, user, domain) => {
      const index = mentionSegments.length;
      mentionSegments.push(
        `<a href="/${user}@${domain}" class="post-mention" onclick="event.stopPropagation()">@${user}@${domain}</a>`
      );
      return `\x00MENTION_${index}\x00`;
    },
  );

  // 再处理本地 @user
  text = text.replace(
    /@(\w+)/g,
    (match, username, offset, str) => {
      // 如果前一个字符是 @ 或字母/数字，跳过
      if (offset > 0 && /[@\w]/.test(str[offset - 1])) return match;
      return `<a href="/${username}" class="post-mention" onclick="event.stopPropagation()">@${username}</a>`;
    },
  );

  // 还原联邦提及占位符
  text = text.replace(/\x00MENTION_(\d+)\x00/g, (_, idx) => mentionSegments[Number(idx)]);

  // 还原 URL 占位符为 <a> 标签（href 使用原始 URL，不含 HTML 实体）
  text = text.replace(/\x00URL_(\d+)\x00/g, (_, idx) => {
    const url = urlSegments[Number(idx)];
    const safeHref = url.replace(/"/g, '&quot;');
    const displayUrl = url.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    return `<a href="${safeHref}" class="post-link" target="_blank" rel="noopener" onclick="event.stopPropagation()">${displayUrl}</a>`;
  });

  // 换行
  text = text.replace(/\\n|\n/g, "<br>");

  // 还原 scratchblocks 代码块
  text = text.replace(/\x00SCRATCHBLOCK_(\d+)\x00/g, (_, idx) => {
    const code = scratchBlocksSegments[Number(idx)]
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return `<pre class="blocks">${code}</pre>`;
  });

  return twemoji.parse(text, TWEMOJI_SVG_OPTIONS);
});

const translationSourceText = computed(() => {
  if (!formattedContent.value) return "";
  let text = formattedContent.value;

  text = text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<[^>]*>/g, "");

  let prev;
  do {
    prev = text;
    text = text
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&#34;/g, '"')
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ");
  } while (text !== prev);

  return text.trim();
});

// Scratchblocks: 检测内容是否包含积木代码块
const hasScratchBlocks = computed(() => {
  if (!displayContent.value) return false;
  return /```blocks\n[\s\S]*?```/.test(displayContent.value);
});

// Scratchblocks: 懒加载并渲染
let scratchblocksModule = null;
async function renderScratchBlocks() {
  if (!postTextRef.value) return;
  const preBlocks = postTextRef.value.querySelectorAll("pre.blocks");
  if (!preBlocks.length) return;

  if (!scratchblocksModule) {
    const [sb, zhCn] = await Promise.all([
      import("scratchblocks").then((m) => m.default),
      import("scratchblocks/locales/zh-cn.json"),
    ]);
    sb.loadLanguages({ "zh-cn": zhCn.default || zhCn });
    scratchblocksModule = sb;
  }

  const sb = scratchblocksModule;
  const options = {
    style: "scratch3",
    inline: false,
    languages: ["en", "zh-cn"],
    scale: 1,
  };

  preBlocks.forEach((el) => {
    // 跳过已渲染的元素
    if (el.querySelector(".scratchblocks")) return;
    const code = sb.read(el, options);
    const doc = sb.parse(code, options);
    const svg = sb.render(doc, options);
    sb.replace(el, svg, doc, options);
  });
}

watch(
  () => formattedContent.value,
  () => {
    if (hasScratchBlocks.value) {
      nextTick(() => renderScratchBlocks());
    }
  },
  { immediate: true },
);

watch(
  () => postId.value,
  () => {
    translatedContent.value = "";
    translationExpanded.value = false;
    translationLoading.value = false;
    detectedSourceLang.value = "";
    shouldShowTranslateButton.value = false;
    languageDetecting.value = false;
  },
);

const detectFeaturedLanguage = async ({ silent = true } = {}) => {
  const text = translationSourceText.value;
  if (!text || !canDetectFeaturedLanguage.value) {
    detectedSourceLang.value = "";
    shouldShowTranslateButton.value = false;
    return;
  }

  languageDetecting.value = true;
  try {
    const detectRes = await fetch(`${TRANSLATE_API_BASE}/detect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        minConfidence: 0,
      }),
    });
    if (!detectRes.ok) {
      throw new Error(`语言检测失败 (${detectRes.status})`);
    }
    const detectJson = await detectRes.json();
    const fromLang = String(detectJson?.language || "").trim();

    detectedSourceLang.value = fromLang;
    shouldShowTranslateButton.value = Boolean(fromLang) && !isChineseLanguage(fromLang);
  } catch (e) {
    detectedSourceLang.value = "";
    shouldShowTranslateButton.value = true;
    if (!silent) {
      showSnackbar(e?.message || "语言检测失败", "error");
    }
  } finally {
    languageDetecting.value = false;
  }
};

watch(
  () => [postId.value, translationSourceText.value, canDetectFeaturedLanguage.value],
  async () => {
    translatedContent.value = "";
    translationExpanded.value = false;
    detectedSourceLang.value = "";
    shouldShowTranslateButton.value = false;
    if (!canDetectFeaturedLanguage.value) return;
    await detectFeaturedLanguage({ silent: true });
  },
  { immediate: true },
);

// Stats
const stats = computed(() => {
  const s = props.post?.stats || {};
  return {
    replies: s.replies || 0,
    retweets: s.retweets || 0,
    likes: s.likes || 0,
    bookmarks: s.bookmarks || 0,
    views: s.views || s.reads || s.impressions || s.view_count || s.viewCount || 0,
  };
});

const viewCountDisplayText = computed(() => {
  const value = Number(viewCountDisplay.value || 0);
  return Number.isFinite(value) ? value.toLocaleString("zh-CN") : "0";
});

const hasVisibleStats = computed(() => {
  return (
    stats.value.retweets > 0
    || stats.value.likes > 0
    || stats.value.bookmarks > 0
    || stats.value.views > 0
  );
});

// Viewer context
const viewerContext = computed(() => props.post?.viewer_context || {});
const isLiked = computed(
  () =>
    viewerContext.value.liked ??
    props.post?.liked ??
    props.post?.isLiked ??
    false,
);
const isRetweeted = computed(
  () =>
    viewerContext.value.retweeted ??
    props.post?.retweeted ??
    props.post?.isRetweeted ??
    false,
);
const isBookmarked = computed(
  () =>
    viewerContext.value.bookmarked ??
    props.post?.bookmarked ??
    props.post?.isBookmarked ??
    false,
);

// Media
const mediaItems = computed(() => {
  const media =
    props.post?.media || props.post?.mediaAssets || props.post?.assets || [];
  return Array.isArray(media) ? media : [];
});

const mediaGridClass = computed(() => {
  const count = Math.min(mediaItems.value.length, 4);
  return `post-media--${count}`;
});

const getMediaUrl = (media) => {
  if (media.url) return media.url;
  if (media.md5) {
    // 使用 md5 和 extension 构建正确的 URL
    const ext = media.extension || "webp";
    return `${getS3staticurl(media.md5)}.${ext}`;
  }
  return media.src || media.href || "";
};

// Embed
const embedData = computed(() => props.post?.embed || null);

const compactEmbedPrimaryLinkIsExternal = computed(
  () => embedData.value?.type === "url",
);

const compactEmbedPrimaryText = computed(() => {
  if (!embedData.value) return "查看内容";
  if (embedData.value.type === "project") return `项目 #${embedData.value.id}`;
  if (embedData.value.type === "article") return `文章 #${embedData.value.id}`;
  if (embedData.value.type === "list") return `列表 #${embedData.value.id}`;
  if (embedData.value.type === "user") {
    return embedData.value.username
      ? `@${embedData.value.username}`
      : `用户 #${embedData.value.id}`;
  }
  if (embedData.value.type === "url") {
    try {
      return new URL(embedData.value.url || "").hostname.replace(/^www\./, "");
    } catch {
      return "打开链接";
    }
  }
  return `${embedData.value.type || "内容"} #${embedData.value.id ?? ""}`.trim();
});

const compactEmbedPrimaryLink = computed(() => {
  if (!embedData.value) return "";
  switch (embedData.value.type) {
    case "project":
      if (props.contextProjectRouteBase) return props.contextProjectRouteBase;
      return embedData.value.id ? `/app/project/${embedData.value.id}` : "";
    case "article":
      if (embedData.value.username && embedData.value.slug) {
        return `/${embedData.value.username}/articles/${embedData.value.slug}`;
      }
      return embedData.value.id ? `/app/project/${embedData.value.id}` : "";
    case "list":
      return embedData.value.id ? `/app/projectlist/${embedData.value.id}` : "";
    case "user":
      if (embedData.value.username) return `/${embedData.value.username}`;
      return embedData.value.id ? `/app/posts/user/${embedData.value.id}` : "";
    case "url":
      return embedData.value.url || "";
    default:
      return "";
  }
});

const normalizedEmbedData = computed(() =>
  normalizeEmbedObject(embedData.value),
);
const normalizedContextEmbedData = computed(() =>
  normalizeEmbedObject(props.contextEmbedData),
);
const compactEmbedMeta = computed(() =>
  getEmbedSpecialMarkers(normalizedEmbedData.value),
);

const hideCurrentContextPrimary = computed(() => {
  if (!props.hideCurrentContextBase) return false;
  if (normalizedEmbedData.value.type !== "project") return false;
  return isSameEmbedTarget(
    normalizedEmbedData.value,
    normalizedContextEmbedData.value,
  );
});

const showCompactEmbedPrimary = computed(
  () => !hideCurrentContextPrimary.value,
);

const compactEmbedBranch = computed(() => compactEmbedMeta.value.branch);

const compactEmbedCommit = computed(() => compactEmbedMeta.value.commit);

const compactEmbedExtraMarkers = computed(() =>
  compactEmbedMeta.value.extras.map((marker) => ({
    key: marker.key,
    text: `标记 ${marker.key}: ${marker.value}`,
  })),
);

const compactEmbedBranchLink = computed(() => {
  if (!compactEmbedBranch.value || !props.contextProjectRouteBase) return "";
  return `${props.contextProjectRouteBase}/tree/${encodeURIComponent(compactEmbedBranch.value)}`;
});

const compactEmbedCommitLink = computed(() => {
  if (!compactEmbedCommit.value || !props.contextProjectRouteBase) return "";
  const rawCommit = String(embedData.value?.commit || compactEmbedCommit.value);
  return `${props.contextProjectRouteBase}/commit/${encodeURIComponent(rawCommit)}`;
});

const compactEmbedMarkers = computed(() => {
  const markers = [];

  if (compactEmbedBranch.value) {
    markers.push({
      key: `branch:${compactEmbedBranch.value}`,
      text: `分支 ${compactEmbedBranch.value}`,
      link: compactEmbedBranchLink.value,
    });
  }

  if (compactEmbedCommit.value) {
    markers.push({
      key: `commit:${compactEmbedCommit.value}`,
      text: `版本 ${compactEmbedCommit.value}`,
      link: compactEmbedCommitLink.value,
    });
  }

  for (const marker of compactEmbedExtraMarkers.value) {
    markers.push({
      key: `extra:${marker.key}`,
      text: marker.text,
      link: "",
    });
  }

  return markers;
});

const showCompactEmbedNote = computed(() => {
  if (!embedData.value || props.embedMode !== "compact") return false;
  if (showCompactEmbedPrimary.value) return true;
  return compactEmbedMarkers.value.length > 0;
});

// Quoted post
const quotedPostId = computed(
  () => props.post?.quote_of_id || props.post?.quoteOfId,
);
const quotedPost = computed(() => {
  if (!quotedPostId.value) return null;
  // 处理ID可能是数字或字符串的情况
  const posts = props.includes?.posts || {};
  return posts[quotedPostId.value] || posts[String(quotedPostId.value)] || null;
});

// Reply to post
const replyToId = computed(
  () => props.post?.reply_to_id || props.post?.replyToId,
);
const replyToPost = computed(() => {
  if (!replyToId.value) return null;
  // 处理ID可能是数字或字符串的情况
  const posts = props.includes?.posts || {};
  return posts[replyToId.value] || posts[String(replyToId.value)] || null;
});

// Permissions
const canDelete = computed(() => {
  if (!currentUserId.value) return false;
  return Number(currentUserId.value) === Number(authorId.value);
});

const isSelf = computed(() => {
  if (!currentUserId.value) return true; // 未登录时不显示关注/拉黑
  return Number(currentUserId.value) === Number(authorId.value);
});

// Follow / Block state
const followStatus = ref(null); // null=未加载, 'following', 'not_following', 'blocked'
const followLoading = ref(false);

const isFollowing = computed(() => followStatus.value === "following");
const isBlocked = computed(() => followStatus.value === "blocked");

const checkRelationship = async () => {
  if (isSelf.value || !authorId.value || !isLogin.value) return;
  try {
    const res = await axios.get(`/follows/relationships/${authorId.value}`);
    const data = res.data?.data || res.data;
    if (data?.isBlocking) {
      followStatus.value = "blocked";
    } else if (data?.isFollowing) {
      followStatus.value = "following";
    } else {
      followStatus.value = "not_following";
    }
  } catch {
    followStatus.value = "not_following";
  }
};

const toggleFollow = async () => {
  if (!requireLogin("关注")) return;
  followLoading.value = true;
  try {
    if (isFollowing.value) {
      await axios.delete(`/follows/${authorId.value}`);
      followStatus.value = "not_following";
      showSnackbar(`已取消关注 @${authorUsername.value}`, "success");
    } else {
      await axios.post(`/follows/${authorId.value}`);
      followStatus.value = "following";
      showSnackbar(`已关注 @${authorUsername.value}`, "success");
    }
  } catch (e) {
    showSnackbar(
      e?.response?.data?.message || e?.message || "操作失败",
      "error",
    );
  } finally {
    followLoading.value = false;
  }
};

const toggleBlock = async () => {
  if (!requireLogin("拉黑")) return;
  followLoading.value = true;
  try {
    if (isBlocked.value) {
      await axios.delete(`/follows/block/${authorId.value}`);
      followStatus.value = "not_following";
      showSnackbar(`已解除拉黑 @${authorUsername.value}`, "success");
    } else {
      await axios.post(`/follows/block/${authorId.value}`);
      followStatus.value = "blocked";
      showSnackbar(`已拉黑 @${authorUsername.value}`, "success");
    }
  } catch (e) {
    showSnackbar(
      e?.response?.data?.message || e?.message || "操作失败",
      "error",
    );
  } finally {
    followLoading.value = false;
  }
};

// Utility
const formatCount = (count) => {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
};

// Navigation
const openDetail = () => {
  if (!postId.value || isDeleted.value) return;
  router.push(`/app/posts/${postId.value}`);
};

const goUser = () => {
  if (!authorUsername.value || authorUsername.value === "unknown") return;
  router.push(`/${authorUsername.value}`);
};

const goToQuotedPost = () => {
  if (!quotedPostId.value) return;
  router.push(`/app/posts/${quotedPostId.value}`);
};

const openAnalyticsPage = () => {
  if (!postId.value || isDeleted.value) return;
  if (!canDelete.value) {
    openViewCountDialog();
    return;
  }
  router.push(`/app/posts/${postId.value}/analytics`);
};

const openViewCountDialog = async () => {
  if (!postId.value) return;

  const localViews = Number(stats.value.views || 0);
  viewCountDisplay.value = Number.isFinite(localViews) ? Math.max(0, localViews) : 0;
  viewCountError.value = "";
  viewCountDialog.value = true;
  viewCountLoading.value = true;

  try {
    const res = await PostsService.getAnalytics(postId.value);
    const remoteViews = Number(res?.viewCount ?? res?.raw?.view_count ?? viewCountDisplay.value);
    if (Number.isFinite(remoteViews)) {
      viewCountDisplay.value = Math.max(0, remoteViews);
    }
  } catch (e) {
    if (!viewCountDisplay.value) {
      viewCountError.value = e?.message || "加载浏览量失败";
    }
  } finally {
    viewCountLoading.value = false;
  }
};

// Actions
const requireLogin = (action) => {
  if (!isLogin.value) {
    showSnackbar(`请先登录后再${action}`, "warning");
    return false;
  }
  return true;
};

const toggleLike = async () => {
  if (!requireLogin("点赞")) return;
  actionLoading.value = true;
  try {
    if (isLiked.value) {
      await PostsService.unlike(postId.value);
      if (props.post.viewer_context) props.post.viewer_context.liked = false;
      else props.post.liked = false;
      if (props.post.stats)
        props.post.stats.likes = Math.max(0, stats.value.likes - 1);
    } else {
      await PostsService.like(postId.value);
      if (props.post.viewer_context) props.post.viewer_context.liked = true;
      else props.post.liked = true;
      if (props.post.stats) props.post.stats.likes = stats.value.likes + 1;
    }
    emit("updated", props.post);
  } catch (e) {
    showSnackbar(e?.message || "操作失败", "error");
  } finally {
    actionLoading.value = false;
  }
};

const toggleRetweet = async () => {
  if (!requireLogin("转推")) return;
  actionLoading.value = true;
  try {
    if (isRetweeted.value) {
      await PostsService.unretweet(postId.value);
      if (props.post.viewer_context)
        props.post.viewer_context.retweeted = false;
      else props.post.retweeted = false;
      if (props.post.stats)
        props.post.stats.retweets = Math.max(0, stats.value.retweets - 1);
    } else {
      await PostsService.retweet(postId.value);
      if (props.post.viewer_context) props.post.viewer_context.retweeted = true;
      else props.post.retweeted = true;
      if (props.post.stats)
        props.post.stats.retweets = stats.value.retweets + 1;
    }
    emit("updated", props.post);
  } catch (e) {
    showSnackbar(e?.message || "操作失败", "error");
  } finally {
    actionLoading.value = false;
  }
};

const toggleBookmark = async () => {
  if (!requireLogin("收藏")) return;
  actionLoading.value = true;
  try {
    if (isBookmarked.value) {
      await PostsService.unbookmark(postId.value);
      if (props.post.viewer_context)
        props.post.viewer_context.bookmarked = false;
      else props.post.bookmarked = false;
      showSnackbar("已取消收藏", "success");
    } else {
      await PostsService.bookmark(postId.value);
      if (props.post.viewer_context)
        props.post.viewer_context.bookmarked = true;
      else props.post.bookmarked = true;
      showSnackbar("已添加到书签", "success");
    }
    emit("updated", props.post);
  } catch (e) {
    showSnackbar(e?.message || "操作失败", "error");
  } finally {
    actionLoading.value = false;
  }
};

// Dialogs
const openReplyDialog = () => {
  if (!requireLogin("回复")) return;
  replyDialog.value = true;
};

const openQuoteDialog = () => {
  if (!requireLogin("引用")) return;
  quoteDialog.value = true;
};

const handleFeaturedReply = () => {
  if (!requireLogin("回复")) return;
  emit('focus-reply');
};

const submitReply = async ({ content, mediaIds, embed }) => {
  const res = await PostsService.reply(postId.value, {
    content,
    mediaIds,
    embed,
  });
  replyDialog.value = false;
  showSnackbar("回复已发布", "success");
  if (props.post.stats) props.post.stats.replies++;
  // 传递完整响应（包含post和includes）
  emit("created", res);
};

const submitQuote = async ({ content, mediaIds, embed }) => {
  const res = await PostsService.quote(postId.value, {
    content,
    mediaIds,
    embed,
  });
  quoteDialog.value = false;
  showSnackbar("引用已发布", "success");
  // 传递完整响应（包含post和includes）
  emit("created", res);
};

const doDelete = async () => {
  deleting.value = true;
  try {
    await PostsService.remove(postId.value);
    confirmDelete.value = false;
    showSnackbar("帖文已删除", "success");
    emit("deleted", postId.value);
  } catch (e) {
    showSnackbar(e?.message || "删除失败", "error");
  } finally {
    deleting.value = false;
  }
};

// Utilities
const copyLink = async () => {
  const url = `${window.location.origin}/app/posts/${postId.value}`;
  try {
    await navigator.clipboard.writeText(url);
    showSnackbar("链接已复制", "success");
  } catch {
    showSnackbar("复制失败", "error");
  }
};

const handleDeleteClick = () => {
  // Trigger rebuild
  showDeleteConfirm(
    async () => {
      await PostsService.remove(postId.value);
      showSnackbar("帖文已删除", "success");
      emit("deleted", postId.value);
    },
    {
      title: "删除帖文？",
      message:
        "此操作无法撤消。该帖文将从你的个人资料、任何关注你的用户的时间线以及搜索结果中删除。",
      confirmText: "删除",
      cancelText: "取消",
    },
  );
};

const getBskyUrl = (bluesky) => {
  if (!bluesky) return null;
  if (bluesky.url) return bluesky.url;
  // Parse AT URI: at://did:plc:xxx/app.bsky.feed.post/rkey
  const uri = bluesky.uri;
  if (!uri) return null;
  const match = uri.match(/^at:\/\/([^/]+)\/[^/]+\/([^/]+)$/);
  if (match) {
    return `https://bsky.app/profile/${match[1]}/post/${match[2]}`;
  }
  return null;
};

const manualSyncPost = async () => {
  if (!canDelete.value) return;
  if (!confirm("确定要重新同步此帖子到所有关联的社交平台吗？")) return;

  actionLoading.value = true;
  try {
    const res = await federationService.userResyncPost(postId.value);
    if (res.data?.status === "success" || res.data?.status === "ok") {
      showSnackbar("同步任务已提交", "success");
    } else {
      showSnackbar(res.data?.message || "同步失败", "error");
    }
  } catch (e) {
    showSnackbar(e?.message || "同步失败", "error");
  } finally {
    actionLoading.value = false;
  }
};

const pushToFederation = async () => {
  if (!canDelete.value) return;
  if (!confirm("确定要推送到 ActivityPub 联邦网络吗？")) return;

  actionLoading.value = true;
  try {
    const res = await federationService.userPushPostToFederation(postId.value);
    if (res.data?.status === "success" || res.data?.status === "ok") {
        showSnackbar("推送任务已提交", "success");
    } else {
        showSnackbar(res.data?.message || "推送失败", "error");
    }
  } catch (e) {
    showSnackbar(e?.message || "推送失败", "error");
  } finally {
    actionLoading.value = false;
  }
};

const onMenuOpen = (isOpen) => {
  if (isOpen && followStatus.value === null && !isSelf.value) {
    checkRelationship();
  }
};

const sharePost = async () => {
  const url = `${window.location.origin}/app/posts/${postId.value}`;
  if (navigator.share) {
    try {
      await navigator.share({
        title: `${authorDisplayName.value}的帖文`,
        text: displayContent.value?.slice(0, 100),
        url,
      });
    } catch {
      // User cancelled
    }
  } else {
    copyLink();
  }
};

const fetchFeaturedTranslation = async () => {
  const text = translationSourceText.value;
  if (!text) return;

  translationLoading.value = true;
  try {
    if (!detectedSourceLang.value) {
      await detectFeaturedLanguage({ silent: false });
    }

    const fromLang = detectedSourceLang.value;

    if (!fromLang || isChineseLanguage(fromLang)) {
      translatedContent.value = "";
      translationExpanded.value = false;
      return;
    }

    const translateRes = await fetch(`${TRANSLATE_API_BASE}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromLang,
        to: "zh-Hans",
        text,
      }),
    });
    if (!translateRes.ok) {
      throw new Error(`翻译请求失败 (${translateRes.status})`);
    }
    const translateJson = await translateRes.json();
    if (!translateJson?.result) {
      throw new Error("未获取到翻译结果");
    }

    translatedContent.value = String(translateJson.result);
    translationExpanded.value = true;
  } catch (e) {
    showSnackbar(e?.message || "翻译失败，请稍后重试", "error");
  } finally {
    translationLoading.value = false;
  }
};

const toggleFeaturedTranslation = async () => {
  if (!canTranslateFeatured.value || translationLoading.value) return;

  if (showTranslatedContent.value) {
    translationExpanded.value = false;
    return;
  }

  if (translatedContent.value) {
    translationExpanded.value = true;
    return;
  }

  await fetchFeaturedTranslation();
};

const openMediaViewer = (index) => {
  mediaViewerIndex.value = index;
  mediaViewerOpen.value = true;
};

let exposureObserver = null;
let exposureTimer = null;

const clearExposureTimer = () => {
  if (exposureTimer) {
    clearTimeout(exposureTimer);
    exposureTimer = null;
  }
};

const setupExposureReporting = () => {
  if (props.featured || !cardRootRef.value || !postId.value) return;

  exposureObserver = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (!entry) return;
      if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
        clearExposureTimer();
        exposureTimer = setTimeout(() => {
          reportPostView(postId.value);
          clearExposureTimer();
        }, 1000);
      } else {
        clearExposureTimer();
      }
    },
    {
      threshold: [0, 0.6, 1],
    },
  );

  exposureObserver.observe(cardRootRef.value);
};

const cleanupExposureReporting = () => {
  clearExposureTimer();
  if (exposureObserver) {
    exposureObserver.disconnect();
    exposureObserver = null;
  }
};

watch(
  () => postId.value,
  () => {
    cleanupExposureReporting();
    nextTick(() => {
      setupExposureReporting();
    });
  },
);

onMounted(() => {
  setupExposureReporting();
});

onUnmounted(() => {
  cleanupExposureReporting();
});
</script>

<style scoped>
.post-card {
  background: rgb(var(--v-theme-surface));
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  transition: background-color 0.15s ease;
}

.post-card:hover {
  background: rgba(var(--v-theme-on-surface), 0.03);
}

.post-card--highlight {
  background: rgba(var(--v-theme-primary), 0.05);
}

.post-card--deleted {
  opacity: 0.6;
}

.post-retweet-indicator,
.post-reply-indicator {
  display: flex;
  align-items: center;
  padding: 8px 16px 0 64px;
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.post-retweet-link,
.post-reply-link {
  color: inherit;
  text-decoration: none;
}

.post-retweet-link:hover,
.post-reply-link:hover {
  text-decoration: underline;
}

.post-main {
  display: flex;
  padding: 12px 16px;
  cursor: pointer;
  position: relative;
}

.post-avatar-col {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-right: 12px;
}

.post-avatar {
  cursor: pointer;
  transition: opacity 0.15s;
}

.post-avatar:hover {
  opacity: 0.85;
}

.post-thread-line {
  flex: 1;
  width: 2px;
  min-height: 24px;
  margin-top: 8px;
  background: rgba(var(--v-theme-on-surface), 0.15);
  border-radius: 1px;
}

.post-content-col {
  flex: 1;
  min-width: 0;
}

.post-header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 4px;
}

.post-author-link {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  min-width: 0;
  text-decoration: none;
  color: inherit;
}

.post-display-name {
  font-weight: 700;
  font-size: 15px;
  color: rgb(var(--v-theme-on-surface));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.post-author-link:hover .post-display-name {
  text-decoration: underline;
}

.post-username {
  font-size: 15px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.post-separator {
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.post-time {
  font-size: 15px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  white-space: nowrap;
}

.post-time:hover {
  text-decoration: underline;
}

.post-menu-btn {
  opacity: 0;
  transition: opacity 0.15s;
}

.post-card:hover .post-menu-btn {
  opacity: 1;
}

.post-menu-list {
  min-width: 200px;
}

.post-deleted-notice {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  margin: 8px 0;
  font-size: 14px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  background: rgba(var(--v-theme-on-surface), 0.05);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  border-radius: 12px;
}

.post-body {
  margin-bottom: 8px;
}

.post-text {
  font-size: 15px;
  line-height: 1.5;
  color: rgb(var(--v-theme-on-surface));
  word-break: break-word;
  white-space: pre-wrap;
}

.post-text :deep(.post-mention) {
  color: rgb(var(--v-theme-primary));
  text-decoration: none;
}

.post-text :deep(.post-mention:hover) {
  text-decoration: underline;
}

.post-text :deep(.post-link) {
  color: rgb(var(--v-theme-primary));
  text-decoration: none;
}

.post-text :deep(.post-link:hover) {
  text-decoration: underline;
}

.post-text :deep(.scratchblocks) {
  overflow-x: auto;
  margin: 8px 0;
}

.post-text :deep(pre.blocks) {
  white-space: pre;
  margin: 8px 0;
}

.post-text :deep(img.twemoji),
.post-featured-text :deep(img.twemoji) {
  width: 1.1em;
  height: 1.1em;
  margin: 0 0.05em;
  vertical-align: -0.2em;
}

.post-embed-note {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.62);
}

.post-embed-note-label {
  color: rgba(var(--v-theme-on-surface), 0.5);
}

.post-embed-note-link {
  color: rgb(var(--v-theme-primary));
  text-decoration: none;
}

.post-embed-note-link:hover {
  text-decoration: underline;
}

.post-embed-note-separator {
  color: rgba(var(--v-theme-on-surface), 0.45);
}

/* Media Grid */
.post-media {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  margin-top: 12px;
  border-radius: 16px;
  overflow: hidden;
  background: rgba(var(--v-theme-on-surface), 0.03);
}

.post-media--1 {
  display: block;
}

.post-media--1 .post-media-item {
  width: 100%;
}

.post-media--2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
}

.post-media--2 .post-media-item {
  aspect-ratio: 1;
}

.post-media--3 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
}

.post-media--3 .post-media-item:first-child {
  grid-row: span 2;
  aspect-ratio: auto;
}

.post-media--3 .post-media-item:not(:first-child) {
  aspect-ratio: 1;
}

.post-media--4 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
}

.post-media--4 .post-media-item {
  aspect-ratio: 1;
}

.post-media-item {
  position: relative;
  cursor: pointer;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--v-theme-on-surface), 0.03);
}

.post-media-img {
  width: 100%;
  height: 100%;
  transition: transform 0.2s ease;
}

.post-media-item:hover .post-media-img {
  transform: scale(1.02);
}

.post-media-more {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  font-size: 24px;
  font-weight: 700;
}

/* Actions */
.post-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin-top: 4px;
}

.post-actions-main,
.post-actions-side {
  display: flex;
  align-items: center;
  gap: 12px;
}

.post-actions-main {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0;
}

.post-actions-main > * {
  justify-self: center;
}

.post-actions-side {
  flex-shrink: 0;
}

.post-action {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px;
  margin: -8px;
  border: none;
  background: none;
  color: rgba(var(--v-theme-on-surface), 0.6);
  font-size: 13px;
  cursor: pointer;
  border-radius: 50px;
  transition: all 0.15s ease;
  position: relative;
  overflow: hidden;
}

.post-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.post-action--reply:hover {
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.1);
}

.post-action--retweet:hover {
  color: #00ba7c;
  background: rgba(0, 186, 124, 0.1);
}

.post-action--retweet.post-action--active {
  color: #00ba7c;
}

.post-action--like:hover {
  color: #f91880;
  background: rgba(249, 24, 128, 0.1);
}

.post-action--like.post-action--active {
  color: #f91880;
}

.post-action--bookmark:hover {
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.1);
}

.post-action--bookmark.post-action--active {
  color: rgb(var(--v-theme-primary));
}

.post-action--share:hover {
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.1);
}

.post-action--views {
  cursor: pointer;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.post-action--views:hover {
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.1);
}

.post-action-count {
  min-width: 1ch;
}

/* Dialog */
.post-dialog-card {
  border-radius: 16px !important;
}

.post-dialog-header {
  display: flex;
  align-items: center;
  padding: 8px 16px !important;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.post-dialog-content {
  padding: 0 !important;
}

.post-confirm-dialog {
  border-radius: 16px !important;
}

.view-count-dialog-card {
  border-radius: 18px !important;
}

.view-count-dialog-title {
  font-size: 18px;
  font-weight: 700;
  justify-content: center;
  padding-top: 20px;
}

.view-count-dialog-content {
  padding-top: 8px;
  padding-bottom: 12px;
}

.view-count-dialog-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 72px;
}

.view-count-value {
  font-size: 52px;
  line-height: 1;
  font-weight: 800;
  color: rgb(var(--v-theme-on-surface));
}

.view-count-error {
  margin-top: 8px;
  font-size: 13px;
  color: rgb(var(--v-theme-error));
}

.view-count-dialog-actions {
  padding: 8px 16px 14px;
}

/* Reply Preview */
.reply-preview {
  display: flex;
  padding: 16px;
  padding-bottom: 0;
}

.reply-preview-avatar {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-right: 12px;
}

.reply-preview-line {
  flex: 1;
  width: 2px;
  min-height: 16px;
  margin-top: 8px;
  background: rgba(var(--v-theme-on-surface), 0.15);
}

.reply-preview-content {
  flex: 1;
  min-width: 0;
}

.reply-preview-header {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
}

.reply-preview-text {
  font-size: 15px;
  color: rgb(var(--v-theme-on-surface));
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.reply-preview-to {
  margin-top: 12px;
  font-size: 14px;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

/* Media Viewer */
.media-viewer {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.media-viewer-close {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 1;
  color: white;
}

.media-viewer-item {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

/* ==================== Featured (主帖) 模式 ==================== */
.post-card--featured {
  border-bottom: none;
  background: transparent;
}

.post-card--featured:hover {
  background: transparent;
}

.post-featured {
  padding: 16px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.post-featured-header {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.post-featured-avatar {
  cursor: pointer;
  margin-right: 12px;
}

.post-featured-author-link {
  cursor: pointer;
  text-decoration: none;
  color: inherit;
}

.post-featured-author-link:hover .post-featured-display-name {
  text-decoration: underline;
}

.post-featured-display-name {
  font-size: 15px;
  font-weight: 700;
  color: rgb(var(--v-theme-on-surface));
  line-height: 1.2;
}

.post-featured-username {
  font-size: 15px;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.post-featured-text {
  font-size: 17px;
  line-height: 1.5;
  color: rgb(var(--v-theme-on-surface));
  word-break: break-word;
  white-space: pre-wrap;
}

.post-featured-text :deep(.post-mention),
.post-featured-text :deep(.post-link) {
  color: rgb(var(--v-theme-primary));
  text-decoration: none;
}

.post-featured-text :deep(.post-mention:hover),
.post-featured-text :deep(.post-link:hover) {
  text-decoration: underline;
}

.post-featured-text :deep(.scratchblocks) {
  overflow-x: auto;
  margin: 8px 0;
}

.post-featured-text :deep(pre.blocks) {
  white-space: pre;
  margin: 8px 0;
}

.post-featured-translate {
  margin-top: 8px;
}

.post-featured-translation-text {
  margin-top: 8px;
}

.post-featured-media {
  margin-top: 16px;
}

.post-featured-time {
  padding: 16px 0;
  font-size: 15px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.post-featured-stats {
  display: flex;
  gap: 20px;
  padding: 16px 0;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.post-featured-stat {
  display: flex;
  align-items: center;
  gap: 4px;
}

.post-featured-stat-value {
  font-size: 14px;
  font-weight: 700;
  color: rgb(var(--v-theme-on-surface));
}

.post-featured-stat-label {
  font-size: 14px;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.post-featured-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.post-featured-actions-main,
.post-featured-actions-side {
  display: flex;
  align-items: center;
  gap: 16px;
}

.post-featured-actions-main {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0;
}

.post-featured-actions-main > * {
  justify-self: center;
}

.post-featured-actions-side {
  flex-shrink: 0;
  gap: 8px;
}

.post-featured-action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: none;
  background: none;
  color: rgba(var(--v-theme-on-surface), 0.6);
  cursor: pointer;
  border-radius: 50%;
  transition: all 0.15s ease;
  position: relative;
  overflow: hidden;
}

.post-featured-action--views {
  width: auto;
  height: auto;
  padding: 6px 10px;
  border-radius: 50px;
  gap: 6px;
  cursor: pointer;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.post-featured-action--views:hover {
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.1);
}

.post-featured-action-count {
  font-size: 14px;
  font-weight: 600;
  line-height: 1;
}

.post-featured-action--reply:hover {
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.1);
}

.post-featured-action--retweet:hover {
  color: #00ba7c;
  background: rgba(0, 186, 124, 0.1);
}

.post-featured-action--retweet.post-featured-action--active {
  color: #00ba7c;
}

.post-featured-action--like:hover {
  color: #f91880;
  background: rgba(249, 24, 128, 0.1);
}

.post-featured-action--like.post-featured-action--active {
  color: #f91880;
}

.post-featured-action--bookmark:hover {
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.1);
}

.post-featured-action--bookmark.post-featured-action--active {
  color: rgb(var(--v-theme-primary));
}

.post-featured-action--share:hover {
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.1);
}
</style>
