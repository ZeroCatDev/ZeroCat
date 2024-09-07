const { input, select } = require("@inquirer/prompts");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
prisma.ow_config
    .findMany({
        select: {
            name: true,
        },
    })
    .then(async (configs) => {
        //console.log(configs);
        await select({
            message: "选择操作",
            choices: [
                {
                    name: "创建一份配置",
                    value: "create",
                    description: "在数据库中创建一份配置文件",
                },
                {
                    name: "更新配置",
                    value: "update",
                    description: "在数据库中更新已存在的配置文件",
                },
            ],
        }).then((operate) => {
            if (operate == "create") {
                createConfig(configs);
            } else if (operate == "update") {
                // 更新配置
                updateConfig(configs);
            }
        });
    });
async function updateConfig(configs) {
    input({
        message: "配置名称[default]",
    }).then((configName) => {
        if (configName == "") {
            configName = "default";
        }
        if (iscreated(configs, configName) == false) {
            console.log("配置不存在");
        } else {
            input({
                message: configName + "的内容",
            }).then((configContent) => {
                prisma.ow_config
                    .update({
                        where: {
                            name: configName,
                        },

                        data: {
                            config: JSON.parse(configContent),
                        },
                    })
                    .then((result) => {
                        console.log("更新成功");
                    });
            });
        }
    });
}
function createConfig(configs) {
    input({
        message: "配置名称[default]",
    }).then((configName) => {
        if (configName == "") {
            configName = "default";
        }
        if (iscreated(configs, configName)) {
            console.log("配置已存在");
        } else {
            input({
                message: configName + "的内容",
            }).then((configContent) => {
                prisma.ow_config
                    .create({
                        data: {
                            name: configName,
                            config: JSON.parse(configContent),
                        },
                    })
                    .then((result) => {
                        console.log("创建成功");
                    });
            });
        }
    });
}
function iscreated(configs, name) {
    const data = configs;

    const value = name;

    const isValueInNames = data.some((item) => item.name === value);

    console.log(isValueInNames);
    return isValueInNames;
}
