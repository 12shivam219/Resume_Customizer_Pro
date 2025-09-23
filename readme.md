# Resume Customizer Pro

<div align="center">
  <img src="https://img.shields.io/badge/React-18.3.1-blue?logo=react" alt="React 18.3.1" />
  <img src="https://img.shields.io/badge/TypeScript-5.6.3-blue?logo=typescript" alt="TypeScript 5.6.3" />
  <img src="https://img.shields.io/badge/Node.js-Express-green?logo=nodedotjs" alt="Node.js Express" />
  <img src="https://img.shields.io/badge/Database-PostgreSQL-blue?logo=postgresql" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/UI-TailwindCSS-blue?logo=tailwindcss" alt="Tailwind CSS" />
</div>

## 🚀 Overview

**Resume Customizer Pro** is an AI-powered web application that revolutionizes the way professionals create and customize their resumes. Upload your DOCX resume files, organize technical skills into strategic groups, and generate tailored versions for every job application with our intuitive rich-text editor.

### ✨ Key Features

- **📄 DOCX Upload & Rich-Text Editing** - Upload existing resumes with full Microsoft Word compatibility
- **🎯 Smart Tech Stack Processing** - Organize technical skills and bullet points into strategic groups
- **🤖 AI-Powered Organization** - Intelligent grouping of skills and experience points
- **💾 Cloud Storage & Export** - Download as DOCX/PDF or save to cloud storage
- **👥 User Authentication** - Secure user accounts with session management
- **📊 Processing History** - Track and review all resume customization activities
- **🎨 Modern UI/UX** - Beautiful, responsive interface built with Radix UI and Tailwind CSS

## 🏗️ Architecture

This is a full-stack application built with modern technologies:

**Frontend:**
- React 18.3+ with TypeScript
- Vite for fast development and building
- TailwindCSS + Radix UI for styling
- TanStack Query for state management
- Wouter for routing

**Backend:**
- Node.js with Express.js
- TypeScript throughout
- Drizzle ORM with PostgreSQL
- Passport.js for authentication
- File upload with Multer

**Database:**
- PostgreSQL with Drizzle ORM
- Optimized indexes for performance
- User authentication and session management

## 🛠️ Installation

### Prerequisites

- Node.js 18+ 
- PostgreSQL database
- Git

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/12shivam219/Resume_Customizer_Pro.git
   cd Resume_Customizer_Pro
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment setup**
   
   Create a `.env` file in the root directory:
   ```env
   # Database
   DATABASE_URL=postgresql://username:password@localhost:5432/resume_customizer

   # Environment
   NODE_ENV=development
   PORT=5000

   # Session Secret
   SESSION_SECRET=your-super-secret-key-here

   # Optional: Cloud storage credentials
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   ```

4. **Database setup**
   ```bash
   # Generate database schema
   npm run db:generate
   
   # Push schema to database
   npm run db:push
   ```

5. **Start development server**
   ```bash
   # Start both client and server
   npm run dev
   
   # Or run separately:
   # Server: npm run dev
   # Client: npm run dev:client
   ```

6. **Open your browser**
   ```
   http://localhost:5000
   ```

## 📚 Usage Guide

### 1. Getting Started
- Register for a new account or login
- You'll be redirected to your personal dashboard

### 2. Upload Resume
- Click "Upload Resume" on your dashboard
- Select a DOCX file from your computer
- The system will process and extract the content

### 3. Add Tech Stacks
- Navigate to the resume editor
- Add your technical skills with associated bullet points
- Organize skills into logical groups (e.g., Frontend, Backend, DevOps)

### 4. Generate Point Groups
- Use the AI processing feature to automatically organize your bullet points
- Review and edit the generated groupings
- Customize the content to match specific job requirements

### 5. Edit and Customize
- Use the rich-text editor to modify your resume
- Apply formatting: bold, italic, underline, lists
- Real-time preview shows document statistics

### 6. Export and Save
- Download as DOCX or PDF
- Save to Google Drive (if configured)
- Access your resumes from anywhere

## 🗂️ Project Structure

```
Resume_Customizer_Pro/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   │   ├── auth/       # Authentication forms
│   │   │   ├── ui/         # Radix UI components
│   │   │   └── *.tsx       # Feature components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # Utilities and configurations
│   │   ├── pages/          # Route components
│   │   └── main.tsx        # App entry point
│   └── index.html
├── server/                 # Express.js backend
│   ├── db.ts              # Database connection
│   ├── index.ts           # Server entry point
│   ├── routes.ts          # API routes
│   ├── storage.ts         # File handling
│   └── *.ts               # Server utilities
├── shared/                 # Shared types and schemas
│   └── schema.ts          # Database schema and types
├── migrations/            # Database migrations
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.ts
```

## 🔧 Available Scripts

```bash
# Development
npm run dev              # Start server (includes client in dev)
npm run dev:client       # Start client only

# Building
npm run build           # Build for production
npm run start           # Start production server

# Database
npm run db:generate     # Generate Drizzle migrations
npm run db:push         # Apply migrations to database
npm run db:studio       # Open Drizzle Studio

# Type checking
npm run check           # TypeScript type checking
```

## 🗄️ Database Schema

The application uses PostgreSQL with the following main tables:

- **users** - User accounts and profiles
- **resumes** - Resume files and content
- **tech_stacks** - Technical skills and bullet points
- **point_groups** - Organized skill groups
- **processing_history** - AI processing audit trail
- **sessions** - User session management

## 🔐 Authentication

The application supports:
- Local authentication with email/password
- Secure password hashing with bcrypt
- Session-based authentication with Express Session
- Protection of authenticated routes

## 🎨 UI Components

Built with a comprehensive design system:
- **Radix UI** - Accessible, unstyled components
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Beautiful icons
- **Framer Motion** - Smooth animations
- **Custom theme** - Consistent design tokens

## 🚀 Deployment

### Production Build

```bash
# Build the application
npm run build

# Start production server
npm run start
```

### Environment Variables

Ensure these environment variables are set in production:

```env
DATABASE_URL=your-production-database-url
NODE_ENV=production
SESSION_SECRET=your-secure-session-secret
PORT=5000
```

### Deployment Platforms

This application can be deployed to:
- **Vercel** - Frontend and serverless functions
- **Railway** - Full-stack deployment
- **Heroku** - Traditional hosting
- **DigitalOcean** - VPS deployment

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Write meaningful commit messages
- Add tests for new features
- Ensure code passes type checking: `npm run check`
- Follow the existing code style and patterns

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Shivam Singh**
- GitHub: [@12shivam219](https://github.com/12shivam219)
- Email: shivam219@example.com

## 🙏 Acknowledgments

- [React](https://reactjs.org/) - Frontend framework
- [Radix UI](https://www.radix-ui.com/) - Component library
- [Tailwind CSS](https://tailwindcss.com/) - CSS framework
- [Drizzle ORM](https://orm.drizzle.team/) - Database ORM
- [Vite](https://vitejs.dev/) - Build tool

## 📞 Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/12shivam219/Resume_Customizer_Pro/issues) page
2. Create a new issue with detailed information
3. Join our community discussions

---

<div align="center">
  <p>Made with ❤️ by developers, for developers</p>
  <p>⭐ Star this repo if you find it helpful!</p>
</div>
