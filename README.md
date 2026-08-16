# Local LLM Experiments

A simple repo for playing with local inference experiments. Not very scientific, but I'll try to put each in a subdirectory and eventually set up GH pages to host the static ones

## Development sandbox

Run `./sandbox` for an interactive Bubblewrap shell or
`./sandbox-run -- COMMAND [ARG ...]` for one command. Node.js/npm, Java, and the
Clojure CLI installed by the host distro, plus tools installed under
`~/.local/bin`, are available through read-only runtime mounts. See
[`.sandbox/README.md`](.sandbox/README.md) for the policy and optional
environment/tool mounts.
