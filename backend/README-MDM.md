# MDM Backend API

A TypeScript-based backend API for the Mobile Device Management (MDM) system using Express.js, MySQL, and JWT authentication.

## 🚀 Features

- **Admin Authentication**: JWT-based authentication for admin users
- **Device Management**: Store and manage device information from agents
- **Agent Data Ingestion**: REST API endpoint for agent data submission
- **MySQL Database**: Structured storage with proper relationships
- **TypeScript**: Full type safety and modern JavaScript features
- **Docker Support**: Complete containerization setup

## 📊 Database Schema

### Tables:
- `admins` - Admin user accounts
- `devices` - Device registration and metadata
- `device_data` - Historical agent reports
- `device_summary` - Latest device status summary

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new admin
- `POST /api/auth/login` - Admin login
- `GET /api/auth/me` - Get current admin info

### Agent Data (Public)
- `POST /api/devices/agent/report` - Receive agent data

### Device Management (Protected)
- `GET /api/devices` - List all devices (paginated)
- `GET /api/devices/:id` - Get device details
- `GET /api/devices/:id/data/:type` - Get specific device data
- `GET /api/devices/dashboard/stats` - Dashboard statistics

## 🛠️ Setup & Installation

### Prerequisites
- Node.js 18+
- MySQL 8.0+
- Docker (optional)

### Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Setup environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your MySQL credentials
   ```

3. **Start MySQL** (or use Docker):
   ```bash
   # Option 1: Local MySQL
   mysql -u root -p
   CREATE DATABASE mdm_agent;
   CREATE USER 'mdm_user'@'localhost' IDENTIFIED BY 'mdm_password';
   GRANT ALL PRIVILEGES ON mdm_agent.* TO 'mdm_user'@'localhost';
   
   # Option 2: Docker MySQL only
   docker-compose up mysql -d
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

### Docker Setup

1. **Start all services:**
   ```bash
   docker-compose up -d
   ```

2. **Check logs:**
   ```bash
   docker-compose logs -f app
   ```

## 📡 Agent Integration

The agent should send data to: `POST /api/devices/agent/report`

**Expected payload format:**
```json
{
  "user": "employee@company.com",
  "version": "1.0.0",
  "os_type": "darwin",
  "os_version": "14.5.0",
  "serial_no": "C07ZX047JYVX",
  "timestamp": "2025-08-04T07:30:07Z",
  "data": {
    "system_info": [...],
    "screen_lock_info": [...],
    "disk_encryption_info": [...],
    "antivirus_info": [...],
    "password_manager_info": [...],
    "apps_info": [...]
  }
}
```

## 🔐 Admin Dashboard Usage

1. **Register first admin:**
   ```bash
   curl -X POST http://localhost:3000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@company.com","password":"password123","name":"Admin User"}'
   ```

2. **Login:**
   ```bash
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@company.com","password":"password123"}'
   ```

3. **Use JWT token in subsequent requests:**
   ```bash
   curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:3000/api/devices
   ```

## 📈 Monitoring

- **Health Check**: `GET /health`
- **API Documentation**: `GET /` (shows available endpoints)
- **Database**: Tables auto-created on first run

## 🔧 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `MYSQL_HOST` | MySQL host | `localhost` |
| `MYSQL_PORT` | MySQL port | `3306` |
| `MYSQL_USER` | MySQL username | `mdm_user` |
| `MYSQL_PASSWORD` | MySQL password | `mdm_password` |
| `MYSQL_DATABASE` | Database name | `mdm_agent` |
| `JWT_SECRET` | JWT signing secret | (required) |

## 🐛 Troubleshooting

- **Connection refused**: Ensure MySQL is running
- **Authentication failed**: Check MySQL credentials in .env
- **JWT errors**: Verify JWT_SECRET is set
- **CORS issues**: Frontend origin may need to be added to CORS config

---

**Ready to receive agent data! 🎯**