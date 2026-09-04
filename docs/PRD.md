# Product Requirements Document

## 1. Product Summary

LeakTest is a browser-based diagnostic platform that detects network and browser environment leaks by correlating signals across HTTP, DNS, WebRTC, timezone, device traits, and claimed browser identity.

The product does not merely report raw signals. It explains whether a user's environment is internally consistent and whether their proxy, VPN, browser masking, or anti-detect setup leaks contradictory information.

## 2. Goals

- Help users determine whether their browsing environment exposes their real network identity
- Identify which subsystem leaks information: IP, DNS, WebRTC, timezone, device traits, or User-Agent
- Provide evidence-backed explanations instead of a binary pass/fail result
- Create a foundation for future batch testing and API access

## 3. Non-Goals

- Absolute proof of device identity
- Malware-grade fingerprinting or persistent cross-site tracking
- OS-level DNS inspection from the browser
- Guaranteed detection of all anti-detect browsers

## 4. Target Users

- Privacy-focused users testing VPN or proxy setups
- Users validating anti-detect browser profiles
- Fraud and trust teams evaluating browser environment consistency
- Developers debugging privacy or networking toolchains

## 5. Core User Stories

- As a user, I want to know whether my proxy or VPN hides my real IP across multiple observation points
- As a user, I want to know whether my DNS requests bypass my proxy path
- As a user, I want to know whether WebRTC exposes an unexpected IP
- As a user, I want to know whether my browser timezone matches my exit location
- As a user, I want to know whether my browser fingerprint looks internally inconsistent
- As a user, I want a readable report that explains the findings and risk level

## 6. Product Principles

- Evidence first: every finding must include machine-readable evidence
- Cross-correlation over raw collection: risk comes from contradictions, not isolated values
- Progressive disclosure: simple summary first, raw details on demand
- Low false-positive bias: ambiguous cases should be explained, not overclaimed

## 7. MVP Scope

### In Scope

- Session creation and report generation
- Multi-source HTTP IP observation
- Timezone and locale consistency checks
- Report page with overall score and module-level findings
- Initial rule engine

### Out of Scope for MVP

- Public developer API
- Batch testing dashboard
- Historical comparisons across sessions
- Advanced anti-automation detection

## 8. Post-MVP Scope

- Authoritative DNS leak detection
- WebRTC leak detection with multiple STUN regions
- Device environment authenticity scoring
- User-Agent authenticity scoring
- JSON export and API access
- Admin analytics and rule tuning

## 9. Feature Requirements

### 9.1 Session Management

- The system must create a unique session for each test run
- Each session must have an expiring signed client token
- Each session must track collection state and final report state

### 9.2 Multi-Source IP Detection

- The client must query at least three HTTP echo nodes in different regions
- The system must record observed IP, family, ASN, geo data, and RTT
- The system must identify inconsistent IP observations across vantage points

### 9.3 DNS Leak Detection

- The system must generate unique per-session hostnames
- The authoritative DNS service must log resolver IP, ASN, region, query type, and timestamps
- The system must flag DNS resolvers that appear inconsistent with the observed exit path

### 9.4 WebRTC Leak Detection

- The client must collect ICE candidates through multiple STUN servers
- The system must distinguish host, srflx, and relay candidates
- The system must detect WebRTC-exposed public IPs that differ from HTTP exit IPs

### 9.5 Timezone Consistency Detection

- The client must collect browser timezone, UTC offset, language preferences, and local time
- The system must compare browser timezone with geo-inferred timezone from exit IP

### 9.6 Device Environment Authenticity

- The client must collect platform, hardware, display, touch, WebGL, and capability signals
- The system must flag impossible or highly unlikely signal combinations

### 9.7 User-Agent Authenticity

- The system must compare request User-Agent, UA-CH, runtime capabilities, and inferred engine behavior
- The system must surface reasons for suspected User-Agent spoofing

### 9.8 Reporting

- The report must show overall score, risk level, module-level status, and evidence
- The report must include short remediation guidance
- The report must support JSON export in later phases

## 10. Risk Scoring

Overall score range: 0-100

- 0-19: Consistent
- 20-49: Mildly suspicious
- 50-79: Suspicious
- 80-100: High risk

Suggested module weights:

- IP consistency: 25
- DNS leak detection: 20
- WebRTC leak detection: 20
- Timezone consistency: 10
- Device authenticity: 12.5
- User-Agent authenticity: 12.5

## 11. UX Requirements

- The homepage must explain what the tool checks and what data it collects
- The run page must show collection progress in real time
- The report page must separate summary from detailed evidence
- Severe findings must be understandable without technical background
- Raw evidence must remain accessible for advanced users

## 12. Privacy Requirements

- The product must disclose collected data before a session starts
- Raw network artifacts must have a retention limit
- Report links should expire by default
- Sensitive raw values should be redacted where possible in public share flows

## 13. Success Metrics

- Successful report generation rate
- Median test completion time
- False-positive rate based on manual review samples
- Percentage of sessions with actionable findings
- DNS and WebRTC module completion rate by browser family

## 14. Delivery Phases

### Phase 1

- Session lifecycle
- Browser collector shell
- HTTP IP detection
- Timezone consistency
- Basic report page

### Phase 2

- Authoritative DNS logging
- DNS correlation rules
- Multi-region STUN deployment
- WebRTC leak detection

### Phase 3

- Device authenticity scoring
- User-Agent authenticity scoring
- Expanded rule catalog
- JSON export

### Phase 4

- Production hardening
- Admin dashboard
- Public API
- Batch execution support
