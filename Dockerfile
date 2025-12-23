FROM node:18-alpine

WORKDIR /app

# Build client first (before copying root package.json to avoid conflicts)
WORKDIR /app/client
COPY client/package.json ./
RUN npm install --no-audit --no-fund --legacy-peer-deps
COPY client ./
RUN npm run build

# Build admin (before copying root package.json to avoid conflicts)
WORKDIR /app/admin
COPY admin/package.json ./
RUN npm install --no-audit --no-fund --legacy-peer-deps
COPY admin ./
RUN npm run build

# Now copy server code and install server dependencies
WORKDIR /app
COPY server ./server
COPY package*.json ./
RUN npm install --production

# Create data directory
RUN mkdir -p /app/data

EXPOSE 3000 3001

CMD ["node", "server/index.js"]

