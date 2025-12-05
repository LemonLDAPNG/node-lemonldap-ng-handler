import nunjucks from "nunjucks";
import path from "path";
import type { TemplateContext } from "../types";

/**
 * Nunjucks template engine wrapper
 */
export class TemplateEngine {
  private env: nunjucks.Environment;

  constructor(viewsPath?: string) {
    const templatesDir = viewsPath || path.join(__dirname, "views");

    const loader = new nunjucks.FileSystemLoader(templatesDir, {
      watch: false,
      noCache: process.env.NODE_ENV === "development",
    });

    this.env = new nunjucks.Environment(loader, {
      autoescape: true,
      throwOnUndefined: false,
      trimBlocks: true,
      lstripBlocks: true,
    });

    this.addFilters();
  }

  /**
   * Add custom filters
   */
  private addFilters(): void {
    // Translate filter (placeholder for i18n)
    this.env.addFilter("translate", (key: string, _lang?: string): string => {
      // TODO: implement i18n
      return key;
    });

    // JSON encode filter
    this.env.addFilter("jsonEncode", (value: any) => {
      return JSON.stringify(value);
    });

    // HTML attribute escape
    this.env.addFilter("attrEscape", (value: string) => {
      if (!value) return "";
      return value
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    });
  }

  /**
   * Render a template with context
   */
  render(template: string, context: TemplateContext = {}): string {
    const templateFile = template.endsWith(".njk")
      ? template
      : `${template}.njk`;
    const result = this.env.render(templateFile, context);
    return result ?? "";
  }

  /**
   * Render template string directly
   */
  renderString(template: string, context: TemplateContext = {}): string {
    const result = this.env.renderString(template, context);
    return result ?? "";
  }
}

export default TemplateEngine;
