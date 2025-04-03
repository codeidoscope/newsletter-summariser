#!/bin/bash

# Gmail Email Summarizer Installation Script
# This script installs all necessary dependencies and sets up the environment

# Text formatting
BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
BLUE="\033[0;34m"
NC="\033[0m" # No Color

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Function for printing section headers
print_section() {
  echo -e "\n${BOLD}${BLUE}$1${NC}\n"
}

# Function for printing success messages
print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

# Function for printing warning messages
print_warning() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

# Function for printing error messages
print_error() {
  echo -e "${RED}✗ $1${NC}"
}

# Welcome message
clear
echo -e "${BOLD}${BLUE}=== Newsletter Summariser Installation ===${NC}"
echo -e "This script will set up all the necessary dependencies for the Newsletter Summariser project."
echo -e "It will install Node.js if needed and set up frontend and backend dependencies."
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."

# Check for Node.js and npm
print_section "Checking for Node.js and npm"

if command_exists node; then
  NODE_VERSION=$(node -v)
  print_success "Node.js is installed (${NODE_VERSION})"
else
  print_error "Node.js is not installed"
  echo "This script requires Node.js to be installed."
  echo "Please install Node.js and npm before continuing."
  echo "Visit https://nodejs.org/ to download and install Node.js."
  exit 1
fi

if command_exists npm; then
  NPM_VERSION=$(npm -v)
  print_success "npm is installed (${NPM_VERSION})"
else
  print_error "npm is not installed"
  echo "This script requires npm to be installed."
  echo "npm is typically installed with Node.js."
  echo "Visit https://nodejs.org/ to download and install Node.js."
  exit 1
fi

# Check if we're in the right directory
print_section "Checking project structure"

if [ ! -f "package.json" ]; then
  print_error "package.json not found in the current directory"
  echo "Please run this script from the project root directory."
  exit 1
fi

if [ ! -d "backend" ]; then
  print_error "backend directory not found"
  echo "Please make sure you're running this script from the project root directory."
  exit 1
fi

print_success "Project structure looks good"

# Install frontend dependencies
print_section "Installing frontend dependencies"
echo "This may take a few minutes..."
npm install

if [ $? -eq 0 ]; then
  print_success "Frontend dependencies installed successfully"
else
  print_error "Failed to install frontend dependencies"
  echo "Please check the error messages above and try again."
  exit 1
fi

# Install backend dependencies
print_section "Installing backend dependencies"
echo "Installing backend dependencies..."
cd backend || exit
npm install

if [ $? -eq 0 ]; then
  print_success "Backend dependencies installed successfully"
  cd ..
else
  print_error "Failed to install backend dependencies"
  echo "Please check the error messages above and try again."
  cd ..
  exit 1
fi

# Note about environment variables
print_section "Environment Variables Reminder"
print_warning "Remember to manually set up your .env files for both frontend and backend"
echo "Frontend (.env in root directory) requires:"
echo "- VITE_GOOGLE_CLIENT_ID"
echo "- VITE_OPENAI_API_KEY"
echo "- VITE_API_BASE_URL (default: http://localhost:5175)"
echo "- VITE_RECIPIENT_FILTER (optional)"
echo ""
echo "Backend (.env in backend directory) requires:"
echo "- PORT (default: 5175)"
echo "- EMAIL_USER (for tracking functionality)"
echo "- EMAIL_PASS"
echo "- EMAIL_RECIPIENT"

# Create necessary directories
print_section "Creating necessary directories"
mkdir -p backend/trackingData
print_success "Created trackingData directory for backend"

# Make start script executable
chmod +x start.sh
print_success "Made start.sh executable"

# Final instructions
print_section "Installation Complete!"
echo -e "The Gmail Email Summarizer has been successfully set up."
echo ""
echo -e "${BOLD}How to run the application:${NC}"
echo "1. Make sure to manually create and configure your .env files first"
echo ""
echo "2. Start both frontend and backend using:"
echo "   npm start"
echo ""
echo " Or using the start script:"
echo "   ./start.sh"
echo ""
echo "   Or start them separately:"
echo "   - Frontend: npm run dev"
echo "   - Backend: cd backend && npm run dev"
echo ""
echo -e "${BOLD}Important notes:${NC}"
echo "• The application uses port 5173 for the frontend and 5175 for the backend by default."
echo ""
echo -e "${BOLD}${GREEN}Happy email summarizing!${NC}"