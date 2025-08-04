# Test mode - single data collection
go run cmd/agent/main.go -test

# Daemon mode - periodic collection (1-hour intervals)  
go run cmd/agent/main.go -daemon

# Installation mode - setup with email
go run cmd/agent/main.go -install -email="employee@company.com"

# Update email only
go run cmd/agent/main.go -email="new-email@company.com"