# System Architecture

## Overview

The Interactive Learning System for Fundamentals of Multimedia follows a modern three-tier architecture designed for scalability, maintainability, and performance. This document describes the system's architectural components, their interactions, and the design decisions that guide the implementation.

## Architectural Pattern

The system employs a **Client-Server Architecture** with **Microservices Principles** for backend organization. The architecture consists of three primary layers:

```
┌─────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                        │
│                    (React + TypeScript Frontend)                 │
├─────────────────────────────────────────────────────────────────┤
│                        APPLICATION LAYER                         │
│              (Node.js + Express.js API Server)                   │
├─────────────────────────────────────────────────────────────────┤
│                          DATA LAYER                              │
│              (Supabase: PostgreSQL + Auth + Storage)             │
└─────────────────────────────────────────────────────────────────┘
```

## Layer 1: Presentation Layer (Frontend)

### Technology Stack
- **Framework**: React 18+ with TypeScript
- **Styling**: Tailwind CSS 3.4+
- **UI Components**: shadcn/ui
- **State Management**: Zustand
- **Data Visualization**: Recharts
- **Routing**: React Router DOM
- **Build Tool**: Vite

### Component Architecture

The frontend follows a **Component-Based Architecture** organized as follows:

```
src/
├── components/           # Reusable UI components
│   ├── ui/              # shadcn/ui components
│   ├── layout/          # Layout components (Sidebar, Header)
│   ├── dashboard/       # Dashboard-specific components
│   ├── lessons/         # Lesson-related components
│   ├── quizzes/         # Quiz and assessment components
│   └── common/          # Shared utility components
├── pages/               # Page-level components
│   ├── student/         # Student-facing pages
│   ├── instructor/      # Instructor-facing pages
│   └── shared/          # Common pages (Login, Profile)
├── hooks/               # Custom React hooks
├── stores/              # Zustand state stores
├── lib/                 # Utility functions and configurations
├── types/               # TypeScript type definitions
└── styles/              # Global styles and Tailwind config
```

### Key Frontend Components

#### 1. Layout Components
- **AppShell**: Main application wrapper with sidebar and content area
- **Sidebar**: Navigation sidebar with role-based menu items
- **Header**: Top navigation bar with user info and notifications
- **ProtectedRoute**: Route guard for authenticated access

#### 2. Dashboard Components
- **StatsCards**: XP, Progress, Quiz Average, Week indicators
- **ProgressChart**: Visual progress tracking with Recharts
- **UnitProgressList**: Expandable unit progress cards
- **UpcomingDeadlines**: Deadline reminders and notifications
- **RecentActivity**: Activity feed with recent actions

#### 3. Learning Components
- **LessonViewer**: Content display with video, text, and interactive elements
- **PlaygroundCanvas**: Interactive simulation environment
- **ResourceDownloader**: File download management
- **BookmarkManager**: Save and resume progress

#### 4. Assessment Components
- **QuizEngine**: Adaptive quiz interface
- **QuestionRenderer**: Multiple question type support
- **ProgressTracker**: Quiz progress indication
- **ResultsViewer**: Detailed results and feedback

## Layer 2: Application Layer (Backend API)

### Technology Stack
- **Runtime**: Node.js 20+
- **Framework**: Express.js 4+
- **Authentication**: Supabase Auth (JWT)
- **API Style**: RESTful with JSON

### API Architecture

The backend follows a **Layered Architecture** pattern:

```
├── src/
│   ├── controllers/     # Request handlers
│   ├── services/        # Business logic
│   ├── middleware/      # Authentication, validation
│   ├── routes/          # API route definitions
│   ├── models/          # Data models (interfaces)
│   ├── utils/           # Utility functions
│   └── config/          # Configuration files
```

### API Endpoints Structure

#### Authentication Routes (`/api/auth`)
```
POST   /api/auth/register          # User registration
POST   /api/auth/login             # User login
POST   /api/auth/logout            # User logout
POST   /api/auth/refresh           # Token refresh
POST   /api/auth/forgot-password   # Password reset request
POST   /api/auth/reset-password    # Password reset confirmation
```

#### User Routes (`/api/users`)
```
GET    /api/users/profile          # Get current user profile
PUT    /api/users/profile          # Update user profile
GET    /api/users/:id/progress     # Get user progress
GET    /api/users/:id/achievements # Get user achievements
```

