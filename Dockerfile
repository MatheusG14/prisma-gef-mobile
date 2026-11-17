FROM node:22-alpine
# node:sqlite requer Node >= 22.13

WORKDIR /app

# Instala dependências de produção
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts || npm install --omit=dev

# Copia os arquivos da aplicação
COPY . .

# Cria diretório para persistência de dados
RUN mkdir -p /app/data && chown -R node:node /app

USER node

ENV NODE_ENV=production
ENV PORT=3000
ENV TRUST_PROXY_HOPS=1
ENV DB_PATH=/app/data/prisma.sqlite

EXPOSE 3000

CMD ["node", "server.js"]

