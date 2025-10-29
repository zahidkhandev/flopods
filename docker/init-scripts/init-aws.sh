#!/bin/bash

#═══════════════════════════════════════════════════════════════════════════════
# Flopods LocalStack Initialization Script
#
# Description: Automatically provisions AWS services in LocalStack for local dev
# Services: S3, DynamoDB, SES, SQS
# Environment: Development only
#
# This script runs automatically when LocalStack starts via ready.d hook.
# LocalStack ready.d scripts execute after all services are initialized.
#
# Usage: Automatically executed by LocalStack (no manual run needed)
# Manual test: docker exec flopods-localstack /etc/localstack/init/ready.d/01-init-aws-services.sh
#═══════════════════════════════════════════════════════════════════════════════

set -e  # Exit on any error
set -u  # Error on undefined variables

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=ap-south-1

echo ""
echo "╔══════════════════════════════════════════════════════════════════════════╗"
echo "║  🚀 Flopods LocalStack Initialization                                    ║"
echo "║  Region: ${AWS_DEFAULT_REGION}                                           ║"
echo "╚══════════════════════════════════════════════════════════════════════════╝"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# WAIT FOR LOCALSTACK
# ═══════════════════════════════════════════════════════════════════════════════

echo "⏳ Waiting for LocalStack services to be ready..."
MAX_RETRIES=30
RETRY_COUNT=0

until awslocal s3 ls >/dev/null 2>&1; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "❌ LocalStack failed to start after ${MAX_RETRIES} attempts"
    exit 1
  fi
  echo "   Attempt ${RETRY_COUNT}/${MAX_RETRIES}..."
  sleep 2
done

echo "✅ LocalStack is ready!"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# S3 BUCKETS
# ═══════════════════════════════════════════════════════════════════════════════

echo "╔══════════════════════════════════════════════════════════════════════════╗"
echo "║  📦 S3 Buckets                                                           ║"
echo "╚══════════════════════════════════════════════════════════════════════════╝"
echo ""

# Function to create bucket with error handling
create_bucket() {
  local bucket_name=$1
  local description=$2

  if awslocal s3 ls "s3://${bucket_name}" >/dev/null 2>&1; then
    echo "⚠️  Bucket ${bucket_name} already exists (skipping)"
  else
    awslocal s3 mb "s3://${bucket_name}" --region "${AWS_DEFAULT_REGION}"
    echo "✅ Created: ${bucket_name} - ${description}"
  fi
}

# Create all S3 buckets
create_bucket "flopods-files-dev" "General file uploads"
create_bucket "flopods-documents-dev" "Document processing files"
create_bucket "flopods-vectors-dev" "Vector embeddings storage"

echo ""
echo "📋 Configuring bucket policies..."

# Enable versioning for files bucket
awslocal s3api put-bucket-versioning \
  --bucket flopods-files-dev \
  --versioning-configuration Status=Enabled

# Enable CORS for document uploads (if needed for direct client uploads)
awslocal s3api put-bucket-cors \
  --bucket flopods-documents-dev \
  --cors-configuration '{
    "CORSRules": [
      {
        "AllowedOrigins": ["http://localhost:5173", "http://localhost:8000"],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
        "AllowedHeaders": ["*"],
        "ExposeHeaders": ["ETag"],
        "MaxAgeSeconds": 3000
      }
    ]
  }'

echo "✅ S3 buckets configured"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# DYNAMODB TABLES
# ═══════════════════════════════════════════════════════════════════════════════

echo "╔══════════════════════════════════════════════════════════════════════════╗"
echo "║  🗄️  DynamoDB Tables                                                     ║"
echo "╚══════════════════════════════════════════════════════════════════════════╝"
echo ""

# Function to create DynamoDB table with error handling
create_table() {
  local table_name=$1
  if awslocal dynamodb describe-table --table-name "${table_name}" >/dev/null 2>&1; then
    echo "⚠️  Table ${table_name} already exists (skipping)"
    return 0
  fi
  return 1
}

# ───────────────────────────────────────────────────────────────────────────────
# Pods Table
# ───────────────────────────────────────────────────────────────────────────────
echo "📊 Creating flopods-pods-dev..."
if ! create_table "flopods-pods-dev"; then
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
    >/dev/null
  echo "✅ Created: flopods-pods-dev"
fi

# ───────────────────────────────────────────────────────────────────────────────
# Executions Table
# ───────────────────────────────────────────────────────────────────────────────
echo "📊 Creating flopods-executions-dev..."
if ! create_table "flopods-executions-dev"; then
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
    >/dev/null
  echo "✅ Created: flopods-executions-dev"
fi

