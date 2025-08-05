# ScanX Frontend

A React TypeScript frontend for the ScanX device management system, built with Vite and Tailwind CSS.

## Features

- **Authentication System**: Login and registration with JWT token management
- **Protected Routes**: Automatic redirection based on authentication status
- **ScanX-style UI**: Clean, modern design matching the ScanX branding
- **Responsive Design**: Works on desktop and mobile devices
- **TypeScript**: Full type safety throughout the application
- **Error Handling**: Comprehensive error handling with automatic token expiration management

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- Backend API running on http://localhost:3000

### Installation

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the environment file and configure if needed:
   ```bash
   cp .env.example .env
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

The application will be available at http://localhost:5173

## Project Structure

```
frontend/
├── src/
│   ├── components/          # React components
│   │   ├── LoginPage.tsx    # Login form
│   │   ├── RegisterPage.tsx # Registration form
│   │   ├── DashboardPage.tsx # Main dashboard
│   │   ├── ProtectedRoute.tsx # Route guard for authenticated users
│   │   └── PublicRoute.tsx  # Route guard for non-authenticated users
│   ├── contexts/            # React contexts
│   │   └── AuthContext.tsx  # Authentication state management
│   ├── services/            # API services
│   │   └── api.ts          # Backend API communication
│   ├── types/              # TypeScript definitions
│   │   └── auth.ts         # Authentication-related types
│   ├── App.tsx             # Main app component with routing
│   ├── main.tsx           # App entry point
│   └── index.css          # Global styles with Tailwind
├── public/                 # Static assets
├── .env.example           # Environment variables template
├── tailwind.config.js     # Tailwind CSS configuration
├── postcss.config.js      # PostCSS configuration
└── package.json           # Dependencies and scripts
```

## API Integration

The frontend communicates with the backend API at the following endpoints:

- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration  
- `GET /api/auth/me` - Get current user info (requires auth)
- `GET /api/auth/logout` - User logout (requires auth)

## Authentication Flow

1. **Login/Register**: Users can create accounts or log in with existing credentials
2. **JWT Token**: Successful authentication returns a JWT token stored in localStorage
3. **Automatic Headers**: API requests automatically include the Bearer token
4. **Token Expiration**: Expired tokens trigger automatic logout and redirect to login
5. **Route Protection**: Protected routes require authentication, public routes redirect if already authenticated

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Environment Variables

- `VITE_API_URL` - Backend API URL (default: http://localhost:3000)

## Design System

The application uses a ScanX-inspired design with:

- **Colors**: Blue gradient background, white cards, blue accent colors
- **Typography**: Inter font family for clean readability
- **Icons**: Lucide React icons for consistent iconography
- **Layout**: Centered forms, responsive grid layouts
- **Spacing**: Consistent Tailwind spacing scale

## Next Steps

To extend the application:

1. Add device management pages
2. Implement device listing and details
3. Add real-time device status updates
4. Create admin management functionality
5. Add device grouping and filtering
6. Implement device command execution

## Troubleshooting

If you encounter issues:

1. Ensure the backend API is running on http://localhost:3000
2. Check browser console for error messages
3. Verify network connectivity to the backend
4. Clear browser localStorage if authentication seems stuck