#### Course Routes (`/api/courses`)
```
GET    /api/courses                # List all courses
GET    /api/courses/:id            # Get course details
GET    /api/courses/:id/modules    # Get course modules
POST   /api/courses                # Create new course (Instructor)
PUT    /api/courses/:id            # Update course (Instructor)
DELETE /api/courses/:id            # Delete course (Instructor)
```

#### Module Routes (`/api/modules`)
```
GET    /api/modules/:id            # Get module details
GET    /api/modules/:id/lessons    # Get module lessons
POST   /api/modules/:id/progress   # Update lesson progress
PUT    /api/modules/:id/complete   # Mark module complete
```

#### Lesson Routes (`/api/lessons`)
```
GET    /api/lessons/:id            # Get lesson content
GET    /api/lessons/:id/resources  # Get lesson resources
POST   /api/lessons/:id/bookmark   # Bookmark lesson
POST   /api/lessons/:id/complete   # Mark lesson complete
```

#### Assessment Routes (`/api/assessments`)
```
GET    /api/assessments            # List assessments
GET    /api/assessments/:id        # Get assessment details
POST   /api/assessments/:id/start  # Start assessment
POST   /api/assessments/:id/submit # Submit answers
GET    /api/assessments/:id/results # Get results
```

#### Forum Routes (`/api/forum`)
```
GET    /api/forum/topics           # List forum topics
POST   /api/forum/topics           # Create new topic
GET    /api/forum/topics/:id       # Get topic with replies
POST   /api/forum/topics/:id/reply # Add reply to topic
```

#### Analytics Routes (`/api/analytics`)
```
GET    /api/analytics/dashboard    # Get dashboard analytics
GET    /api/analytics/progress     # Get progress analytics
GET    /api/analytics/performance  # Get performance metrics
GET    /api/analytics/recommendations # Get AI recommendations
```

### Middleware Components

1. **Authentication Middleware**
   - Validates JWT tokens
   - Attaches user context to requests
   - Handles token expiration

2. **Authorization Middleware**
   - Checks user roles and permissions
   - Enforces access control rules
   - Returns appropriate error responses

3. **Validation Middleware**
   - Validates request body parameters
   - Sanitizes user inputs
   - Returns validation error details

4. **Error Handling Middleware**
   - Catches and formats errors
   - Logs errors for monitoring
   - Returns consistent error responses

## Layer 3: Data Layer (Supabase)

### Database: PostgreSQL

Supabase provides a managed PostgreSQL database with the following characteristics:
- **Version**: PostgreSQL 14+
- **Connection**: Direct PostgreSQL + Supabase client libraries
- **Security**: Row Level Security (RLS) policies
- **Extensions**: pgjwt, uuid-ossp, pgcrypto

### Real-Time Subscriptions

Supabase Realtime enables live data updates through WebSocket connections:
- **Database Changes**: Subscribe to INSERT, UPDATE, DELETE events
- **Broadcast**: Send and receive messages across clients
- **Presence**: Track user online status and activity

### File Storage

Supabase Storage handles file uploads and management:
- **Buckets**: Organized storage containers
- **Policies**: Access control per bucket
- **Transformations**: On-the-fly image resizing
- **CDN**: Global content delivery

## Authentication Flow

### Registration Flow
```
1. User submits registration form (email, password, role)
2. Frontend validates input
3. POST /api/auth/register
4. Backend validates and calls Supabase Auth
5. Supabase creates user record
6. Backend creates user profile in database
7. Returns success + confirmation email sent
```

### Login Flow
```
1. User submits login credentials
2. Frontend validates input
3. POST /api/auth/login
4. Backend calls Supabase Auth
5. Supabase validates and returns JWT tokens
6. Backend fetches user profile and permissions
7. Returns tokens + user data
8. Frontend stores tokens and redirects to dashboard
```

### Token Refresh Flow
```
1. Access token expires (1 hour)
2. Frontend detects 401 response
3. POST /api/auth/refresh with refresh token
4. Backend validates refresh token
5. Supabase issues new access token
6. Frontend retries original request
```

### Protected Route Flow
```
1. User navigates to protected route
2. ProtectedRoute component checks auth state
3. If not authenticated, redirect to login
4. If authenticated, verify token validity
5. Check role-based access permissions
6. Render route or show access denied
```

## Data Flow Diagrams

