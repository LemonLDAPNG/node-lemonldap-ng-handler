/**
 * Tests for CAS ticket generation
 */

import {
  generateServiceTicket,
  generateProxyTicket,
  generatePGT,
  generatePGTIOU,
  isValidTicketFormat,
  isValidPGTIOUFormat,
  getTicketType,
} from "./ticket";

describe("CAS Ticket Generation", () => {
  describe("generateServiceTicket", () => {
    it("should generate a ticket starting with ST-", () => {
      const ticket = generateServiceTicket();
      expect(ticket).toMatch(/^ST-[a-f0-9-]{36}$/);
    });

    it("should generate unique tickets", () => {
      const tickets = new Set<string>();
      for (let i = 0; i < 100; i++) {
        tickets.add(generateServiceTicket());
      }
      expect(tickets.size).toBe(100);
    });
  });

  describe("generateProxyTicket", () => {
    it("should generate a ticket starting with PT-", () => {
      const ticket = generateProxyTicket();
      expect(ticket).toMatch(/^PT-[a-f0-9-]{36}$/);
    });

    it("should generate unique tickets", () => {
      const tickets = new Set<string>();
      for (let i = 0; i < 100; i++) {
        tickets.add(generateProxyTicket());
      }
      expect(tickets.size).toBe(100);
    });
  });

  describe("generatePGT", () => {
    it("should generate a ticket starting with PGT-", () => {
      const pgt = generatePGT();
      expect(pgt).toMatch(/^PGT-[a-f0-9-]{36}$/);
    });

    it("should generate unique tickets", () => {
      const tickets = new Set<string>();
      for (let i = 0; i < 100; i++) {
        tickets.add(generatePGT());
      }
      expect(tickets.size).toBe(100);
    });
  });

  describe("generatePGTIOU", () => {
    it("should generate a PGTIOU starting with PGTIOU-", () => {
      const pgtiou = generatePGTIOU();
      expect(pgtiou).toMatch(/^PGTIOU-[a-f0-9-]{36}$/);
    });

    it("should generate unique PGTIOUs", () => {
      const ious = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ious.add(generatePGTIOU());
      }
      expect(ious.size).toBe(100);
    });
  });

  describe("isValidTicketFormat", () => {
    it("should validate ST tickets", () => {
      expect(
        isValidTicketFormat("ST-12345678-1234-1234-1234-123456789012"),
      ).toBe(true);
      expect(
        isValidTicketFormat("ST-abcdef01-2345-6789-abcd-ef0123456789"),
      ).toBe(true);
    });

    it("should validate PT tickets", () => {
      expect(
        isValidTicketFormat("PT-12345678-1234-1234-1234-123456789012"),
      ).toBe(true);
    });

    it("should validate PGT tickets", () => {
      expect(
        isValidTicketFormat("PGT-12345678-1234-1234-1234-123456789012"),
      ).toBe(true);
    });

    it("should reject invalid tickets", () => {
      expect(isValidTicketFormat("")).toBe(false);
      expect(isValidTicketFormat("invalid")).toBe(false);
      expect(isValidTicketFormat("ST-invalid")).toBe(false);
      expect(
        isValidTicketFormat("PGTIOU-12345678-1234-1234-1234-123456789012"),
      ).toBe(false);
      expect(
        isValidTicketFormat("XX-12345678-1234-1234-1234-123456789012"),
      ).toBe(false);
    });

    it("should validate with expected type", () => {
      const st = "ST-12345678-1234-1234-1234-123456789012";
      expect(isValidTicketFormat(st, "ST")).toBe(true);
      expect(isValidTicketFormat(st, "PT")).toBe(false);
      expect(isValidTicketFormat(st, "PGT")).toBe(false);
    });
  });

  describe("isValidPGTIOUFormat", () => {
    it("should validate PGTIOU format", () => {
      expect(
        isValidPGTIOUFormat("PGTIOU-12345678-1234-1234-1234-123456789012"),
      ).toBe(true);
      expect(
        isValidPGTIOUFormat("PGTIOU-abcdef01-2345-6789-abcd-ef0123456789"),
      ).toBe(true);
    });

    it("should reject invalid PGTIOU", () => {
      expect(isValidPGTIOUFormat("")).toBe(false);
      expect(isValidPGTIOUFormat("PGTIOU-invalid")).toBe(false);
      expect(
        isValidPGTIOUFormat("ST-12345678-1234-1234-1234-123456789012"),
      ).toBe(false);
      expect(
        isValidPGTIOUFormat("PGT-12345678-1234-1234-1234-123456789012"),
      ).toBe(false);
    });
  });

  describe("getTicketType", () => {
    it("should extract ticket type", () => {
      expect(getTicketType("ST-12345678-1234-1234-1234-123456789012")).toBe(
        "ST",
      );
      expect(getTicketType("PT-12345678-1234-1234-1234-123456789012")).toBe(
        "PT",
      );
      expect(getTicketType("PGT-12345678-1234-1234-1234-123456789012")).toBe(
        "PGT",
      );
    });

    it("should return null for invalid tickets", () => {
      expect(getTicketType("")).toBe(null);
      expect(getTicketType("invalid")).toBe(null);
      expect(getTicketType("PGTIOU-12345678-1234-1234-1234-123456789012")).toBe(
        null,
      );
    });
  });
});
