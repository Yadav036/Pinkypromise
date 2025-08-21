# Overview

SecureShare is a passwordless file sharing application that leverages WebAuthn biometric authentication for secure, modern user authentication. The application provides a complete file upload, management, and sharing platform with role-based access control, built using a modern full-stack architecture with React frontend and Express backend.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript for type safety and modern development
- **Routing**: Wouter for lightweight client-side routing
- **UI Components**: Shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS custom properties for theming
- **State Management**: TanStack Query (React Query) for server state management and caching
- **Form Handling**: React Hook Form with Zod validation for type-safe forms
- **Build Tool**: Vite for fast development and optimized production builds

## Backend Architecture
- **Framework**: Express.js with TypeScript for the REST API server
- **Authentication**: WebAuthn implementation using @simplewebauthn/server for passwordless biometric authentication
- **Session Management**: JWT tokens for stateless authentication
- **File Storage**: Multer for handling multipart file uploads with local filesystem storage
- **API Design**: RESTful endpoints with consistent error handling and logging middleware

## Data Storage Solutions
- **Database**: PostgreSQL configured through Drizzle ORM
- **Schema Management**: Drizzle Kit for database migrations and schema management
- **Connection**: Neon Database serverless PostgreSQL for cloud deployment
- **Storage Pattern**: Repository pattern implemented through IStorage interface with both memory and database implementations
- **File Storage**: Local filesystem storage in uploads directory with metadata tracked in database

## Authentication and Authorization
- **Primary Method**: WebAuthn (Web Authentication API) for passwordless authentication using biometrics, security keys, or device authentication
- **Backup Authentication**: JWT tokens for session management after WebAuthn verification
- **Role-Based Access**: Two-tier role system (admin/user) with different permission levels
- **Security Features**: Credential counter tracking for replay attack prevention, challenge-response authentication flow

## External Dependencies

### Core Framework Dependencies
- **@neondatabase/serverless**: Serverless PostgreSQL database connection for cloud deployment
- **drizzle-orm**: TypeScript ORM for database operations and query building
- **@simplewebauthn/server**: Server-side WebAuthn implementation for biometric authentication
- **@simplewebauthn/browser**: Client-side WebAuthn implementation
- **jsonwebtoken**: JWT token generation and verification for session management

### UI and Frontend Libraries
- **@radix-ui/***: Comprehensive set of accessible UI primitives for building the component system
- **@tanstack/react-query**: Server state management and data fetching with caching
- **react-hook-form**: Form state management and validation
- **@hookform/resolvers**: Integration between React Hook Form and validation libraries
- **wouter**: Lightweight routing solution for single-page application navigation

### Development and Build Tools
- **vite**: Modern build tool and development server
- **@vitejs/plugin-react**: React integration for Vite
- **typescript**: Type checking and enhanced developer experience
- **tailwindcss**: Utility-first CSS framework for styling
- **@replit/vite-plugin-runtime-error-modal**: Development error handling for Replit environment

### File Handling and Utilities
- **multer**: Middleware for handling multipart/form-data file uploads
- **react-dropzone**: Drag-and-drop file upload interface
- **date-fns**: Date manipulation and formatting utilities
- **clsx** and **tailwind-merge**: Utility functions for conditional CSS class names