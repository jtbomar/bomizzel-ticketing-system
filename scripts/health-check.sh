#!/bin/bash

# Bomizzel Ticketing System - Health Check Script
# This script checks the health of all development services

echo "🏥 Bomizzel System Health Check"
echo "==============================="

# Check Node.js services
echo "📋 Checking Node.js processes..."

# Check if backend is running
if curl -s http://localhost:5000/api/health > /dev/null 2>&1; then
    echo "✅ Backend API is running (http://localhost:5000)"
else
    echo "❌ Backend API is not responding (http://localhost:5000)"
fi

# Check if frontend is running
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Frontend is running (http://localhost:3000)"
else
    echo "❌ Frontend is not responding (http://localhost:3000)"
fi

# Check Docker services
echo ""
echo "🐳 Checking Docker services..."

# Check PostgreSQL
if docker-compose ps postgres | grep -q "healthy\|Up"; then
    echo "✅ PostgreSQL is running"
    
    # Test database connection
    if docker-compose exec -T postgres pg_isready -U bomizzel_user -d bomizzel_db > /dev/null 2>&1; then
        echo "✅ PostgreSQL connection is healthy"
    else
        echo "⚠️  PostgreSQL is running but connection test failed"
    fi
else
    echo "❌ PostgreSQL is not running"
fi

# Check Redis
if docker-compose ps redis | grep -q "healthy\|Up"; then
    echo "✅ Redis is running"
    
    # Test Redis connection
    if docker-compose exec -T redis redis-cli ping | grep -q "PONG"; then
        echo "✅ Redis connection is healthy"
    else
        echo "⚠️  Redis is running but connection test failed"
    fi
else
    echo "❌ Redis is not running"
fi

# Check pgAdmin (if running)
if docker-compose ps pgadmin | grep -q "Up" 2>/dev/null; then
    echo "✅ pgAdmin is running (http://localhost:8080)"
else
    echo "ℹ️  pgAdmin is not running (optional service)"
fi

# Check disk space
echo ""
echo "💾 Checking disk space..."
df -h . | tail -1 | awk '{
    if ($5+0 > 90) 
        print "⚠️  Disk space is low: " $5 " used"
    else if ($5+0 > 80)
        print "⚠️  Disk space getting full: " $5 " used"
    else
        print "✅ Disk space is adequate: " $5 " used"
}'

# Check memory usage
echo ""
echo "🧠 Checking memory usage..."
if command -v free > /dev/null 2>&1; then
    free -h | awk 'NR==2{
        used_percent = ($3/$2) * 100
        if (used_percent > 90)
            print "⚠️  Memory usage is high: " used_percent "% used"
        else if (used_percent > 80)
            print "⚠️  Memory usage getting high: " used_percent "% used"
        else
            print "✅ Memory usage is normal: " used_percent "% used"
    }'
elif command -v vm_stat > /dev/null 2>&1; then
    # macOS memory check
    echo "ℹ️  Memory check not implemented for macOS"
else
    echo "ℹ️  Memory check not available on this system"
fi

# Check log files for errors
echo ""
echo "📋 Checking for recent errors..."

# Check backend logs if they exist
if [ -f "packages/backend/logs/app.log" ]; then
    ERROR_COUNT=$(tail -100 packages/backend/logs/app.log | grep -i error | wc -l)
    if [ "$ERROR_COUNT" -gt 0 ]; then
        echo "⚠️  Found $ERROR_COUNT recent errors in backend logs"
        echo "   Last error:"
        tail -100 packages/backend/logs/app.log | grep -i error | tail -1 | sed 's/^/   /'
    else
        echo "✅ No recent errors in backend logs"
    fi
else
    echo "ℹ️  Backend log file not found"
fi

echo ""
echo "🏁 Health check complete!"

# Summary
echo ""
echo "📊 Quick Summary:"
echo "   Backend API: $(curl -s http://localhost:5000/api/health > /dev/null 2>&1 && echo "✅ UP" || echo "❌ DOWN")"
echo "   Frontend: $(curl -s http://localhost:3000 > /dev/null 2>&1 && echo "✅ UP" || echo "❌ DOWN")"
echo "   PostgreSQL: $(docker-compose ps postgres | grep -q "healthy\|Up" && echo "✅ UP" || echo "❌ DOWN")"
echo "   Redis: $(docker-compose ps redis | grep -q "healthy\|Up" && echo "✅ UP" || echo "❌ DOWN")"