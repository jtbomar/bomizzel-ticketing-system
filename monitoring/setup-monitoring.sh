#!/bin/bash

# Bomizzel Ticketing System - Monitoring Setup Script
# This script sets up the complete monitoring stack

set -e

echo "📊 Setting up Bomizzel Monitoring Stack"
echo "======================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Create monitoring directories
echo "📁 Creating monitoring directories..."
mkdir -p monitoring/prometheus/rules
mkdir -p monitoring/grafana/provisioning/datasources
mkdir -p monitoring/grafana/provisioning/dashboards
mkdir -p monitoring/grafana/dashboards
mkdir -p monitoring/alertmanager
mkdir -p monitoring/loki
mkdir -p monitoring/promtail

# Set proper permissions for Grafana
echo "🔐 Setting up permissions..."
sudo chown -R 472:472 monitoring/grafana/ 2>/dev/null || true

# Start monitoring stack
echo "🚀 Starting monitoring services..."
docker-compose -f monitoring/docker-compose.monitoring.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 30

# Check service health
echo "🏥 Checking service health..."

services=("prometheus:9090" "grafana:3001" "alertmanager:9093" "loki:3100")
for service in "${services[@]}"; do
    name=$(echo $service | cut -d: -f1)
    port=$(echo $service | cut -d: -f2)
    
    if curl -s http://localhost:$port > /dev/null 2>&1; then
        echo "✅ $name is running on port $port"
    else
        echo "⚠️  $name may not be ready yet on port $port"
    fi
done

# Import Grafana dashboards
echo "📊 Setting up Grafana dashboards..."
sleep 10

# Create basic dashboard for Bomizzel metrics
cat > monitoring/grafana/dashboards/bomizzel-overview.json << 'EOF'
{
  "dashboard": {
    "id": null,
    "title": "Bomizzel Overview",
    "tags": ["bomizzel"],
    "timezone": "browser",
    "panels": [
      {
        "id": 1,
        "title": "Application Status",
        "type": "stat",
        "targets": [
          {
            "expr": "up{job=\"bomizzel-backend\"}",
            "legendFormat": "Backend"
          }
        ],
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0}
      },
      {
        "id": 2,
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "Requests/sec"
          }
        ],
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 0}
      }
    ],
    "time": {
      "from": "now-1h",
      "to": "now"
    },
    "refresh": "5s"
  }
}
EOF

echo ""
echo "🎉 Monitoring stack setup complete!"
echo ""
echo "📋 Access URLs:"
echo "   - Prometheus: http://localhost:9090"
echo "   - Grafana: http://localhost:3001 (admin/admin123)"
echo "   - AlertManager: http://localhost:9093"
echo "   - Loki: http://localhost:3100"
echo ""
echo "🔧 Next steps:"
echo "   1. Configure alert notification channels in AlertManager"
echo "   2. Import additional Grafana dashboards"
echo "   3. Set up application metrics endpoints"
echo "   4. Configure log shipping from applications"
echo ""
echo "📚 Documentation:"
echo "   - Prometheus: https://prometheus.io/docs/"
echo "   - Grafana: https://grafana.com/docs/"
echo "   - AlertManager: https://prometheus.io/docs/alerting/latest/alertmanager/"