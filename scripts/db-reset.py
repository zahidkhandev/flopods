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

# Container Configuration
CONTAINER_RUNTIME = os.getenv("CONTAINER_RUNTIME", "docker").lower().strip()
if CONTAINER_RUNTIME not in ["docker", "podman"]:
    CONTAINER_RUNTIME = "docker"

# Container names from docker-compose
DB_CONTAINER = os.getenv("DB_CONTAINER_NAME", "flopods-db")
LOCALSTACK_CONTAINER = os.getenv("LOCALSTACK_CONTAINER_NAME", "localstack")
REDIS_CONTAINER = os.getenv("REDIS_CONTAINER_NAME", "flopods-redis")

# Volume names
DB_VOLUME = "flopods_db_data"
LOCALSTACK_VOLUME = "localstack-data"
REDIS_VOLUME = "redis-data"

# Network name
NETWORK_NAME = "flopods_network"

# Docker compose files
DOCKER_DIR = Path(__file__).parent.parent / "docker"
COMPOSE_FILES = {
    "database": DOCKER_DIR / "db-docker-compose.yaml",
    "localstack": DOCKER_DIR / "localstack-docker-compose.yaml",
    "redis": DOCKER_DIR / "redis-docker-compose.yaml",
}


def run(cmd, capture=False):
    """Run shell command"""
    print(f"🔄 {cmd[:70]}...")
    if capture:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        return result
    else:
        result = subprocess.run(cmd, shell=True)
        return result


def stop_container(name):
    """Stop a running container"""
    print(f"\n⏹️  Stopping container: {name}")
    run(f"{CONTAINER_RUNTIME} stop {name} 2>/dev/null || true")


def remove_container(name):
    """Remove a container"""
    print(f"🗑️  Removing container: {name}")
    run(f"{CONTAINER_RUNTIME} rm {name} 2>/dev/null || true")


def remove_volume(name):
    """Remove a volume"""
    print(f"💾 Removing volume: {name}")
    run(f"{CONTAINER_RUNTIME} volume rm {name} 2>/dev/null || true")


def prune_network(name):
    """Remove unused networks"""
    print(f"🌐 Pruning network: {name}")
    run(f"{CONTAINER_RUNTIME} network rm {name} 2>/dev/null || true")


def run_init_localstack():
    """Call the init-localstack.py script"""
    print(f"\n📦 Running LocalStack initialization...")
    init_script = Path(__file__).parent / "init-localstack.py"
    if init_script.exists():
        subprocess.run([sys.executable, str(init_script)])
    else:
        print(f"⚠️  init-localstack.py not found at {init_script}")


def main():
    print("\n╔════════════════════════════════════════════════════════════╗")
    print("║  🔄 FLOPODS Database & Container Reset                    ║")
    print(f"║  Runtime: {CONTAINER_RUNTIME.upper()}                                      ║")
    print(f"║  Env File: {env_file}                           ║")
    print("╚════════════════════════════════════════════════════════════╝\n")

    print("⚠️  WARNING: This will:")
    print("   - Stop all containers (flopods-db, localstack, flopods-redis)")
    print("   - Delete all volumes (data loss!)")
    print("   - Remove network configuration")
    print("   - Reinitialize LocalStack with fresh services\n")

    response = input("Are you sure? Type 'yes' to continue: ")
    if response.lower() != "yes":
        print("❌ Reset cancelled.")
        sys.exit(0)

    print("\n" + "="*70)
    print("PHASE 1: Stopping Containers")
    print("="*70)
    stop_container(DB_CONTAINER)
    stop_container(LOCALSTACK_CONTAINER)
    stop_container(REDIS_CONTAINER)

    print("\n" + "="*70)
    print("PHASE 2: Removing Containers")
    print("="*70)
    remove_container(DB_CONTAINER)
    remove_container(LOCALSTACK_CONTAINER)
    remove_container(REDIS_CONTAINER)

    print("\n" + "="*70)
    print("PHASE 3: Removing Volumes (Data Deletion)")
    print("="*70)
    remove_volume(DB_VOLUME)
    remove_volume(LOCALSTACK_VOLUME)
    remove_volume(REDIS_VOLUME)

    print("\n" + "="*70)
    print("PHASE 4: Pruning Networks")
    print("="*70)
    prune_network(NETWORK_NAME)

    print("\n" + "="*70)
    print("PHASE 5: Starting Fresh Containers")
    print("="*70)

    # Start containers from separate compose files
    for service_name, compose_file in COMPOSE_FILES.items():
        if compose_file.exists():
            print(f"\n🚀 Starting {service_name} from: {compose_file.name}")
            run(f"{CONTAINER_RUNTIME} compose -f {compose_file} up -d")
        else:
            print(f"⚠️  Skipping {service_name}: {compose_file} not found")

    # Wait for containers to be healthy
    print("\n⏳ Waiting for containers to be healthy...")
    import time
    time.sleep(10)

    # Run LocalStack initialization
    run_init_localstack()

    print("\n" + "="*70)
    print("Reset Complete!")
    print("="*70)
    print(f"""
✓ All containers stopped and removed
✓ All volumes deleted
✓ Fresh containers started from:
  - {COMPOSE_FILES['database'].name}
  - {COMPOSE_FILES['localstack'].name}
  - {COMPOSE_FILES['redis'].name}
✓ LocalStack services initialized

To verify status, run:
  {CONTAINER_RUNTIME} ps -a
  {CONTAINER_RUNTIME} volume ls
""")


if __name__ == "__main__":
    main()
