#!/usr/bin/env python3
import argparse
import hashlib
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


def run_psql_scalar(sql: str) -> str | None:
    cmd = [
        "docker",
        "exec",
        "nexus-postgres",
        "psql",
        "-U",
        "postgres",
        "-d",
        "nexus",
        "-Atq",
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        sql,
    ]
    out = subprocess.check_output(cmd, text=True).strip()
    return out or None


def sql_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def mask_email(email: str | None) -> str | None:
    if not email or "@" not in email:
        return email
    local, domain = email.split("@", 1)
    if len(local) <= 2:
        masked_local = local[0] + "*" * max(0, len(local) - 1)
    else:
        masked_local = local[:2] + "*" * (len(local) - 2)
    return f"{masked_local}@{domain}"


def metadata_fingerprint(path: Path | None) -> str | None:
    if not path or not path.exists():
        return None
    st = path.stat()
    raw = f"{path}|{st.st_size}|{st.st_mtime_ns}|{st.st_ino}"
    return "meta-" + hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


def emit_progress(run_label: str | None, line: str) -> None:
    if not run_label:
        return
    sql = (
        "INSERT INTO run_progress (run_label, line) VALUES ("
        f"{sql_literal(run_label)}, {sql_literal(line[:1900])}"
        ");"
    )
    cmd = [
        "docker",
        "exec",
        "nexus-postgres",
        "psql",
        "-U",
        "postgres",
        "-d",
        "nexus",
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        sql,
    ]
    subprocess.run(cmd, check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", required=True)
    parser.add_argument("--run-label", default="")
    args = parser.parse_args()

    home = Path.home()
    slots_dir = home / ".nexus-claude-accounts"
    legacy_file = home / ".nexus-claude.env"
    session_file = home / ".claude.json"

    try:
        binding = run_psql_scalar(
            f"SELECT value FROM runner_config WHERE key = {sql_literal('claude_account_binding:' + args.repo)};"
        )
        active = run_psql_scalar(
            "SELECT value FROM runner_config WHERE key = 'claude_account_active';"
        )
        labels_raw = run_psql_scalar(
            "SELECT value FROM runner_config WHERE key = 'claude_account_labels';"
        )
    except subprocess.CalledProcessError as exc:
        raise SystemExit(f"runner_config query failed: {exc}") from exc

    labels = {}
    if labels_raw:
        try:
            parsed = json.loads(labels_raw)
            if isinstance(parsed, dict):
                labels = {str(k): str(v) for k, v in parsed.items()}
        except json.JSONDecodeError:
            labels = {}

    account_id = binding or active
    source = "repo_binding" if binding else "active" if active else "legacy_default"

    if account_id:
        env_file = slots_dir / f"{account_id}.env"
        if not env_file.exists():
            raise SystemExit(f"resolved account slot missing on runner: {account_id}")
    else:
        env_file = legacy_file
        if not env_file.exists():
            raise SystemExit("no Claude auth file available on runner")

    label = labels.get(account_id) if account_id else None
    label_masked = mask_email(label)

    session_fp = metadata_fingerprint(session_file)
    token_fp = metadata_fingerprint(env_file)
    legacy_fp = metadata_fingerprint(legacy_file)

    result = {
        "repo": args.repo,
        "account_id": account_id or "legacy-default",
        "label_masked": label_masked or "",
        "source": source,
        "resolved_at": datetime.now(timezone.utc).isoformat(),
        "env_file": str(env_file),
        "env_file_is_legacy": str(env_file == legacy_file).lower(),
        "token_fingerprint": token_fp or "",
        "session_file": str(session_file),
        "session_fingerprint": session_fp or "",
        "legacy_file": str(legacy_file),
        "legacy_fingerprint": legacy_fp or "",
    }
    print(json.dumps(result))

    identity_line = (
        f"claude-account account={result['account_id']} source={source} "
        f"label={result['label_masked'] or 'n/a'} env={result['env_file']} "
        f"token_fp={result['token_fingerprint'] or 'n/a'} "
        f"session_fp={result['session_fingerprint'] or 'n/a'}"
    )
    emit_progress(args.run_label or None, identity_line)
    return 0


if __name__ == "__main__":
    sys.exit(main())
