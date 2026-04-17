# Interactive Learning Backend

Node.js + Express backend API for the Interactive Learning System.

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```bash
# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key

# JWT Configuration
JWT_SECRET=your_jwt_secret_key
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key
JWT_EXPIRATION=3600
JWT_REFRESH_EXPIRATION=86400

# Server Configuration
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

### 3. Run Development Server
```bash
npm run dev
```

The server will start on `http://localhost:3001`

## API Endpoints

Base URL: `http://localhost:3001/api`

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Logout user

### Users
- `GET /users/profile` - Get current user profile
- `PUT /users/profile` - Update user profile
- `GET /users/:id/progress` - Get user progress
- `GET /users/:id/achievements` - Get user achievements
- `GET /users/leaderboard` - Get leaderboard

### Courses
- `GET /courses` - List courses
- `GET /courses/:id` - Get course details
- `GET /courses/:id/lessons` - Get course lessons

## Database Schema

Tables needed in Supabase:
- `users` - User accounts
- `courses` - Course information
- `modules` - Course modules
- `lessons` - Individual lessons
- `user_progress` - User learning progress
- `user_achievements` - User earned achievements
- `achievements` - Available achievements

See `../system-design/database_schema.md` for full schema details.
