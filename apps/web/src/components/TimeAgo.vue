<template>
  <!-- 显示格式化的相对时间 -->
  {{ timeAgo }}
</template>

<script>
export default {
  name: "TimeAgo", // 组件名
  props: {
    date: {
      type: String, // 传入的日期字符串，格式如："2024-10-06T06:33:21.000Z"
      required: true,
    },
  },
  data() {
    return {
      timeAgo: "", // 用于存储格式化后的时间
      now: new Date(), // 当前时间
    };
  },
  mounted() {
    // 组件挂载时计算相对时间
    this.timeAgo = this.getTimeAgo(new Date(this.date), this.now);

    // 每隔60秒更新一次当前显示的相对时间
    setInterval(() => {
      this.now = new Date(); // 更新当前时间
      this.timeAgo = this.getTimeAgo(new Date(this.date), this.now); // 重新计算
    }, 60000); // 每分钟刷新一次
  },
  watch: {
    date() {
      // 监听传入的日期变化
      this.timeAgo = this.getTimeAgo(new Date(this.date), this.now);
    },
  },
  methods: {
    padWithZeros(vNumber, width) {
      // 辅助函数：补零操作
      let numAsString = vNumber.toString();
      while (numAsString.length < width) {
        numAsString = "0" + numAsString;
      }
      return numAsString;
    },
    dateFormat(date) {
      // 日期格式化函数：将 Date 转换为 `YYYY-MM-DD` 格式字符串
      const vDay = this.padWithZeros(date.getDate(), 2);
      const vMonth = this.padWithZeros(date.getMonth() + 1, 2);
      const vYear = this.padWithZeros(date.getFullYear(), 2);
      const vHour = this.padWithZeros(date.getHours(), 2);
      const vMinute = this.padWithZeros(date.getMinutes(), 2);
      const vSecond = this.padWithZeros(date.getSeconds(), 2);
      return `${vYear}-${vMonth}-${vDay} ${vHour}:${vMinute}:${vSecond}`;
    },
    getTimeAgo(date, now) {
      // 获取相对时间描述（模糊时间）
      if (!date) return "";

      const time = date instanceof Date ? date : new Date(date);
      const timePassed = now.getTime() - time.getTime();

      // 计算相差天数
      const days = Math.floor(timePassed / (24 * 3600 * 1000));

      if (days === 0) {
        const leave1 = timePassed % (24 * 3600 * 1000); // 计算天数后剩余的毫秒数
        const hours = Math.floor(leave1 / (3600 * 1000));

        if (hours === 0) {
          const leave2 = leave1 % (3600 * 1000); // 计算小时数后剩余的毫秒数
          const minutes = Math.floor(leave2 / (60 * 1000));

          if (minutes === 0) {
            const leave3 = leave2 % (60 * 1000); // 计算分钟数后剩余的毫秒数
            const seconds = Math.round(leave3 / 1000);

            return `${seconds} 秒前`;
          }

          return `${minutes} 分钟前`;
        }

        return `${hours} 小时前`;
      }

      if (days < 0) return "刚刚"; // 如果是未来时间，返回 `刚刚`
      if (days < 8) return `${days} 天前`; // 如果天数在 1 到 7 天之间，返回 `X 天前`

      return this.dateFormat(time); // 超过 7 天，则返回格式化的日期
    },
  },
};
</script>

<style scoped>
/* 组件样式（可选） */
span {
  font-size: 14px;
  color: #666;
}
</style>
