# Builder stage
FROM node:18-alpine as builder

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
FROM node:18-alpine as runner

# Set working directory
WORKDIR /app

# Copy build files
COPY --from=builder /app/dist ./dist

# Copy package files    
COPY package*.json ./

# Install dependencies
RUN npm install --only=production

# Copy app source
COPY . .    

# Expose the port the app runs on
EXPOSE 3000

# Run the app
CMD ["npm", "start"]
