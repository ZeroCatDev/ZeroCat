const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const crypto = require("crypto");

prisma.ow_projects
    .findMany({})
    .then((projects) => {
        //console.log(projects);
        projects.forEach((project) => {
            const hash = crypto
                .createHash("sha256")
                .update(String(project.source))
                .digest("hex");
            //console.log(project.source);
            prisma.ow_projects_file
                .upsert({
                    where: {
                        sha256: hash,
                    },
                    update: {
                        sha256: hash,
                        source: project.source,
                    }

                })
                .catch((error) => {
                    prisma.ow_projects.update({
                        where: {
                            id: project.id,
                        },
                        data: {
                            source: hash,
                        },
                    }).catch((error) => {
                        console.log(error);
                    })
                    //console.log(error);
                }).then(() => {
                    prisma.ow_projects.update({
                        where: {
                            id: project.id,
                        },
                        data: {
                            source: hash,
                        },
                    }).catch((error) => {
                        console.log(error);
                    })
                    console.log("done");
                })
        });
    })
    .catch((error) => {
        console.log(error);
    });
