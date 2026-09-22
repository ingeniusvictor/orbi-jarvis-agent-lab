# LUM-ECC-P2 — AgentShield Repository Baseline

Status: CLASSIFIED / REPORT-ONLY / NON-ENFORCING

AgentShield run: `35677759003`  
Artifact: `lumia-ecc-agentshield-35677759003`  
Artifact ID: `10672988591`  
Artifact digest: `sha256:bdaa7e8eaa687209618a01aa3a69897be7c3bd8f440925788d3645218a11f64e`  
Evidence-pack digest: `sha256:a119dc7576917812f9ba4990981c55a8f33c2f85e3e2dd94a8f6038176129db8`

## Purpose

Establish a repository-specific AgentShield baseline for the active L.U.M.I.A. Voice Gate line.

This baseline was classified from L.U.M.I.A.'s own evidence. No accepted finding from ORBI Creative Studio was inherited automatically.

## Pinning

AgentShield:

- package: `ecc-agentshield@1.6.0`
- repository: `affaan-m/agentshield`
- commit: `b0891303bdcd6037376a94263d45cfd2ff3dfb98`

GitHub Actions used by the scanner are pinned to immutable SHAs.

## Execution result

Observed scanner summary:

- scanner outcome: success;
- score: 80/100;
- grade: B;
- total findings: 358;
- critical: 358;
- high/medium/low/info: 0;
- evidence-pack verification: PASSED;
- registered harness adapters: 9;
- matched harness adapters: 1;
- matched harness: Codex;
- Codex confidence: strong;
- Codex evidence: root `AGENTS.md`.

Supply-chain summary:

- status: clean;
- packages analyzed: 374;
- risky packages: 0;
- critical/high package risks: 0;
- pinned packages: 374;
- unpinned packages: 0;
- known-good packages: 1.

## Finding classification

The raw report and evidence pack were inspected rather than accepting the severity count at face value.

All 358 findings have exactly:

- category: `secrets`;
- severity: `critical`;
- title: `Hardcoded Azure storage account key`;
- file: `package-lock.json`.

There are no AgentShield findings in:

- provider secret code;
- `.env` files;
- bridge/tool source;
- voice/speaker profile source;
- root `AGENTS.md`;
- ECC manifest/docs.

Representative evidence was checked against the real lockfile.

For example, the scanner evidence beginning:

`glc7SdwP...oA==`

maps to:

```json
"integrity": "sha512-glc7SdwPkOkLw8oxwLo9PKTdLJGqW/PIR4urWXFoRtX9YllwozsEVc5Tc1+EvLSkfrsxPJqQWqOgpjUOQXf1oA=="
```

for `@anthropic-ai/claude-agent-sdk@0.3.220`.

Additional sampled findings map the same way to npm `integrity: sha512-...` metadata.

Therefore, for this exact repository baseline, all 358 findings are classified as the same npm Subresource Integrity false-positive class, not Azure credentials.

## ORBI conclusion

1. `358 critical` MUST NOT be interpreted as 358 leaked secrets.
2. `package-lock.json` MUST NOT be redacted or rewritten to silence this detector.
3. The scanner score/grade is evidence, not an enforcement threshold.
4. AgentShield remains report-only.
5. Future scans must compare finding classes and paths against this baseline.
6. Any new finding outside the accepted npm-integrity class requires fresh security review.
7. The accepted false-positive class applies only to evidence that is demonstrably npm lockfile integrity metadata.

## Report-only guarantees

- repository permission: `contents: read`;
- checkout credentials are not persisted;
- `fail-on-findings: false`;
- `fail-on-supply-chain: false`;
- online supply-chain registry lookup disabled;
- no `--fix`;
- scanner is non-blocking;
- artifacts retained for review;
- no product/runtime source mutation.

## Integrated repository validation

LUMIA ECC Pull Request Gate run `35677758971` completed successfully:

- exact dependency install: PASS;
- brain provider contracts: PASS;
- Voice Gate contracts: PASS;
- production build: PASS;
- lint: PASS.

## Exit result

P2: **PASS — REPORT-ONLY BASELINE CLASSIFIED**

This does not authorize automatic remediation or enforcement.

Next controlled phase: evidence-backed `agent-sort` for L.U.M.I.A.
