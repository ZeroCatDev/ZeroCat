FROM node:20.19.0
LABEL author=wuyuan
COPY . /
RUN npm install
EXPOSE 3000
CMD ["sh", "-c", "npm run prisma && npm run start"]
