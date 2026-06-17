#!/usr/bin/env python3
"""
Reproduit un webhook Persona signé HMAC vers /api/persona/webhook.
Prouve la transition KYC pending -> approved (voir VALIDATION_BEFORE_LIVE.md §1).

Prérequis :
  - serveur dev up sur :4105
  - un KycInquiry { inquiryId, userId } existant en DB (= ce que claimKycInquiry fait au onReady)
  - PERSONA_WEBHOOK_SECRET dans .env.local

Usage :
  python3 kyc-webhook.py <inquiryId> <userId> [status]
  status défaut = "completed"
"""
import sys, json, time, hmac, hashlib, urllib.request, urllib.error, os, re

def load_secret():
    # lit PERSONA_WEBHOOK_SECRET depuis .env.local (remonte jusqu'à 3 niveaux)
    here = os.path.dirname(os.path.abspath(__file__))
    for up in range(4):
        p = os.path.join(here, *([".."] * up), ".env.local")
        if os.path.exists(p):
            for line in open(p):
                m = re.match(r'^PERSONA_WEBHOOK_SECRET=(.+)$', line.strip())
                if m:
                    return m.group(1).strip().strip('"')
    sys.exit("PERSONA_WEBHOOK_SECRET introuvable dans .env.local")

def main():
    if len(sys.argv) < 3:
        sys.exit("usage: python3 kyc-webhook.py <inquiryId> <userId> [status]")
    inquiry_id, user_id = sys.argv[1], sys.argv[2]
    status = sys.argv[3] if len(sys.argv) > 3 else "completed"
    secret = load_secret()

    payload = {
        "data": {
            "type": "inquiry",
            "id": inquiry_id,
            "attributes": {"status": status, "reference-id": user_id},
        },
        "events": [{"name": f"inquiry.{status}",
                    "occurred-at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}],
    }
    raw = json.dumps(payload, separators=(",", ":"))
    ts = str(int(time.time()))
    sig = hmac.new(secret.encode(), f"{ts}.{raw}".encode(), hashlib.sha256).hexdigest()

    req = urllib.request.Request(
        "http://localhost:4105/api/persona/webhook",
        data=raw.encode(), method="POST",
        headers={"Content-Type": "application/json",
                 "Persona-Signature": f"t={ts},v1={sig}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            print(f"HTTP {r.status}: {r.read().decode()}")
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}: {e.read().decode()}")

if __name__ == "__main__":
    main()
