#!/bin/bash

# Script to setup Firebase Admin SDK environment variable
# Usage: ./scripts/setup-firebase-admin.sh

echo "=== Firebase Admin SDK Setup ==="
echo ""

# Check if serviceAccountKey.json exists
if [ ! -f "serviceAccountKey.json" ]; then
    echo "❌ Error: serviceAccountKey.json not found!"
    echo ""
    echo "Please:"
    echo "1. Download service account key from Firebase Console"
    echo "2. Save it as 'serviceAccountKey.json' in project root"
    echo "3. Run this script again"
    exit 1
fi

echo "✅ Found serviceAccountKey.json"
echo ""

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "⚠️  jq not found. Installing..."
    # Try to install jq (works on most Linux systems)
    if command -v apt-get &> /dev/null; then
        sudo apt-get update && sudo apt-get install -y jq
    elif command -v yum &> /dev/null; then
        sudo yum install -y jq
    else
        echo "❌ Cannot install jq automatically. Please install jq manually."
        echo "   Or use Python method below."
        exit 1
    fi
fi

# Convert JSON to single line and escape
echo "Converting service account JSON to environment variable format..."
SERVICE_ACCOUNT_JSON=$(cat serviceAccountKey.json | jq -c .)

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "Creating .env.local file..."
    touch .env.local
fi

# Check if FIREBASE_SERVICE_ACCOUNT already exists
if grep -q "FIREBASE_SERVICE_ACCOUNT" .env.local; then
    echo "⚠️  FIREBASE_SERVICE_ACCOUNT already exists in .env.local"
    read -p "Do you want to update it? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Remove old entry
        sed -i '/^FIREBASE_SERVICE_ACCOUNT=/d' .env.local
        # Add new entry
        echo "FIREBASE_SERVICE_ACCOUNT='$SERVICE_ACCOUNT_JSON'" >> .env.local
        echo "✅ Updated FIREBASE_SERVICE_ACCOUNT in .env.local"
    else
        echo "Skipped update."
    fi
else
    # Add new entry
    echo "FIREBASE_SERVICE_ACCOUNT='$SERVICE_ACCOUNT_JSON'" >> .env.local
    echo "✅ Added FIREBASE_SERVICE_ACCOUNT to .env.local"
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "⚠️  IMPORTANT: Restart your application for changes to take effect!"
echo ""
echo "If using PM2:"
echo "  pm2 restart editaja"
echo ""
echo "If using npm start:"
echo "  # Stop server (Ctrl+C) then"
echo "  npm start"
echo ""
echo "To verify setup:"
echo "  node -e \"console.log(process.env.FIREBASE_SERVICE_ACCOUNT ? 'OK' : 'NOT SET')\""


