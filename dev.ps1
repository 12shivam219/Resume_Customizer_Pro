# Set environment variables
$env:NODE_ENV="development"
$env:DATABASE_URL="postgresql://neondb_owner:npg_3jl0ZhsqTKcM@ep-wandering-firefly-adywanxv-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

# Check if node_modules exists, if not install dependencies
if (-not (Test-Path -Path "node_modules")) {
    Write-Host "Installing dependencies..."
    npm install
}

# Run database migrations if needed
Write-Host "Checking database migrations..."
npm run db:push

# Start the development server
Write-Host "Starting development server..."
npm run dev