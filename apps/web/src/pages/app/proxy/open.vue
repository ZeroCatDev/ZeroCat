<template>
  <v-container>
    <v-dialog v-model="showDialog" max-width="500">
      <v-card>

        <v-card-text>
          {{ decodeBase64(text) }}
        </v-card-text>

      </v-card>
    </v-dialog>
    <proxylicense
      url="https://scratch.mit.edu/explore/projects/all"
    ></proxylicense>
    <br />
    <v-text-field
      v-model="scratchprojectid"
      label="输入Scratch作品ID"
      variant="outlined"
    ></v-text-field>
    <v-btn
      :disabled="scratchprojectid == ''"
      :to="'/app/proxy/' + scratchprojectid"
      color="primary"
      >打开
    </v-btn>
    <br /><br />
    <v-text-field
      v-model="scratchstudioid"
      label="输入Scratch工作室ID"
      variant="outlined"
    ></v-text-field>
    <v-btn
      :disabled="scratchstudioid == ''"
      :to="'/app/proxy/studio/' + scratchstudioid"
      color="primary"
      >打开
    </v-btn>
    <br /><br />
    <v-text-field
      v-model="scratchusername"
      label="输入Scratch用户名称"
      variant="outlined"
    ></v-text-field>
    <v-btn
      :disabled="scratchusername == ''"
      :to="'/app/proxy/user/' + scratchusername"
      color="primary"
      >打开
    </v-btn>
    <br />
  </v-container>
</template>

<script>
import { useHead } from "@unhead/vue";

export default {
  setup() {
    useHead({
      title: "Open Scratch Content",
    });
  },
  data() {
    return {
      scratchprojectid: "",
      scratchstudioid: "",
      scratchusername: "",
      text: "5piU6ICF77yM5pyJ5LiA54G15rOJ77yM5ZCN5puw5oCd5b+r5rGg77yM5riF5r6I6YCP5Lqu77yM5a6b6Iul5LuZ5aKD77yM5LyX55Sf5LqO5rGg5ayJ5oiP77yM5qyi5oSJ5peg5b+n77yM5oGN6Iul5qKm5Lit5LuZ5a2Q57+p54S26LW36Iie44CC5b+95LiA5pel77yM5Ye26K+I5LmL5b6S5r2c5YWl77yM5qSN5LiA5aaW6Iqx77yM5ZCN5puw6L6x6Iqx44CC5q2k6Iqx5Za35bCE5Lik5q+S77yM5puw5bKX5q+S44CB6IuU5q+S77yM5q+S5aaC5bm95Yal5LmL5rCU77yM5r2c6JeP5LqO5rC077yM5LiN6KKr5a+f6KeJ44CC5aeL5pe277yM5q+S5rCU5bm96ZqQ5pyq6Kem5LiW6Ze077yM6buY5a6I5pe25py644CC5p+Q5aSc5pyI6buR6aOO6auY77yM5LiA5b2x55+u5bCP5qOu5Ya377yM5Ly86ay86a2F6Iis5oKE6Iez77yM5omL5pGY6L6x6Iqx77yM5bCG5q+S5bC95rSS5rGg5bqV44CC5LyX5Lq657q357q354yc5rWL77yM5q2k5b2x5oiW5Li66L656I2S54yr5aaW5LmL5bm75YyW77yM54S25a6e5oOF5aaC6Zu+77yM5pyq5piO5YW255yf44CC5q+S57Sg5rOE5Ye677yM5aaC5peg5b2i5bm96a2C77yM5riQ5riQ5byl5ryr77yM6IWQ6JqA5rGg5Lit5qyi6LeD5LmL54G177yM54q556eL6aOO5omr6JC95Y+277yM5pGn5q6L5YeL6Zu244CC57uI5pyJ5LiA5pel77yM5LiA5Lid5q+S6L+56KKr5Lq65Y+R546w77yM5Ly85oOK6bi/5LiA556l77yM5a6Y5bqc5oGQ5YW25aaC5rSq5rC054yb5YW977yM56W45Y+K6buO5bq277yM6YGC5Yaz5oSP5aGr5rGg5Lul57ud5ZCO5oKj44CC5piU5pel5rGg6L656YCN6YGl6ICF77yM5b+D5oCA5L6d5oGL77yM5oCA5b+15piU5pel5LuZ5aKD5LiO57qv55yf77yM6YGC5bu65paw5Zut5aaC5Yek5Yew5raF5qeD5LqO5q2k44CC",      showDialog: false,
      keySequence: ['','','','','','','',''],
      konamiCode: ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']
    };
  },
  mounted() {
    window.addEventListener('keydown', this.handleKeyPress);
  },
  unmounted() {
    window.removeEventListener('keydown', this.handleKeyPress);
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
    handleKeyPress(event) {
      const key = event.key.toLowerCase();
      this.keySequence.push(event.key);

      if (this.keySequence.length > this.konamiCode.length) {
        this.keySequence.shift();
      }

      const isKonamiCode = this.keySequence.every((key, index) => {
        return key.toLowerCase() === this.konamiCode[index].toLowerCase();
      });

      if (isKonamiCode) {
        this.showDialog = true;
      }
    }
  },
};
</script>
