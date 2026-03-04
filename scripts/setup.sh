#!/bin/bash

# AACA - AI Academic Cognitive Assistant Setup Script

set -e

echo "🚀 AACA Setup Script"
echo "===================="

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }

command_exists() { command -v "$1" >/dev/null 2>&1; }

check_python() {
    print_info "Checking Python..."
    
    if ! command_exists python3; then
        print_error "Python 3 is not installed"
        exit 1
    fi
    
    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
    print_success "Found Python $PYTHON_VERSION"
}

check_node() {
    print_info "Checking Node.js..."
    
    if ! command_exists node; then
        print_error "Node.js is not installed"
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2)
    print_success "Found Node.js $NODE_VERSION"
}

check_mongodb() {
    print_info "Checking MongoDB..."
    
    if command_exists docker; then
        if docker ps | grep -q mongo; then
            print_success "MongoDB container is running"
        else
            print_warning "MongoDB not running. Start with:"
            print_info "  docker run -d --name mongodb-aaca -p 27017:27017 mongo:7.0"
        fi
    else
        print_warning "Docker not found. Install MongoDB manually."
    fi
}

setup_backend() {
    print_info "Setting up Backend..."
    
    cd backend
    
    if [ ! -d "venv" ]; then
        print_info "Creating virtual environment..."
        python3 -m venv venv
    fi
    
    source venv/bin/activate
    pip install --upgrade pip -q
    pip install -r requirements.txt -q
    
    if [ ! -f ".env" ]; then
        print_warning ".env not found. Creating from template..."
        cp .env.example .env
        print_warning "Please edit .env and add your API keys!"
    fi
    
    cd ..
    print_success "Backend setup complete!"
}

setup_frontend() {
    print_info "Setting up Frontend..."
    
    cd frontend
    
    if [ ! -d "node_modules" ]; then
        print_info "Installing dependencies..."
        npm install
    fi
    
    if [ ! -f ".env" ]; then
        print_warning ".env not found. Creating from template..."
        cp .env.example .env
    fi
    
    cd ..
    print_success "Frontend setup complete!"
}

create_directories() {
    print_info "Creating directories..."
    mkdir -p backend/uploads backend/logs
    print_success "Directories created!"
}

print_next_steps() {
    echo ""
    echo -e "${GREEN}🎉 Setup complete!${NC}"
    echo ""
    echo "Next steps:"
    echo ""
    echo "1. Start MongoDB:"
    echo "   docker run -d --name mongodb-aaca -p 27017:27017 mongo:7.0"
    echo ""
    echo "2. Start backend:"
    echo "   cd backend && source venv/bin/activate && uvicorn app.main:app --reload"
    echo ""
    echo "3. Start frontend:"
    echo "   cd frontend && npx expo start"
    echo ""
}

main() {
    print_info "Starting AACA setup..."
    
    check_python
    check_node
    check_mongodb
    create_directories
    setup_backend
    setup_frontend
    print_next_steps
}

main "$@"
