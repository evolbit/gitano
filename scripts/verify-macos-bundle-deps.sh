#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_EXECUTABLE="${ROOT_DIR}/src-tauri/target/release/bundle/macos/gitano.app/Contents/MacOS/gitano"
EXECUTABLE="${1:-$DEFAULT_EXECUTABLE}"

if [[ ! -x "${EXECUTABLE}" ]]; then
  cat >&2 <<EOF
error: packaged macOS executable not found:
  ${EXECUTABLE}

Build the Tauri macOS bundle before dependency validation, or pass the path to:
  gitano.app/Contents/MacOS/gitano
EOF
  exit 1
fi

if ! command -v otool >/dev/null 2>&1; then
  echo "error: otool is required to validate macOS bundle dependencies." >&2
  exit 1
fi

dependency_output="$(otool -L "${EXECUTABLE}")"
package_manager_lines="$(printf "%s\n" "${dependency_output}" | grep -E "/opt/homebrew|/usr/local|/opt/local" || true)"

if [[ -n "${package_manager_lines}" ]]; then
  echo "error: packaged executable references non-portable package-manager dependencies:" >&2
  printf "%s\n" "${package_manager_lines}" >&2
  echo >&2
  echo "Full dependency output:" >&2
  printf "%s\n" "${dependency_output}" >&2
  exit 1
fi

libgit2_lines="$(printf "%s\n" "${dependency_output}" | grep -E "libgit2([^[:space:]]*)?\.dylib" || true)"

if [[ -z "${libgit2_lines}" ]]; then
  echo "macOS bundle dependency check passed: no dynamic libgit2 dependency found."
  exit 0
fi

invalid_lines=()
while IFS= read -r line; do
  trimmed="${line#"${line%%[![:space:]]*}"}"
  dependency_path="${trimmed%% *}"

  case "${dependency_path}" in
    @executable_path/*|@loader_path/*|@rpath/*|/usr/lib/*|/System/Library/*)
      ;;
    /opt/homebrew/*|/usr/local/*|/opt/local/*)
      invalid_lines+=("${line}")
      ;;
    /*)
      invalid_lines+=("${line}")
      ;;
  esac
done <<< "${libgit2_lines}"

if (( ${#invalid_lines[@]} > 0 )); then
  echo "error: packaged executable references a non-portable libgit2 dependency:" >&2
  printf "  %s\n" "${invalid_lines[@]}" >&2
  echo >&2
  echo "Full dependency output:" >&2
  printf "%s\n" "${dependency_output}" >&2
  exit 1
fi

echo "macOS bundle dependency check passed: libgit2 dependency is bundled or executable-relative."
