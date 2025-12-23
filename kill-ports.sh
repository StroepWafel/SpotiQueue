#!/bin/bash

echo "Killing processes on ports 3000, 3001, and 3002..."
echo

# Port 3000
PID=$(lsof -ti:3000)
if [ ! -z "$PID" ]; then
    echo "Killing process $PID on port 3000..."
    kill -9 $PID
fi

# Port 3001
PID=$(lsof -ti:3001)
if [ ! -z "$PID" ]; then
    echo "Killing process $PID on port 3001..."
    kill -9 $PID
fi

# Port 3002
PID=$(lsof -ti:3002)
if [ ! -z "$PID" ]; then
    echo "Killing process $PID on port 3002..."
    kill -9 $PID
fi

echo
echo "Done! Ports should now be free."

