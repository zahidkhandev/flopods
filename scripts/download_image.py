#!/usr/bin/env python3
"""Download Docker images - handles OCI multi-arch indexes"""

import json
import os
import platform
import sys

import requests


def get_platform():
    """Detect current platform"""
    machine = platform.machine().lower()
    if machine in ["amd64", "x86_64"]:
        return "linux", "amd64"
    elif machine in ["aarch64", "arm64"]:
        return "linux", "arm64"
    return "linux", "amd64"  # Default


def download_image(image_name, tag="latest", target_platform=None):
    """Download Docker image, resolving multi-arch indexes"""

    # Parse image name
    if "/" not in image_name:
        # Only add library prefix for official images
        official_images = ["postgres", "redis", "mysql", "nginx", "ubuntu"]
        if image_name in official_images:
            image_name = f"library/{image_name}"

    registry = "registry-1.docker.io"
    repo = image_name

    # Get platform
    if target_platform:
        os_name, arch = target_platform.split("/")
    else:
        os_name, arch = get_platform()

    print(f"Downloading {repo}:{tag} for {os_name}/{arch}...")

    # Get authentication token
    token_url = f"https://auth.docker.io/token?service=registry.docker.io&scope=repository:{repo}:pull"
    try:
        token_response = requests.get(token_url, timeout=30)
        token_response.raise_for_status()
        token = token_response.json()["token"]
    except Exception as e:
        print(f"Error getting token: {e}")
        return False

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": ", ".join(
            [
                "application/vnd.docker.distribution.manifest.v2+json",
                "application/vnd.docker.distribution.manifest.list.v2+json",
                "application/vnd.oci.image.manifest.v1+json",
                "application/vnd.oci.image.index.v1+json",
            ]
        ),
    }

    # Get initial manifest (might be index)
    manifest_url = f"https://{registry}/v2/{repo}/manifests/{tag}"
    try:
        manifest_response = requests.get(manifest_url, headers=headers, timeout=30)
        manifest_response.raise_for_status()
        manifest = manifest_response.json()
        _manifest_digest = manifest_response.headers.get("Docker-Content-Digest", "")
    except Exception as e:
        print(f"Error getting manifest: {e}")
        return False

    media_type = manifest.get("mediaType", "")
    print(f"Media Type: {media_type}")

    # Check if it's a multi-arch index
    if "index" in media_type or "manifest.list" in media_type:
        print(f"Multi-arch index detected, resolving platform {os_name}/{arch}...")

        manifests = manifest.get("manifests", [])
        target_manifest = None

        for m in manifests:
            plat = m.get("platform", {})
            if plat.get("os") == os_name and plat.get("architecture") == arch:
                target_manifest = m
                break

        if not target_manifest:
            print(f"Platform {os_name}/{arch} not found in index")
            print("Available platforms:")
            for m in manifests:
                plat = m.get("platform", {})
                print(f"  - {plat.get('os')}/{plat.get('architecture')}")
            return False

        # Fetch the platform-specific manifest
        platform_digest = target_manifest["digest"]
        print(f"Fetching platform manifest: {platform_digest}")

        platform_url = f"https://{registry}/v2/{repo}/manifests/{platform_digest}"
        platform_response = requests.get(platform_url, headers=headers, timeout=30)
        platform_response.raise_for_status()
        manifest = platform_response.json()
        _manifest_digest = platform_digest

    print(f"Manifest Schema Version: {manifest.get('schemaVersion')}")

    # Create output directory
    output_dir = f"{image_name.replace('/', '_')}_{tag}_{arch}"
    os.makedirs(output_dir, exist_ok=True)

    # Download config blob
    config = manifest.get("config", {})
    config_file = None
    if config:
        config_digest = config["digest"]
        print(f"\nDownloading config: {config_digest}")

        blob_url = f"https://{registry}/v2/{repo}/blobs/{config_digest}"
        config_response = requests.get(blob_url, headers=headers, stream=True)

        config_file = os.path.join(output_dir, "config.json")
        with open(config_file, "wb") as f:
            for chunk in config_response.iter_content(chunk_size=8192):
                f.write(chunk)
        print(f"  Saved to: {config_file}")

    # Download layers
    layers = manifest.get("layers", [])
    print(f"\nDownloading {len(layers)} layers...")

    layer_files = []
    for idx, layer in enumerate(layers, 1):
        layer_digest = layer["digest"]
        layer_size = layer.get("size", 0)

        print(f"\n[{idx}/{len(layers)}] Layer: {layer_digest}")
        print(f"  Size: {layer_size / (1024 * 1024):.2f} MB")

        blob_url = f"https://{registry}/v2/{repo}/blobs/{layer_digest}"
        try:
            response = requests.get(blob_url, headers=headers, stream=True, timeout=300)
            response.raise_for_status()

            layer_filename = f"layer-{idx}.tar.gz"
            filename = os.path.join(output_dir, layer_filename)

            downloaded = 0
            with open(filename, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
                    downloaded += len(chunk)
                    if layer_size > 0:
                        progress = (downloaded / layer_size) * 100
                        print(f"\r  Progress: {progress:.1f}%", end="", flush=True)

            print(f"\n  Saved to: {filename}")
            layer_files.append(layer_filename)

        except Exception as e:
            print(f"\n  Error downloading layer: {e}")
            return False

    # Create OCI-compatible image layout
    print("\nCreating OCI image layout...")

    # Create manifest.json for podman load
    podman_manifest = [
        {"Config": "config.json", "RepoTags": [f"{repo}:{tag}"], "Layers": layer_files}
    ]

    manifest_file = os.path.join(output_dir, "manifest.json")
    with open(manifest_file, "w") as f:
        json.dump(podman_manifest, f, indent=2)

    print("\n✓ Download complete!")
    print(f"Output directory: {output_dir}")

    # Create TAR for podman load
    import tarfile

    tar_filename = f"{image_name.replace('/', '_')}_{tag}_{arch}.tar"
    print(f"\nCreating TAR archive: {tar_filename}")

    with tarfile.open(tar_filename, "w") as tar:
        tar.add(output_dir, arcname=".")

    print(f"\n✓ TAR created: {tar_filename}")
    print("\nTo load into Podman:")
    print(f"  podman load -i {tar_filename}")

    return True


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python download_image.py <image_name> [tag] [platform]")
        print("Example: python download_image.py postgres 16-alpine")
        print("Example: python download_image.py postgres 16-alpine linux/amd64")
        sys.exit(1)

    image = sys.argv[1]
    tag = sys.argv[2] if len(sys.argv) > 2 else "latest"
    plat = sys.argv[3] if len(sys.argv) > 3 else None

    success = download_image(image, tag, plat)
    sys.exit(0 if success else 1)