### Student Learning Flow
```
┌─────────┐    ┌──────────┐    ┌─────────┐    ┌──────────┐
│ Student │───▶│ Frontend │───▶│ Backend │───▶│ Database │
└─────────┘    └──────────┘    └─────────┘    └──────────┘
     │               │               │               │
     │ 1. Login      │               │               │
     │──────────────▶│               │               │
     │               │ 2. Auth req   │               │
     │               │──────────────▶│               │
     │               │               │ 3. Validate   │
     │               │               │──────────────▶│
     │               │               │ 4. Tokens     │
     │               │◀──────────────│               │
     │ 5. Dashboard  │               │               │
     │◀──────────────│               │               │
     │               │               │               │
     │ 6. Open Lesson│               │               │
     │──────────────▶│               │               │
     │               │ 7. Fetch content              │
     │               │──────────────▶│──────────────▶│
     │               │ 8. Content    │◀──────────────│
     │◀──────────────│◀──────────────│               │
     │               │               │               │
     │ 9. Complete   │               │               │
     │──────────────▶│               │               │
     │               │ 10. Update progress           │
     │               │──────────────▶│──────────────▶│
     │               │ 11. XP Awarded│◀──────────────│
     │◀──────────────│◀──────────────│               │
```

### Instructor Analytics Flow
```
┌───────────┐    ┌──────────┐    ┌─────────┐    ┌──────────┐
│ Instructor│───▶│ Frontend │───▶│ Backend │───▶│ Database │
└───────────┘    └──────────┘    └─────────┘    └──────────┘
     │                 │               │               │
     │ 1. View Analytics                │               │
     │────────────────▶│               │               │
     │                 │ 2. Query data │               │
     │                 │──────────────▶│──────────────▶│
     │                 │ 3. Aggregate  │◀──────────────│
     │                 │◀──────────────│               │
     │ 4. Charts/Tables│               │               │
     │◀────────────────│               │               │
```

## Security Architecture

### Authentication Security
- **Password Hashing**: bcrypt with salt rounds 12
- **JWT Tokens**: RS256 algorithm, 1-hour access token expiry
- **Refresh Tokens**: Secure HTTP-only cookies, 7-day expiry
- **Rate Limiting**: 5 login attempts per minute per IP

### Authorization Security
- **Row Level Security**: Database-level access control
- **Role-Based Access Control**: Student/Instructor/Admin roles
- **Resource Ownership**: Users can only modify their own data
- **API Validation**: All inputs validated and sanitized

### Data Security
- **HTTPS**: All communications encrypted
- **SQL Injection Prevention**: Parameterized queries
- **XSS Protection**: Input sanitization and CSP headers
- **CSRF Protection**: Token-based validation

## Scalability Considerations

### Horizontal Scaling
- **Stateless API**: No server-side session storage
- **Load Balancing**: Distribute requests across instances
- **Database Read Replicas**: Scale read operations
- **Caching Layer**: Redis for frequently accessed data

### Performance Optimization
- **CDN**: Static assets served from edge locations
- **Image Optimization**: Automatic resizing and format conversion
- **Lazy Loading**: Components loaded on demand
- **Code Splitting**: Route-based bundle splitting

### Database Optimization
- **Indexing**: Strategic indexes on query columns
- **Query Optimization**: Efficient queries with proper joins
- **Connection Pooling**: Reuse database connections
- **Pagination**: Limit result sets for large queries

## Deployment Architecture

### Development Environment
```
Local Machine
├── React Dev Server (Vite) :5173
├── Node.js API Server      :3001
└── Supabase (Cloud)        :5432
```

### Production Environment
```
Cloud Infrastructure
├── CDN (Static Assets)
├── Load Balancer
├── API Servers (Node.js) x N
└── Supabase (Managed)
    ├── PostgreSQL
    ├── Auth
    ├── Storage
    └── Realtime
```

## Monitoring and Logging

### Application Monitoring
- **Error Tracking**: Sentry for error capture and alerting
- **Performance Monitoring**: Web Vitals tracking
- **User Analytics**: Mixpanel for user behavior
- **Server Metrics**: PM2 for Node.js monitoring

### Logging Strategy
- **Application Logs**: Winston logger with rotation
- **Access Logs**: HTTP request/response logging
- **Audit Logs**: Security-relevant event tracking
- **Error Logs**: Detailed error stack traces

## Conclusion

The system architecture described above provides a solid foundation for building a scalable, maintainable, and performant interactive learning platform. The three-tier architecture with clear separation of concerns enables independent development and scaling of each layer. The use of modern technologies and best practices ensures the system can meet current requirements while remaining adaptable to future needs.
