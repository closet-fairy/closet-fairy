#!/bin/bash
set -e

mkdir -p "${MEDIA_ROOT:-media}/essential"
cp db/seeds/essential_images/*.webp "${MEDIA_ROOT:-media}/essential/"
