# Repository sandbox

`./sandbox` opens Bash and `./sandbox-run -- COMMAND [ARG ...]` runs any command
under the same Bubblewrap policy. The extra `--` is optional when the command
does not resemble a sandbox option, so `./sandbox-run git status` also works.

The base image is the host distro's read-only `/usr` and `/etc`. Consequently,
the distro-installed Node.js/npm, Java, and Clojure CLI are available without
exposing the host home directory. Safe distro entries retain their ordering from
the host `PATH`; Windows, temporary Codex, empty/CWD, and arbitrary home entries
are discarded. Clojure and npm downloads go into the private, per-invocation
sandbox home unless the project configures another project-local cache.

The common host installation trees `~/.local/bin` and `~/.local/lib` are mounted
read-only as `/opt/host-local/bin` and `/opt/host-local/lib`. This makes tools
such as `pi` available while preserving relative `bin/../lib` symlinks, without
exposing the rest of the host home, `~/.local/share`, or tool credentials.

Pi's global configuration is available under its private sandbox home. Ordinary
settings, instructions, packages, extensions, skills, prompts, themes, helper
binaries, and model caches are read-only. `auth.json` is mounted read-write so
login and token refresh work. `PI_CODING_AGENT_DIR` is fixed at
`/home/sandbox/.pi/agent`; saved trust decisions and session history remain
private by default.

When `~/.hermes` exists, each existing top-level agent-state item—including
configuration, authentication, sessions, memory, skills, and caches—is mounted
read-write at `/home/sandbox/.hermes`. The installed `hermes-agent` source and
virtualenv are read-only. Hermes' nested `home/` is replaced by a directory on
the private home tmpfs because it is subprocess state and can contain SSH or
unrelated tool credentials. `HERMES_HOME` is fixed at
`/home/sandbox/.hermes`.

The installed launcher currently uses absolute paths into the original
`~/.hermes/hermes-agent` virtualenv and uv-managed Python. Those two runtime
trees are also exposed at their original paths, read-only; no other host-home
content or `~/.local/share` content is exposed.

Only `TERM` and `LANG` values are inherited automatically. `PATH` is rebuilt
from the safe mounted entries described above, and Java's private-home option is
constructed by the launcher. Forward any other variable deliberately:

```bash
./sandbox-run --env MY_TOKEN -- command-that-needs-it
```

Home-installed tools can be exposed narrowly and read-only. Mount only the
needed tree and, for executables, append its guest `bin` directory to `PATH`:

```bash
./sandbox-run \
  --ro-mount /home/me/.local:/opt/host-local \
  --path /opt/host-local/bin \
  -- tool-name
```

For another agent, expose its persistent context explicitly when needed:

```bash
./sandbox \
  --rw-mount /home/me/.other-agent:/home/sandbox/.other-agent
```

This authorizes sandboxed processes to read and modify that exact host path.

These switches are intentionally command-line-only. The launcher does not
source repository config, host `.env` files, hooks, or generated scripts. A
Hermes `.env` may be mounted as opaque agent-owned data, but its contents are
never sourced into the launcher environment. Any explicit mount is trusted user
input and can weaken isolation if it exposes a sensitive or overly broad path.

## Base policy

- `/workspace`: repository root, read-write.
- `/workspace/sandbox`, `/workspace/sandbox-run`, `/workspace/.sandbox`:
  read-only overlays protecting future invocations.
- Host `~/.local/bin` and `~/.local/lib`, when present: read-only at
  `/opt/host-local/bin` and `/opt/host-local/lib`; no other home content is
  included by default.
- Selected Pi configuration/resources from `~/.pi/agent`: read-only at
  `/home/sandbox/.pi/agent`; `auth.json` is the narrow read-write exception.
  `trust.json` and `sessions/` are not selected.
- Existing Hermes authentication and persistent state items from `~/.hermes`:
  read-write under `/home/sandbox/.hermes`; its installed runtime is read-only
  and its nested subprocess `home/` lives on private tmpfs.
- The exact Hermes install tree and uv Python runtime collection: additionally
  read-only at their launcher-required absolute paths under the otherwise
  unmounted host home.
- `/usr` and `/etc`, plus `/bin`, `/sbin`, `/lib`, and `/lib64` when present:
  host distro trees, read-only. This retains the effective WSL `/etc/hosts`,
  `/etc/resolv.conf`, certificates, dynamic libraries, and runtime
  installations.
- If `/etc/resolv.conf` is a symlink outside `/etc` (as on WSL), only its
  resolved target file is additionally mounted read-only at the same path. Its
  surrounding `/mnt/wsl` or `/run` tree is not exposed.
- `/proc`, `/dev`: fresh Bubblewrap-managed views.
- `/tmp`, `/home`: private tmpfs; `HOME=/home/sandbox`. Java's `user.home` is
  also pinned there with `JAVA_TOOL_OPTIONS=-Duser.home=/home/sandbox`, rather
  than inferred from the host distro's read-only `/etc/passwd`.
- PID, IPC, UTS, and user namespaces plus a new session. Networking is kept.
- No `/run`, host home root, `~/.ssh`, unrelated `~/.local/share`, Pi session
  history, Hermes subprocess home, surrounding `/mnt/c`, agent socket, or
  container socket is mounted by the launcher.

The checked-in launchers remain trusted host-side code. Bubblewrap isolates the
started process, not unrelated host processes or a privileged kernel exploit.
