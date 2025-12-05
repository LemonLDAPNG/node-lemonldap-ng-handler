import { TemplateEngine } from "../templates/engine";
import path from "path";

describe("TemplateEngine", () => {
  let engine: TemplateEngine;

  beforeAll(() => {
    const viewsPath = path.join(__dirname, "../templates/views");
    engine = new TemplateEngine(viewsPath);
  });

  it("should render login template", () => {
    const html = engine.render("login", {
      PORTAL: "/",
    });
    expect(html).toContain("<form");
    expect(html).toContain("user");
    expect(html).toContain("password");
  });

  it("should render login template with error", () => {
    const html = engine.render("login", {
      PORTAL: "/",
      AUTH_ERROR: "Bad credentials",
      AUTH_ERROR_CODE: "PE_BADCREDENTIALS",
      LOGIN: "testuser",
    });
    expect(html).toContain("Bad credentials");
    expect(html).toContain('value="testuser"');
  });

  it("should render error template", () => {
    const html = engine.render("error", {
      error: "Something went wrong",
      errorCode: "TEST_ERROR",
    });
    expect(html).toContain("Something went wrong");
    expect(html).toContain("TEST_ERROR");
  });

  it("should render menu template with session", () => {
    const html = engine.render("menu", {
      session: {
        _session_id: "test123",
        _utime: Date.now() / 1000,
        uid: "testuser",
        cn: "Test User",
        mail: "test@example.com",
      },
    });
    expect(html).toContain("testuser");
    expect(html).toContain("logout");
  });
});

describe("Template filters", () => {
  let engine: TemplateEngine;

  beforeAll(() => {
    const viewsPath = path.join(__dirname, "../templates/views");
    engine = new TemplateEngine(viewsPath);
  });

  it("should escape HTML attributes with safe filter", () => {
    // attrEscape + safe to avoid double escaping by nunjucks autoescape
    const result = engine.renderString("{{ val | attrEscape | safe }}", {
      val: 'test"value&here',
    });
    expect(result).toBe("test&quot;value&amp;here");
  });

  it("should JSON encode values with safe filter", () => {
    // jsonEncode + safe to avoid escaping the JSON quotes
    const result = engine.renderString("{{ val | jsonEncode | safe }}", {
      val: { key: "value" },
    });
    expect(result).toBe('{"key":"value"}');
  });
});
