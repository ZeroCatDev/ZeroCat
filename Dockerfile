FROM node:alpine
LABEL author=wuyuan
COPY . /
RUN npm install
EXPOSE 3000
CMD ["npm", "run", "prisma", "&&", "npm", "run", "start"]

