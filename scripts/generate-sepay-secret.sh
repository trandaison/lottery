#!/bin/bash

# Generate a secure random secret for SEPAY_WEBHOOK_JWT_SECRET
# Minimum 32 characters as required

echo "Generating SEPAY_WEBHOOK_JWT_SECRET..."
echo ""

# Generate a 64-character random string
SECRET=$(openssl rand -hex 32)

echo "Add this to your .env.local file:"
echo ""
echo "SEPAY_WEBHOOK_JWT_SECRET=$SECRET"
echo ""
echo "Or run this command to append it:"
echo "echo 'SEPAY_WEBHOOK_JWT_SECRET=$SECRET' >> .env.local"
echo ""
