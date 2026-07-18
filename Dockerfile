FROM node:22-slim

WORKDIR /app

# 安裝 git（同步功能需要）
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# 複製依賴並安裝
COPY package*.json ./
RUN npm ci --omit=dev

# 複製程式碼
COPY . .

# Build 前端
RUN npm run build

# 資料目錄用 volume mount
ENV DATA_DIR=/data

EXPOSE 3000

CMD ["node", "server.js"]
