#!/bin/bash

# Create resources directory if it doesn't exist
mkdir -p ../resources

# Build for the current platform
echo "Building file manager for current platform..."
go build -o ../resources/filemanager main.go

echo "Build complete!" 