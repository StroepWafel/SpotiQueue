#!/bin/bash

echo "🎵 Spotify Queue App Setup"
echo "=========================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "Creating .env file from env.example..."
    cp env.example .env
    echo "✅ Created .env file"
    echo "⚠️  Please edit .env and add your Spotify credentials!"
else
    echo "✅ .env file already exists"
fi

# Create data directory
if [ ! -d data ]; then
    echo "Creating data directory..."
    mkdir -p data
    echo "✅ Created data directory"
else
    echo "✅ Data directory already exists"
fi

# Install root dependencies
echo ""
echo "Installing root dependencies..."
npm install

# Install client dependencies
echo ""
echo "Installing client dependencies..."
cd client
npm install
cd ..

# Install admin dependencies
echo ""
echo "Installing admin dependencies..."
cd admin
npm install
cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env and add your Spotify credentials"
echo "2. Run 'npm run dev' for development"
echo "3. Or run 'docker-compose up' for production"
echo ""

