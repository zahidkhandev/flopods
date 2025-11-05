#!/usr/bin/env python3
# scripts/init-localstack.py

import os
import subprocess
import sys

from dotenv import load_dotenv

# Load .env
load_dotenv()

AWS_REGION = os.getenv("AWS_DYNAMODB_REGION", "ap-south-1")
AWS_DEFAULT_REGION = os.getenv("AWS_DEFAULT_REGION", "ap-south-1")


def run(cmd):
    """Run shell command"""
    print(f"🔄 {cmd[:60]}...")
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.returncode == 0:
        print("✅ Done")
        return True
    print("⚠️  Skipped (may already exist)")
    return True


def main():
    print("\n╔════════════════════════════════════════════════════════════╗")
    print("║  🚀 FLOPODS LocalStack Initialization                    ║")
    print(f"║  Region: {AWS_REGION}                                   ║")
    print("╚════════════════════════════════════════════════════════════╝\n")

    # S3 Buckets
    print("📦 Creating S3 Buckets...")
    run(
        f"podman exec -it localstack awslocal s3 mb s3://flopods-documents-dev --region {AWS_REGION}"
    )
    run(
        f"podman exec -it localstack awslocal s3 mb s3://flopods-vectors-dev --region {AWS_REGION}"
    )
    run(
        f"podman exec -it localstack awslocal s3 mb s3://flopods-files-dev --region {AWS_REGION}"
    )
    print()

    # DynamoDB Tables
    print("🗄️  Creating DynamoDB Tables...")

    run(
        f"podman exec -it localstack awslocal dynamodb create-table --table-name flopods-pods-dev --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE --billing-mode PAY_PER_REQUEST --region {AWS_REGION}"
    )

    run(
        f"podman exec -it localstack awslocal dynamodb create-table --table-name flopods-executions-dev --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE --billing-mode PAY_PER_REQUEST --region {AWS_REGION}"
    )

    run(
        f"podman exec -it localstack awslocal dynamodb create-table --table-name flopods-context-dev --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE --billing-mode PAY_PER_REQUEST --region {AWS_REGION}"
    )

    run(
        f"podman exec -it localstack awslocal dynamodb create-table --table-name flopods-sessions-dev --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE --billing-mode PAY_PER_REQUEST --region {AWS_REGION}"
    )

    run(
        f"podman exec -it localstack awslocal dynamodb create-table --table-name flopods-cache-dev --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE --billing-mode PAY_PER_REQUEST --region {AWS_REGION}"
    )
    print()

    # SES
    print("📧 Setting up SES...")
    run(
        f"podman exec -it localstack awslocal ses verify-email-identity --email-address noreply@flopods.local --region {AWS_REGION}"
    )
    run(
        f"podman exec -it localstack awslocal ses verify-email-identity --email-address support@flopods.local --region {AWS_REGION}"
    )
    print()

    # SQS
    print("📨 Creating SQS Queues...")
    run(
        f"podman exec -it localstack awslocal sqs create-queue --queue-name flopods-document-processing.fifo --attributes FifoQueue=true,ContentBasedDeduplication=true,VisibilityTimeout=300,MessageRetentionPeriod=1209600 --region {AWS_REGION}"
    )
    run(
        f"podman exec -it localstack awslocal sqs create-queue --queue-name flopods-document-processing-dlq.fifo --attributes FifoQueue=true,MessageRetentionPeriod=1209600 --region {AWS_REGION}"
    )
    print()

    # Verify
    print("╔════════════════════════════════════════════════════════════╗")
    print("║  ✅ Verification                                           ║")
    print("╚════════════════════════════════════════════════════════════╝\n")

    print("📦 S3 Buckets:")
    subprocess.run(
        f"podman exec -it localstack awslocal s3 ls --region {AWS_REGION}", shell=True
    )

    print("\n🗄️  DynamoDB Tables:")
    subprocess.run(
        f"podman exec -it localstack awslocal dynamodb list-tables --region {AWS_REGION}",
        shell=True,
    )

    print("\n📨 SQS Queues:")
    subprocess.run(
        f"podman exec -it localstack awslocal sqs list-queues --region {AWS_REGION}",
        shell=True,
    )

    print("\n✅ LocalStack initialization complete!\n")


if __name__ == "__main__":
    main()
