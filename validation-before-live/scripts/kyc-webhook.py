#!/usr/bin/env python3
"""
Reproduit un webhook Sumsub signé HMAC vers /api/sumsub/webhook.
Prouve la transition KYC pending -> approved (voir VALIDATION_BEFORE_LIVE.md §1).

NOTE: l'ancien script ciblait /api/persona/webhook (Persona, header Persona-Signature).
Persona est entièrement supprimé. Ce script utilise le format Sumsub :
  - endpoint : /api/sumsub/webhook
  - header   : x-payload-digest = HMAC_SHA256(SUMSUB_WEBHOOK_SECRET, rawBody) hex
  - header   : x-payload-digest-alg = HMAC_SHA256_HEX

Prérequis :
  - serveur dev up sur :4105
  - un KycInquiry { inquiryId: applicantId, userId } existant en DB
    (= ce que claimKycInquiry / submitKycDocument écrit côté serveur)
  - SUMSUB_WEBHOOK_SECRET dans .env.local

Usage :
  python3 kyc-webhook.py <applicantId> <userId> [reviewAnswer]
  reviewAnswer défaut = "GREEN"  (declenche pending->approved)
  reviewAnswer = "RED"           (archive uniquement, pas d'auto-rejet)

Exemples :
  python3 kyc-webhook.py applicant_abc123 usr_xyz GREEN
  python3 kyc-webhook.py applicant_abc123 usr_xyz RED
"""
import sys, json, hmac as hmac_lib, hashlib, urllib.request, urllib.error, os, re


def load_secret():
    """Lit SUMSUB_WEBHOOK_SECRET depuis .env.local (remonte jusqu'a 4 niveaux)."""
    here = os.path.dirname(os.path.abspath(__file__))
    for up in range(5):
        p = os.path.join(here, *([".."] * up), ".env.local")
        if os.path.exists(p):
            with open(p) as f:
                for line in f:
                    m = re.match(r'^SUMSUB_WEBHOOK_SECRET=(.+)$', line.strip())
                    if m:
                        return m.group(1).strip().strip('"').strip("'")
    sys.exit("SUMSUB_WEBHOOK_SECRET introuvable dans .env.local")


def main():
    if len(sys.argv) < 3:
        sys.exit(
            "usage: python3 kyc-webhook.py <applicantId> <userId> [GREEN|RED]\n"
            "       applicantId  = valeur stockee dans KycInquiry.inquiryId\n"
            "       userId       = id investisseur (info seulement, non utilise cote serveur)\n"
            "       reviewAnswer = GREEN (defaut) ou RED"
        )

    applicant_id = sys.argv[1]
    user_id = sys.argv[2]  # hint only — le webhook resout userId depuis KycInquiry (P0-4)
    review_answer = sys.argv[3].upper() if len(sys.argv) > 3 else "GREEN"

    if review_answer not in ("GREEN", "RED"):
        sys.exit(f"reviewAnswer invalide : {review_answer!r} — doit etre GREEN ou RED")

    secret = load_secret()

    # Payload applicantReviewed — format exact attendu par src/app/api/sumsub/webhook/route.ts
    # externalUserId est present mais UNTRUSTED cote serveur (defense P0-4).
    payload = {
        "type": "applicantReviewed",
        "applicantId": applicant_id,
        "externalUserId": user_id,
        "reviewResult": {
            "reviewAnswer": review_answer,
        },
    }
    raw = json.dumps(payload, separators=(",", ":"))

    # Signature Sumsub webhook :
    #   x-payload-digest     = HMAC_SHA256(SUMSUB_WEBHOOK_SECRET, rawBody) hex
    #   x-payload-digest-alg = HMAC_SHA256_HEX
    sig = hmac_lib.new(secret.encode(), raw.encode(), hashlib.sha256).hexdigest()

    print(f"[kyc-webhook] applicantId  = {applicant_id}")
    print(f"[kyc-webhook] reviewAnswer = {review_answer}")
    print(f"[kyc-webhook] digest prefix = {sig[:16]}...")

    req = urllib.request.Request(
        "http://localhost:4105/api/sumsub/webhook",
        data=raw.encode(),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "x-payload-digest": sig,
            "x-payload-digest-alg": "HMAC_SHA256_HEX",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            body = r.read().decode()
            print(f"HTTP {r.status}: {body}")
            if review_answer == "GREEN" and '"received":true' in body:
                print("[kyc-webhook] GREEN accepte -- verifier kycStatus=approved en DB :")
                print('  sqlite3 prisma/dev.db "SELECT kycStatus FROM Investor WHERE id=\'<id>\'"')
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"HTTP {e.code}: {body}")
        if e.code == 401:
            print("[kyc-webhook] 401 = signature invalide (secret incorrect ou body altere)")
        elif e.code == 500:
            print("[kyc-webhook] 500 = SUMSUB_WEBHOOK_SECRET absent du serveur dev")


if __name__ == "__main__":
    main()
