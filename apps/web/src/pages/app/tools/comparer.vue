<template>
  <v-container>
    <v-file-input
      id="file1"
      truncate-length="22"
      label="scratch项目1"
      :disabled="progresstext === '完成！'"
    ></v-file-input>
    <v-file-input
      id="file2"
      truncate-length="22"
      label="scratch项目2"
      :disabled="progresstext === '完成！'"
    ></v-file-input>
    <v-btn
      color="primary"
      elevation="2"
      class="mx-5"
      @click="convertFiles"
      v-text="progresstext"
      :disabled="progresstext === '完成！'"
    ></v-btn>
    <v-progress-linear v-if='isLoading' indeterminate></v-progress-linear>

    <br/>
    <br/><br/>
    <v-card
      :title="`${(final * 100).toFixed(0)}%的概率为抄袭`"
      subtitle="推测数据，请以实际为准"
      border
    >
      <v-row>
        <v-col cols="6">
          <v-card
            :title="name1"
            :subtitle="'素材总数' + resultjson.assets.objectAmount0"
          >
            <v-card-text>
              {{
              (
              (resultjson.assets.objectSameAmount0 /
              resultjson.assets.objectAmount0) *
              100
              ).toFixed(4)
              }}%（{{ resultjson.assets.objectSameAmount0 }}/{{
              resultjson.assets.objectAmount0
              }}）的素材与右侧相同

              <br/>
              {{
              ((proj0samularty / resultjson.code.code0length) * 100).toFixed(
              4
              )
              }}%（{{ proj0samularty }}/{{
              resultjson.code.code0length
              }}）的项目树与右侧相同
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="6">
          <v-card
            :title="name2"
            :subtitle="'素材总数' + resultjson.assets.objectAmount1"
          >
            <v-card-text>
              {{
              (
              (resultjson.assets.objectSameAmount1 /
              resultjson.assets.objectAmount1) *
              100
              ).toFixed(4)
              }}（{{ resultjson.assets.objectSameAmount1 }}/{{
              resultjson.assets.objectAmount1
              }}）的素材与左侧相同

              <br/>
              {{
              ((proj1samularty / resultjson.code.code1length) * 100).toFixed(
              4
              )
              }}%（{{ proj1samularty }}/{{
              resultjson.code.code1length
              }}）的项目树与左侧相同
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
      <v-card-text>
        <h2>共{{ resultjson.assets.objectSameAmount1 }}条素材相同</h2>
        <h2>共{{ resultjson.code.code0.length }}条项目树相同</h2>
        相同的素材：
        <div v-for="item in resultjson.assets.objectSame0" :key="item">
          {{ item }}
        </div>
      </v-card-text>

      <v-card-actions>
        <v-btn @click="printpage">打印</v-btn>
      </v-card-actions>
    </v-card>
    <br/>
    <v-card border>
      <v-card-title>关于</v-card-title>
      <v-card-subtitle>致谢~</v-card-subtitle>
      <v-card-text>
        本工具使用由<a href="https://github.com/Steve-xmh">Steve-xmh</a>开发的<a
        href="https://github.com/Steve-xmh/scratch-source-comparer"
      >scratch-source-comparer</a
      >进行比对，网页版本由<a href="https://github.com/52black">52black</a
      >制作，开源于<a
        href="https://github.com/52black/scratch-source-comparer-web"
      >Github</a
      >
        <br/>在此感谢 Steve-xmh , 52black 以及这些项目的贡献者们
        <br/>此版本由孙悟元制作，同ZeroCat一同开源于<a
        href="https://github.com/zerocatdev/zerocat-frontend"
      >Github</a
      >
        <br/>本项目目前使用GPLv3许可证。
      </v-card-text>
    </v-card
    >
  </v-container>
</template>

<script>
import {ref} from "vue";
import {useHead} from "@unhead/vue";
import md5 from "crypto-js/md5";
import prettydiff from "prettydiff";
import JSZip from "jszip";

class Block {
  constructor(protoBlock) {
    this.opcode = protoBlock.opcode;
    this.next = protoBlock.next;
    this.parent = protoBlock.parent;
    this.inputs = protoBlock.inputs;
    this.fields = protoBlock.fields;
    this.shadow = protoBlock.shadow;
    this.topLevel = protoBlock.topLevel;
    this.x = protoBlock.x;
    this.y = protoBlock.y;
  }

  get type() {
    return "steve-block";
  }

