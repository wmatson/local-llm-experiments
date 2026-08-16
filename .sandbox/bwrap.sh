#!/usr/bin/env bash
set -euo pipefail

readonly sandbox_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
readonly repo_root="$(cd -- "${sandbox_dir}/.." && pwd -P)"

if ! command -v bwrap >/dev/null 2>&1; then
  printf 'sandbox: bubblewrap (bwrap) is required\n' >&2
  exit 127
fi

declare -a forwarded_env=()
declare -a extra_mounts=()
declare -a extra_rw_mounts=()
declare -a extra_paths=()

host_home=""
while IFS=: read -r _ _ passwd_uid _ _ passwd_home _; do
  if [[ "$passwd_uid" == "$(id -u)" ]]; then
    host_home="$passwd_home"
    break
  fi
done < /etc/passwd

usage() {
  cat <<'EOF'
Usage:
  ./sandbox [sandbox options]
  ./sandbox-run [sandbox options] -- COMMAND [ARG ...]

Sandbox options:
  --env NAME              Forward one deliberately selected host variable.
  --ro-mount HOST:GUEST   Add one explicit read-only directory/file mount.
  --rw-mount HOST:GUEST   Add one explicit read-write state/auth mount.
  --path GUEST_DIR        Append a mounted tool directory to sandbox PATH.
  -h, --help              Show this help.

Options end at --. Values are passed without evaluation or config-file loading.
EOF
}

