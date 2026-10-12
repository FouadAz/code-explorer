#!/bin/bash

echo "🚀 Setting up Code Explorer..."
echo ""

# Install backend dependencies
echo "📦 Installing backend dependencies..."
npm install

if [ $? -ne 0 ]; then
  echo "❌ Backend installation failed"
  exit 1
fi

# Build backend
echo "🔨 Building backend..."
npm run build

if [ $? -ne 0 ]; then
  echo "❌ Backend build failed"
  exit 1
fi

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend
npm install

if [ $? -ne 0 ]; then
  echo "❌ Frontend installation failed"
  exit 1
fi

# Build frontend
echo "🔨 Building frontend..."
npm run build

if [ $? -ne 0 ]; then
  echo "❌ Frontend build failed"
  exit 1
fi

cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "Quick start:"
echo "  1. Create a config file: code-explorer.config.json"
echo "  2. Run: npm run dev analyze"
echo "  3. Run: npm run dev serve"
echo ""
echo "Or use the convenience command:"
echo "  npm run dev open"
echo ""
