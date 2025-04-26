#!/bin/bash

# Install required dependencies
npm install mysql2 dotenv

# Create necessary directories if they don't exist
mkdir -p config utils

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    cat > .env << EOL
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=coincex
PORT=5001
EOL
    echo "Created .env file with default values"
fi

echo "Setup completed!" 