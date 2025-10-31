#!/bin/bash

RUNTIME="${1:-docker}"

# Validate runtime argument
if [ "$RUNTIME" != "docker" ] && [ "$RUNTIME" != "podman" ]; then
    echo "Error: Invalid runtime. Use 'docker' or 'podman'"
    echo "Usage: ./setup.sh [docker|podman]"
    exit 1
fi

echo ""
echo "===================================="
echo "Flopods - Setup Script"
echo "Runtime: $RUNTIME"
echo "===================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed. Please install Node.js v20.0.0+"
    exit 1
fi

# Check if Docker or Podman is running
if ! $RUNTIME ps &> /dev/null; then
    echo "Error: $RUNTIME is not running. Please start $RUNTIME first."
    exit 1
fi

echo "[1/6] Installing dependencies..."
yarn install
if [ $? -ne 0 ]; then
    echo "Error: Failed to install dependencies"
    exit 1
fi

echo ""
echo "[2/6] Creating .env file..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo ".env file created"
else
    echo ".env file already exists"
fi

echo ""
echo "[3/6] Starting services with $RUNTIME..."
yarn ${RUNTIME}:dev
sleep 10

echo ""
echo "[4/6] Generating Prisma client..."
yarn db:generate
if [ $? -ne 0 ]; then
    echo "Warning: Failed to generate Prisma client (proxy issue?)"
fi

echo ""
echo "[5/6] Running migrations..."
yarn db:migrate:deploy
if [ $? -ne 0 ]; then
    echo "Error: Failed to run migrations"
    exit 1
fi

echo ""
echo "[6/6] Seeding database (optional)..."
read -p "Do you want to seed the pricing data? (y/n): " SEED
if [[ "$SEED" =~ ^[Yy]$ ]]; then
    yarn db:seed:pricing
    if [ $? -ne 0 ]; then
        echo "Warning: Seed timed out or failed"
    fi
else
    echo "Skipping seed. You can run it later with: yarn db:seed:pricing"
fi

echo ""
echo "===================================="
echo "Setup Complete!"
echo "===================================="
echo ""
echo "Starting development servers..."
echo ""

yarn dev:backend
