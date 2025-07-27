FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

RUN mkdir -p /app/public/uploads /app/config

EXPOSE 3001

CMD ["npm", "start"]