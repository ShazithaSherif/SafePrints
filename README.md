# SafePrints

Zero-Knowledge Encrypted Document Printing Relay

SafePrints eliminates the privacy risks of sharing sensitive documents (identification cards, resumes, financial records, and academic reports) via messaging apps or email at public print shops. Instead of downloading files onto a shop computer, customers pair directly from their mobile browser, encrypt documents locally, and stream them through a volatile memory relay that shreds data immediately after printing.

- Customer Portal: https://safeprints.onrender.com
- Counter Terminal: https://safeprints.onrender.com/shop

---

## Problem Statement

Standard messaging platforms do not prevent print shop operators from downloading PDFs or documents onto local storage, leaving sensitive personal files indefinitely in Downloads folders and system recycle bins. SafePrints enforces a zero-disk, zero-preview workflow controlled entirely from the customer's device.

## Core Capabilities

- QR Code and Session PIN Pairing: Counter terminals generate a unique, rotating 4-digit session PIN and scannable QR code for instant WebSocket pairing without user registration.
- Client-Side AES-256-GCM Encryption: Single or multi-file batches (PDF, PNG, JPEG) are encrypted inside the customer's browser using the Web Crypto API prior to network transmission.
- Volatile RAM-Only Relay: The Node.js and Socket.io backend routes encrypted buffers strictly in volatile memory, ensuring zero files are written to server disk or local counter storage.
- Protected Print Mode Shield: During print execution, a full-screen security overlay masks the counter terminal display to prevent unauthorized visual capture while buffers are decrypted, dispatched, and overwritten with zeros.
- Instant Customer Revocation: Customers retain session control and can terminate and purge unprinted payloads from server memory at any time.
- Real-Time Telemetry Dashboard (/stats): Provides live metrics on portal traffic, active counter terminals, paired sessions, and completed print-and-wipe operations without logging document contents or filenames.

---

## System Architecture

```text
+--------------------+     1. Scan QR / Enter 4-Digit PIN     +-------------------------+

|   Customer Phone   | -------------------------------------> | Counter Terminal (/shop)|
+--------------------+                                        +-------------------------+

          |                                                                |
 2. Encrypt Locally                                                        |
  (Web Crypto AES-256)                                                     |
          v                                                                v
+---------------------------------+   3. Release & Protected Mode   +-------------------+

| Node.js + Socket.io RAM Relay   | ------------------------------> | Decrypt & Shred   |
+---------------------------------+                                 +-------------------+
```

---

## Technology Stack

- Backend Runtime: Node.js, Express, Socket.io
- Cryptography and Security: Web Crypto API (AES-256-GCM), Volatile RAM Buffer Zero-Filling
- QR Code Processing: qrcode (server-side generation), html5-qrcode (client camera scanner)
- Frontend: Responsive HTML5, CSS3, Vanilla JavaScript

---

## Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/ShazithaSherif/SafePrints
   cd SafePrints
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the application:
   ```bash
   npm start
   ```

4. Access local endpoints:
   - Customer Portal: http://localhost:3000
   - Counter Terminal: http://localhost:3000/shop
   - Telemetry Dashboard: http://localhost:3000/stats?key=safeprint123

---

Created by shazithasherif
