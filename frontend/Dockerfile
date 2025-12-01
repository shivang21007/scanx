#--------------------------------------------
# Builder stage
FROM node:lts-alpine AS builder
# Set working directory
WORKDIR /app
# Copy package files
COPY package*.json ./
# Install dependencies
RUN npm install

# Copy app source
COPY . .
# Build the app
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
ARG VITE_ENABLE_REGISTER_ENDPOINT
ENV VITE_ENABLE_REGISTER_ENDPOINT=${VITE_ENABLE_REGISTER_ENDPOINT}

# Run build script
RUN npm run build

#--------------------------------------------
# Runner stage
FROM nginx:stable-alpine AS runner
# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Set working directory
WORKDIR /usr/share/nginx/html
# Copy dist files
COPY --from=builder /app/dist .
# Copy custom error pages
COPY public/429.html .
# Fix permissions for all files
RUN chmod -R 644 /usr/share/nginx/html/* && \
    find /usr/share/nginx/html -type d -exec chmod 755 {} \;
# Expose port
EXPOSE 80
# Run nginx
CMD ["nginx", "-g", "daemon off;"]