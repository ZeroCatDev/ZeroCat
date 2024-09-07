import { prisma } from "./global.js";
var getconfig = {}
prisma.ow_config.findFirst({
    where: {
        name: 'default'
    }
}).then((config) => {
    getconfig = config
}).catch((err) => {
    console.log(err);
});

export const config= getconfig