# ───────────────────────────────────────────────────────────────────────────────
# Context Table
# ───────────────────────────────────────────────────────────────────────────────
echo "📊 Creating flopods-context-dev..."
if ! create_table "flopods-context-dev"; then
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
    >/dev/null
  echo "✅ Created: flopods-context-dev"
fi

# ───────────────────────────────────────────────────────────────────────────────
# Sessions Table
# ───────────────────────────────────────────────────────────────────────────────
echo "📊 Creating flopods-sessions-dev..."
if ! create_table "flopods-sessions-dev"; then
  awslocal dynamodb create-table \
    --table-name flopods-sessions-dev \
    --attribute-definitions \
      AttributeName=pk,AttributeType=S \
      AttributeName=sk,AttributeType=S \
    --key-schema \
      AttributeName=pk,KeyType=HASH \
      AttributeName=sk,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST \
    >/dev/null
  echo "✅ Created: flopods-sessions-dev"
fi

# ───────────────────────────────────────────────────────────────────────────────
# Cache Table (with TTL)
# ───────────────────────────────────────────────────────────────────────────────
echo "📊 Creating flopods-cache-dev..."
if ! create_table "flopods-cache-dev"; then
  awslocal dynamodb create-table \
    --table-name flopods-cache-dev \
    --attribute-definitions \
      AttributeName=pk,AttributeType=S \
      AttributeName=sk,AttributeType=S \
    --key-schema \
      AttributeName=pk,KeyType=HASH \
      AttributeName=sk,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST \
    >/dev/null

  # Enable TTL
  awslocal dynamodb update-time-to-live \
    --table-name flopods-cache-dev \
    --time-to-live-specification "Enabled=true,AttributeName=ttl" \
    >/dev/null

  echo "✅ Created: flopods-cache-dev (with TTL)"
fi

echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# SES EMAIL IDENTITIES
# ═══════════════════════════════════════════════════════════════════════════════

echo "╔══════════════════════════════════════════════════════════════════════════╗"
echo "║  📧 SES Email Configuration                                              ║"
echo "╚══════════════════════════════════════════════════════════════════════════╝"
echo ""

# Verify email identities
awslocal ses verify-email-identity --email-address noreply@flopods.local
awslocal ses verify-email-identity --email-address support@flopods.local

echo "✅ Verified: noreply@flopods.local"
echo "✅ Verified: support@flopods.local"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# SQS QUEUES
# ═══════════════════════════════════════════════════════════════════════════════

echo "╔══════════════════════════════════════════════════════════════════════════╗"
echo "║  📨 SQS Queues                                                           ║"
echo "╚══════════════════════════════════════════════════════════════════════════╝"
echo ""

# Create main processing queue (FIFO)
if awslocal sqs get-queue-url --queue-name flopods-document-processing.fifo >/dev/null 2>&1; then
  echo "⚠️  Queue flopods-document-processing.fifo already exists"
else
  awslocal sqs create-queue \
    --queue-name flopods-document-processing.fifo \
    --attributes '{
      "FifoQueue": "true",
      "ContentBasedDeduplication": "true",
      "VisibilityTimeout": "300",
      "MessageRetentionPeriod": "1209600",
      "ReceiveMessageWaitTimeSeconds": "20"
    }' \
    >/dev/null
  echo "✅ Created: flopods-document-processing.fifo"
fi

# Create dead letter queue (FIFO)
if awslocal sqs get-queue-url --queue-name flopods-document-processing-dlq.fifo >/dev/null 2>&1; then
  echo "⚠️  Queue flopods-document-processing-dlq.fifo already exists"
else
  awslocal sqs create-queue \
    --queue-name flopods-document-processing-dlq.fifo \
    --attributes '{
      "FifoQueue": "true",
      "MessageRetentionPeriod": "1209600"
    }' \
    >/dev/null
  echo "✅ Created: flopods-document-processing-dlq.fifo"
fi

echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# VERIFICATION
# ═══════════════════════════════════════════════════════════════════════════════

echo "╔══════════════════════════════════════════════════════════════════════════╗"
echo "║  ✅ Verification                                                         ║"
echo "╚══════════════════════════════════════════════════════════════════════════╝"
echo ""

echo "📦 S3 Buckets:"
awslocal s3 ls | grep flopods

echo ""
echo "🗄️  DynamoDB Tables:"
awslocal dynamodb list-tables --output text | grep flopods

echo ""
echo "📨 SQS Queues:"
awslocal sqs list-queues --output text | grep flopods

echo ""
echo "╔══════════════════════════════════════════════════════════════════════════╗"
echo "║  🎉 LocalStack Initialization Complete!                                 ║"
echo "║                                                                          ║"
echo "║  All AWS services are ready for Flopods development.                    ║"
echo "║  You can now start the backend with 'yarn dev:backend'                  ║"
echo "╚══════════════════════════════════════════════════════════════════════════╝"
echo ""