while (($#)); do
  case "$1" in
    --env)
      (($# >= 2)) || { printf 'sandbox: --env requires NAME\n' >&2; exit 2; }
      [[ "$2" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || {
        printf 'sandbox: invalid environment variable name: %s\n' "$2" >&2
        exit 2
      }
      forwarded_env+=("$2")
      shift 2
      ;;
    --ro-mount)
      (($# >= 2)) || { printf 'sandbox: --ro-mount requires HOST:GUEST\n' >&2; exit 2; }
      [[ "$2" == /*:* ]] || {
        printf 'sandbox: --ro-mount requires absolute HOST:GUEST paths\n' >&2
        exit 2
      }
      extra_mounts+=("$2")
      shift 2
      ;;
    --rw-mount)
      (($# >= 2)) || { printf 'sandbox: --rw-mount requires HOST:GUEST\n' >&2; exit 2; }
      [[ "$2" == /*:* ]] || {
        printf 'sandbox: --rw-mount requires absolute HOST:GUEST paths\n' >&2
        exit 2
      }
      extra_rw_mounts+=("$2")
      shift 2
      ;;
    --path)
      (($# >= 2)) || { printf 'sandbox: --path requires GUEST_DIR\n' >&2; exit 2; }
      [[ "$2" == /* ]] || {
        printf 'sandbox: --path requires an absolute guest path\n' >&2
        exit 2
      }
      extra_paths+=("$2")
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      break
      ;;
    *)
      break
      ;;
  esac
done

(($#)) || { printf 'sandbox: no command supplied\n' >&2; exit 2; }

sandbox_path=''
append_path() {
  local path_entry="$1"
  case ":${sandbox_path}:" in
    *":${path_entry}:"*) return ;;
  esac
  if [[ -n "$sandbox_path" ]]; then
    sandbox_path="${sandbox_path}:${path_entry}"
  else
    sandbox_path="$path_entry"
  fi
}

# Retain host ordering for paths backed by the read-only distro mount. Exclude
# empty/CWD entries, Windows paths, temporary Codex paths, and arbitrary home
# directories. A common ~/.local installation is remapped under /opt below.
IFS=: read -r -a host_path_entries <<<"${PATH:-}"
for path_entry in "${host_path_entries[@]}"; do
  case "$path_entry" in
    /usr|/usr/*|/bin|/sbin|/lib|/lib/*|/lib64|/lib64/*)
      [[ -d "$path_entry" ]] && append_path "$path_entry"
      ;;
    "$host_home/.local/bin")
      [[ -n "$host_home" && -d "$path_entry" ]] && append_path /opt/host-local/bin
      ;;
  esac
done

# Supply a deterministic minimum if the host PATH was unusually sparse.
for path_entry in /usr/local/sbin /usr/local/bin /usr/sbin /usr/bin /sbin /bin; do
  [[ -d "$path_entry" ]] && append_path "$path_entry"
done
for path_entry in "${extra_paths[@]}"; do
  append_path "$path_entry"
done

# Hermes installations may keep their launcher inside HERMES_HOME instead of
# ~/.local/bin. Add only runtime directories that actually exist on the host;
# they are remapped read-only below.
if [[ -n "$host_home" ]]; then
  for hermes_bin_mapping in \
    "$host_home/.hermes/bin:/home/sandbox/.hermes/bin" \
    "$host_home/.hermes/.venv/bin:/home/sandbox/.hermes/.venv/bin" \
    "$host_home/.hermes/venv/bin:/home/sandbox/.hermes/venv/bin" \
    "$host_home/.hermes/hermes-agent/.venv/bin:/home/sandbox/.hermes/hermes-agent/.venv/bin" \
    "$host_home/.hermes/hermes-agent/venv/bin:/home/sandbox/.hermes/hermes-agent/venv/bin"; do
    hermes_host_bin="${hermes_bin_mapping%%:*}"
    hermes_guest_bin="${hermes_bin_mapping#*:}"
    [[ -d "$hermes_host_bin" ]] && append_path "$hermes_guest_bin"
  done
fi

declare -a bwrap_args=(
  --die-with-parent
  --new-session
  --unshare-user
  --unshare-pid
  --unshare-ipc
  --unshare-uts
  --clearenv
  --setenv HOME /home/sandbox
  --setenv PATH "${sandbox_path}"
  --setenv USER sandbox
  --setenv LOGNAME sandbox
  --setenv SHELL /bin/bash
  --setenv LANG "${LANG:-C.UTF-8}"
  --setenv JAVA_TOOL_OPTIONS -Duser.home=/home/sandbox
  --setenv PI_CODING_AGENT_DIR /home/sandbox/.pi/agent
  --setenv HERMES_HOME /home/sandbox/.hermes
  --hostname sandbox
  --ro-bind /usr /usr
  --ro-bind /etc /etc
  --proc /proc
  --dev /dev
  --tmpfs /tmp
  --tmpfs /home
  --dir /home/sandbox
  --dir /workspace
  --bind "${repo_root}" /workspace
  --ro-bind "${repo_root}/sandbox" /workspace/sandbox
  --ro-bind "${repo_root}/sandbox-run" /workspace/sandbox-run
  --ro-bind "${repo_root}/.sandbox" /workspace/.sandbox
  --chdir /workspace
)

for system_path in /bin /sbin /lib /lib64; do
  if [[ -e "$system_path" ]]; then
    bwrap_args+=(--ro-bind "$system_path" "$system_path")
  fi
done

# ~/.local/bin and ~/.local/lib are common package installation infrastructure.
# Mount only those two trees, read-only and remapped away from the real home.
# Keeping their relative bin/../lib layout also supports symlinked launchers.
if [[ -n "$host_home" && -d "$host_home/.local/bin" ]]; then
  bwrap_args+=(--ro-bind "$host_home/.local/bin" /opt/host-local/bin)
fi
if [[ -n "$host_home" && -d "$host_home/.local/lib" ]]; then
  bwrap_args+=(--ro-bind "$host_home/.local/lib" /opt/host-local/lib)
fi

# Preserve ordinary Pi preferences and installed resources. Configuration and
# code are read-only, while the narrow auth store is writable for token refresh.
if [[ -n "$host_home" ]]; then
  pi_agent_dir="$host_home/.pi/agent"
  for pi_config_file in settings.json keybindings.json lmstudio.json models-store.json AGENTS.md SYSTEM.md APPEND_SYSTEM.md; do
    if [[ -f "$pi_agent_dir/$pi_config_file" ]]; then
      bwrap_args+=(--ro-bind "$pi_agent_dir/$pi_config_file" "/home/sandbox/.pi/agent/$pi_config_file")
    fi
  done
  for pi_resource_dir in bin npm git extensions skills prompts themes; do
    if [[ -d "$pi_agent_dir/$pi_resource_dir" ]]; then
      bwrap_args+=(--ro-bind "$pi_agent_dir/$pi_resource_dir" "/home/sandbox/.pi/agent/$pi_resource_dir")
    fi
  done
  if [[ -f "$pi_agent_dir/auth.json" ]]; then
    bwrap_args+=(--bind "$pi_agent_dir/auth.json" /home/sandbox/.pi/agent/auth.json)
  fi

  # Hermes stores configuration, authentication, and persistent state together.
  # Bind each existing top-level state item read-write except its subprocess
  # home and installed runtime. This keeps the parent on private tmpfs, so an
  # omitted home can never reveal SSH state or require modifying the host merely
  # to create a mount point.
  hermes_dir="$host_home/.hermes"
  if [[ -d "$hermes_dir" ]]; then
    shopt -s dotglob nullglob
    for hermes_item in "$hermes_dir"/*; do
      hermes_name="${hermes_item##*/}"
      case "$hermes_name" in
        home|hermes-agent) continue ;;
      esac
      bwrap_args+=(--bind "$hermes_item" "/home/sandbox/.hermes/$hermes_name")
    done
    shopt -u dotglob nullglob
    bwrap_args+=(--dir /home/sandbox/.hermes/home)
  fi
  if [[ -d "$hermes_dir/hermes-agent" ]]; then
    bwrap_args+=(--ro-bind "$hermes_dir/hermes-agent" /home/sandbox/.hermes/hermes-agent)
    bwrap_args+=(--ro-bind "$hermes_dir/hermes-agent" "$hermes_dir/hermes-agent")
  fi

  # uv-managed Python interpreters are absolute virtualenv symlink targets.
  # Expose only uv's Python runtime collection, never all of ~/.local/share.
  uv_python_dir="$host_home/.local/share/uv/python"
  if [[ -d "$uv_python_dir" ]]; then
    bwrap_args+=(--ro-bind "$uv_python_dir" "$uv_python_dir")
  fi
fi

# WSL commonly makes /etc/resolv.conf a symlink into /mnt/wsl. Bind only that
# resolved file (not the surrounding drive or runtime tree) so the inherited
# resolver configuration remains usable inside the otherwise private root.
resolver_path="$(readlink -f /etc/resolv.conf)"
if [[ "$resolver_path" != /etc/resolv.conf && -f "$resolver_path" ]]; then
  bwrap_args+=(--ro-bind "$resolver_path" "$resolver_path")
fi

# Preserve only ordinary terminal behavior by default.
if [[ -n "${TERM:-}" ]]; then
  bwrap_args+=(--setenv TERM "${TERM}")
fi

# Forwarding is opt-in and values are copied literally, never evaluated.
for name in "${forwarded_env[@]}"; do
  if [[ -v "$name" ]]; then
    bwrap_args+=(--setenv "$name" "${!name}")
  else
    printf 'sandbox: cannot forward unset variable: %s\n' "$name" >&2
    exit 2
  fi
done

for mount in "${extra_mounts[@]}"; do
  host_path="${mount%%:*}"
  guest_path="${mount#*:}"
  [[ "$guest_path" == /* && -e "$host_path" ]] || {
    printf 'sandbox: invalid or missing read-only mount: %s\n' "$mount" >&2
    exit 2
  }
  bwrap_args+=(--ro-bind "$host_path" "$guest_path")
done

for mount in "${extra_rw_mounts[@]}"; do
  host_path="${mount%%:*}"
  guest_path="${mount#*:}"
  [[ "$guest_path" == /* && -e "$host_path" ]] || {
    printf 'sandbox: invalid or missing read-write mount: %s\n' "$mount" >&2
    exit 2
  }
  bwrap_args+=(--bind "$host_path" "$guest_path")
done

# Networking stays in the parent namespace. No host /home, /mnt, or /run mount
# is created; only the repository, common read-only tool trees described above,
# and explicit --ro-mount/--rw-mount paths are exposed.
exec bwrap "${bwrap_args[@]}" "$@"
