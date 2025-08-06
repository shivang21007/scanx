# Test single run
go run ./cmd/agent -test

# Run daemon mode (foreground)
go run ./cmd/agent -daemon

# Run with custom config
go run ./cmd/agent -daemon -config /custom/path

# Service management
go run ./cmd/agent -service status




# Build binary
go build -o mdm-agent ./cmd/agent

# Run built binary
./mdm-agent -daemon
./mdm-agent -test
./mdm-agent -service install



# Install as service
sudo ./mdm-agent -service install

# Or use installation package
sudo ./install/install-linux.sh --email "user@company.com