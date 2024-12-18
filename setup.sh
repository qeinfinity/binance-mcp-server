#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Check if we're in the correct directory (has package.json)
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: package.json not found. Are you in the correct directory?${NC}"
    exit 1
fi

# Function to create directory if it doesn't exist
create_dir() {
    if [ ! -d "$1" ]; then
        mkdir -p "$1"
        echo -e "${GREEN}Created directory: $1${NC}"
    else
        echo "Directory already exists: $1"
    fi
}

# Function to create file if it doesn't exist
create_file() {
    if [ ! -f "$1" ]; then
        touch "$1"
        # Add basic export statement to TypeScript files
        if [[ $1 == *.ts ]]; then
            echo "// $1" > "$1"
            echo "export {}" >> "$1"
        fi
        echo -e "${GREEN}Created file: $1${NC}"
    else
        echo "File already exists: $1"
    fi
}

# Create directory structure
create_dir "src/connectors"
create_dir "src/types"
create_dir "src/utils"

# Create files
create_file "src/connectors/binance-rest.ts"
create_file "src/connectors/binance-ws.ts"
create_file "src/types/market-data.ts"
create_file "src/types/api-types.ts"
create_file "src/utils/logger.ts"
create_file "src/config.ts"

echo -e "\n${GREEN}Directory structure created successfully!${NC}"
echo -e "Next steps:"
echo "1. Implement the TypeScript interfaces in types/"
echo "2. Set up the configuration in config.ts"
echo "3. Implement the connectors in connectors/"
echo "4. Set up logging in utils/logger.ts"
echo "5. Update main server implementation in index.ts"

# Print final directory tree
echo -e "\nFinal directory structure:"
tree