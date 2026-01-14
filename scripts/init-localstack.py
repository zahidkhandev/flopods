import os
import subprocess
import sys
from pathlib import Path

from dotenv import load_dotenv

# Load .env from project root (2 levels up from scripts/)
root_dir = Path(__file__).parent.parent.parent
env_file = root_dir / ".env"

# Fallback to one level up if not found
if not env_file.exists():
    root_dir = Path(__file__).parent.parent
    env_file = root_dir / ".env"

load_dotenv(env_file)

# Container Configuration - Default to docker, support both Docker and Podman
CONTAINER_RUNTIME = os.getenv("CONTAINER_RUNTIME", "docker").lower().strip()
LOCALSTACK_CONTAINER_NAME = os.getenv("LOCALSTACK_CONTAINER_NAME", "localstack")

# AWS Configuration
AWS_REGION = os.getenv("AWS_DYNAMODB_REGION", "ap-south-1")
AWS_DYNAMODB_ENDPOINT = os.getenv("AWS_DYNAMODB_ENDPOINT", "http://localhost:4566")

# LocalStack SQS Config
LOCALSTACK_SQS_ENDPOINT = os.getenv("AWS_SQS_ENDPOINT", AWS_DYNAMODB_ENDPOINT)

# DynamoDB Table Names
DYNAMODB_POD_TABLE = os.getenv("AWS_DYNAMODB_POD_TABLE", "flopods-pods-dev")
DYNAMODB_SESSION_TABLE = os.getenv("AWS_DYNAMODB_SESSION_TABLE", "flopods-sessions-dev")
DYNAMODB_EXECUTION_TABLE = os.getenv("AWS_DYNAMODB_EXECUTION_TABLE", "flopods-executions-dev")
DYNAMODB_CACHE_TABLE = os.getenv("AWS_DYNAMODB_CACHE_TABLE", "flopods-cache-dev")
DYNAMODB_CONTEXT_TABLE = os.getenv("AWS_DYNAMODB_CONTEXT_TABLE", "flopods-context-dev")

# S3 Bucket Names
S3_DOCUMENTS_BUCKET = os.getenv("DOCUMENT_S3_BUCKET", "flopods-documents-dev")
S3_VECTORS_BUCKET = os.getenv("DOCUMENT_VECTOR_S3_BUCKET", "flopods-vectors-dev")
S3_FILES_BUCKET = os.getenv("AWS_S3_BUCKET_NAME", "flopods-files-dev")

# SES Emails
SES_NOREPLY_EMAIL = os.getenv("AWS_SES_NO_REPLY_EMAIL", "noreply@flopods.local")
SES_SUPPORT_EMAIL = os.getenv("AWS_SES_SUPPORT_EMAIL", "support@flopods.local")

# Validate container runtime
if CONTAINER_RUNTIME not in ["docker", "podman"]:
    print(f"⚠️  Invalid CONTAINER_RUNTIME: {CONTAINER_RUNTIME}")
    print(f"   Defaulting to docker")
    CONTAINER_RUNTIME = "docker"

def run(cmd):
    """Run shell command"""
    print(f"🔄 {cmd[:60]}...")
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.returncode == 0:
        print("Done")
        return True
    print("⚠️  Skipped (may already exist)")
    return True

