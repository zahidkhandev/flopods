#!/bin/bash

set -e

echo "🚀 Initializing LocalStack AWS services..."

export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=ap-south-1

# Wait for LocalStack to be ready
echo "⏳ Waiting for LocalStack..."
awslocal dynamodb list-tables || true

# ==========================================
# S3 Buckets
# ==========================================
echo "📦 Creating S3 buckets..."

awslocal s3 mb s3://flopods-files-dev 2>/dev/null || echo "Bucket flopods-files-dev already exists"
awslocal s3 mb s3://flopods-documents-dev 2>/dev/null || echo "Bucket flopods-documents-dev already exists"
awslocal s3 mb s3://flopods-vectors-dev 2>/dev/null || echo "Bucket flopods-vectors-dev already exists"

# Enable versioning
awslocal s3api put-bucket-versioning \
  --bucket flopods-files-dev \
  --versioning-configuration Status=Enabled

echo "✅ S3 buckets created"

# ==========================================
# DynamoDB Tables
# ==========================================
echo "🗄️  Creating DynamoDB tables..."

# Pods Table
awslocal dynamodb create-table \
  --table-name flopods-pods-dev \
  --attribute-definitions \
    AttributeName=pk,AttributeType=S \
    AttributeName=sk,AttributeType=S \
    AttributeName=gsi1pk,AttributeType=S \
    AttributeName=gsi1sk,AttributeType=S \
    AttributeName=gsi2pk,AttributeType=S \
    AttributeName=gsi2sk,AttributeType=S \
  --key-schema \
    AttributeName=pk,KeyType=HASH \
    AttributeName=sk,KeyType=RANGE \
  --global-secondary-indexes \
    "[
      {
        \"IndexName\": \"GSI1-FlowPods\",
        \"KeySchema\": [
          {\"AttributeName\":\"gsi1pk\",\"KeyType\":\"HASH\"},
          {\"AttributeName\":\"gsi1sk\",\"KeyType\":\"RANGE\"}
        ],
        \"Projection\": {\"ProjectionType\":\"ALL\"}
      },
      {
        \"IndexName\": \"GSI2-PodVersions\",
        \"KeySchema\": [
          {\"AttributeName\":\"gsi2pk\",\"KeyType\":\"HASH\"},
          {\"AttributeName\":\"gsi2sk\",\"KeyType\":\"RANGE\"}
        ],
        \"Projection\": {\"ProjectionType\":\"ALL\"}
      }
    ]" \
  --billing-mode PAY_PER_REQUEST \
  2>/dev/null || echo "Table flopods-pods-dev already exists"

# Executions Table
awslocal dynamodb create-table \
  --table-name flopods-executions-dev \
  --attribute-definitions \
    AttributeName=pk,AttributeType=S \
    AttributeName=sk,AttributeType=S \
    AttributeName=gsi1pk,AttributeType=S \
    AttributeName=gsi1sk,AttributeType=S \
    AttributeName=gsi2pk,AttributeType=S \
    AttributeName=gsi2sk,AttributeType=S \
  --key-schema \
    AttributeName=pk,KeyType=HASH \
    AttributeName=sk,KeyType=RANGE \
  --global-secondary-indexes \
    "[
      {
        \"IndexName\": \"GSI1-FlowExecutions\",
        \"KeySchema\": [
          {\"AttributeName\":\"gsi1pk\",\"KeyType\":\"HASH\"},
          {\"AttributeName\":\"gsi1sk\",\"KeyType\":\"RANGE\"}
        ],
        \"Projection\": {\"ProjectionType\":\"ALL\"}
      },
      {
        \"IndexName\": \"GSI2-WorkspaceExecutions\",
        \"KeySchema\": [
          {\"AttributeName\":\"gsi2pk\",\"KeyType\":\"HASH\"},
          {\"AttributeName\":\"gsi2sk\",\"KeyType\":\"RANGE\"}
        ],
        \"Projection\": {\"ProjectionType\":\"ALL\"}
      }
    ]" \
  --billing-mode PAY_PER_REQUEST \
  2>/dev/null || echo "Table flopods-executions-dev already exists"

# Context Table
awslocal dynamodb create-table \
  --table-name flopods-context-dev \
  --attribute-definitions \
    AttributeName=pk,AttributeType=S \
    AttributeName=sk,AttributeType=S \
    AttributeName=gsi1pk,AttributeType=S \
    AttributeName=gsi1sk,AttributeType=S \
  --key-schema \
    AttributeName=pk,KeyType=HASH \
    AttributeName=sk,KeyType=RANGE \
  --global-secondary-indexes \
    "[
      {
        \"IndexName\": \"GSI1-PodContextUsage\",
        \"KeySchema\": [
          {\"AttributeName\":\"gsi1pk\",\"KeyType\":\"HASH\"},
          {\"AttributeName\":\"gsi1sk\",\"KeyType\":\"RANGE\"}
        ],
        \"Projection\": {\"ProjectionType\":\"ALL\"}
      }
    ]" \
  --billing-mode PAY_PER_REQUEST \
  2>/dev/null || echo "Table flopods-context-dev already exists"

# Sessions Table
awslocal dynamodb create-table \
  --table-name flopods-sessions-dev \
  --attribute-definitions \
    AttributeName=pk,AttributeType=S \
    AttributeName=sk,AttributeType=S \
  --key-schema \
    AttributeName=pk,KeyType=HASH \
    AttributeName=sk,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  2>/dev/null || echo "Table flopods-sessions-dev already exists"

# Cache Table
awslocal dynamodb create-table \
  --table-name flopods-cache-dev \
  --attribute-definitions \
    AttributeName=pk,AttributeType=S \
    AttributeName=sk,AttributeType=S \
  --key-schema \
    AttributeName=pk,KeyType=HASH \
    AttributeName=sk,KeyType=RANGE \
  --time-to-live-specification \
    Enabled=true,AttributeName=ttl \
  --billing-mode PAY_PER_REQUEST \
  2>/dev/null || echo "Table flopods-cache-dev already exists"

echo "✅ DynamoDB tables created"

# ==========================================
# SES Email Identities
# ==========================================
echo "📧 Setting up SES..."

awslocal ses verify-email-identity --email-address noreply@flopods.local
awslocal ses verify-email-identity --email-address support@flopods.local

echo "✅ SES email identities verified"

# ==========================================
# SQS Queues (Optional)
# ==========================================
echo "📨 Creating SQS queues..."

awslocal sqs create-queue --queue-name flopods-document-processing.fifo \
  --attributes FifoQueue=true,ContentBasedDeduplication=true \
  2>/dev/null || echo "Queue already exists"

awslocal sqs create-queue --queue-name flopods-document-processing-dlq.fifo \
  --attributes FifoQueue=true \
  2>/dev/null || echo "DLQ already exists"

echo "✅ SQS queues created"

echo "🎉 LocalStack initialization complete!"
