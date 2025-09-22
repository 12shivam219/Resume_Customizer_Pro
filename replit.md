# ResumeCustomizer Pro

## Overview

ResumeCustomizer Pro is a full-stack web application that allows users to upload DOCX resume files, process tech skills into organized groups, and create customized versions tailored for specific job applications. The platform features AI-powered tech stack organization, a rich text editor for resume customization, and file export capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript running on Vite for fast development and optimized builds
- **UI Components**: Radix UI primitives with shadcn/ui components for consistent, accessible design
- **Styling**: Tailwind CSS with CSS variables for theming and responsive design
- **State Management**: TanStack Query (React Query) for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation for type-safe form handling

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules for modern JavaScript features
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Authentication**: Replit Auth with OpenID Connect for seamless user authentication
- **Session Management**: Express sessions with PostgreSQL store for persistent login state
- **File Handling**: Multer middleware for DOCX file uploads with memory storage

### Database Design
- **Primary Database**: PostgreSQL with Neon serverless connection
- **Schema Management**: Drizzle Kit for migrations and schema versioning
- **Key Tables**:
  - `users`: User profiles and authentication data
  - `resumes`: Resume metadata and content storage
  - `techStacks`: Processed technology skills and groupings
  - `pointGroups`: Organized skill points for resume customization
  - `processingHistory`: Audit trail of resume processing operations
  - `sessions`: User session persistence for authentication

### Authentication & Authorization
- **Provider**: Replit Auth with OIDC protocol for secure authentication
- **Session Strategy**: Server-side sessions with PostgreSQL storage for scalability
- **Authorization**: Route-level protection with user context injection
- **Security**: HTTP-only cookies with secure flags and CSRF protection

### File Processing Pipeline
- **Upload**: Memory-based storage with DOCX format validation
- **Processing**: Tech stack extraction and point group generation
- **Storage**: Text-based content storage with original and customized versions
- **Export**: JSON export for point groups and future DOCX generation

### API Design
- **Architecture**: RESTful API with Express.js routes
- **Validation**: Zod schemas for input validation and type safety
- **Error Handling**: Centralized error middleware with proper HTTP status codes
- **Logging**: Request/response logging with performance metrics

## External Dependencies

### Core Infrastructure
- **Database**: Neon PostgreSQL serverless database for scalable data storage
- **Authentication**: Replit Auth service for user management and SSO
- **Development**: Replit platform with integrated development environment

### UI Framework & Styling
- **Component Library**: Radix UI for accessible, unstyled components
- **CSS Framework**: Tailwind CSS for utility-first styling
- **Icons**: Lucide React for consistent iconography
- **Fonts**: Google Fonts (Inter, DM Sans, Architects Daughter) for typography

### Development Tools
- **Build Tool**: Vite for fast development and optimized production builds
- **Type Safety**: TypeScript for compile-time type checking
- **Code Quality**: ESLint and Prettier for code consistency
- **Package Management**: npm with lockfile for dependency resolution

### Runtime Libraries
- **Database**: Drizzle ORM with Neon adapter for database operations
- **Validation**: Zod for runtime type validation and schema definition
- **State Management**: TanStack Query for server state caching and synchronization
- **File Handling**: Multer for multipart form data and file uploads
- **Utilities**: date-fns for date manipulation, memoizee for function caching