<template>
  <v-container>
    <!-- Header Section -->
    <v-row justify="center">
      <v-col cols="12" md="10" lg="8">
        <v-card class="header-card" elevation="0">
          <v-card-text class="pa-8">
            <v-avatar size="80" class="mb-4">
              <v-img src="@/assets/logo.svg" alt="ZeroCat Logo"></v-img>
            </v-avatar>
            <h1
              class="text-h3 font-weight-bold mb-4 text-white"
              v-text="decodeBase64(headerTitle)"
            ></h1>
            <p
              class="text-h6 text-white"
              v-text="decodeBase64(headerDesc1)"
            ></p>
            <p
              class="text-body-1 text-white mt-4"
              v-text="decodeBase64(headerDesc2)"
            ></p>
            <p
              class="text-body-1 text-white mt-2"
              v-text="decodeBase64(headerDesc3)"
            ></p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
    <v-row justify="center">
      <v-col cols="12" md="10" lg="8">
        <v-card elevation="2" border hover>
          <v-card-title v-text="decodeBase64(referenceTitle)"></v-card-title>
          <v-card-subtitle
            v-text="decodeBase64(referenceSubtitle)"
          ></v-card-subtitle>
          <v-card-text v-html="decodeBase64(referenceText)"></v-card-text>
          <v-card-actions>
            <v-btn
              class="text"
              :href="decodeBase64(referenceLink)"
              target="_blank"
              append-icon="mdi-open-in-new"
              >{{ decodeBase64(referenceButton) }}</v-btn
            ></v-card-actions
          >
        </v-card>
      </v-col>
    </v-row>
    <!-- Main Content -->
    <v-row justify="center">
      <v-col cols="12" md="10" lg="8">
        <!-- Detailed Guidelines -->
        <v-card elevation="2" border hover>
          <v-card-item>
            <v-card-title v-text="decodeBase64(mainTitle)"></v-card-title>
          </v-card-item>
          <v-card-text>
            <div
              v-for="(detail, index) in detailedGuidelines"
              :key="index"
              class="mb-6"
            >
              <v-row>
                <v-col
                  cols="12"
                  md="4"
                  class="d-flex justify-center align-center"
                >
                  <v-img
                    :src="detail.image"
                    :alt="detail.title"
                    max-width="200"
                    max-height="200"
                    contain
                    class="guideline-image"
                  ></v-img>
                </v-col>
                <v-col cols="12" md="8">
                  <v-card-item :prepend-icon="detail.icon">
                    <v-card-title>
                      {{ detail.title }}
                    </v-card-title>
                  </v-card-item>
                  <v-card-text>
                    <p class="mb-4">{{ detail.description }}</p>
                    <p class="mb-4">{{ detail.content }}</p>
                    <!-- <div v-html="detail.content"></div> -->
                  </v-card-text>
                </v-col>
              </v-row>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import { ref } from "vue";

