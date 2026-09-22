# LUM-ECC-P2 — AgentShield Repository Baseline

Status: REPORT-ONLY / BASELINE PENDING EXECUTION

## Purpose

Add a repository-specific AgentShield baseline for the active L.U.M.I.A. Voice Gate line.

This phase intentionally does not inherit accepted findings from ORBI Creative Studio.

## Pinning

AgentShield:

- package: `ecc-agentshield@1.6.0`
- repository: `affaan-m/agentshield`
- commit: `b0891303bdcd6037376a94263d45cfd2ff3dfb98`

GitHub Actions used by the scanner are pinned to immutable SHAs.

## Report-only guarantees

- repository permission: `contents: read`;
- checkout credentials are not persisted;
- `fail-on-findings: false`;
- `fail-on-supply-chain: false`;
- online supply-chain registry lookup disabled;
- no `--fix`;
- scanner step is non-blocking;
- artifacts retained for review;
- no product/runtime source mutation.

## L.U.M.I.A.-specific review priorities

The baseline must be inspected for findings involving:

- provider keys/tokens or secure-secret handling;
- bridge/tool write boundaries;
- camera/microphone surfaces;
- voice/speaker profile data;
- local runtime/process execution;
- model/runtime downloads;
- browser/network/SSRF surfaces;
- GitHub Actions and supply-chain configuration;
- agent/harness instructions.

A numeric score is not authority. Finding classes must be inspected before remediation.

## No inherited exceptions

Creative Studio previously observed a repository-specific lockfile false-positive class.

That classification is **not** automatically accepted here.

If L.U.M.I.A. shows the same detector behavior, P2 must independently prove the evidence is npm integrity metadata before recording an accepted baseline.

## Exit criteria

P2 can be promoted only when:

1. AgentShield runs successfully;
2. evidence pack verification succeeds;
3. supply-chain result is recorded;
4. finding classes are inspected;
5. accepted false positives, if any, are documented from L.U.M.I.A. evidence;
6. the LUMIA ECC PR gate remains GREEN;
7. no runtime/product source changes are introduced.
