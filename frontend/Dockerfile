FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Expose port
EXPOSE 5173

# Start dev server (for production, use npm run build + serve)
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