// Import images
import respectImage from "@/assets/scratch/community_guidelines/illustration_respect.svg";
import safeImage from "@/assets/scratch/community_guidelines/illustration_safe.svg";
import feedbackImage from "@/assets/scratch/community_guidelines/illustration_feedback.svg";
import remixImage from "@/assets/scratch/community_guidelines/illustration_remix.svg";
import honestImage from "@/assets/scratch/community_guidelines/illustration_honest.svg";
import friendlyImage from "@/assets/scratch/community_guidelines/illustration_friendly.svg";
import learnMoreImage from "@/assets/scratch/community_guidelines/illustration_learn_more.svg";
export default {
  name: "CommunityGuidelines",
  data() {
    return {
      // Base64 encoded texts
      headerTitle: "56S+5Yy66KGM5Li65YeG5YiZ",
      headerDesc1:
        "WmVyb0NhdOmbtueMq+ekvuWMuuaYr+S4gOS4qumdouWQkeS7u+S9leS6uumDveWPi+WlveeahOekvuWMuu+8jOWcqOi/memHjOS9oOWPr+S7peWSjOWkp+WutuS4gOi1t+WIm+mAoOOAgeWIhuS6q+OAgeWtpuS5oOOAgg==",
      headerDesc2:
        "5oiR5Lus5qyi6L+O5omA5pyJ5Lq677yM5LiN6K665bm06b6E44CB56eN5peP44CB5rCR5peP44CB5a6X5pWZ5L+h5Luw44CB6IO95Yqb44CB5oCn5Y+W5ZCR5ZKM5oCn5Yir6K6k5ZCM44CC",
      headerDesc3:
        "6YCa6L+H6YG15a6I6L+Z5Lqb56S+5Yy66KGM5Li65YeG5YiZ77yM5biu5Yqp57u05oqk5LiA5Liq5Y+L5ZaE44CB56ev5p6B44CB5a+M5pyJ5Yib6YCg5oCn55qE56S+5Yy644CC",
      referenceTitle:
        "5q2k5YeG5YiZ5Y+C6ICD6IeqIFNjcmF0Y2gg44CK56S+5Yy66KGM5Li65YeG5YiZ44CL",
      referenceSubtitle:
        "U2NyYXRjaCDjgIrnpL7ljLrooYzkuLrlh4bliJnjgIsg5piv5LulIENDIEJZLVNBIDIuMCDorrjlj6/or4HmjojmnYPnmoTjgII=",
      referenceText:
        "U2NyYXRjaOaYr1NjcmF0Y2jln7rph5HkvJrkuI5NSVTlqpLkvZPlrp7pqozlrqTnu4jnlJ/lubzlhL/lm63lsI/nu4TnmoTlkIjkvZzpobnnm67jgILlj6/ku6XlnKg8YSBocmVmPSJodHRwczovL3NjcmF0Y2gubWl0LmVkdSIgdGFyZ2V0PSJfYmxhbmsiPmh0dHBzOi8vc2NyYXRjaC5taXQuZWR1PC9hPuWFjei0ueS9v+eUqA==",
      referenceButton: "U2NyYXRjaCDjgIrnpL7ljLrooYzkuLrlh4bliJnjgIs=",
      referenceLink:
        "aHR0cHM6Ly9zY3JhdGNoLm1pdC5lZHUvY29tbXVuaXR5X2d1aWRlbGluZXM=",
      mainTitle: "56S+5Yy66KGM5Li65YeG5YiZ",
      detailedGuidelines: [
        {
          title: "尊重每个人",
          color: "blue",
          icon: "mdi-heart",
          image: respectImage,
          description: "创作者们有不同的背景、兴趣、身份和经历。",
          content:
            "我们鼓励社区中的每一位成员分享令自己兴奋、对自己意义重大的事物——并希望你能在这里找到方式，庆祝并表达独特的自我，同时也尊重他人以同样方式展现自我。针对个人或群体身份的攻击，或对他人的背景与兴趣表现出不友善，都是不被接受的。",
        },
        {
          title: "注意安全：保护个人隐私和联系方式",
          color: "yellow",
          icon: "mdi-shield-lock",
          image: safeImage,
          description:
            "出于安全原因，不要透露任何可能用于私人交流的信息，无论是面对面还是在线交流。",
          content:
            "需妥善保密的个人信息包括但不限于：真实姓名、联系电话、居住地址、学校或幼儿园名称、电子邮箱、社交媒体账号、视频通话平台或软件、浏览器扩展程序、用户脚本，以及任何允许投票、填写表单、发送私信等功能的网站或软件。",
        },
        {
          title: "给予有效的反馈",
          color: "magenta",
          icon: "mdi-comment-text",
          image: feedbackImage,
          description: "在社区中，人人都是学习者。",
          content:
            "在评论项目时，请先分享你欣赏的亮点，并给予建设性的建议，始终保持友善的态度，而非单纯批评。请让评论保持尊重，避免发送垃圾信息或无意义的链接内容。我们鼓励你勇于尝试新事物，积极进行创作实验，并从他人的作品中汲取灵感与经验。",
        },
        {
          title: "鼓励良好的改编",
          color: "green",
          icon: "mdi-music-note",
          image: remixImage,
          description:
            "改编就是你在别人的作品、代码、想法、图片或者他们在社区上分享的任何东西的基础上以完成自己独特作品的过程。",
          content:
            "改编是一种与其他创作者交流与合作的绝佳方式。我们鼓励你在作品中充分运用你在社区中上发现的素材，只需在作品中向原作者致谢，并在内容上作出具有意义的改动。同时，当你在社区上发布作品时，即表示你也授权所有创作者们在他们的作品中使用你的内容。",
        },
        {
          title: "要有诚信",
          color: "purple",
          icon: "mdi-check-decagram",
          image: honestImage,
          description:
            "在社区上诚实地与他人互动是很重要的，每一个社区用户的背后都是一个真实的人。",
          content:
            "散布谣言、冒充他人（包括公众人物），或以虚构病痛博取同情，均属对社区的不敬之举。",
        },
        {
          title: "帮助维护网站的友好氛围",
          color: "pink",
          icon: "mdi-emoticon-happy",
          image: friendlyImage,
          description:
            "让你的创作与交流始终对所有年龄段的成员友好且适宜，至关重要。",
          content:
            "若您在社区中发现内容存在卑劣、侮辱、过度暴力，或对社区造成破坏之虞，敬请点击“报告”按钮告知我们。请以“报告”功能进行反馈，而非参与争执、传播有关他人行为的流言，或以其他方式回应不当内容。管理团队将认真审阅您的报告，并采取适当的处理措施。",
        },
      ],
    };
  },
  methods: {
    decodeBase64(str) {
      try {
        return decodeURIComponent(escape(atob(str)));
      } catch (e) {
        console.error("Base64 解码错误:", e);
        return str;
      }
    },
  },
};
</script>

<style scoped>
.header-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.v-card {
  border-radius: 12px;
}

.v-btn {
  border-radius: 8px;
}

.guideline-image {
  transition: transform 0.3s ease;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.1));
}

.guideline-image:hover {
  transform: scale(1.05);
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}
</style>
