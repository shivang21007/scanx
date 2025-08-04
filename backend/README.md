# JWT CRUD API with Node.js, MongoDB, and Nginx

A secure RESTful API built with Node.js, featuring JWT authentication, MongoDB database, and Nginx reverse proxy. This project demonstrates a complete CRUD (Create, Read, Update, Delete) application with proper authentication and containerization.

## Features

- JWT-based authentication
- MongoDB database integration
- Nginx reverse proxy
- Docker containerization
- RESTful API endpoints
- Secure environment configuration

## Prerequisites

- Docker and Docker Compose
- Node.js (for local development)
- Git

## Project Structure

```
.
├── controllers/     # Route controllers
├── middleware/      # Custom middleware (auth, error handling)
├── models/         # MongoDB models
├── routes/         # API routes
├── nginx/          # Nginx configuration
├── .github/        # GitHub Actions workflow
├── server.js       # Main application file
├── docker-compose.yml
└── Dockerfile
```

## Local Setup

1. Clone the repository:
   ```bash
   https://github.com/shivang21007/jwtAuth.git
   cd jwt-crud-api
   ```

2. Create a `.env` file in the root directory with the following content:
   ```
   PORT=3000
   MONGO_URI=mongodb://mongo:27017/jwtcrud
   JWT_SECRET=your-secret-key-here
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Start the application:
   ```bash
   npm start
   ```

## Docker Setup

1. Build and run the containers:
   ```bash
   docker-compose up --build
   ```

2. To run in detached mode:
   ```bash
   docker-compose up -d
   ```

3. To stop the containers:
   ```bash
   docker-compose down
   ```

## Nginx Configuration

The Nginx reverse proxy is configured to:
- Route traffic to the Node.js application
- Handle SSL termination (if configured)
- Provide load balancing (if scaled)

The Nginx configuration is located in `nginx/default.conf` and is automatically mounted into the container.

## Verifying the Setup

1. Check if the API is running:
   ```bash
   curl http://localhost/tasks
   ```

2. For authenticated endpoints, include the JWT token:
   ```bash
   curl -H "Authorization: Bearer your-jwt-token" http://localhost/tasks
   ```

## Environment Variables

Create a `.env` file with the following variables:

```env
PORT=3000
MONGO_URI=mongodb://mongo:27017/jwtcrud
JWT_SECRET=your-secret-key-here
```

## API Endpoints

- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login and get JWT token
- `GET /tasks` - Get all tasks (requires authentication)
- `POST /tasks` - Create a new task (requires authentication)
- `PUT /tasks/:id` - Update a task (requires authentication)
- `DELETE /tasks/:id` - Delete a task (requires authentication)

## GitHub Actions

The project includes a GitHub Actions workflow that:
- Runs tests
- Builds Docker images
- Deploys to production (if configured)

## Project Workflow

### 1. Authentication Flow

1. **User Registration**
   - User sends POST request to `/auth/register` with email and password
   - System validates input and checks for existing user
   - Password is hashed using bcrypt
   - New user is saved to MongoDB
   - Returns success message

2. **User Login**
   - User sends POST request to `/auth/login` with credentials
   - System verifies email and password
   - Generates JWT token with user ID and expiration
   - Returns JWT token for subsequent requests

### 2. Task Management Flow

1. **Creating a Task**
   - User sends POST request to `/tasks` with task details
   - JWT token is validated in middleware
   - Task is associated with authenticated user
   - Task is saved to MongoDB
   - Returns created task with ID

2. **Reading Tasks**
   - User sends GET request to `/tasks`
   - JWT token is validated
   - System fetches all tasks for the authenticated user
   - Returns array of tasks

3. **Updating a Task**
   - User sends PUT request to `/tasks/:id` with updated data
   - JWT token is validated
   - System verifies task ownership
   - Updates task in MongoDB
   - Returns updated task

4. **Deleting a Task**
   - User sends DELETE request to `/tasks/:id`
   - JWT token is validated
   - System verifies task ownership
   - Removes task from MongoDB
   - Returns success message

### 3. System Architecture Flow

1. **Request Handling**
   - Client sends request to Nginx (port 80)
   - Nginx forwards request to Node.js application
   - Request passes through middleware chain
   - Appropriate controller handles the request
   - Response is sent back through the chain

2. **Database Operations**
   - MongoDB stores user and task data
   - Mongoose models handle data validation
   - Queries are optimized for performance
   - Data is properly indexed

3. **Security Measures**
   - JWT tokens are validated on each request
   - Passwords are hashed before storage
   - Input is sanitized and validated
   - Rate limiting is implemented
   - CORS is properly configured

4. **Error Handling**
   - Global error handler catches exceptions
   - Custom error classes for different scenarios
   - Proper HTTP status codes are returned
   - Error messages are sanitized for security

### 4. Container Workflow

1. **Docker Setup**
   - Node.js application container starts
   - MongoDB container initializes
   - Nginx container starts and loads configuration
   - Containers are connected via Docker network

2. **Service Communication**
   - Node.js app connects to MongoDB
   - Nginx proxies requests to Node.js app
   - Health checks ensure service availability
   - Logs are properly managed

3. **Scaling Considerations**
   - MongoDB can be scaled for high availability
   - Node.js app can be load balanced
   - Nginx handles multiple instances
   - Data persistence is maintained

### 5. CI/CD Pipeline

1. **GitHub Actions Workflow**
   - Code is pushed to repository
   - Tests are automatically run
   - Docker images are built
   - Security scans are performed
   - Deployment to production (if configured)

2. **Quality Assurance**
   - Code linting and formatting
   - Unit tests execution
   - Integration tests
   - Performance benchmarks

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request


## License

This project is licensed under the MIT License - see the LICENSE file for details.