def main():
    print("\n╔════════════════════════════════════════════════════════════╗")
    print(f"║  🚀 FLOPODS LocalStack Initialization ({CONTAINER_RUNTIME.upper()})            ║")
    print(f"║  Region: {AWS_REGION}                                   ║")
    print(f"║  Container: {LOCALSTACK_CONTAINER_NAME}                              ║")
    print(f"║  Env File: {env_file}                           ║")
    print("╚════════════════════════════════════════════════════════════╝\n")

    # S3 Buckets
    print("📦 Creating S3 Buckets...")
    run(
        f"{CONTAINER_RUNTIME} exec -it {LOCALSTACK_CONTAINER_NAME} awslocal s3 mb s3://{S3_DOCUMENTS_BUCKET} --region {AWS_REGION}"
    )
    run(
        f"{CONTAINER_RUNTIME} exec -it {LOCALSTACK_CONTAINER_NAME} awslocal s3 mb s3://{S3_VECTORS_BUCKET} --region {AWS_REGION}"
    )
    run(
        f"{CONTAINER_RUNTIME} exec -it {LOCALSTACK_CONTAINER_NAME} awslocal s3 mb s3://{S3_FILES_BUCKET} --region {AWS_REGION}"
    )
    print()

    # DynamoDB Tables
    print("🗄️  Creating DynamoDB Tables...")

    run(
        f"{CONTAINER_RUNTIME} exec -it {LOCALSTACK_CONTAINER_NAME} awslocal dynamodb create-table --table-name {DYNAMODB_POD_TABLE} --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE --billing-mode PAY_PER_REQUEST --region {AWS_REGION}"
    )

    run(
        f"{CONTAINER_RUNTIME} exec -it {LOCALSTACK_CONTAINER_NAME} awslocal dynamodb create-table --table-name {DYNAMODB_EXECUTION_TABLE} --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE --billing-mode PAY_PER_REQUEST --region {AWS_REGION}"
    )

    run(
        f"{CONTAINER_RUNTIME} exec -it {LOCALSTACK_CONTAINER_NAME} awslocal dynamodb create-table --table-name {DYNAMODB_CONTEXT_TABLE} --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE --billing-mode PAY_PER_REQUEST --region {AWS_REGION}"
    )

    run(
        f"{CONTAINER_RUNTIME} exec -it {LOCALSTACK_CONTAINER_NAME} awslocal dynamodb create-table --table-name {DYNAMODB_SESSION_TABLE} --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE --billing-mode PAY_PER_REQUEST --region {AWS_REGION}"
    )

    run(
        f"{CONTAINER_RUNTIME} exec -it {LOCALSTACK_CONTAINER_NAME} awslocal dynamodb create-table --table-name {DYNAMODB_CACHE_TABLE} --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE --billing-mode PAY_PER_REQUEST --region {AWS_REGION}"
    )
    print()

    # SES
    print("📧 Setting up SES...")
    run(
        f"{CONTAINER_RUNTIME} exec -it {LOCALSTACK_CONTAINER_NAME} awslocal ses verify-email-identity --email-address {SES_NOREPLY_EMAIL} --region {AWS_REGION}"
    )
    run(
        f"{CONTAINER_RUNTIME} exec -it {LOCALSTACK_CONTAINER_NAME} awslocal ses verify-email-identity --email-address {SES_SUPPORT_EMAIL} --region {AWS_REGION}"
    )
    print()

    # SQS
    print("📨 Creating SQS Queues...")
    run(
        f"{CONTAINER_RUNTIME} exec -it {LOCALSTACK_CONTAINER_NAME} awslocal sqs create-queue --queue-name flopods-document-processing.fifo --attributes FifoQueue=true,ContentBasedDeduplication=true,VisibilityTimeout=300,MessageRetentionPeriod=1209600 --region {AWS_REGION}"
    )
    run(
        f"{CONTAINER_RUNTIME} exec -it {LOCALSTACK_CONTAINER_NAME} awslocal sqs create-queue --queue-name flopods-document-processing-dlq.fifo --attributes FifoQueue=true,MessageRetentionPeriod=1209600 --region {AWS_REGION}"
    )
    print()

    # Verify
    print("╔════════════════════════════════════════════════════════════╗")
    print("║  Verification                                           ║")
    print("╚════════════════════════════════════════════════════════════╝\n")

    print("📦 S3 Buckets:")
    subprocess.run(
        f"{CONTAINER_RUNTIME} exec -it {LOCALSTACK_CONTAINER_NAME} awslocal s3 ls --region {AWS_REGION}", shell=True
    )

    print("\n🗄️  DynamoDB Tables:")
    subprocess.run(
        f"{CONTAINER_RUNTIME} exec -it {LOCALSTACK_CONTAINER_NAME} awslocal dynamodb list-tables --region {AWS_REGION}",
        shell=True,
    )

    print("\n📨 SQS Queues:")
    subprocess.run(
        f"{CONTAINER_RUNTIME} exec -it {LOCALSTACK_CONTAINER_NAME} awslocal sqs list-queues --region {AWS_REGION}",
        shell=True,
    )

    print("\nLocalStack initialization complete!\n")

if __name__ == "__main__":
    main()
