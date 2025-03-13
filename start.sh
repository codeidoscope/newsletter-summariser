#!/bin/bash

# Make script exit if any command fails
set -e

# Check if concurrently is installed
if ! npm list -g concurrently &> /dev/null; then
  echo "Installing concurrently package..."
  npm install -g concurrently
fi

# Check if backend dependencies are installed
if [ ! -d "backend/node_modules" ]; then
  echo "Installing backend dependencies..."
  cd backend
  npm install
  cd ..
fi

# Check if frontend dependencies are installed
if [ ! -d "node_modules" ]; then
  echo "Installing frontend dependencies..."
  npm install
fi

# Run both servers concurrently
echo "Starting both frontend and backend servers..."
concurrently "npm run dev" "cd backend && npm run dev"