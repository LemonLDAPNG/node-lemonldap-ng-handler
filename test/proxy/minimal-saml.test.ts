// Minimal SAML test to isolate Jest crash
import { createSAMLOIDCTestbed, ProxyTestbed } from "./helpers/portal-factory";

// Check if lasso.js is available
let lassoAvailable = false;
try {
  require("lasso.js");
  lassoAvailable = true;
  console.log("lasso.js loaded in Jest");
} catch (err) {
  console.log("lasso.js not available:", err);
}

const describeIfLasso = lassoAvailable ? describe : describe.skip;

describeIfLasso("Minimal SAML Test", () => {
  let testbed: ProxyTestbed;

  beforeAll(async () => {
    console.log("Creating SAML-OIDC testbed...");
    testbed = await createSAMLOIDCTestbed(100);
    console.log("Testbed created");
    await testbed.start();
    console.log("Testbed started");
  }, 30000);

  afterAll(async () => {
    if (testbed) {
      await testbed.stop();
      console.log("Testbed stopped");
    }
  });

  it("should load lasso.js", () => {
    const lasso = require("lasso.js");
    expect(lasso.Server).toBeDefined();
    expect(lasso.Login).toBeDefined();
  });

  it("should have created testbed", () => {
    expect(testbed).toBeDefined();
    expect(testbed.idp).toBeDefined();
    expect(testbed.proxy).toBeDefined();
    expect(testbed.sp).toBeDefined();
  });
});
