# Builder stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy app source
COPY . .

# Build the app
RUN npm run build 

#--------------------------------------------
# Runner stage
FROM node:18-alpine AS runner

# Set working directory
WORKDIR /app

# Copy package files    
COPY package*.json ./

# Install dependencies
RUN npm install --only=production

# Copy dist files
COPY --from=builder /app/dist ./dist

# Copy Google Service Account Key File
COPY scanx-468705-b3849805bd57.json .

# Copy entrypoint script
COPY entrypoint.sh /app/entrypoint.sh

# Make entrypoint script executable
RUN chmod +x /app/entrypoint.sh

# Expose port
EXPOSE 5000

# Run app
CMD ["npm", "run", "start"]