  toFormatedString(indent = 0) {
    let ret = `${this.topLevel ? "function " : ""}${this.opcode}()${
      this.topLevel ? "" : ";"
    }`;
    if (this.opcode === "control_if" || this.opcode === "control_if_else") {
      ret = "if(true){";
    } else if (
      this.opcode === "control_forever" ||
      this.opcode === "control_repeat" ||
      this.opcode === "control_repeat_until" ||
      this.opcode === "control_while" ||
      this.opcode === "control_for_each"
    ) {
      ret = "while(true)";
    }
    if (this.topLevel) ret += "{";
    if (this.next) {
      ret += ` ${this.next.toFormatedString(indent + 1)}`;
    }
    if (this.inputs.SUBSTACK) {
      ret += `{${this.inputs.SUBSTACK[1].toFormatedString(indent + 1)}}`;
    }
    if (this.inputs.SUBSTACK2) {
      ret += `else{${this.inputs.SUBSTACK2[1].toFormatedString(indent + 1)}}`;
    }
    if (
      this.topLevel ||
      this.opcode === "control_if" ||
      this.opcode === "control_if_else"
    )
      ret += `${"\t".repeat(indent)}}`;
    return ret;
  }
}

export default {
  name: "Comparer",
  setup() {
    useHead({
      title: "比较器",
    });
  },
  data() {
    return {
      isLoading: false,
      name1: ref("项目1"),
      name2: ref("项目1"),
      final: ref(0),
      resultjson: ref({
        assets: {
          objectSameAmount0: 0,
          objectSameAmount1: 0,
          objectAmount0: 0,
          objectAmount1: 0,
          objectSame0: [],
          objectSame1: [],
          objectSameKey0: {},
          objectSameKey1: {},
        },
        code: {
          code0length: 0,
          code1length: 0,
          code0: {same: {}, length: 0},
          code1: {same: {}, length: 0},
        },
      }),
      proj0samularty: ref(0),
      proj1samularty: ref(0),
      progresstext: "开始比对",
      progresslog: "",
      blob1: ref(null),
      blob2: ref(null),
      ignoreMD5List: [
        "83a9787d4cb6f3b7632b4ddfebf74367",
        "83c36d806dc92327b9e7049a565c6bff",
        "cd21514d0531fdffb22204e0ec5ed84a",
        "b7853f557e4426412e64bb3da6531a99",
        "ee1c4946b2fbefa4479c1cd60653fb46",
        "d6118ccd46404fb73d4e9454d610b9ac",
        "8b8a0a49e7f5ece89ada8c069bf5a7ff",
        "547019f968041480c14ddf76113bae3d",
        "7085b3e5732e3689a4ba6a8ad98be814",
        "9e4bdaa40445a5cf843ffb031838b295",
        "b578feebd8a0bdba72e38dc61887cce1",
        "d8e8f89e256b5c131593c0919581a34f",
        "",
      ],
    };
  },
  methods: {
    printpage() {
      window.print();
    },

    async updateProgress(d) {
      this.progresstext = d.text;
      this.progresslog += `\n${d.text}`;
      await this.$nextTick(); // 确保 UI 更新
    },

    async c() {
      if (this.blob1 && this.blob2) {
        this.isLoading = true;
        this.progresstext = "正在比对代码";
        await this.$nextTick(); // 确保 UI 更新
        let result = await this.compare(this.blob1, this.blob2);
        for (const block in result.code.code0.same) {
          if (block !== "length") {
            this.proj0samularty += result.code.code0.same[block].simularty;
          }
        }
        for (const block in result.code.code1.same) {
          if (block !== "length") {
            this.proj1samularty += result.code.code1.same[block].simularty;
          }
        }

        this.final =
          (result.assets.objectSameAmount0 / result.assets.objectAmount1) *
          0.3 +
          (this.proj1samularty / result.code.code1length) * 0.7;
        this.resultjson = result;
        this.progresstext = "完成！";
        this.isLoading = false;

      }
    },

    convertFiles() {
      const file1 = document.getElementById("file1").files[0];
      const file2 = document.getElementById("file2").files[0];

      const reader1 = new FileReader();
      reader1.readAsArrayBuffer(file1);
      this.name1 = file1.name;
      reader1.onload = async () => {
        this.blob1 = new Blob([reader1.result], {type: file1.type});
        await this.c();
      };

      const reader2 = new FileReader();
      reader2.readAsArrayBuffer(file2);
      this.name2 = file2.name;
      reader2.onload = async () => {
        this.blob2 = new Blob([reader2.result], {type: file2.type});
        await this.c();
      };
    },

    async compareCode(project0, project1) {
      const codeTrees0 = await this.makeCodeTree(project0);
      const codeTrees1 = await this.makeCodeTree(project1);
      const total = codeTrees0.length + codeTrees1.length;
      let cur = 0;

      prettydiff.options.diff_format = "json";
      const result = {
        code0length: codeTrees0.length,
        code1length: codeTrees1.length,
        code0: await this.compareTree(codeTrees0, codeTrees1, total, cur),
        code1: await this.compareTree(codeTrees1, codeTrees0, total, cur),
      };
      return result;
    },

    async makeCodeTree(project) {
      const array = [];
      for (const target of project.targets) {
        for (const id in target.blocks) {
          const block = target.blocks[id];
          if (block instanceof Object && !(block instanceof Array)) {
            if (
              block.opcode &&
              block.opcode.startsWith("event_") &&
              block.opcode !== "event_broadcastandwait" &&
              block.opcode !== "event_broadcast"
            ) {
              array.push({
                id,
                code: this.fixBlock(block, target.blocks).toFormatedString(),
              });
              await this.updateProgress({
                text: `正在构建伪代码 (${array.length})`,
                progress: 50 + array.length * 0.02,
              });
            } else if (block.opcode) {
              switch (block.opcode) {
                case "procedures_definition":
                case "control_start_as_clone":
                  array.push({
                    id,
                    code: this.fixBlock(block, target.blocks).toFormatedString(),
                  });
                  await this.updateProgress({
                    text: `正在构建伪代码 (${array.length})`,
                    progress: 50 + array.length * 0.02,
                  });
                  break;
                default:
              }
            }
          }
        }
      }
      return array;
    },

    async compareTree(codeTrees0, codeTrees1, total, cur) {
      const result = {same: {}, length: 0};
      const sameObj = result.same;
      for (const tree0 of codeTrees0) {
        prettydiff.options.source = tree0.code;
        let samest = null;
        for (const tree1 of codeTrees1) {
          let equalsLines = 0;
          let changedLine = 0;
          if (tree0.code === tree1.code) {
            sameObj[tree0.id] = {
              simularTo: tree1.id,
              code0: tree0.code,
              code1: tree1.code,
              simularty: 1,
            };
            result.length++;
            break;
          } else {
            try {
              prettydiff.options.diff = tree1.code;
              const prettyResult = JSON.parse(prettydiff());
              prettyResult.diff.forEach((v) => {
                switch (v[0]) {
                  case "=":
                    equalsLines++;
                  case "+":
                  case "r":
                    changedLine++;
                    break;
                  case "-":
                    changedLine--;
                    break;
                }
              });
              if (
                (!samest || equalsLines / changedLine > samest.simularty) &&
                equalsLines < changedLine
              ) {
                samest = {
                  simularTo: tree1.id,
                  simularty: equalsLines / changedLine,
                  code0: tree0.code,
                  code1: tree1.code,
                };
              }
            } catch (err) {
              samest = null;
            }
          }
        }
        if (!sameObj[tree0.id] && samest && samest.simularty > 0.8) {
          sameObj[tree0.id] = {
            simularTo: samest.simularTo,
            simularty: samest.simularty,
            code0: samest.code0,
            code1: samest.code1,
          };
          result.length++;
        }
        cur++;
        await this.updateProgress({
          text: `正在比对代码 (${cur}/${total})`,
          progress: 60 + (cur / total) * 35,
        });
        await this.waitTick(); // 避免卡顿
      }
      return result;
    },

    async compareAssets({o0, o1, h0, h1}) {
      console.log(o0, o1);
      const result = {
        objectSameAmount0: 0,
        objectSameAmount1: 0,
        objectAmount0: 0,
        objectAmount1: 0,
        objectSame0: [],
        objectSame1: [],
        objectSameKey0: {},
        objectSameKey1: {},
      };

      let total = Object.keys(o0).length + Object.keys(o1).length;
      let processed = 0;

      for (const okey in o0) {
        const item = okey;
        result.objectAmount0++;
        if (this.ignoreMD5List.indexOf(item) !== -1) continue;
        for (const key in o1) {
          const comp = key;
          if (comp == item) {
            result.objectSame0.push(item);
            result.objectSameKey0[item] = okey;
            result.objectSameAmount0++;
            break;
          }
        }
        processed++;
        await this.updateProgress({
          text: `对比资源文件中 (${processed}/${total})`,
          progress: 35 + (processed / total) * 15,
        });
        await this.waitTick(); // 避免卡顿
      }
      for (const okey in o1) {
        const item = okey;
        result.objectAmount1++;
        if (this.ignoreMD5List.indexOf(item) !== -1) continue;
        for (const key in o0) {
          const comp = key;
          if (comp == item) {
            result.objectSame1.push(item);
            result.objectSameKey1[item] = okey;
            result.objectSameAmount1++;
            break;
          }
        }
        processed++;
        await this.updateProgress({
          text: `对比资源文件中 (${processed}/${total})`,
          progress: 35 + (processed / total) * 15,
        });
        await this.waitTick(); // 避免卡顿
      }
      return result;
    },

    async compare(project0, project1) {
      this.updateProgress({text: "正在转换工程版本", progress: 0});
      const [zip0, zip1] = await Promise.all([
        JSZip.loadAsync(project0),
        JSZip.loadAsync(project1),
      ]);
      this.transferSb2IfNeed(zip0);
      this.transferSb2IfNeed(zip1);
      this.updateProgress({text: "正在打开", progress: 0});
      const md50 = {};
      const md51 = {};
      const imgHash0 = {};
      const imgHash1 = {};
      const threads = [];
      const result = {};
      let fileTotal = 0;
      let fileLoaded = 0;

      const collectHash = (zip, array) => {
        zip.forEach((rpath, file) => {
          if (rpath === "project.json") return;
          fileTotal++;
          threads.push(
            (async () => {
              const data = await file.async("uint8array");
              const hash = md5(data);
              if (this.ignoreMD5List.indexOf(hash) === -1) {
                if (rpath.endsWith(".png")) {
                  array[rpath] = md5(data);
                } else {
                  array[rpath] = md5(data);
                }
                await this.waitTick();
              }
              fileLoaded++;
              await this.updateProgress({
                text: `收集资源文件中 (${fileLoaded}/${fileTotal})`,
                progress: 5 + (fileLoaded / fileTotal) * 30,
              });
            })()
          );
        });
      };

      collectHash(zip0, md50, imgHash0);
      collectHash(zip1, md51, imgHash1);
      await Promise.all(threads);
      console.log(md50, md51);
      result.assets = await this.compareAssets({
        o0: md50,
        o1: md51,
        h0: imgHash0,
        h1: imgHash1,
      });
      const [projectJson0, projectJson1] = await Promise.all([
        (async () =>
          JSON.parse(await zip0.file("project.json").async("string")))(),
        (async () =>
          JSON.parse(await zip1.file("project.json").async("string")))(),
      ]);
      result.code = await this.compareCode(projectJson0, projectJson1);
      this.updateProgress({text: "完成！", progress: 1});
      return result;
    },

    fixBlock(block, blocks) {
      if (typeof block !== "object") throw new Error("没有传入模块参数！");
      if (typeof blocks !== "object") throw new Error("没有传入模块表参数！");

      const b = new Block(block);
      if (b.next) {
        b.next = this.fixBlock(blocks[b.next], blocks);
        b.next.parent = b;
      }
      if (b.inputs.SUBSTACK && b.inputs.SUBSTACK[1]) {
        b.inputs.SUBSTACK[1] = this.fixBlock(
          blocks[b.inputs.SUBSTACK[1]],
          blocks
        );
        b.inputs.SUBSTACK[1].parent = b;
      } else {
        b.inputs.SUBSTACK = undefined;
      }

      if (b.inputs.SUBSTACK2 && b.inputs.SUBSTACK2[1]) {
        b.inputs.SUBSTACK2[1] = this.fixBlock(
          blocks[b.inputs.SUBSTACK2[1]],
          blocks
        );
        b.inputs.SUBSTACK2[1].parent = b;
      } else {
        b.inputs.SUBSTACK2 = undefined;
      }

      return b;
    },

    async transferSb2IfNeed(proj) {
      // const projJSON = JSON.parse(await proj.file('project.json').async('string'))
      // if (projJSON.objName !== undefined) {
      //     const vm = new VisualMachine()
      //     await vm.loadProject(projJSON)
      //     proj.file('project.json', vm.toJSON())
      //     return JSZip.loadAsync(vm.saveProjectSb3())
      // }
    },

    waitTick() {
      return new Promise((resolve) => setTimeout(resolve, 0));
    },
  },
};
</script>
